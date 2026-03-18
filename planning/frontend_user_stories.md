# Frontend User Stories — Renewal Risk Detection System (ROP)

> **Stack:** React 18 + TypeScript · Vite (or Next.js 14) · TanStack Query · Tailwind CSS · shadcn/ui  
> **Bundle:** `@essentials`  
> **Key Individual Skills:** `frontend-dev-guidelines` · `react-patterns` · `react-nextjs-development` · `tanstack-query-expert` · `zod-validation-expert` · `tailwind-patterns` · `shadcn` · `e2e-testing-patterns` · `api-design-principles`

---

## Architecture Decisions (applies to all stories)

| Decision | Choice | Rationale |
|---|---|---|
| Data fetching | TanStack Query v5 | Server state management, caching, background refetch — avoids custom useEffect chains |
| UI components | shadcn/ui + Tailwind CSS | Accessible primitives, no heavy bundle, composable |
| Routing | React Router v6 (or Next.js App Router) | Single route: `/properties/:propertyId/renewal-risk` |
| State | React local state + TanStack Query cache | No global store needed at MVP scale |
| API client | Typed `fetch` wrapper in `src/lib/api.ts` | Centralized base URL, headers, error handling |
| Error display | Toast notifications + inline error banners | Toast for async ops (triggers), Banner for load failures |
| Color coding | Tailwind semantic tokens: `red-600` = high, `amber-500` = medium, `green-600` = low | Consistent across table, badges, skeleton states |

---

## Epic 5 — Renewal Risk Dashboard Page

### FS-01 — Route and Page Shell

**As a** property manager,  
**I want** to navigate to a dedicated renewal risk page for my property,  
**so that** I can view all at-risk residents in one place.

#### Acceptance Criteria
- [ ] Route exists: `/properties/:propertyId/renewal-risk`
- [ ] Page title: `"Renewal Risk — [Property Name]"` (document note: property name fetched from API or URL state)
- [ ] Loading state: full-page skeleton with placeholder rows while data loads
- [ ] Error state: a non-dismissible banner reading `"Failed to load renewal risk data. Please try again."` with a Retry button
- [ ] Empty state: if `residents.length === 0`, display a card with `"No residents at risk. Run a new calculation."` and a Calculate button
- [ ] Page is responsive — readable on 1280px+ Desktop (no mobile requirement for MVP)

**Skills to use:** `react-patterns` · `react-nextjs-development` · `tailwind-patterns`

---

### FS-02 — Summary Statistics Bar

**As a** property manager,  
**I want** to see aggregate renewal risk statistics at the top of the page,  
**so that** I can quickly grasp portfolio exposure without reading every row.

#### Acceptance Criteria
- [ ] Displays four stat cards in a horizontal row:
  - **Total Residents** (total count of at-risk residents in `residents[]`)
  - **High Risk** (count, red badge)
  - **Medium Risk** (count, amber badge)
  - **Calculated At** (formatted as `"Mar 17, 2026 2:57 PM"`)
- [ ] Stat cards animate in with subtle fade/slide when data loads (CSS transition, no heavy animation library required)
- [ ] `calculatedAt` shows "Never" if no calculation has run
- [ ] All four cards are always visible; counts update reactively when a new calculation runs

**Skills to use:** `react-patterns` · `tailwind-patterns` · `react-ui-patterns`

---

### FS-03 — At-Risk Residents Table

**As a** property manager,  
**I want** a sortable table of all at-risk residents with their risk scores and key signals,  
**so that** I can prioritize which residents to contact first.

#### Acceptance Criteria
- [ ] Table columns (all visible by default):
  - Resident Name
  - Unit Number
  - Risk Score (numeric, 0–100)
  - Risk Tier (badge: `HIGH` in red, `MEDIUM` in amber)
  - Days to Expiry (number, or "MTM" for month-to-month)
  - Signals (expandable — see FS-04)
  - Actions (trigger button — see FS-05)
- [ ] Table is sorted by `riskScore DESC` by default
- [ ] Resident name links to a future resident detail page (renders as non-navigable styled text for MVP, documents the intent)
- [ ] Row renders with a left-border color accent: red for high, amber for medium
- [ ] Empty table rows for loading (skeleton) use the same column structure
- [ ] Table supports at least 100 rows without janky scroll (windowing not required for MVP, but document upgrade path)

