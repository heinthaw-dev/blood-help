-- A widening could slip a whole minute behind schedule, every step.
--
-- radius_last_expanded_at was written as now(), read a few milliseconds after the
-- cron run's start_time. The next run's due test is
-- `radius_last_expanded_at <= now() - interval '3 minutes'`, so if that run starts
-- even slightly earlier within its minute than the previous one did, the row misses
-- its own cutoff by milliseconds and waits another full minute.
--
-- Observed live:
--   run 22:34:00.077684  cutoff 22:31:00.077684  stored 22:31:00.091972  → skipped by 14ms
--   run 22:35:00.104682  cutoff 22:32:00.104682                          → widened
--
-- Both clocks are the same now(), read at slightly different moments, so the test is
-- self-referential and will keep skipping at random. Across a full 10→30 km
-- expansion that is up to four extra minutes of a requester watching a number that
-- should have moved.
--
-- The fix is to stop recording a timestamp precise enough to jitter. pg_cron fires on
-- minute boundaries, so the minute is the real resolution of this schedule; storing
-- it truncated makes the comparison stable. Truncation can only ever move the stored
-- time earlier, so the error direction is "widen a moment sooner", which is the right
-- way to be wrong here.

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
        -- Truncated, not raw now() — see the header. The sub-second part of this
        -- timestamp is the only thing that ever made a due request miss its cutoff.
        radius_last_expanded_at = date_trunc('minute', now())
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
  'Widens every due request by 5 km toward the 30 km cap and queues the ring each widening newly reached. Due = active, under cap, zero responders, last widened over 3 minutes ago. The expansion timestamp is truncated to the minute so cron jitter cannot delay a widening by a full tick.';
