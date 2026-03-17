# WFD Renewal Risk Detection System

A full-stack take-home exercise implementing a **Renewal Risk Detection API** and a **React dashboard** for a residential property management platform.

---

## Architecture Overview

```
wfd-sr-full-stack/
├── backend/          # Node.js + Express + Prisma + PostgreSQL
│   ├── prisma/       # Schema, migrations, seed data
│   └── src/          # Routes, services, workers
└── frontend/         # Vite + React + TypeScript + Tailwind CSS
    └── src/          # Pages, components, hooks, types
```

### Key Design Decisions

| Concern | Solution |
|---|---|
| Risk scoring | Weighted signal engine (`riskScore` in [0,1]) → tiered as *high / medium / low* |
| Webhook delivery | Persistent `WebhookDeliveryLog` table, exponential back-off worker, dead-letter queue after 3 failures |
| Type safety | Zod schemas at API boundaries — shared between runtime validation and TS inference |
| Data freshness | Scores are recalculated on-demand via `POST /renewal-risk/batch` and cached in DB |

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- PostgreSQL 14+
- npm (or pnpm/yarn)

### 1. Database

```bash
createdb rop_db
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # edit DATABASE_URL and RMS_ENDPOINT
npm install
npm run db:generate       # generate Prisma client
npx prisma migrate dev    # run migrations
npm run seed              # load sample property + residents
npm run dev               # start on :3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env      # set VITE_PROPERTY_ID (from seed output)
npm install
npm run dev               # start on :5173
```

Open <http://localhost:5173>. Click **Run Risk Calculation** to score all residents and populate the dashboard.

---

## API Summary

All routes are prefixed `/api/v1`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/properties/:id/renewal-risk` | Paginated risk scores (filter by tier, date) |
| `POST` | `/properties/:id/renewal-risk/batch` | Trigger fresh scoring run |
| `GET` | `/properties/:id/webhooks` | Webhook delivery log (filter by status) |
| `POST` | `/webhooks/:id/retry` | Manually retry a failed delivery |

See [`backend/README.md`](./backend/README.md) for full API documentation.

---

## Testing the Webhook Flow

1. Create a free endpoint at [webhook.site](https://webhook.site) and paste the URL into `RMS_ENDPOINT`.
2. Run `POST /api/v1/properties/:id/renewal-risk/batch`.
3. High- and medium-risk events are dispatched to your endpoint.
4. The delivery log is visible via `GET /api/v1/properties/:id/webhooks` and in the dashboard Webhook panel.
