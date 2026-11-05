# Fintech Internal Tools — Devin Proof of Concept

A Devin-assisted proof of concept exploring whether a fintech engineering team could build and maintain custom internal applications rather than rely exclusively on a low-code platform such as Microsoft Power Apps.

The prototype contains two representative tools: a KYC review workflow with server-enforced decisions and audit history, and a read-only refunds dashboard backed by a simulated API. Both share application infrastructure, UI patterns, and authorization checks. The project evaluates application feasibility and maintainability — not full Power Apps feature parity.

[GitHub repository](https://github.com/AarzuGupta/devin-fintech-tools-poc) · [KYC PR #1](https://github.com/AarzuGupta/devin-fintech-tools-poc/pull/1) · [Refunds PR #2](https://github.com/AarzuGupta/devin-fintech-tools-poc/pull/2) · [Maintenance PR #3](https://github.com/AarzuGupta/devin-fintech-tools-poc/pull/3)

**Try it:** [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/AarzuGupta/devin-fintech-tools-poc)

The Codespace installs dependencies, seeds the synthetic database, builds, and starts the production app on port 3000, which opens in a browser tab (first start takes a few minutes). It needs a GitHub account with access to this repository and uses that account's Codespaces quota. There is no hosted deployment; you can also run it locally (below).

> **Demonstration only:** All records are synthetic, demo identities can be freely impersonated, and no real refunds are processed. This is not production-secure or compliance-certified.

## What you can try

| Application | Capabilities |
|---|---|
| KYC review (`/kyc`) | Search, filter, and sort seeded cases; inspect verification signals and history; approve, reject, or escalate pending cases; review admin-only audit events (`/audit`). |
| Refunds (`/refunds`) | Inspect synthetic refund transactions and summary metrics, search and filter records, open details, and exercise simulated upstream failures. No payment actions are executed. |
| Shared foundation | App shell, table/detail patterns, URL-driven filters, demo sessions and server-side permissions, typed business logic, and regression tests. |

## KYC business rules

Pending cases can be approved, rejected, or escalated, subject to role permissions. Analysts cannot approve high-risk cases; only admins can approve them. Analysts can still reject or escalate high-risk pending cases, and the interface shows them a disabled Approve button with an explanation. Low- and medium-risk approvals retain their prior behavior. Escalated cases require an admin for final resolution; approved and rejected cases are terminal.

Restrictions are enforced by the server using the case's database-stored risk tier, not a value sent by the browser. Unauthorized attempts do not change case status and write no audit event. Successful decisions use a conditional status update and write an audit event in the same database transaction. Rejections and escalations require a reason of at least 10 characters.

The refunds dashboard is intentionally read-only and uses a local mock API rather than a payment provider. To see the simulated unavailable-provider state, visit `/refunds?simulate=unavailable` (also `slow`, `timeout`, `error`, `malformed`).

## Run locally

Requirements: Node.js 24 (pinned in `package.json` `engines`; other versions untested) and npm.

```bash
npm ci
cp .env.example .env
# Edit .env and set SESSION_SECRET to a long random value (at least 32 characters).
npm run setup
npm run dev
```

Open http://localhost:3000, choose a demo identity, and explore the applications.

| Command | Purpose |
|---|---|
| `npm run setup` | Generate Prisma client, initialize SQLite, and seed synthetic demo data |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Build / serve the production app |
| `npm run start:deploy` | Hosting start: apply the schema without resetting, seed only an empty database, then serve on `$PORT` |
| `npm run db:reset` | Reset and reseed locally (deletes demo changes) |
| `npm test` | Vitest unit/integration suite |
| `npm run test:e2e` | Playwright production-build browser tests (may require `npx playwright install chromium`) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint checks |

## Demo identities

| Name | Role | Access |
|---|---|---|
| Aarzu Gupta | Viewer | Read KYC and refunds; no decisions |
| Marcus Lee, Elena Rossi, Tomás Alvarez | Analyst | View and act on pending cases, subject to the risk-based approval policy |
| Jordan Blake | Admin | All permitted case actions, high-risk approval, escalated-case resolution, and global audit access |

Demo sign-in is impersonation, not authentication. Anyone with access can select any identity, including Admin. The signed HTTP-only cookie stores the selected user's ID; the server resolves permissions independently. Do not use real customer data or secrets.

## Architecture

**Stack:** Next.js 15 (App Router), TypeScript, Fluent UI v9, Tailwind CSS, Prisma 6, SQLite, Vitest, and Playwright. The application is a modular monolith: shared infrastructure without prematurely introducing a generalized internal-tools platform.

```text
prisma/                 SQLite schema and seed entry points
src/lib/seed/           Deterministic synthetic KYC dataset
src/lib/domain/         Pure KYC workflow/policy rules and refund metrics
src/lib/auth/           Demo sessions, role resolution, permissions
src/lib/services/       Server-side application services and atomic audit writes
src/lib/integrations/   Typed refunds API adapter and local mock finance API
src/app/actions/        Server action boundaries and validation
src/app/                KYC, refunds, audit, and sign-in pages; mock API route
src/components/         Shared components and app-specific presentation
tests/ and e2e/         Unit/integration tests and production browser checks
```

The KYC workflow is database-backed; refunds uses a typed mock API. The second application reused the app shell, authorization, table, URL-state, error/date helpers, and visual patterns; it still required app-specific toolbar and table wiring. One deployable keeps the PoC simple but would require isolation and operational review before supporting a larger app portfolio.

## Engineering evidence and limitations

The work was staged as build → extend → maintain, preserved in three stacked draft PRs. Devin reported that the refunds extension took 20 minutes 41 seconds of agent elapsed time. The subsequent KYC policy change took 12 minutes 7 seconds through its policy/docs commits, with further development-server investigation afterward. These are agent-reported elapsed times from Git timestamps, not measured human effort or a Power Apps speed benchmark.

After the maintenance change, Devin reported 115/115 Vitest tests, clean type-check and lint, 5/5 production-build browser tests, and 15/15 across three production runs. Earlier first-pass attempts revealed test-helper, typing, hydration, and production-only lost-click bugs that were corrected. Development-server browser tests remain unreliable; the cause is unresolved. GitHub Actions (`.github/workflows/ci.yml`) runs type-check, lint, Vitest, and the production-build Playwright tests on every pull request and push to `main`. See [`docs/experiment_evidence.md`](docs/experiment_evidence.md) and the PR histories for checkpoints and detailed failures.

This prototype does not validate enterprise SSO, real KYC/payment integrations, managed data governance, production security, sensitive-data retention, scalable analytics, monitoring, backup/recovery, deployment controls, or nontechnical visual app authoring. The demo uses SQLite, a freely selectable role, and application-level audit history. Real deployment would require dedicated security, compliance, and operational review.

**Evaluation takeaway:** The prototype demonstrates that Devin can build and evolve useful internal application code with meaningful reuse. It does not establish full platform replacement, lower total cost of ownership, or production readiness; those require independent evaluation of licensing, engineering labor, integration, governance, and ongoing operations.
