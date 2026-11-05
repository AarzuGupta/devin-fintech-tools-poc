# Fintech Internal Tools — KYC Review + Refunds Dashboard (PoC)

Internal operations tools built as a proof of concept for replacing low-code internal tools with a small, maintainable custom codebase:

- **KYC review** — review queue, case details, an approve / reject / escalate workflow, role-based authorization enforced on the server, and a persistent audit trail.
- **Refunds dashboard** — read-only monitoring of refunds served by a local **mock finance API** through a typed adapter (see [Refunds dashboard](#refunds-dashboard)).

A *Feature flags* entry in the sidebar is a disabled placeholder for a planned tool.

> **This is a prototype, not a production system.** It uses synthetic data only, a demo impersonation mechanism instead of real authentication, and a local SQLite database. See [Production gaps](#production-gaps).

## Quick start

Requirements: Node.js 20+ (developed on Node 24) and npm.

```bash
npm install
cp .env.example .env          # set SESSION_SECRET to a long random string (≥ 32 chars)
npm run setup                 # prisma generate + create SQLite DB + deterministic seed
npm run dev                   # http://localhost:3000
```

Open http://localhost:3000, pick a demo identity on the sign-in screen, and start reviewing.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:reset` | Drop, recreate and reseed the local database |
| `npm run db:seed` | Re-run the seed (it clears existing data first) |
| `npm test` | Vitest suite (unit + service/integration tests against a real SQLite test DB) |
| `npm run test:e2e` | Playwright browser tests (builds and serves the app on port 3100 against a fresh `e2e.db`); `E2E_DEV=1 npm run test:e2e` runs the same specs against `next dev` |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |

The first `npm run test:e2e` may require `npx playwright install chromium`.

## Demo identities and permissions

Sign-in is **demo impersonation, not authentication**: anyone can choose any identity, and the header switcher is labeled accordingly. The selection is stored in a signed, httpOnly cookie that contains only the user ID; the role is always looked up from the database on the server.

| Identity | Role | Can do |
| --- | --- | --- |
| Priya Shah | Viewer | Read the KYC queue and case details (read-only); read the refunds dashboard |
| Marcus Lee, Elena Rossi, Tomás Alvarez | Analyst | Viewer access + approve / reject / escalate **pending** cases (approve only for low/medium risk) |
| Jordan Blake | Admin | Analyst access + approve **high-risk** cases + resolve **escalated** cases + view the global audit log |

All three roles hold `refunds:read`; the dashboard has no write actions for any role. Anonymous users are redirected to sign-in and cannot read any case or refund data. Every service function checks permissions itself, so reads and writes are protected even if the UI is bypassed.

## Supported workflow

```
PENDING ──approve──▶ APPROVED  (final)
   │    ──reject───▶ REJECTED  (final)
   └────escalate──▶ ESCALATED ──approve/reject (admin only)──▶ APPROVED / REJECTED
```

- Analysts can act on any pending case; the assigned reviewer is informational.
- **High-risk approval policy:** only admins (`kyc:approve-high-risk`) can approve a `HIGH`-risk case. Analysts can still reject or escalate it; the panel shows a disabled Approve button with the reason, and the service refuses an analyst approval with `FORBIDDEN` and writes nothing. Low/medium-risk cases are unchanged. The policy applies to new decisions only: earlier decisions and audit history are not modified.
- Reject and escalate require a reason of 10–1000 characters; approve accepts an optional note.
- Approved and rejected cases are final; any further change is refused.
- Each successful decision updates the case and writes an audit event in a single transaction. The update is conditional on the status that was read (`UPDATE … WHERE id = ? AND status = ?`), so two concurrent decisions cannot both succeed; the loser gets a conflict error and no audit event is written. Optionally the client sends `expectedStatus`, so acting on a stale screen is also rejected.

UI features: searchable / filterable (status, risk, type) / sortable queue with URL-persisted state, overdue deadline indicators, right-side detail panel with verification signals and decision history, confirmation dialogs with reason validation, success / error toasts, loading, empty and access-denied states, admin audit log with search.

## Refunds dashboard

`/refunds` is a **read-only** operational view. It cannot create, retry or cancel refunds; refunds are issued in the payment provider. All data is synthetic.

- **List:** refund ID, transaction ID, customer, original payment amount, refund amount, currency, reason, status, created and completed dates. Search (refund / transaction / customer ID or name), filters (status, currency, created range: 7 / 30 / 90 days or all time, default 30), sorting, and 25-per-page pagination, all kept in the URL.
- **Detail panel:** amount (full or partial refund), transaction context, payment method summary, reason, initiator, failure reason, and status history from the upstream.
- **States:** empty results, pending (toolbar spinner during filter/sort/page changes, sidebar spinner while navigating to the page), and explicit error states for upstream failures.

**Metric scope.** All four tiles are computed over *every refund matching the current filters* (not just the visible page), stated above the tiles with the data's as-of time:

| Tile | Definition |
| --- | --- |
| Total refunded | Sum of `SUCCEEDED` refund amounts, **per currency** (currencies are never added together); count of succeeded refunds |
| Pending or processing | Count (and per-currency amount) of `PENDING` + `PROCESSING` |
| Failed | Count (and per-currency amount) of `FAILED` |
| Created in last 7 days | Count and per-currency amount of all statuses created in the 7 days before now, within the filtered set |

Amounts are integer minor units (`refundAmountMinor`, `originalAmountMinor`) end to end; formatting to currency happens only for display. Sorting by amount groups by currency, then amount, because amounts in different currencies are not comparable.

### Integration boundary

```
/refunds page ─▶ refundService (auth: refunds:read, query validation, metrics, pagination)
             ─▶ RefundsApiClient (typed adapter: HTTP, zod contract, timeout, error mapping)
             ─▶ /api/mock-finance/v1/refunds[/:id]  (local mock upstream, deterministic data)
```

- **Mock API** (`src/lib/integrations/refundsApi/mockServer.ts`): 120 deterministic refunds, bearer-token check, `status` / `currency` / `created_gte` filters, cursor pagination (`limit`, `starting_after`, `has_more`, `next_cursor`), and JSON error bodies with request IDs. Scenarios are selected with the `X-Mock-Scenario` header: `slow` (1.2 s delay, succeeds), `timeout` (stalls past the client timeout), `error` (500), `unavailable` (503 + `Retry-After: 30`), `malformed` (200 with an invalid body). For demos, append `?simulate=<scenario>` to `/refunds`.
- **Adapter** (`src/lib/integrations/refundsApi/client.ts`, `contract.ts`): validates every response against a zod wire contract (snake_case, lowercase enums, ISO dates) and maps it to the domain `Refund`. Failures become a typed `RefundsApiError` (`TIMEOUT`, `UNAVAILABLE`, `UPSTREAM_ERROR`, `INVALID_RESPONSE`, `NOT_FOUND`, `BAD_REQUEST`, `UNAUTHORIZED`). There is no cache: a failed load shows an error with the attempt time, request ID and retry option, and no figures or rows, so earlier data is never presented as current and a malformed 200 is never rendered as success.
- **Configuration:** `REFUNDS_API_BASE_URL` and `REFUNDS_API_TOKEN` (`.env.example`). The token is a local placeholder, not a credential.

**What would change for a real payment provider or internal finance service** (this mock does **not** demonstrate compatibility with any real connector):

- `contract.ts` — the wire schema and `toDomainRefund` mapping (field names, enum values, amount and currency conventions, history/event shape).
- `client.ts` — authentication (OAuth client credentials, mTLS or signed requests instead of a static bearer token), pagination style, rate limiting and retry/backoff policy, and error-code mapping.
- `server.ts` — configuration and secret management (vault instead of env vars), network egress.
- Data volume: metrics are currently computed by fetching every matching record (≤ a few hundred). At real volumes, totals should come from a reporting endpoint or warehouse, and the list should page server-side.
- The mock routes under `src/app/api/mock-finance` would be removed. The domain (`src/lib/domain/refunds.ts`), service, and UI are not expected to change unless the provider's data model differs materially.

## Architecture

A single Next.js 15 (App Router) application structured as a small modular monolith:

```
prisma/schema.prisma        User, KycCase, VerificationSignal, AuditEvent
prisma/seed.ts              → src/lib/seed (deterministic synthetic data)
src/lib/domain/kyc.ts       Pure business rules: statuses, transitions, role rules, reason validation
src/lib/domain/refunds.ts   Refund types, metrics, search, sorting, pagination, money formatting
src/lib/integrations/       refundsApi: wire contract, typed client, mock upstream + data
src/lib/auth/               roles + permission map, signed demo session, current-actor helper
src/lib/services/           kycService (list/get/summary/decide), auditService (generic audit events), refundService (dashboard/detail)
src/app/actions/            Thin server actions: resolve actor from cookie → call service → map errors
src/app/(app)/              Pages: /kyc (queue + detail panel), /refunds, /audit (admin only)
src/app/api/mock-finance/   Local mock finance API routes
src/components/             Reusable shell, DataTable, badges, filters, pagination, detail-panel parts; components/kyc and components/refunds for app-specific UI
tests/                      Vitest suites;  e2e/  Playwright smoke test
```

Key decisions:

- **Domain rules are pure functions** (`evaluateDecision`, `allowedDecisions`) shared by the service and the UI, so the UI only offers actions the server will accept; the server remains the authority.
- **Authorization lives in the service layer** (`requirePermission`), not in pages or components. Pages call services with the server-resolved actor; nothing role- or identity-related is accepted from the client (decision input is a strict Zod schema that rejects extra fields such as `role` or `actorId`).
- **Generic audit model:** `AuditEvent { entityType, entityId, actorId, action, previousState, newState, reason, createdAt }` is not KYC-specific, so future tools (refunds, feature flags) can reuse `recordAuditEvent` / `getEntityHistory`.
- **Fluent UI v9 + Tailwind:** Fluent provides accessible controls (buttons, dialogs, menus, fields, toasts); Tailwind handles layout. The table is a small reusable component rather than a heavy grid library.
- **SQLite + Prisma** for zero-setup local persistence. Moving to Postgres is a datasource change; the conditional-update concurrency guard is written to remain correct under non-serialized isolation levels.
- **Deterministic seed:** fixed PRNG seed and fixed base date (5 users, 40 cases across all statuses, 22 historical audit events), so the demo and tests are reproducible.

## Testing

- `npm test` — 101 Vitest tests: 60 KYC/platform tests (below) and 41 refunds tests covering metric totals and status counts, per-currency separation, date ranges, search, sorting, pagination, query validation, adapter contract mapping, cursor pagination, success / error / slow / timeout / unavailable / malformed scenarios, token rejection, and `refunds:read` denial for anonymous callers.
- KYC suite: 60 tests across domain rules, session signing, the KYC/audit services and server actions, run against a real SQLite database (`prisma/test.db`, reset per test). Covered behaviors include valid and invalid transitions, finalized-case protection, role restrictions, anonymous and sensitive-read denial (admin-only global audit), reason validation, persistence and audit fields, cookie tampering and payload swapping, rejection of client-supplied role/actor fields, stale `expectedStatus`, competing concurrent decisions (shared and separate DB connections), and a stale-read test that fails if the conditional update guard is removed.
- `npm run test:e2e` — Playwright smoke test against a production build: an analyst rejects a pending case with a reason, the status and decision history persist after reload, the analyst is denied the audit log, and an admin finds the decision in it; plus a viewer read-only and anonymous redirect check. Refunds: a viewer filters, pages, sorts and opens a refund, and the state survives a reload; an unavailable upstream shows the error state with no figures, recovers when the scenario is removed, and anonymous page and API access are refused.

Note: SQLite serializes write transactions, so the concurrency tests would pass on SQLite even without the conditional update. The stale-read test exists specifically to cover that guard.

## Known limitations / not implemented

- KYC queue has no pagination or virtualization (fine for ~40 rows; needed for real volumes).
- Refunds: read-only by design; no exports, saved views, currency conversion, or per-user time zones. Metrics are computed in the app from all matching records fetched from the upstream (see the integration notes for real volumes). The mock API is in-process, so it does not exercise real network failure modes such as DNS errors or TLS.
- No case assignment / reassignment workflow, comments, attachments, document viewer, or SLA notifications.
- Escalation has no separate queue or notification; admins filter by status.
- Times display in the browser's locale; there is no per-user time zone setting.
- Global audit log is limited to the 200 most recent events (with search).
- Only one browser smoke flow is automated; there are no visual-regression or accessibility audit tests (controls use Fluent's accessible components and keyboard-operable rows, but no formal WCAG review was done).

## Production gaps

This prototype is **not production-secure and not compliance-certified**. Before real use it would need at least:

- **Authentication / SSO:** replace demo impersonation with the corporate IdP (OIDC/SAML, e.g. Entra ID), MFA, session expiry and rotation, CSRF review, group-to-role mapping, and joiner/mover/leaver handling.
- **Data protection:** real KYC data is sensitive PII — encryption at rest and in transit, field-level access controls and masking, data residency, retention and deletion policies, and secure secret management (no `.env` files).
- **Hosting and database:** managed Postgres (SQLite is single-node), migrations instead of `db push`, environment separation, and a deployment pipeline.
- **Governance and audit:** tamper-evident / append-only audit storage, export to the SIEM, four-eyes or maker-checker rules where policy requires them, change management, and access reviews.
- **Monitoring:** structured logging, error tracking, metrics, alerting, and uptime checks.
- **Backup and recovery:** automated backups, tested restores, defined RPO/RTO.
- **Integrations:** real identity verification, sanctions/PEP screening, and case-management providers; currently all signals are synthetic seed data.
- **Security assurance:** threat model, dependency scanning, penetration testing, rate limiting, and compliance review (e.g. SOC 2 controls, AML/KYC regulatory requirements).

## Implementation notes

A short record of notable issues and changes of approach during Phase 1:

- The seed base date was moved forward and SLA windows adjusted after the first UI review showed nearly every case as overdue, which was unrealistic for a demo.
- `next lint` is deprecated in Next 15.5, so linting uses the ESLint CLI with the flat config.
- Concurrency tests initially passed even with the conditional update removed (SQLite serializes writes); a stale-read test was added that fails without the guard.
- The Playwright smoke test exposed two real UI defects in the production build:
  - Clicking a row immediately after changing a filter could drop one of the two URL updates. `useUrlState` now composes rapid successive updates on top of the pending query.
  - Roughly a third to half of in-page navigations (row selection, filters) were silently lost in `next build` output, while `next dev` was unaffected. Isolating variants with repeated scripted clicks traced it to the route-level `kyc/loading.tsx` boundary combined with search-param navigations (Next.js 15.5); removing the file eliminated the failures (0 lost across repeated runs). The toolbar spinner still indicates pending queue updates.
- No work required human intervention beyond plan approval.
