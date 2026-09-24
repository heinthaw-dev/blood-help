-- Auto-expanding search radius: the half that actually moves.
--
-- 20260924190500 added the state columns and 20260924190600 added donors_in_ring(),
-- but nothing ever wrote search_radius_km. Every request sat at 10 km forever while
-- RequestLive faithfully polled the column and reported 10. This migration adds the
-- mover: a SQL state machine, a durable queue for the alerts a widening owes, and a
-- per-minute cron tick that drives both.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- The ring queue
-- ---------------------------------------------------------------------------
-- A widening is two separate facts: the radius grew (Postgres, instant, reliable)
-- and the donors it newly reached were alerted (FCM, over the network, fallible).
-- Writing them as one step loses the alert whenever a push fails — the request
-- would read 15 km with nobody in the 10-15 km band ever buzzed and no record that
-- it happened. That is the silent failure this app exists to prevent, so the ring
-- is recorded as owed and stays owed until delivery actually settles it.
create table if not exists public.radius_expansion_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests(id) on delete cascade,
  -- Exclusive inner, inclusive outer — the bounds donors_in_ring() expects.
  inner_km int not null,
  outer_km int not null,
  created_at timestamptz not null default now(),
  -- Null while the ring is still owed an alert. Stamped on every terminal outcome
  -- (sent, nothing to send, superseded) so only genuine failures come back.
  notified_at timestamptz,
  -- Bounded retry. Incremented when the worker claims the row, not when it
  -- succeeds, so a worker that crashes mid-send burns an attempt instead of
  -- looping on the same ring forever.
  attempts int not null default 0,
  last_error text
);

-- Partial index: the worker only ever asks for unsettled rings, and that set stays
-- near-empty in normal operation while the table grows for the life of the project.
create index if not exists radius_expansion_events_pending_idx
  on public.radius_expansion_events (created_at)
  where notified_at is null;

alter table public.radius_expansion_events enable row level security;
-- No policies, deliberately. This is job-internal bookkeeping: the service role
-- bypasses RLS, and every other role must see nothing. A donor must not be able to
-- read which rings were alerted and when.

comment on table public.radius_expansion_events is
  'One row per widening — the band of donors that widening newly reached and still owes an alert. Drained by the expand-radius edge function.';
comment on column public.radius_expansion_events.attempts is
  'Incremented when the worker claims the row, so a crash mid-send is bounded rather than retried forever.';

