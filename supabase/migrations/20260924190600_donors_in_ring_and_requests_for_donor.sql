-- Two RPCs the auto-expanding radius needs.
--
-- Parameters are p_-prefixed on purpose. An earlier cut named them lat/lng while
-- RETURNS TABLE also declares lat/lng output columns; inside the body bare `lat`/`lng`
-- resolved to the output columns (NULL), every distance came out NULL, and the
-- function returned no rows — silently, with no error raised.

-- Donors in the ring between two radii — the donors a widening newly reaches.
--
-- Widening from 10 km to 15 km must alert only the 10-15 km band; everyone inside
-- 10 km was already alerted and must not be buzzed again. Exclusive on the inner
-- bound, inclusive on the outer, so consecutive rings partition the area exactly
-- with no donor alerted twice and none skipped.
create or replace function public.donors_in_ring(
  p_lat double precision,
  p_lng double precision,
  p_inner_km double precision,
  p_outer_km double precision
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
  -- The distance is computed once in the subquery rather than three times in a
  -- WHERE clause, so the ring bounds and the returned value cannot disagree.
  SELECT id, profile_id, blood_type, donation_count, lat, lng, dist_meters
  FROM (
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
    WHERE d.is_available = true
  ) ranked
  WHERE dist_meters >  p_inner_km * 1000
    AND dist_meters <= p_outer_km * 1000
  ORDER BY dist_meters;
$function$;

-- Requests visible to a donor, judged by each request's own reach.
--
-- requests_within_radius compares against one radius passed by the caller, which
-- made the donor's feed and the push alerts disagree once a request could widen:
-- a request reaching 20 km would push a donor at 15 km who then could not find it
-- in their list. Here the request's search_radius_km decides.
create or replace function public.requests_for_donor(
  p_lat double precision,
  p_lng double precision
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
  search_radius_km integer,
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
    r.search_radius_km,
    extensions.st_distance(
      extensions.st_point(r.lng, r.lat)::extensions.geography,
      extensions.st_point(p_lng, p_lat)::extensions.geography
    ) AS dist_meters
  FROM public.blood_requests r
  WHERE r.status = 'active'
    AND r.expires_at > now()
    AND extensions.st_dwithin(
          extensions.st_point(r.lng, r.lat)::extensions.geography,
          extensions.st_point(p_lng, p_lat)::extensions.geography,
          r.search_radius_km * 1000
        )
  ORDER BY dist_meters;
$function$;

grant execute on function public.donors_in_ring(double precision, double precision, double precision, double precision) to authenticated, service_role;
grant execute on function public.requests_for_donor(double precision, double precision) to authenticated, service_role;
