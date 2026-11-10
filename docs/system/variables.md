# Environment variables

| Variable | Required | Exposure | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes for auth/gateway | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes for browser auth | Public | Supabase anon key; RLS remains mandatory |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for key management/gateway | Secret, server only | Trusted database access and restricted RPC calls |
| `OPENROUTER_API_KEY` | Yes for model gateway | Secret, server only | Upstream provider authentication |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public | App URL sent as provider HTTP referer |
| `DEFAULT_MONTHLY_TOKEN_LIMIT` | Optional | Server config | Positive integer workspace token cap; blank disables shared cap |
| `GATEWAY_RATE_LIMIT_PER_MINUTE` | Optional | Server config | Positive integer 1–10,000; default 60 requests per key per 60-second window |

Never prefix a secret with `NEXT_PUBLIC_`. Do not commit `.env.local`, provider keys, service-role keys or production connection strings. Keep development and production credentials separate.

Verify actual Vercel environment scope and Supabase integration settings from their dashboards before release; this file documents code-level names, not proof of deployed values.