**Skills to use:** `react-patterns` · `shadcn` · `tailwind-patterns` · `tanstack-query-expert`

---

### FS-04 — Expandable Risk Signals Detail

**As a** property manager,  
**I want** to expand a resident row to see which specific signals contributed to their risk score,  
**so that** I can have an informed conversation with the resident.

#### Acceptance Criteria
- [ ] Each table row has an expand chevron (`›` / `⌄`) in the leftmost column
- [ ] Clicking the chevron expands an inline detail section below the row (no modal)
- [ ] Expanded section shows a signal grid:
  | Signal | Value |
  |---|---|
  | Days to Lease Expiry | `45 days` |
  | Payment History | `✓ On time` or `✗ Delinquent` |
  | Renewal Offer Sent | `Yes` or `No` |
  | Rent vs Market | `$1,400 / $1,600 market (+14%)` or `N/A` |
- [ ] Boolean signals use green checkmark / red X icons (accessible: include aria-label)
- [ ] Only one row can be expanded at a time (accordion behavior); expanding another row collapses the previous
- [ ] Animation: expand/collapse uses CSS `max-height` transition (no layout jitter)

**Skills to use:** `react-patterns` · `tailwind-patterns` · `fixing-accessibility`

---

### FS-05 — Trigger Renewal Event Button

**As a** property manager,  
**I want** to trigger a renewal event for a specific resident,  
**so that** the revenue management system (RMS) is notified and can take action.

#### Acceptance Criteria
- [ ] Each row has a `"Trigger Renewal Event"` button in the Actions column
- [ ] Button is disabled if a delivery for this resident already exists with `status = 'delivered'`
- [ ] On click: button shows a spinner and is disabled to prevent double-sends
- [ ] On success (API returns 200 or 202):
  - Toast notification: `"✓ Renewal event triggered for [Resident Name]"`
  - Button label changes to `"Triggered ✓"` and becomes disabled
  - Row background subtly transitions to confirm completion
- [ ] On failure (API error or network failure):
  - Toast notification: `"✗ Failed to trigger renewal event. Please try again."`
  - Button returns to enabled state
- [ ] Confirmation dialog (optional, document as future hardening): "Are you sure you want to trigger a renewal event for Jane Doe?"

**Skills to use:** `react-patterns` · `tanstack-query-expert` · `react-ui-patterns` · `tailwind-patterns`

---

## Epic 6 — Calculate Risk Action

### FS-06 — Calculate Renewal Risk Action

**As a** property manager,  
**I want** to trigger a new risk calculation from the UI,  
**so that** I can refresh results when lease data has changed.

#### Acceptance Criteria
- [ ] A `"Calculate Risk"` button is visible at the top-right of the page
- [ ] Button triggers `POST /api/v1/properties/:propertyId/renewal-risk/calculate`
- [ ] During calculation: button shows a spinner and is disabled; page does NOT navigate away
- [ ] On success: TanStack Query cache is invalidated, table refreshes with new results; toast: `"✓ Risk scores updated"`
- [ ] On failure: toast `"✗ Calculation failed. Check backend logs."` — button re-enables
- [ ] If a 409 Conflict is returned (concurrent batch guard): toast `"⚠ Calculation already running. Please wait a moment."`
- [ ] Button is re-enabled after success or failure (no permanent disabled state)

**Skills to use:** `tanstack-query-expert` · `react-patterns` · `tailwind-patterns`

---

### FS-02.5 — Custom Filter Tabs
- [ ] Add filter tabs (`All`, `High`, `Medium`, `Low`) that natively filter the table view instantly.

### Epic 7 — Data Layer
- [ ] Base URL and Property ID securely populated via `import.meta.env.VITE_API_BASE_URL` and `import.meta.env.VITE_PROPERTY_ID`.

---

### FS-08 — TanStack Query Hooks

**As a** React component,  
**I want** composable query hooks,  
**so that** data fetching, caching, and loading states are handled uniformly.

