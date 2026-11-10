# OpRouter

A Next.js App Router workspace for discovering AI models and comparing streamed responses through OpenRouter.

## Stack
- Next.js 15 App Router and TypeScript
- React 19
- OpenRouter API (server-side proxy)
- Supabase Auth and Postgres (optional until configured)

## Local development
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `OPENROUTER_API_KEY` in `.env.local`. Keep it server-only; do not use a `NEXT_PUBLIC_` prefix.
4. To enable accounts, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project.
5. Apply the SQL migration in `supabase/migrations` using the Supabase CLI or SQL editor.
6. Set `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable to enable trusted usage ingestion. Never prefix it with `NEXT_PUBLIC_` or expose it to the browser.
6. Configure the Supabase Auth site URL and allowed redirect URL to include `http://localhost:3000/auth/callback`.
8. Run `npm install` and `npm run dev`, then open http://localhost:3000.

## Available routes
- `/` — workspace overview
- `/models` — live OpenRouter model catalogue
- `/playground` — multi-model streaming comparison
- `/login` — email/password sign-in and sign-up
- `/activity` — authenticated user's usage history
- `/settings` — account and sign-out

## Authentication and data access
- Supabase sessions use `@supabase/ssr` cookies and are refreshed in Next middleware.
- When Supabase is configured, playground, activity, and settings routes require a verified session. The chat API independently checks the user with `auth.getUser()`.
- When Supabase credentials are absent, the app remains in local/demo mode. Configure Supabase before exposing the app publicly.
- The usage-events migration enables and forces row-level security. Authenticated users can read only rows whose `user_id` matches `auth.uid()`.
- Usage writes are intentionally not granted to browser clients. Authenticated chat streams request provider usage metadata and persist token counts and reported cost through a server-only Supabase service-role client. Browser clients cannot forge token counts or costs.
- Never expose a Supabase service-role key in browser code or a `NEXT_PUBLIC_` variable.

## Validation
```bash
npm run lint
npm run typecheck
npm run build
```
GitHub Actions runs these checks for pull requests targeting `main` and pushes to `main` or feature branches.

## Security notes
- The OpenRouter API key is read only on the server by `/api/chat`.
- The browser calls the same-origin API route and never receives the provider key.
- Per-user quotas and enforcement remain a follow-up; usage history is persisted only when the server-only service-role key is configured.
