# OpRouter product plan

**Current phase: gateway hardening and release readiness.** This file is the authoritative product roadmap; status claims are kept distinct from planned work and verified production behavior.

## Product shape and decisions
- Audience: individual developers integrating OpenAI-compatible model APIs through one managed gateway.
- Workspace: individual user account; no organization/team model.
- Identity and billing: Supabase Auth; no billing or paid entitlements.
- Anonymous public actions: no. Gateway requests require an owner-issued OpRouter API key.
- Embedded agents: no. Model inference is a server-side provider integration.
- Member home: `/` (authenticated workspace); `/login` for sign-in.
- Provider: OpenRouter behind a server-side proxy. Provider credentials never reach browser code.
- Browser playground remains a product surface; gateway reliability and developer controls take priority over monetization.
- Default rate limit: 60 requests per API key per fixed 60-second window; `GATEWAY_RATE_LIMIT_PER_MINUTE` overrides it (1–10,000).
- Workspace monthly token cap: `DEFAULT_MONTHLY_TOKEN_LIMIT`; optional per-key monthly token caps are also supported.

## Phases and completion evidence

### 1. Product foundation and playground — done (2026-11-10)
- Workspace shell, model catalogue, login, playground, settings and activity routes.
- Multi-model streaming comparison.
- Evidence: routes and components in `src/app/` and `src/components/`; README usage instructions.

### 2. Identity, API keys and usage foundations — implemented in code (2026-11-10)
- Supabase Auth, usage events and workspace quota migrations.
- Developer API keys: cryptographic random generation, SHA-256 hash at rest, prefix lookup, owner-scoped list/revoke, model allowlist and optional per-key monthly cap.
- Atomic workspace/per-key quota reservations.
- Evidence: migrations `20261110000100`–`20261110000400`, `src/lib/api-keys.ts`, `/api/keys`.
- Caveat: runtime production flow has not been fully exercised with a signed-in user and real provider call.

### 3. Gateway reliability and security — in progress
- OpenAI-compatible non-stream and SSE chat completions; validation, model authorization, usage persistence and reservation cleanup.
- Persistent per-key fixed-window rate limiting shared across serverless instances.
- Upstream timeout and well-formed terminal SSE timeout event; client cancellation remains distinct.
- Deterministic integration tests for authentication, validation, model restrictions, rate limits, quotas, provider errors, streaming, timeouts and reservation lifecycle.
- Supabase function concurrency, grants and RLS tests against an isolated development database.
- Health/readiness checks and structured redacted operational logs.
- Done when required CI suites pass, DB atomicity/privileges are proven, the independent review has no introduced finding above Low, and production smoke evidence is recorded.

### 4. Developer experience and observability — planned
- Complete API reference with curl, Node and Python examples, supported fields, errors, stream parsing and rate-limit headers.
- API key rename/rotation with safe overlap and revocation; per-key last-used status.
- Per-key/model usage, provider cost, latency and request outcome views with tenant isolation.
- Model/provider metadata and pricing with explicit source and freshness.

### 5. Production readiness and first release — not yet complete
- Independent review, security and performance review proposals, coverage map, release history and environment record.
- Production smoke: exact served commit, `/health`, auth callback, create/revoke key, non-stream request, SSE request, quota/rate boundaries and usage ingestion.
- Front-door/legal content must describe actual data flows, provider forwarding, logging and retention; owner approves legal text.
- Production sign-up and authenticated flows must be tested with a dedicated account; no real customer credentials in tests.

### 6. Organizations, teams and billing — deferred
- Only revisit after gateway reliability and production readiness are complete and the owner chooses a business model.
- No billing tables, prices, plans, entitlements or team roles are implied by this roadmap.

## Current execution order
1. Repair PR #13's lint/test failures and complete all required CI checks; no merge while red or pending.
2. Verify the integration harness truly exercises the route with isolated Supabase/OpenRouter mocks; fix misleading assertions and cover timeout/error stream semantics.
3. Add database-level tests for rate-limit and quota RPC concurrency, RLS and service-role-only grants.
4. Add health/readiness semantics and redacted structured gateway telemetry.
5. Generate and maintain architecture, flows, permissions, environment-variable and test-coverage docs.
6. Perform independent review and a safe production smoke. Record unverified authenticated/provider steps honestly.
7. Proceed to API key lifecycle, analytics and complete docs. Teams/billing stay deferred.

## Definition of done
- A stage is done only when its own done-when holds and its gate passes on the agent's own run.
- Tests and docs land with the change; a bug fix includes a regression test that fails before the fix.
- Green lint/typecheck/build alone does not prove a data boundary, RPC privilege or production runtime.
- No PR is merged until every required CI check completes successfully. A deploying push requires a clean independent review round.

## Current status snapshot (2026-11-10)
- `main` latest recorded CI run: success at `35d074f`.
- PR #13 (gateway stream timeout + integration tests): open; its initial CI run failed at lint. Lint fixes are being applied on its branch; no successful rerun is yet evidenced.
- PR #14 was created against PR #13's feature branch and has no GitHub Actions workflow run because CI only runs PRs targeting `main`; its changes are being folded back into PR #13.
- Persistent rate limit migration `20261110000500_gateway_rate_limits.sql` and route integration are present on `main`; migration was previously applied to the connected Supabase project.
- No complete production authenticated/provider smoke has been verified.