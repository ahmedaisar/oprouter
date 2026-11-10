# Permissions and data access

| Resource/action | Anonymous | Signed-in owner | API-key caller | Service role |
|---|---|---|---|---|
| Supabase Auth session | Sign in/up only | Own session | No | Server session validation |
| API key plaintext | No | Once at create | Presents secret | Creates; never reads plaintext later |
| API key metadata | No | Own keys only | Own key authenticates itself | Auth lookup/list/revoke |
| Usage events | No | Own usage only | No direct DB access | Inserts gateway usage |
| Usage reservations | No | No direct access | Indirectly via gateway | Reserve/finalize/release RPC |
| Gateway rate-limit rows | No | No direct access | Indirectly via gateway | Atomic consume RPC |

## Invariants
- Browser requests never receive Supabase service-role or OpenRouter credentials.
- API key authentication hashes the presented secret and compares it to the stored hash; prefix lookup is not sufficient authentication.
- A user may list/revoke only API keys where `user_id` equals the authenticated session user.
- API key callers can only invoke the public gateway route and are constrained by key revocation, model allowlist, request rate and applicable monthly quotas.
- `usage_events`, `usage_reservations`, `api_keys` and `gateway_rate_limits` have RLS enabled; server-only operations use service role and narrowly granted RPCs.
- RPC execute grants must exclude `PUBLIC`, `anon` and `authenticated` and include `service_role` only.
- Rate limit and quota database errors fail closed; never bypass a missing function or database outage.
- Logs and error responses must not include API key values, auth tokens, provider credentials or message contents.

## Verification required
- Run cross-user API-key list/revoke tests and database privilege/RLS checks.
- Test rate-limit and quota concurrency against an isolated Postgres/Supabase instance.
- Confirm production database migration ledger and function grants before deploying code that calls an RPC.