# OpRouter

A Next.js App Router workspace for discovering AI models and comparing streamed responses through OpenRouter.

## Stack

- Next.js 15 App Router and TypeScript
- React 19
- OpenRouter API (server-side proxy)
- Supabase dependencies are included for upcoming auth and persistence work

## Local development

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `OPENROUTER_API_KEY` in `.env.local`. Keep it server-only; do not use a `NEXT_PUBLIC_` prefix.
4. Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Available routes

- `/` — workspace overview
- `/models` — live OpenRouter model catalogue
- `/playground` — multi-model streaming comparison

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

GitHub Actions runs the validation commands for pull requests targeting `main` and pushes to `main` or feature branches.

## Security notes

- The OpenRouter API key is read only on the server by `/api/chat`.
- The browser calls the same-origin API route and never receives the provider key.
- Add authentication, per-user usage limits, and persistent request accounting before opening this app to untrusted public users.
