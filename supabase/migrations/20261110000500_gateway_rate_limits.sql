-- Persistent fixed-window request limits shared across all gateway instances.
create table if not exists public.gateway_rate_limits (
  api_key_id uuid primary key references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.gateway_rate_limits enable row level security;
alter table public.gateway_rate_limits force row level security;
revoke all on public.gateway_rate_limits from public, anon, authenticated;

create or replace function public.consume_gateway_rate_limit(
  p_api_key_id uuid,
  p_limit integer default 60,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_api_key_id is null then raise exception 'API key is required.'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000 then raise exception 'Invalid rate limit.'; end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then raise exception 'Invalid rate window.'; end if;
  if not exists (
    select 1 from public.api_keys k
    where k.id = p_api_key_id and k.revoked_at is null
  ) then
    raise exception 'API key is not active.';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.gateway_rate_limits(api_key_id, window_start, request_count, updated_at)
  values (p_api_key_id, v_window_start, 1, now())
  on conflict (api_key_id) do update
    set window_start = excluded.window_start,
        request_count = case
          when public.gateway_rate_limits.window_start < excluded.window_start then 1
          when public.gateway_rate_limits.request_count < p_limit
            then public.gateway_rate_limits.request_count + 1
          else public.gateway_rate_limits.request_count
        end,
        updated_at = now()
  returning request_count into v_count;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_gateway_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_gateway_rate_limit(uuid, integer, integer)
  to service_role;
