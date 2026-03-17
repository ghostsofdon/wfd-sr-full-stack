# Frontend — Renewal Risk Dashboard

Vite · React 18 · TypeScript · Tailwind CSS · TanStack Query · React Router

---

## Setup

```bash
cp .env.example .env      # set VITE_PROPERTY_ID
npm install
npm run dev               # starts on :5173
```

The Vite dev server proxies `/api` → `http://localhost:3001`, so no CORS headers are needed during development.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_PROPERTY_ID` | ✅ | The property UUID returned by the backend seed script |

---

## Project Structure

```
src/
├── main.tsx                  # Entry — QueryClientProvider, StrictMode
├── App.tsx                   # BrowserRouter, Routes
├── index.css                 # Tailwind directives + custom utilities
│
├── types/
│   └── api.ts                # Zod schemas + TypeScript types for all API shapes
│
├── lib/
│   └── api.ts                # Typed fetch client — snake_case → camelCase normalisation
│
├── hooks/
│   └── useRenewalRisk.ts     # useRenewalRisk, useRunBatchScoring, useRetryWebhook
│
├── pages/
│   └── DashboardPage.tsx     # Primary view — stats + filter + resident table
│
└── components/
    ├── StatCard.tsx           # Summary metric card
    ├── RiskBadge.tsx          # Coloured tier pill
    ├── ResidentRow.tsx        # Table row with risk data
    └── SignalsAccordion.tsx   # Collapsible risk signal breakdown
```

---

## Data Flow

```
DashboardPage
  └── useRenewalRisk(propertyId)         → GET /renewal-risk
  └── useRunBatchScoring(propertyId)     → POST /renewal-risk/batch
        └── on success: invalidates useRenewalRisk cache
```

All API shapes are validated with **Zod** at the boundary (`src/lib/api.ts`), ensuring runtime type safety against unexpected server responses.

---

## Usage

1. Ensure the backend is running (`npm run dev` in `../backend`).
2. Set `VITE_PROPERTY_ID` in `.env` to the UUID printed by the seed script.
3. Open <http://localhost:5173>.
4. Click **Run Risk Calculation** to trigger batch scoring and refresh the table.
5. Use the tier filter pills (All / High / Medium / Low) to narrow the view.
