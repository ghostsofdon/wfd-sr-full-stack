# Backend User Stories — Renewal Risk Detection System (ROP)

> **Stack:** Node.js + TypeScript · Express · Prisma (or TypeORM) · PostgreSQL  
> **Bundle:** `@essentials`  
> **Key Individual Skills:** `backend-dev-guidelines` · `database-design` · `prisma-expert` · `postgresql` · `postgresql-optimization` · `fastapi-pro` (pattern reference) · `api-endpoint-builder` · `api-design-principles` · `nodejs-backend-patterns` · `bullmq-specialist` · `error-handling-patterns` · `zod-validation-expert` · `docker-expert`

---

## Architecture Decisions (applies to all stories)

| Decision | Choice | Rationale |
|---|---|---|
| ORM | Prisma | Type-safe schema + migrations; easier to document; native PostgreSQL features |
| Runtime | Node.js 20 LTS + TypeScript strict | Project requirement, type safety |
| Transport | Express 4 + zod validation middleware | Lightweight, well-known, easy to test |
| Background queue | In-process retry with `node-cron` (MVP) / BullMQ (production path) | See BS-05 |
| Multi-tenancy | `property_id` on every table, enforced by query middleware | Row-level isolation without separate schemas |
| Idempotency | `event_id` unique constraint + DB upsert on webhook delivery | Prevents duplicate RMS deliveries |
| Concurrency guard | PostgreSQL advisory locks per property during batch run | Prevents duplicate batch jobs |

---

## Epic 1 — Database Schema

### BS-01 — Design and Migrate Renewal Risk Score Table

**As a** backend system,  
**I want** a `renewal_risk_scores` table that stores a point-in-time risk score per resident,  
**so that** the API can serve historical and current risk data without recalculating on every request.

#### Acceptance Criteria
- [ ] Migration creates `renewal_risk_scores` with columns: `id (UUID PK)`, `property_id (UUID FK → properties)`, `resident_id (UUID FK → residents)`, `lease_id (UUID FK → leases)`, `risk_score (INT 0–100)`, `risk_tier (VARCHAR: high|medium|low)`, `calculated_at (TIMESTAMP)`, `as_of_date (DATE)`, `created_at`, `updated_at`
- [ ] Composite index on `(property_id, as_of_date DESC)` to support the "get latest scores for property" query efficiently
- [ ] Composite index on `(resident_id, calculated_at DESC)` for resident-level history
- [ ] Unique constraint on `(resident_id, as_of_date)` — one score per resident per calculation date
- [ ] Migration is idempotent (can be re-run safely)
- [ ] README documents the rationale: "point-in-time snapshot for auditability; query pattern is always per-property + date"

#### Implementation Notes
- Do NOT store computed risk tier separately unless you plan to re-use it outside the calculation; derive it from `risk_score` in the service layer or store both for query ease (acceptable trade-off).
- Month-to-month residents get `as_of_date` set to `CURRENT_DATE`; the score calculation treats them as 30-day-to-expiry.

**Skills to use:** `prisma-expert` · `postgresql` · `database-design`

---

### BS-02 — Design and Migrate Risk Signals Table

**As a** backend system,  
**I want** a `risk_signals` table that stores the individual input values used to compute a risk score,  
**so that** property managers and engineers can audit *why* a resident was flagged at any point in time.

#### Acceptance Criteria
- [ ] Migration creates `risk_signals` with columns: `id (UUID PK)`, `risk_score_id (UUID FK → renewal_risk_scores)`, `property_id (UUID FK)`, `resident_id (UUID FK)`, `days_to_expiry (INT)`, `payment_history_delinquent (BOOLEAN)`, `no_renewal_offer_yet (BOOLEAN)`, `rent_growth_above_market (BOOLEAN)`, `current_rent (DECIMAL 10,2)`, `market_rent (DECIMAL 10,2)`, `rent_delta_pct (DECIMAL 5,2)`, `recorded_at (TIMESTAMP)`, `created_at`
- [ ] FK to `renewal_risk_scores` with CASCADE DELETE (signals meaningless without parent score)
- [ ] Index on `(risk_score_id)` for JOIN performance
- [ ] One-to-one relationship enforced: `UNIQUE(risk_score_id)`
- [ ] If market rent data is unavailable, `market_rent` is NULL and `rent_growth_above_market` defaults to FALSE; this is documented in README

**Skills to use:** `prisma-expert` · `database-design` · `postgresql`

---

### BS-03 — Design and Migrate Webhook Delivery State Tables

**As a** backend system,  
**I want** `webhook_delivery_log` and `webhook_dead_letter_queue` tables,  
**so that** every webhook attempt is traceable, retryable, and auditable with full ACID guarantees.

