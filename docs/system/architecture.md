# System architecture

## Runtime
- Next.js 15 App Router with React 19 and TypeScript.
- Vercel hosts the web application and API routes.
- Supabase provides Auth and Postgres. Browser access uses the anon key and RLS; trusted server operations use the service-role client.
- OpenRouter is the upstream model provider. The provider key is read only in server routes.

## Main request paths
- Browser workspace: `/` → models/playground/settings/activity routes; Supabase SSR client handles the user session.
- API key lifecycle: authenticated browser → `GET|POST|DELETE /api/keys` → server-side Supabase admin client.
- Gateway: client → `POST /api/v1/chat/completions` → authenticate hashed OpRouter key → per-key rate-limit RPC → validate model/body/allowlist → reserve token quota if configured → OpenRouter → stream or JSON response → usage event + reservation finalization.
- Activity: authenticated browser → `/api/activity` → owner-scoped usage rows and quota summary.

## Persistence
- `api_keys`: key prefix/hash, owner, allowlist, optional per-key token cap, revocation and last-used fields.
- `usage_events`: completed usage and provider-reported token/cost metadata.
- `usage_reservations`: in-flight quota reservations to prevent concurrent overspend.
- `gateway_rate_limits`: one fixed-window counter row per API key.

## Trust boundaries
- Browser input and API key values are untrusted.
- API key plaintext is returned only at creation; only hash/prefix are persisted.
- Service-role and OpenRouter credentials must never be exposed in client bundles, logs or API responses.
- Database security-definer RPCs must use a fixed search_path, row_security off only where justified, and service-role-only execute grants.
- Upstream provider content is untrusted; preserve provider-compatible response frames while sanitizing internal errors and never logging prompts/secrets.

## Operational caveats
- `/api/health` currently reports process health only; it does not prove Supabase readiness.
- Rate limiting is database-backed and shared across serverless instances; the database function is a critical availability dependency.
- The gateway's 120-second upstream timeout and terminal SSE behavior are under PR review, not a verified production behavior.
- Production authenticated flows and a real provider-backed smoke remain unverified.