-- Usage events are append-only and owned by the authenticated user.
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null check (char_length(model) between 1 and 180),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost numeric(14, 8) not null default 0 check (estimated_cost >= 0),
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;
alter table public.usage_events force row level security;

revoke all on public.usage_events from anon, public;
grant select on public.usage_events to authenticated;

drop policy if exists "Users can read their own usage" on public.usage_events;
create policy "Users can read their own usage"
  on public.usage_events for select to authenticated
  using ((select auth.uid()) = user_id);

-- Writes are reserved for trusted server-side ingestion (service role).
-- Authenticated browser clients cannot forge token counts or estimated costs.
-- No update or delete policy: user usage records are immutable.
