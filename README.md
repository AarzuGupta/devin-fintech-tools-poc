# Fintech Internal Tools — KYC Review (Phase 1 PoC)

An internal KYC (Know Your Customer) review application built as a proof of concept for replacing low-code internal tools with a small, maintainable custom codebase. It provides a review queue, case details, an approve / reject / escalate workflow, role-based authorization enforced on the server, and a persistent audit trail.

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
| `npm run test:e2e` | Playwright browser smoke test (builds and serves the app on port 3100 against a fresh `e2e.db`) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |

The first `npm run test:e2e` may require `npx playwright install chromium`.

## Demo identities and permissions

Sign-in is **demo impersonation, not authentication**: anyone can choose any identity, and the header switcher is labeled accordingly. The selection is stored in a signed, httpOnly cookie that contains only the user ID; the role is always looked up from the database on the server.

| Identity | Role | Can do |
| --- | --- | --- |
| Priya Shah | Viewer | Read the queue and case details (read-only) |
| Marcus Lee, Elena Rossi, Tomás Alvarez | Analyst | Viewer access + approve / reject / escalate **pending** cases |
| Jordan Blake | Admin | Analyst access + resolve **escalated** cases + view the global audit log |

Anonymous users are redirected to sign-in and cannot read any case data. Every service function checks permissions itself, so reads and writes are protected even if the UI is bypassed.

## Supported workflow

```
PENDING ──approve──▶ APPROVED  (final)
   │    ──reject───▶ REJECTED  (final)
   └────escalate──▶ ESCALATED ──approve/reject (admin only)──▶ APPROVED / REJECTED
```

- Analysts can act on any pending case; the assigned reviewer is informational.
- Reject and escalate require a reason of 10–1000 characters; approve accepts an optional note.
- Approved and rejected cases are final; any further change is refused.
- Each successful decision updates the case and writes an audit event in a single transaction. The update is conditional on the status that was read (`UPDATE … WHERE id = ? AND status = ?`), so two concurrent decisions cannot both succeed; the loser gets a conflict error and no audit event is written. Optionally the client sends `expectedStatus`, so acting on a stale screen is also rejected.

UI features: searchable / filterable (status, risk, type) / sortable queue with URL-persisted state, overdue deadline indicators, right-side detail panel with verification signals and decision history, confirmation dialogs with reason validation, success / error toasts, loading, empty and access-denied states, admin audit log with search.

## Architecture

A single Next.js 15 (App Router) application structured as a small modular monolith:

```
prisma/schema.prisma        User, KycCase, VerificationSignal, AuditEvent
prisma/seed.ts              → src/lib/seed (deterministic synthetic data)
src/lib/domain/kyc.ts       Pure business rules: statuses, transitions, role rules, reason validation
src/lib/auth/               roles + permission map, signed demo session, current-actor helper
src/lib/services/           kycService (list/get/summary/decide), auditService (generic audit events)
src/app/actions/            Thin server actions: resolve actor from cookie → call service → map errors
src/app/(app)/              Pages: /kyc (queue + detail panel), /audit (admin only)
src/components/             Reusable shell, DataTable, badges, states; components/kyc for KYC-specific UI
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

- `npm test` — 60 Vitest tests across domain rules, session signing, the KYC/audit services and server actions, run against a real SQLite database (`prisma/test.db`, reset per test). Covered behaviors include valid and invalid transitions, finalized-case protection, role restrictions, anonymous and sensitive-read denial (admin-only global audit), reason validation, persistence and audit fields, cookie tampering and payload swapping, rejection of client-supplied role/actor fields, stale `expectedStatus`, competing concurrent decisions (shared and separate DB connections), and a stale-read test that fails if the conditional update guard is removed.
- `npm run test:e2e` — Playwright smoke test against a production build: an analyst rejects a pending case with a reason, the status and decision history persist after reload, the analyst is denied the audit log, and an admin finds the decision in it; plus a viewer read-only and anonymous redirect check.

Note: SQLite serializes write transactions, so the concurrency tests would pass on SQLite even without the conditional update. The stale-read test exists specifically to cover that guard.

## Known limitations / not implemented

- No pagination or virtualization (fine for ~40 rows; needed for real volumes).
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
