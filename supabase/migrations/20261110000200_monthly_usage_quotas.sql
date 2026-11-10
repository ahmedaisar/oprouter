-- Monthly token quotas use short-lived reservations so parallel requests
-- for one user cannot all pass against the same remaining allowance.
create table if not exists public.usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reserved_tokens integer not null check (reserved_tokens > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists usage_reservations_user_expiry_idx
  on public.usage_reservations (user_id, expires_at);

-- This table and its functions are only for trusted server-side use.
revoke all on public.usage_reservations from public, anon, authenticated;

create or replace function public.reserve_usage_quota(
  p_user_id uuid,
  p_reserved_tokens integer,
  p_monthly_token_limit bigint
)
returns table (
  allowed boolean,
  used_tokens bigint,
  reserved_tokens bigint,
  monthly_limit bigint,
  resets_at timestamptz,
  reservation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  v_used_tokens bigint := 0;
  v_reserved_tokens bigint := 0;
  v_reservation_id uuid;
begin
  if p_user_id is null then
    raise exception 'A user id is required.';
  end if;
  if p_reserved_tokens is null or p_reserved_tokens < 1 or p_reserved_tokens > 1000000 then
    raise exception 'The requested token reservation is invalid.';
  end if;
  if p_monthly_token_limit is null or p_monthly_token_limit < 1 then
    raise exception 'The monthly token limit must be a positive integer.';
  end if;

  -- Serialize quota checks per user. The reservation is inserted in the same
  -- transaction as the check, so concurrent requests see one another.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  delete from public.usage_reservations
  where user_id = p_user_id and expires_at <= now();

  select coalesce(sum(e.total_tokens), 0)::bigint
    into v_used_tokens
    from public.usage_events as e
   where e.user_id = p_user_id
     and e.created_at >= v_month_start;

  select coalesce(sum(r.reserved_tokens), 0)::bigint
    into v_reserved_tokens
    from public.usage_reservations as r
   where r.user_id = p_user_id
     and r.created_at >= v_month_start
     and r.expires_at > now();

  if v_used_tokens + v_reserved_tokens + p_reserved_tokens > p_monthly_token_limit then
    return query select
      false, v_used_tokens, v_reserved_tokens, p_monthly_token_limit,
      v_month_start + interval '1 month', null::uuid;
    return;
  end if;

  insert into public.usage_reservations (user_id, reserved_tokens, expires_at)
  values (p_user_id, p_reserved_tokens, now() + interval '2 hours')
  returning id into v_reservation_id;

  return query select
    true, v_used_tokens, v_reserved_tokens, p_monthly_token_limit,
    v_month_start + interval '1 month', v_reservation_id;
end;
$$;

create or replace function public.release_usage_reservation(
  p_user_id uuid,
  p_reservation_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.usage_reservations
   where user_id = p_user_id and id = p_reservation_id;
$$;

create or replace function public.get_usage_quota(
  p_user_id uuid,
  p_monthly_token_limit bigint
)
returns table (
  used_tokens bigint,
  reserved_tokens bigint,
  monthly_limit bigint,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_user_id is null then
    raise exception 'A user id is required.';
  end if;
  if p_monthly_token_limit is null or p_monthly_token_limit < 1 then
    raise exception 'The monthly token limit must be a positive integer.';
  end if;

  return query
  select
    coalesce((
      select sum(e.total_tokens)::bigint
        from public.usage_events as e
       where e.user_id = p_user_id and e.created_at >= v_month_start
    ), 0),
    coalesce((
      select sum(r.reserved_tokens)::bigint
        from public.usage_reservations as r
       where r.user_id = p_user_id
         and r.created_at >= v_month_start and r.expires_at > now()
    ), 0),
    p_monthly_token_limit,
    v_month_start + interval '1 month';
end;
$$;

revoke all on function public.reserve_usage_quota(uuid, integer, bigint) from public, anon, authenticated;
revoke all on function public.release_usage_reservation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_usage_quota(uuid, bigint) from public, anon, authenticated;
grant execute on function public.reserve_usage_quota(uuid, integer, bigint) to service_role;
grant execute on function public.release_usage_reservation(uuid, uuid) to service_role;
grant execute on function public.get_usage_quota(uuid, bigint) to service_role;
