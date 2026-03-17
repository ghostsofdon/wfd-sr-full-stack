# Backend — Renewal Risk Detection API

Node.js · Express · Prisma · PostgreSQL · TypeScript

---

## Setup

```bash
cp .env.example .env
npm install
npm run db:generate        # generate Prisma client
npx prisma migrate dev     # run all migrations
npm run seed               # seed sample property + residents
npm run dev                # start dev server on PORT (default 3001)
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | ❌ | `3001` | HTTP server port |
| `RMS_ENDPOINT` | ✅ | — | Webhook delivery target URL |
| `WEBHOOK_SECRET` | ✅ | — | HMAC-SHA256 signing secret |
| `NODE_ENV` | ❌ | `development` | `development` or `production` |

---

## Project Structure

```
src/
├── index.ts                  # Express app bootstrap + cron scheduler
├── lib/
│   └── prisma.ts             # Singleton Prisma client
├── middleware/
│   └── errorHandler.ts       # Global error handler
├── routes/
│   ├── renewalRisk.ts        # /renewal-risk and /renewal-risk/batch
│   └── webhooks.ts           # /webhooks and /webhooks/:id/retry
├── services/
│   ├── riskEngine.ts         # Weighted signal scoring
│   └── webhookService.ts     # Event publishing + retry logic
└── workers/
    └── webhookWorker.ts      # Background delivery worker (cron every 10s)
```

---

## API Reference

All routes are prefixed `/api/v1`.

### GET `/properties/:propertyId/renewal-risk`

Returns paginated, cached risk scores for all active residents.

**Query params**

| Param | Type | Description |
|---|---|---|
| `tier` | `high \| medium \| low` | Filter by risk tier |
| `limit` | `number` | Page size (default 50, max 200) |
| `offset` | `number` | Pagination offset |
| `as_of_date` | `YYYY-MM-DD` | Return scores calculated on this date |

**Response 200**
```json
{
  "property_id": "...",
  "total": 12,
  "limit": 50,
  "offset": 0,
  "results": [
    {
      "id": "...",
      "resident_id": "...",
      "resident_name": "Jane Smith",
      "resident_email": "jane@example.com",
      "unit_id": "101A",
      "risk_score": 0.82,
      "risk_tier": "high",
      "calculated_at": "2024-11-01T12:00:00.000Z",
      "as_of_date": "2024-11-01",
      "signals": {
        "days_to_expiry": 25,
        "payment_history_delinquent": true,
        "no_renewal_offer_yet": true,
        "rent_growth_above_market": false,
        "current_rent": 1800,
        "market_rent": 1750,
        "rent_delta_pct": 2.86
      }
    }
  ]
}
```

---

### POST `/properties/:propertyId/renewal-risk/batch`

Scores all active residents and queues webhook events for high/medium-risk residents.

**Query params** (optional): `as_of_date=YYYY-MM-DD`

**Response 200**
```json
{
  "message": "Batch scoring complete",
  "property_id": "...",
  "as_of_date": "2024-11-01",
  "processed": 12,
  "highRisk": 3,
  "mediumRisk": 4,
  "lowRisk": 5,
  "webhooksQueued": 7
}
```

---

### GET `/properties/:propertyId/webhooks`

Returns paginated webhook delivery log.

**Query params**: `status` (`pending | delivered | failed | dlq`), `limit`, `offset`

**Response 200**
```json
{
  "property_id": "...",
  "total": 7,
  "limit": 50,
  "offset": 0,
  "results": [
    {
      "id": "...",
      "event_id": "...",
      "resident_id": "...",
      "resident_name": "Jane Smith",
      "event_type": "HIGH_RISK_RENEWAL",
      "status": "delivered",
      "attempt_count": 1,
      "last_attempt_at": "2024-11-01T12:00:05.000Z",
      "next_retry_at": null,
      "rms_response_status": 200,
      "created_at": "2024-11-01T12:00:00.000Z",
      "dlq_reason": null
    }
  ]
}
```

---

### POST `/webhooks/:webhookId/retry`

Manually moves a `failed` or `dlq` webhook back to `pending` for re-delivery.

---

## Risk Scoring Model

Signals and their weights:

| Signal | Weight |
|---|---|
| Days to expiry ≤ 60 | +30 |
| Payment delinquency | +35 |
| No renewal offer | +20 |
| Rent growth > market | +15 |

`riskScore = totalWeight / 100` (capped at 1.0)

Tiers: **high** (≥ 0.65) · **medium** (≥ 0.30) · **low** (< 0.30)

---

## Webhook Delivery

- Worker polls every 10 seconds for `pending` webhooks.
- Exponential back-off: retries at 1 min → 5 min → 15 min.
- After 3 failures, status moves to **DLQ** (dead letter queue).
- Manual retry resets status to `pending`.
- Payload is signed with HMAC-SHA256; signature is in the `X-WFD-Signature` header.