#### Acceptance Criteria
- [ ] `useRenewalRisk(propertyId: string)` — wraps `getRenewalRisk`, exposes `{ data, isLoading, isError, error, refetch }`
- [ ] `useCalculateRisk()` — wraps `calculateRenewalRisk`, a mutation with `{ mutate, isPending, isError }`
- [ ] `useTriggerEvent()` — wraps `triggerRenewalEvent`, a mutation; on success invalidates `useRenewalRisk` cache
- [ ] `useRenewalRisk` sets `staleTime: 60_000` (1 minute) — avoids spamming the API on re-render
- [ ] All hooks are in `src/hooks/` and unit-testable with MSW mocks (document the test approach even if not implemented)

**Skills to use:** `tanstack-query-expert` · `react-patterns`

---

## Epic 8 — UI Polish and Accessibility

### FS-09 — Loading and Error States

**As a** property manager on a slow connection,  
**I want** skeleton loaders and clear error messages,  
**so that** the UI feels responsive and communicates failure clearly.

#### Acceptance Criteria
- [ ] Table has a skeleton row animation for each row slot (8 placeholder rows) during initial load
- [ ] Summary stat cards show pulsing placeholder boxes while loading
- [ ] Error banner includes the HTTP status code for ops triage (e.g., `"Error 503: Backend unavailable"`)
- [ ] Browser tab title updates to `"Loading... — Renewal Risk"` during fetch and back to `"Renewal Risk — [Property]"` on success

**Skills to use:** `react-ui-patterns` · `tailwind-patterns` · `fixing-accessibility`

---

### FS-10 — Keyboard and ARIA Accessibility

**As a** user relying on keyboard navigation,  
**I want** to tab through the table and trigger actions without a mouse,  
**so that** the tool meets basic accessibility standards.

#### Acceptance Criteria
- [ ] All interactive elements (expand chevron, trigger button, calculate button) are reachable via `Tab`
- [ ] Expand chevron has `aria-expanded="true|false"` and `aria-label="Expand signals for [Resident Name]"`
- [ ] Risk tier badges have appropriate `aria-label` (`aria-label="High risk"` on red badge)
- [ ] Toast notifications are announced by screen readers (`role="alert"`)
- [ ] Color is never the **only** differentiator — tier badges include text label, not just color

**Skills to use:** `fixing-accessibility` · `react-patterns` · `tailwind-patterns`

---

## Story Map Summary

```
Epic 5: Dashboard Page
  FS-01  Route and page shell (loading / error / empty states)
  FS-02  Summary statistics bar (4 stat cards)
  FS-03  At-risk residents table (sortable, color-coded)
  FS-04  Expandable risk signals detail (accordion)
  FS-05  Trigger Renewal Event button (loading, success, error states)

Epic 6: Calculate Risk
  FS-06  Calculate risk button + optimistic cache invalidation

Epic 7: Data Layer
  FS-07  Typed API client in src/lib/api.ts
  FS-08  TanStack Query hooks (useRenewalRisk, useCalculateRisk, useTriggerEvent)

Epic 8: Polish
  FS-09  Skeleton loaders + error states
  FS-10  Keyboard navigation + ARIA compliance
```

---

## UI State Machine — Trigger Button

```
idle
 ├─ [click] → loading (spinner, disabled)
 │     ├─ [success] → triggered (✓ label, permanently disabled)
 │     └─ [error]   → idle (toast shown, re-enabled)
 └─ [already delivered] → disabled (grey, "Triggered ✓")
```

---

## UI Component Tree (Suggested)

```
<RenewalRiskPage>
  <PageHeader title="Renewal Risk — Park Meadows">
    <CalculateRiskButton />
  </PageHeader>

  <SummaryStatsBar
    totalCount={...}
    highCount={...}
    mediumCount={...}
    calculatedAt={...}
  />

  <RiskTable residents={residents}>
    <RiskTableRow resident={r}>
      <ExpandSignalsButton />
      <RiskTierBadge tier={r.riskTier} />
      <TriggerEventButton residentId={r.residentId} />
    </RiskTableRow>

    <SignalsPanel resident={r} expanded={expanded} />
  </RiskTable>
</RenewalRiskPage>
```

---

## Environment Variables

```bash
# .env.example
VITE_API_BASE_URL=http://localhost:3000
```

---

*Context files: `renewal_risk_takehome.md` · `seed_and_testing.md`*
