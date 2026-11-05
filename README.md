# Fintech Internal Tools — Devin Proof of Concept

A working prototype, built with Devin, of two of the client's three Power Apps internal tools: a **KYC review queue** and a **refunds dashboard**. It tests whether a fintech engineering team can use Devin to build *and then maintain* internal apps on a shared, code-owned foundation. It is a feasibility study, not a full Power Apps replacement.

**Live demo:** _pending — replaced with the verified Railway URL after deployment._ No Devin login is needed; pick any demo identity on the sign-in page.

> **Demo only.** All data is synthetic. Sign-in is impersonation (anyone can pick Admin). No real refunds are processed. Not production-secure or compliance-certified.

PRs (stacked, in build order): [#1 KYC review](https://github.com/AarzuGupta/devin-fintech-tools-poc/pull/1) → [#2 Refunds dashboard](https://github.com/AarzuGupta/devin-fintech-tools-poc/pull/2) → [#3 Policy change (maintenance)](https://github.com/AarzuGupta/devin-fintech-tools-poc/pull/3)

## What it demonstrates

| Power Apps concern | In this prototype |
|---|---|
| Data-driven app (gallery + form) | KYC queue: search, filter, sort, case detail with verification signals; refunds list with metrics, filters, paging, detail |
| Business rules and approvals | KYC: Pending → Approved / Rejected / Escalated; Escalated → Approved / Rejected (admin); approved/rejected are final; reject/escalate need a reason (≥ 10 chars) |
| Role-based security | Viewer / Analyst / Admin permissions checked on the server for every read and decision, not just hidden in the UI |
| Audit trail | Each decision writes an audit event in the same transaction as the status change; admin-only global audit log at `/audit` |
| Connectors | Refunds read from a typed adapter over a local mock finance API, including simulated failures (`/refunds?simulate=unavailable`, also `slow`, `timeout`, `error`, `malformed`) |
| Reuse across apps | Refunds reused the app shell, auth/permissions, table, filter, URL-state and detail-panel components from KYC |
| Change requests | PR #3: "analysts may not approve high-risk cases; admins can" — enforced in the domain/service layer using the stored risk tier, shown in the UI as a disabled Approve with an explanation, covered by tests |

## Demo identities

| Name | Role | Can do |
|---|---|---|
| Aarzu Gupta | Viewer | Read KYC and refunds |
| Marcus Lee, Elena Rossi, Tomás Alvarez | Analyst | Decide pending cases (approve only low/medium risk) |
| Jordan Blake | Admin | Everything, incl. high-risk approval, escalated cases, audit log |

Switch identity from the menu in the top-right.

## Run locally

Requires Node.js 24 (pinned in `package.json`; other versions untested).

```bash
npm ci
cp .env.example .env        # set SESSION_SECRET to a random value of at least 32 characters
npm run setup               # Prisma client + SQLite schema + synthetic seed
npm run dev                 # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm test` | Vitest unit/integration tests (115) |
| `npm run test:e2e` | Playwright tests against a production build (first run: `npx playwright install chromium`) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:reset` | Wipe and reseed the local database |
| `npm run start:deploy` | Hosted start: `prisma db push` (never resets), seed only if empty, `next start` on `$PORT` |

## Deployment

Railway, from this repo, with SQLite on a persistent volume. `railway.json` sets the build (`npm run build`; `prisma generate` runs on install), start (`npm run start:deploy`) and a `/sign-in` health check. Environment: volume mounted at `/data`, `DATABASE_URL=file:/data/app.db`, `SESSION_SECRET` (≥ 32 random chars), `REFUNDS_API_TOKEN` (any placeholder; the mock API and its client share it). Railway provides `PORT`. Data persists across restarts and redeploys because the start script never resets or reseeds a non-empty database.

## Architecture

Next.js 15 (App Router) modular monolith, TypeScript, Prisma 6 + SQLite, Fluent UI v9 + Tailwind, Vitest, Playwright.

```text
src/lib/domain/        Pure business rules (KYC transitions + risk policy, refund metrics)
src/lib/auth/          Demo session cookie (user ID only), roles, permissions
src/lib/services/      Server-side reads/decisions with permission checks and atomic audit writes
src/lib/integrations/  Typed refunds API adapter + local mock finance API
src/app/               Pages (KYC, refunds, audit, sign-in), server actions, mock API route
src/components/        Shared shell, table, filters, badges, detail panel; app-specific views
prisma/, src/lib/seed/ Schema and deterministic synthetic seed
tests/, e2e/           Unit/integration tests; production-build browser tests
```

## Evidence and limitations

- **Evidence:** git history and the three PRs record each checkpoint, test run and fix; [`docs/experiment_evidence.md`](docs/experiment_evidence.md) covers the refunds extension. Agent elapsed time (git timestamps, not human effort): refunds extension 20 min 41 s; policy change 12 min 7 s.
- **Tests (latest):** 115/115 Vitest; type-check and lint clean; Playwright 5/5 on a production build (15/15 over three repeats). Playwright against `next dev` is unreliable on the build VM (also on the pre-change baseline); cause unresolved. No CI is configured.
- **Defects caught during the build:** production-only lost clicks from route-level loading/Suspense boundaries (fixed in both apps), a hydration mismatch in filters, and test-helper bugs. Production-build browser tests were needed to catch the first.
- **Not validated:** SSO/real authentication, real KYC or payment integrations, data governance and retention, monitoring, backups, multi-app isolation (one deployable, one SQLite file), metrics at real data volumes, and visual authoring by non-engineers.
