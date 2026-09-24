-- Auto-expanding search radius for a blood request.
--
-- A request starts at 10 km. While nobody has responded, a scheduled job widens it
-- by 5 km every 3 minutes up to 30 km, alerting only the donors in each newly added
-- ring. The radius stops being a constant in application code and becomes state on
-- the request itself.

alter table public.blood_requests
  add column if not exists search_radius_km int not null default 10,
  -- Null until the first widening; the next one is due at
  -- coalesce(radius_last_expanded_at, created_at) + 3 minutes.
  add column if not exists radius_last_expanded_at timestamptz,
  -- So the "reached maximum range" message is sent once, not on every cron tick.
  add column if not exists radius_cap_notified boolean not null default false;

alter table public.blood_requests
  add constraint blood_requests_search_radius_km_check
  check (search_radius_km between 10 and 30);

comment on column public.blood_requests.search_radius_km is
  'Current search reach in km. Starts at 10, widens by 5 every 3 minutes while there are zero responders, caps at 30.';
comment on column public.blood_requests.radius_last_expanded_at is
  'When the radius last widened. Null until the first widening — the clock then runs from created_at.';
comment on column public.blood_requests.radius_cap_notified is
  'True once the requester has been told the 30 km cap was reached, so the message is not repeated.';
