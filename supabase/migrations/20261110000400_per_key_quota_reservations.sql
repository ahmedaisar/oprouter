-- Track reservations against both the account pool and individual API keys.
alter table public.usage_reservations add column if not exists api_key_id uuid references public.api_keys(id) on delete cascade;
create index if not exists usage_reservations_api_key_expiry_idx on public.usage_reservations(api_key_id, expires_at) where api_key_id is not null;

create or replace function public.reserve_gateway_quota(
  p_user_id uuid,
  p_api_key_id uuid,
  p_reserved_tokens integer,
  p_workspace_limit bigint,
  p_key_limit bigint
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
set search_path = pg_catalog, public
set row_security = off
as $
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  v_user_used bigint := 0;
  v_user_reserved bigint := 0;
  v_key_used bigint := 0;
  v_key_reserved bigint := 0;
  v_effective_limit bigint;
  v_id uuid;
begin
  if p_user_id is null or p_api_key_id is null then raise exception 'User and API key are required.'; end if;
  if p_reserved_tokens is null or p_reserved_tokens < 1 or p_reserved_tokens > 1000000 then raise exception 'Invalid token reservation.'; end if;
  if p_workspace_limit is not null and p_workspace_limit < 1 then raise exception 'Invalid workspace limit.'; end if;
  if p_key_limit is not null and p_key_limit < 1 then raise exception 'Invalid key limit.'; end if;
  if not exists (select 1 from public.api_keys k where k.id = p_api_key_id and k.user_id = p_user_id and k.revoked_at is null) then
    raise exception 'API key is not active or does not belong to this user.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_api_key_id::text, 1));
  delete from public.usage_reservations where user_id = p_user_id and expires_at <= now();

  select coalesce(sum(e.total_tokens),0)::bigint into v_user_used
    from public.usage_events e where e.user_id=p_user_id and e.created_at>=v_month_start;
  select coalesce(sum(r.reserved_tokens),0)::bigint into v_user_reserved
    from public.usage_reservations r where r.user_id=p_user_id and r.created_at>=v_month_start and r.expires_at>now();
  select coalesce(sum(e.total_tokens),0)::bigint into v_key_used
    from public.usage_events e where e.api_key_id=p_api_key_id and e.created_at>=v_month_start;
  select coalesce(sum(r.reserved_tokens),0)::bigint into v_key_reserved
    from public.usage_reservations r where r.api_key_id=p_api_key_id and r.created_at>=v_month_start and r.expires_at>now();

  if (p_workspace_limit is not null and v_user_used+v_user_reserved+p_reserved_tokens>p_workspace_limit)
     or (p_key_limit is not null and v_key_used+v_key_reserved+p_reserved_tokens>p_key_limit) then
    v_effective_limit := case when p_workspace_limit is null then p_key_limit when p_key_limit is null then p_workspace_limit else least(p_workspace_limit,p_key_limit) end;
    return query select false,v_user_used,v_user_reserved,v_effective_limit,v_month_start+interval '1 month',null::uuid;
    return;
  end if;

  insert into public.usage_reservations(user_id,api_key_id,reserved_tokens,expires_at)
  values(p_user_id,p_api_key_id,p_reserved_tokens,now()+interval '2 hours') returning id into v_id;
  v_effective_limit := case when p_workspace_limit is null then p_key_limit when p_key_limit is null then p_workspace_limit else least(p_workspace_limit,p_key_limit) end;
  return query select true,v_user_used,v_user_reserved,v_effective_limit,v_month_start+interval '1 month',v_id;
end;
$$;
revoke all on function public.reserve_gateway_quota(uuid,uuid,integer,bigint,bigint) from public,anon,authenticated;
grant execute on function public.reserve_gateway_quota(uuid,uuid,integer,bigint,bigint) to service_role;