#### Acceptance Criteria
**`webhook_delivery_log`**
- [ ] Columns: `id (UUID PK)`, `event_id (VARCHAR UNIQUE — idempotency key)`, `property_id (UUID FK)`, `resident_id (UUID FK)`, `event_type (VARCHAR)`, `payload (JSONB)`, `status (VARCHAR: pending|delivering|delivered|failed|dlq)`, `attempt_count (INT DEFAULT 0)`, `last_attempt_at (TIMESTAMP)`, `next_retry_at (TIMESTAMP)`, `rms_response_status (INT)`, `rms_response_body (TEXT)`, `created_at`, `updated_at`
- [ ] Index on `(status, next_retry_at)` — critical for the retry poller query
- [ ] Index on `(property_id, created_at DESC)` — for dashboard webhook history
- [ ] `event_id` is globally unique (UNIQUE constraint) for idempotency

**`webhook_dead_letter_queue`**  
- [ ] Columns: `id (UUID PK)`, `webhook_delivery_log_id (UUID FK)`, `reason (TEXT)`, `moved_at (TIMESTAMP DEFAULT NOW())`, `created_at`
- [ ] FK with NO ACTION (keep DLQ records even if delivery log is deleted for audit)

- [ ] A DB transaction updates `webhook_delivery_log` status AND inserts to DLQ atomically

**Skills to use:** `prisma-expert` · `postgresql` · `database-design` · `error-handling-patterns`

---

## Epic 2 — Renewal Risk Scoring API

### BS-04 — Implement POST /api/v1/properties/:propertyId/renewal-risk/calculate

**As a** property manager or scheduler,  
**I want** to trigger a renewal risk batch calculation for a single property,  
**so that** I receive a summary of all at-risk residents along with their scores and signals.

#### Acceptance Criteria
- [ ] Endpoint: `POST /api/v1/properties/:propertyId/renewal-risk/calculate`
- [ ] Request body validated with Zod: `{ propertyId: string (UUID), asOfDate: string (YYYY-MM-DD, optional — defaults to TODAY) }`
- [ ] Validates that `propertyId` in URL matches body (or ignores body field and uses URL param — document the choice)
- [ ] Returns 404 if property does not exist
- [ ] Returns 400 with structured error if body is malformed
- [ ] Returns 200 with the exact response shape from the spec (see `renewal_risk_takehome.md` §2)
- [ ] Only residents with `status = 'active'` and leases with `status = 'active'` are included
- [ ] Month-to-month residents (`lease_type = 'month_to_month'`) are included with `daysToExpiry = 30` (documented decision)
- [ ] Residents whose lease has already expired (`lease_end_date < asOfDate`) are excluded and logged
- [ ] Residents with no active lease are excluded
- [ ] **Concurrency guard:** uses a PostgreSQL advisory lock keyed to `property_id` so two simultaneous calls don't produce duplicate score rows — returns 409 Conflict if lock cannot be acquired
- [ ] Query is done in a single SQL pass (JOIN across `leases`, `residents`, `renewal_offers`, `unit_pricing`, `resident_ledger`) — no N+1
- [ ] Scores and signals persisted to DB within the same transaction as the response
- [ ] Minimum viable performance: completes for 5000 residents in < 5 seconds (document the query plan)

#### Risk Scoring Logic
```
score = 0
daysToExpiry      → map to 0–40 pts: ≤30d = 40, 31–60d = 30, 61–90d = 20, >90d = 0
paymentDelinquent → 25 pts if TRUE, 0 pts if FALSE
  (delinquent = any charge with no matching payment in the same month in last 6 months)
noRenewalOffer    → 20 pts if no active renewal_offer, 0 pts if one exists
rentGrowthAbove   → 15 pts if market_rent > current monthly_rent * 1.05, else 0
tier              → score ≥ 70 = high; 40–69 = medium; < 40 = low
```
- [ ] Scoring helper is a pure function in `src/services/riskScoring.ts` — unit testable with no DB dependency
- [ ] Only residents with `score ≥ 40` (medium or high) are returned in `flags[]`; all residents count toward `totalResidents`

**Skills to use:** `api-endpoint-builder` · `api-design-principles` · `zod-validation-expert` · `nodejs-backend-patterns` · `postgresql-optimization` · `error-handling-patterns`

---

### BS-05 — Implement GET /api/v1/properties/:propertyId/renewal-risk

**As a** React dashboard,  
**I want** to fetch the most recent risk scores for a property,  
**so that** I can display residents at risk without re-triggering the calculation.

