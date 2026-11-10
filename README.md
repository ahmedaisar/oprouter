# OpRouter

A Next.js App Router workspace and OpenAI-compatible AI gateway powered by OpenRouter.

## Stack
- Next.js 15 App Router and TypeScript
- React 19
- OpenRouter API (server-side provider proxy)
- Supabase Auth and Postgres

## Local development
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `OPENROUTER_API_KEY` server-side.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable accounts.
5. Apply every SQL migration in `supabase/migrations`.
6. Set `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable for trusted key management and usage ingestion.
7. Optionally set `DEFAULT_MONTHLY_TOKEN_LIMIT` to a positive whole number. Leave blank to disable the shared workspace cap.
8. Configure Supabase Auth site URL and redirect URL to include `http://localhost:3000/auth/callback`.
9. Run `npm install` and `npm run dev`.

## Routes
- `/` — workspace overview
- `/models` — live model catalogue
- `/playground` — multi-model streaming comparison
- `/login` — sign-in and sign-up
- `/activity` — usage history and monthly allowance
- `/settings` — account and developer API keys
- `POST /api/v1/chat/completions` — OpenAI-compatible chat completions endpoint
- `GET|POST|DELETE /api/keys` — authenticated API key management

## Developer gateway
Create keys in **Settings → API keys**. A secret is displayed once at creation; only its SHA-256 hash and a short prefix are stored. Keys can be revoked at any time. Treat keys like passwords and send them only in the `Authorization: Bearer` header.

Example:
```bash
curl https://YOUR_APP_HOST/api/v1/chat/completions \
  -H "Authorization: Bearer opk_live_YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role":"user","content":"Hello from OpRouter"}],
    "stream": false
  }'
```

The endpoint accepts OpenAI-style `model`, `messages`, `temperature`, `max_tokens` and `stream`. Streaming is enabled by default. It returns provider-compatible completion payloads and SSE frames. API keys may optionally be restricted to a list of model IDs and assigned a monthly token cap. The effective cap is the lower of the key cap and `DEFAULT_MONTHLY_TOKEN_LIMIT`; quota reservations are atomic per account, so multiple keys share the same account usage pool.

Usage events are ingested server-side from provider-reported token and cost metadata and associated with the API key. Missing usage metadata retains a quota reservation for up to two hours rather than silently releasing it.

## Security and data access
- API key material is generated with cryptographic randomness, shown once, and stored as a one-way SHA-256 hash. Authentication compares hashes in constant time.
- API keys are user-owned. Browser sessions can list and revoke only their own keys; creation, authentication and secret fields use the server-only Supabase service-role client.
- Supabase row-level security protects usage and API key records. Never expose the service-role key or OpenRouter key to browser code.
- Model allowlists are enforced server-side. Revocation takes effect on the next request.
- The API gateway requires Supabase Auth and a configured service-role key. Local/demo browser playground mode remains separate.

## Validation
```bash
npm run lint
npm run typecheck
npm run build
```
