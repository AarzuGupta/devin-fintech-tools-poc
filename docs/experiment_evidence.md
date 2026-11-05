# Experiment evidence — refunds dashboard (second application)

This report was compiled from Git history, GitHub activity, test output and this Devin session's log. Each value is labelled **verified** (observed directly in those sources), **estimated**, or **unavailable**. Timestamps are UTC. Git and push timestamps record agent wall-clock activity only. They do **not** measure active human engineering time.

## Commits and timing

| Item | Value | Label |
| --- | --- | --- |
| Baseline (KYC, incl. visual polish) | `c59a8d48f3b3522768ea33c7feb6e3bec722de91`, pushed 2026-11-05T06:23:54Z | verified |
| Task start | 2026-11-05T06:33:43Z (recorded with `date` when the branch was created; the VM clock agrees with GitHub's server timestamps below) | verified |
| Checkpoint 1: domain, mock API, adapter, tests | `59c6d2772070a62c4ddc0643fbb8bf483f867e67`, branch created on GitHub 06:36:08Z. 19 files, +1044/−14 | verified |
| Checkpoint 2: functional dashboard | `b7fa779eed4ff29d160897d6d6e877b456c5df6a`, pushed 06:39:07Z. 19 files, +703/−107 | verified |
| Checkpoint 3: production click fix, browser tests | `e1ca4b9f1f228c696aa54f100f1f46af0eda5e9f`, pushed 06:46:27Z. 5 files, +109/−32 | verified |
| Checkpoint 4: docs and this report | The commit that adds this file. Its SHA and timestamp are in `git log` and the PR #2 description | verified (in git) |
| Elapsed time, start to checkpoint 3 | ≈ 12¾ min of agent wall-clock time | verified (from timestamps) |
| Active human time | Not measurable from these sources | unavailable |
| Reference: KYC application (first app) | Branch created 05:24:41Z, Phase 1 final push 06:01:07Z, polish push 06:23:54Z (GitHub activity). The session started 05:16Z and included planning | verified |
| Total diff vs baseline (before checkpoint 4) | 39 files, +1827/−124. Full diff: PR #2 | verified |
| Devin usage / cost | `devin_session_insights` returned `acus_consumed=0.0` while the session was running. No billed figure or per-ACU rate is exposed to the session | unavailable |

## Test runs: first attempt vs final

| Stage | First attempt | Cause | Final |
| --- | --- | --- | --- |
| CP1 Vitest | 100/101: adapter timeout test failed | The in-process fake `fetch` used in tests ignored the abort signal, so a timed-out request still returned data. It was a test-helper bug, not an app bug | 101/101 (verified) |
| CP2 `tsc` | Failed: union narrowing in `refunds/page.tsx` (two passes) | Typing of combined success/error results | Clean (verified) |
| CP2 dev browser check | Console errors: Fluent `Toolbar` "mover API used before initialization" on `/refunds`, and `useId` hydration mismatches on filtered URLs of **both** `/refunds` and `/kyc` | The first came from Suspense streaming combined with Fluent Toolbar. The second came from `useId` in the filter select. Baseline `CaseToolbar` used the same pattern, so it is likely pre-existing (estimated; not re-run on the baseline) | 0 console errors on checked URLs (verified) |
| CP2 layout | With the panel open, the toolbar wrapped and the nav "Feature flags" label wrapped | Width | Fixed (verified by screenshot) |
| CP3 Playwright (prod build) | 3/4: refunds workflow timed out because a row click did nothing | Page-level `<Suspense>` boundary: clicks were dropped in `next build` output. A scripted repro also lost the sort click on its first iteration. This is the same failure class as KYC's earlier `loading.tsx` defect | Boundary removed. Repro 12/12 OK (verified) |
| CP3 Playwright, 2nd run | 3/4 | My assertion expected "Failed"; the history text is "Refund failed" (test bug) | 4/4. Then `--repeat-each=3`: 12/12 (verified) |
| CP3 Playwright, dev server (`E2E_DEV=1`) | 3/4: KYC reject test `toHaveText` failed once | Not determined. It did not reproduce in 2 further dev repeats (4/4) | Unresolved intermittent dev-only failure (verified observation) |
| Lint / typecheck | Clean at each checkpoint | | verified |

Final suite (verified at checkpoint 3, re-run before checkpoint 4): Vitest 101/101, of which 60 are the unchanged KYC tests and 41 are new refunds tests. Playwright 4/4 against the production build: 2 KYC + 2 refunds. Production build, ESLint and `tsc --noEmit` are clean. No existing test was removed or weakened.

## Reuse and changes to the KYC code (verified from the diff)

- **Reused unchanged:** `DataTable`, `PageHeader`, `AppShell` layout, `useUrlState`, signed session + `requireActor`/`requirePermission`, `AppError`, `format.ts` date helpers, `searchParams.ts`, the Fluent theme/visual system.
- **Modified for concrete reuse:**
  - `PanelCloseLink` moved from `components/kyc/` to `components/` and given a `label` prop.
  - `DetailSection`/`DetailField` extracted from `CaseDetailPanel`.
  - `FilterSelect`/`UrlSearchBox` extracted from `CaseToolbar`, with deterministic ids to fix the hydration mismatch.
  - `ToneBadge` extracted in `Badges`.
  - `mulberry32` moved to `lib/seed/random.ts`.
  - `refunds:read` added to `permissions.ts`.
  - `NavLinks` grouped by section, with a planned Feature flags entry and a pending spinner (`useLinkStatus`).
  - `AppShell` subtitle changed.
- **New, refunds-specific:**
  - `lib/domain/refunds.ts`, `services/refundService.ts`, `integrations/refundsApi/*` (contract, client, server config, mock server and data), and two API routes.
  - `components/refunds/*` and the shared `Pagination`.
  - 3 Vitest files plus a helper, and `e2e/refunds.spec.ts`.
- **Structurally similar to KYC rather than shared:** `RefundToolbar` vs `CaseToolbar` (refresh/clear/filters layout), `RefundTable` vs `CaseTable` (`DataTable` wrapper with sort/selection), and the per-app label maps.
- **Not used:** Prisma persistence and `auditService`/`AuditEvent`. The dashboard is read-only, so it has no auditable actions.
- **KYC regressions:** none observed. The 60 KYC Vitest tests and 2 KYC Playwright tests pass in the production build. The dev-only intermittent failure above is unresolved.

## User interventions during this task (verified, session log)

1. The task request itself.
2. A clarification: use Git, PR, tests and session logs as evidence; no manual running log; produce this file. A draft engineering log was deleted in response.
3. An evaluation clarification: what to report, and to separate first-pass from final behaviour.
4. A final evidence clarification: format of the handoff, and listing limitations for 10+ apps.

None of these changed the product scope or corrected the code.

## Unresolved limitations relevant to 10+ applications

- **Production-only lost clicks:** with Next 15.5, `<Suspense>`/`loading.tsx` around search-param pages dropped clicks in production builds, for both apps. The root cause in Next/React was not identified. New pages must avoid these boundaries, and only production-build e2e tests catch the failure.
- **Global roles:** three roles and a static permission map in code. There is no per-app role administration, group mapping or SSO; sign-in is demo impersonation.
- **Duplicated list-page wiring:** each app re-implements the toolbar, table wrapper and label maps. A list-page pattern is not extracted yet.
- **Single deployable:** one Next.js app and one SQLite file, so all tools share releases, schema and runtime. There are no module-boundary checks.
- **Integration maturity:** metrics are computed in-app from every matching upstream record, which won't hold at real volumes. The adapter has no retry/backoff, circuit breaker or upstream observability. The mock runs in-process and does not exercise network/TLS failures, and it does not demonstrate compatibility with any real connector.
- **Read access is not audited.** Only KYC decisions write audit events.
- **E2E suite:** runs serially against one seeded database, so runtime grows with each app. There is one unexplained dev-mode intermittent failure.