#### Acceptance Criteria
- [ ] Endpoint: `GET /api/v1/properties/:propertyId/renewal-risk`
- [ ] Returns the latest `renewal_risk_scores` + `risk_signals` rows per resident for the property (most recent `calculated_at`)
- [ ] Query uses a subquery/CTE to get max `calculated_at` per resident, not a full table scan
- [ ] Response shape:
```json
{
  "propertyId": "...",
  "calculatedAt": "...",
  "residents": [
    {
      "residentId": "...",
      "name": "...",
      "unitId": "...",
      "riskScore": 85,
      "riskTier": "high",
      "daysToExpiry": 45,
      "signals": { ... }
    }
  ]
}
```
- [ ] Returns 200 with empty `residents: []` if no scores have been calculated yet (not 404)
- [ ] Returns 404 if property does not exist
- [ ] Supports optional query param `?tier=high|medium|low` for filtering (future-proof, not required for MVP)
- [ ] Includes pagination headers (`X-Total-Count`) for large properties

**Skills to use:** `api-endpoint-builder` · `postgresql-optimization` · `nodejs-backend-patterns`

---

## Epic 3 — Webhook Delivery System

### BS-06 — Implement POST /api/v1/properties/:propertyId/residents/:residentId/renewal-event

**As a** property manager clicking "Trigger Renewal Event",  
**I want** the backend to create a renewal event record and immediately attempt webhook delivery to the RMS,  
**so that** the revenue management system is notified in near real-time.

#### Acceptance Criteria
- [ ] Endpoint: `POST /api/v1/properties/:propertyId/residents/:residentId/renewal-event`
- [ ] Validates both `propertyId` and `residentId` exist; returns 404 if either missing
- [ ] Looks up the latest risk score for the resident; returns 422 if no risk score exists yet (must calculate first)
- [ ] Creates a `webhook_delivery_log` row with `status = 'pending'` **before** attempting delivery (within a DB transaction)
- [ ] Generates a deterministic `event_id`:  `sha256(residentId + propertyId + riskScoreId)` — idempotent: same resident+score + property → same `event_id`; second call returns 200 with existing delivery state without re-triggering
- [ ] Immediately attempts HTTP POST to `RMS_ENDPOINT` (env var) with the webhook payload (spec §4)
- [ ] On success (HTTP 2xx from RMS): updates `status = 'delivered'`, stores `rms_response_status`, returns 200
- [ ] On failure: updates `status = 'failed'`, increments `attempt_count`, sets `next_retry_at = NOW() + interval`, returns 202 Accepted (delivery in progress, not yet confirmed)
- [ ] Webhook payload includes `X-ROP-Signature: sha256-hmac(payload, WEBHOOK_SECRET)` header for RMS to verify authenticity
- [ ] Response includes `{ eventId, status, attemptCount }` so the frontend can poll if needed

**Skills to use:** `api-endpoint-builder` · `error-handling-patterns` · `nodejs-backend-patterns` · `zod-validation-expert`

---

### BS-07 — Implement Webhook Retry Worker with Exponential Backoff

**As a** backend system,  
**I want** a background worker that retries failed webhook deliveries with exponential backoff,  
**so that** transient RMS outages do not result in lost delivery events.

#### Acceptance Criteria
- [ ] Worker polls `webhook_delivery_log WHERE status = 'failed' AND next_retry_at <= NOW() AND attempt_count < 5` every 5 seconds
- [ ] Exponential backoff: retry delay = `2^(attempt_count - 1)` seconds → 1s, 2s, 4s, 8s, 16s
- [ ] On each attempt: updates `last_attempt_at = NOW()` and `next_retry_at = NOW() + next_delay` atomically
- [ ] On success: sets `status = 'delivered'`
- [ ] On 5th failure: sets `status = 'dlq'` AND inserts a row in `webhook_dead_letter_queue` atomically (single transaction)
- [ ] Worker is idempotent: uses `SELECT ... FOR UPDATE SKIP LOCKED` to prevent two worker instances from picking the same row
- [ ] Worker logs every attempt (structured JSON: `{ event_id, attempt, status, rms_response }`)
- [ ] MVP implementation: `node-cron` based in-process worker; documented upgrade path to BullMQ for production

**Skills to use:** `bullmq-specialist` · `error-handling-patterns` · `nodejs-backend-patterns` · `postgresql-optimization`

---

### BS-08 — Implement Dead Letter Queue Review Endpoint

**As an** operations engineer,  
**I want** to query failed webhook events that have been moved to the DLQ,  
**so that** I can inspect failures and manually re-trigger delivery if necessary.

#### Acceptance Criteria
- [ ] Endpoint: `GET /api/v1/webhook/dlq` (optionally filtered by `?propertyId=`)
- [ ] Returns list of DLQ entries with full payload and failure reason
- [ ] Endpoint: `POST /api/v1/webhook/dlq/:id/retry` — resets `status = 'pending'`, `attempt_count = 0`, removes from DLQ, triggers immediate retry
- [ ] Admin-only (documented with note that auth middleware would guard this in production)

