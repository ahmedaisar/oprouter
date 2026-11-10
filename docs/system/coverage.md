# Test coverage map

Evidence is recorded only after a run completes on the exact commit. A listed test file describes intended coverage, not a passing result by itself.

| Area | Test/evidence | Current status | Missing proof |
|---|---|---|---|
| API key generation/hash/compare | `tests/api-keys.test.ts` | Present on main | Full route owner-isolation test |
| Rate-limit config/header helper | `tests/gateway-rate-limit.test.ts` | Present on main | Postgres RPC atomic concurrency boundary |
| Quota estimation/config | `tests/usage-quota.test.ts` | Present on main | Concurrent reservations and cleanup against real isolated DB |
| Gateway auth/validation/model restriction | `tests/integration/gateway.integration.test.ts` | PR #13, CI previously failed lint | Green CI on exact final head; test assertions need audit |
| Gateway non-stream/SSE/provider errors | Integration suite in PR #13 | PR under review | Test malformed provider and all error paths on exact route |
| Rate limit and monthly quota rejection | Integration suite in PR #13 | PR under review | Multi-instance/concurrent DB-backed RPC test |
| Timeout, stream cancellation and reservation cleanup | Gateway route + PR #13 | Not yet verified | Short configurable timeout test; assert emitted SSE frames and DB cleanup |
| RLS, grants and tenant isolation | Supabase migrations | Schema configured | Automated privilege/RLS and cross-user DB tests |
| Health/readiness | `src/app/api/health/route.ts` | Process-only 200 | DB readiness and failure response |
| Browser authenticated journeys | None | Not implemented | Sign-in, key create/revoke, activity owner isolation at desktop/mobile |
| Production smoke | None recorded | Not verified | Served commit, health, authenticated key flow, provider call and usage reconciliation |

## CI gate
Workflow `.github/workflows/ci.yml` runs lint, TypeScript typecheck, unit tests, integration tests and production build. A CI result counts only for the exact commit SHA and only after all required steps complete. Vercel Preview and Supabase Preview checks do not substitute for the GitHub CI job.

## Recording a run
Add date, commit SHA, workflow run URL, exit result and the exact suites run. Never mark coverage green based only on source presence or inherited reports.