-- ---------------------------------------------------------------------------
-- The state machine
-- ---------------------------------------------------------------------------
-- Pure SQL on purpose: widening is what the waiting requester reads on screen, so
-- it must not depend on a secret being present or an edge function being reachable.
create or replace function public.expand_request_radius()
returns table (
  request_id uuid,
  old_radius_km int,
  new_radius_km int,
  hit_cap boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_step_km  constant int      := 5;
  v_cap_km   constant int      := 30;
  v_every    constant interval := interval '3 minutes';
begin
  return query
  -- The three steps run as one statement so a request cannot be widened without
  -- its ring being queued, or vice versa.
  with due as (
    select r.id, r.search_radius_km as old_km
    from public.blood_requests r
    where r.status = 'active'
      and r.search_radius_km < v_cap_km
      -- Null radius_last_expanded_at means never widened, so the clock runs from
      -- creation — the first widening is due 3 minutes after the request is posted.
      and coalesce(r.radius_last_expanded_at, r.created_at) <= now() - v_every
      -- Widening stops at the first response: once somebody is coming, buzzing a
      -- wider band of strangers is noise, not help.
      and not exists (
        select 1
        from public.request_responses rr
        where rr.request_id = r.id
          and rr.status = 'responding'
      )
    -- Two overlapping cron ticks must not both widen the same request. The second
    -- tick skips locked rows rather than waiting and applying a duplicate +5.
    for update skip locked
  ),
  bumped as (
    update public.blood_requests b
    set search_radius_km = least(b.search_radius_km + v_step_km, v_cap_km),
        radius_last_expanded_at = now()
    from due
    where b.id = due.id
    returning b.id, due.old_km, b.search_radius_km as new_km
  ),
  queued as (
    insert into public.radius_expansion_events (request_id, inner_km, outer_km)
    select bumped.id, bumped.old_km, bumped.new_km from bumped
    returning 1
  )
  select bumped.id, bumped.old_km, bumped.new_km, (bumped.new_km >= v_cap_km)
  from bumped;
end;
$function$;

comment on function public.expand_request_radius() is
  'Widens every due request by 5 km toward the 30 km cap and queues the ring each widening newly reached. Due = active, under cap, zero responders, last widened over 3 minutes ago.';

-- ---------------------------------------------------------------------------
-- The tick
-- ---------------------------------------------------------------------------
create or replace function public.run_radius_expansion()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pending int;
  v_url     text;
  v_key     text;
begin
  -- Step 1 — move the radius. Always runs, never network-bound.
  perform public.expand_request_radius();

  -- Step 2 — poke the delivery worker, but only if a ring is actually owed. An
  -- idle project must not make an HTTP call every minute for nothing.
  select count(*) into v_pending
  from public.radius_expansion_events
  where notified_at is null
    and attempts < 5;

  if v_pending = 0 then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';

  -- Missing secrets degrade delivery, not widening. The warning names the cause so
  -- this does not present as "the job silently stopped working".
  if v_url is null or v_key is null then
    raise warning '[radius] % ring alert(s) pending but vault secrets project_url/service_role_key are unset — radius still widened', v_pending;
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/expand-radius',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$function$;

comment on function public.run_radius_expansion() is
  'Cron entry point: widens due requests, then asks the expand-radius edge function to deliver any owed ring alerts. Delivery failures never block widening.';

-- Every minute, not every three. The 3-minute gate lives in the state machine, so a
-- frequent tick only means a request widens close to when it is actually due rather
-- than up to 3 minutes late.
select cron.schedule(
  'expand-request-radius',
  '* * * * *',
  $cron$select public.run_radius_expansion()$cron$
);

-- ---------------------------------------------------------------------------
-- The claim
-- ---------------------------------------------------------------------------
-- The worker must not select-then-update: two overlapping drains would both read
-- the same pending ring and push it twice, and a donor buzzed twice for one
-- widening is exactly the noise the ring bounds were designed to avoid. Claiming
-- is therefore a single statement, and it hands back everything the push needs so
-- the worker makes one round trip instead of three per ring.
create or replace function public.claim_radius_expansion_events(p_limit int default 50)
returns table (
  event_id uuid,
  request_id uuid,
  inner_km int,
  outer_km int,
  blood_type public.blood_type,
  lat double precision,
  lng double precision,
  urgency public.urgency,
  current_address text,
  -- False when the request closed or was answered between the widening and this
  -- drain. The ring is then settled without a push rather than retried.
  still_alerting boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return query
  with claimed as (
    update public.radius_expansion_events e
    set attempts = e.attempts + 1
    where e.id in (
      select e2.id
      from public.radius_expansion_events e2
      where e2.notified_at is null
        and e2.attempts < 5
      order by e2.created_at
      for update skip locked
      limit p_limit
    )
    returning e.id, e.request_id, e.inner_km, e.outer_km
  )
  select
    c.id,
    c.request_id,
    c.inner_km,
    c.outer_km,
    r.blood_type,
    r.lat,
    r.lng,
    r.urgency,
    r.current_address,
    (
      r.status = 'active'
      and not exists (
        select 1
        from public.request_responses rr
        where rr.request_id = r.id
          and rr.status = 'responding'
      )
    )
  from claimed c
  join public.blood_requests r on r.id = c.request_id;
end;
$function$;

comment on function public.claim_radius_expansion_events(int) is
  'Atomically claims pending ring alerts for the expand-radius worker, incrementing attempts and returning the request context each push needs.';

revoke all on function public.expand_request_radius() from public, anon, authenticated;
revoke all on function public.run_radius_expansion() from public, anon, authenticated;
revoke all on function public.claim_radius_expansion_events(int) from public, anon, authenticated;
