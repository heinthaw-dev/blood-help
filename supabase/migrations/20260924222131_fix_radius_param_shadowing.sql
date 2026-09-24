-- The radius arguments never did anything.
--
-- donors_within_radius and requests_within_radius both named their parameters
-- `lat` and `lng`, and both query a table that has columns called `lat` and `lng`.
-- In a SQL function the table's columns win that name resolution, so
-- `st_point(lng, lat)` compiled to the row's own position: every distance was
-- measured from a row to itself. dist_meters came back 0 for everything and
-- st_dwithin(x, x, anything) is always true, so the radius was ignored entirely.
--
-- Measured before this migration: donors_within_radius(16.78, 96.14, 1) returned
-- three donors — one of them 18 km away — each reporting dist_meters = 0.
--
-- donors_in_ring had the same bug and was fixed in 20260924190553 by prefixing its
-- parameters p_. These two were missed. The prefix is the fix: p_lat cannot collide
-- with a column, so the parameter is the only thing it can mean.
--
-- create or replace cannot rename a parameter, so each function is dropped and
-- recreated. Both are security definer with default PUBLIC EXECUTE, which the
-- recreate restores — the callers keep the access they had.

drop function if exists public.donors_within_radius(double precision, double precision, double precision);

create function public.donors_within_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision
)
returns table (
  id uuid,
  profile_id uuid,
  blood_type public.blood_type,
  donation_count integer,
  lat double precision,
  lng double precision,
  dist_meters double precision
)
language sql
security definer
set search_path to ''
as $function$
  SELECT
    d.id,
    d.profile_id,
    d.blood_type,
    d.donation_count,
    d.lat,
    d.lng,
    extensions.st_distance(
      extensions.st_point(d.lng, d.lat)::extensions.geography,
      extensions.st_point(p_lng, p_lat)::extensions.geography
    ) AS dist_meters
  FROM public.donors d
  WHERE
    d.is_available = true
    AND extensions.st_dwithin(
      extensions.st_point(d.lng, d.lat)::extensions.geography,
      extensions.st_point(p_lng, p_lat)::extensions.geography,
      p_radius_km * 1000
    )
  ORDER BY dist_meters;
$function$;

comment on function public.donors_within_radius(double precision, double precision, double precision) is
  'Available donors within p_radius_km of (p_lat, p_lng), nearest first. Parameters are p_-prefixed so they cannot be captured by donors.lat/donors.lng.';

drop function if exists public.requests_within_radius(double precision, double precision, double precision);

create function public.requests_within_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision
)
returns table (
  id uuid,
  requester_id uuid,
  blood_type public.blood_type,
  current_address text,
  contact_phone text,
  units_needed integer,
  units_collected integer,
  urgency public.urgency,
  status public.request_status,
  created_at timestamptz,
  expires_at timestamptz,
  dist_meters double precision
)
language sql
security definer
set search_path to ''
as $function$
  SELECT
    r.id,
    r.requester_id,
    r.blood_type,
    r.current_address,
    r.contact_phone,
    r.units_needed,
    r.units_collected,
    r.urgency,
    r.status,
    r.created_at,
    r.expires_at,
    extensions.st_distance(
      extensions.st_point(r.lng, r.lat)::extensions.geography,
      extensions.st_point(p_lng, p_lat)::extensions.geography
    ) AS dist_meters
  FROM public.blood_requests r
  WHERE
    r.status = 'active'
    AND r.expires_at > now()
    AND extensions.st_dwithin(
      extensions.st_point(r.lng, r.lat)::extensions.geography,
      extensions.st_point(p_lng, p_lat)::extensions.geography,
      p_radius_km * 1000
    )
  ORDER BY dist_meters;
$function$;

comment on function public.requests_within_radius(double precision, double precision, double precision) is
  'Active, unexpired requests within p_radius_km of (p_lat, p_lng), nearest first. Parameters are p_-prefixed so they cannot be captured by blood_requests.lat/blood_requests.lng.';