**Skills to use:** `api-endpoint-builder` · `error-handling-patterns`

---

## Epic 4 — Infrastructure & Quality

### BS-09 — Local Development Setup with Docker Compose

**As a** developer,  
**I want** a single `docker-compose up` command to stand up the entire backend and database,  
**so that** the evaluator can run the system without configuring local PostgreSQL.

#### Acceptance Criteria
- [ ] `docker-compose.yml` at project root defines: `db` (postgres:16), `backend` (Node.js service)
- [ ] Environment variables: `DATABASE_URL`, `RMS_ENDPOINT`, `WEBHOOK_SECRET`, `PORT`
- [ ] `backend` service runs `prisma migrate deploy && node dist/index.js` on start
- [ ] `npm run seed` (or `docker-compose run backend npm run seed`) runs `seed.sql` against the DB
- [ ] `backend/README.md` documents every env variable and provides `.env.example`
- [ ] Health check endpoint: `GET /health` returns `{ status: 'ok', db: 'connected' }` — used by docker healthcheck directive

**Skills to use:** `docker-expert` · `nodejs-backend-patterns`

---

### BS-10 — Seed Script with Realistic Test Data

**As a** developer evaluating the system,  
**I want** a seed script that creates representative test residents with varied risk profiles,  
**so that** I can verify the scoring logic produces meaningful results.

#### Acceptance Criteria
- [ ] Seed script creates exactly the 4 scenarios from `seed_and_testing.md`:
  - Resident 1 (Jane Doe): HIGH risk (45d to expiry, no offer, below-market rent)
  - Resident 2 (John Smith): MEDIUM risk (60d, missed payment)
  - Resident 3 (Alice Johnson): LOW risk (180d, renewal offer sent)
  - Resident 4 (Bob Williams): MEDIUM risk (month-to-month)
- [ ] Seed is idempotent (uses `ON CONFLICT DO NOTHING` or checks existence)
- [ ] Script outputs the `propertyId` so the evaluator can immediately call the API

**Skills to use:** `database-design` · `prisma-expert`

---

### BS-11 — Error Handling and Edge Case Documentation

**As a** code reviewer,  
**I want** consistent, structured error responses and documented edge case handling,  
**so that** the API is predictable and production-safe.

#### Acceptance Criteria
- [ ] All errors return `{ error: string, code: string, details?: object }` shape
- [ ] Edge cases handled and documented in `backend/README.md`:
  - RMS endpoint unreachable → 202 + retry scheduled, logged
  - Resident lease already expired → excluded from score, logged as `warn`
  - No market rent data → `rent_growth_above_market = false`, `market_rent = null`
  - Batch job triggered twice simultaneously → advisory lock returns 409 Conflict
- [ ] `src/middleware/errorHandler.ts` catches unhandled errors and returns 500 with structured body (no stack traces in response)
- [ ] All DB queries wrapped in try/catch with specific error logging

**Skills to use:** `error-handling-patterns` · `nodejs-backend-patterns` · `zod-validation-expert`

---

## Story Map Summary

```
Epic 1: Schema
  BS-01  renewal_risk_scores table + indexes
  BS-02  risk_signals table (1:1 with scores)
  BS-03  webhook_delivery_log + webhook_dead_letter_queue

Epic 2: Risk API
  BS-04  POST /renewal-risk/calculate  ← core scoring batch
  BS-05  GET  /renewal-risk            ← read latest scores

Epic 3: Webhooks
  BS-06  POST /renewal-event           ← trigger + first attempt
  BS-07  Background retry worker       ← exponential backoff + DLQ
  BS-08  GET/POST /webhook/dlq         ← ops visibility

Epic 4: Infrastructure
  BS-09  Docker Compose local setup
  BS-10  Seed script
  BS-11  Error handling + docs
```

---

## API Contract Quick Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/properties/:pid/renewal-risk/calculate` | — | Trigger batch score calculation |
| GET | `/api/v1/properties/:pid/renewal-risk` | — | Fetch latest risk scores |
| POST | `/api/v1/properties/:pid/residents/:rid/renewal-event` | — | Trigger webhook delivery |
| GET | `/api/v1/webhook/dlq` | admin | List DLQ entries |
| POST | `/api/v1/webhook/dlq/:id/retry` | admin | Re-queue a DLQ entry |
| GET | `/health` | — | Health check |

---

*Context files: `renewal_risk_takehome.md` · `starter_schema.sql` · `seed_and_testing.md`*
