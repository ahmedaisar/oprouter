-- Developer API keys are stored as one-way hashes and are never readable by clients.
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null unique,
  key_hash text not null unique,
  model_allowlist text[],
  monthly_token_limit bigint check (monthly_token_limit is null or monthly_token_limit > 0),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_user_created_idx on public.api_keys(user_id, created_at desc);
alter table public.api_keys enable row level security;
alter table public.api_keys force row level security;
revoke all on public.api_keys from public, anon;
grant select on public.api_keys to authenticated;
drop policy if exists "Users can read their own API keys" on public.api_keys;
create policy "Users can read their own API keys" on public.api_keys
  for select to authenticated using ((select auth.uid()) = user_id);
-- Only the service role can create, authenticate, update or revoke keys.
revoke insert, update, delete on public.api_keys from authenticated;
alter table public.usage_events add column if not exists api_key_id uuid references public.api_keys(id) on delete set null;
create index if not exists usage_events_api_key_created_idx on public.usage_events(api_key_id, created_at desc) where api_key_id is not null;
