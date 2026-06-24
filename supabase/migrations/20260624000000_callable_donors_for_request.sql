-- callable_donors_for_request: owner-scoped SECURITY DEFINER RPC
-- Returns emergency_callable, available, compatible, within-10km donors for a blood request.
-- Security: SECURITY DEFINER + owner guard ensures only the request owner gets results.
-- Non-owner gets zero rows with no existence disclosure (mirrors responders_for_request pattern).

CREATE OR REPLACE FUNCTION public.callable_donors_for_request(p_request_id uuid)
RETURNS TABLE (
  donor_id uuid,
  name text,
  phone text,
  blood_type text,
  dist_meters double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_blood_type public.blood_type;
BEGIN
  -- Owner guard: only the requester gets results (T-VXW-01).
  -- IF NOT FOUND → RETURN with zero rows and no existence disclosure.
  SELECT r.lat, r.lng, r.blood_type
    INTO v_lat, v_lng, v_blood_type
    FROM public.blood_requests r
   WHERE r.id = p_request_id
     AND r.requester_id = (SELECT auth.uid());
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      d.profile_id AS donor_id,
      p.name,
      p.phone,
      d.blood_type::text AS blood_type,
      extensions.st_distance(
        d.geog,
        extensions.st_makepoint(v_lng, v_lat)::extensions.geography
      ) AS dist_meters
    FROM public.donors d
    JOIN public.profiles p ON p.id = d.profile_id
   WHERE d.emergency_callable = true
     AND d.is_available = true
     AND d.profile_id <> (SELECT auth.uid())
     AND d.blood_type = ANY (
           CASE v_blood_type
             WHEN 'AB+' THEN ARRAY['O-','O+','A-','A+','B-','B+','AB-','AB+']::public.blood_type[]
             WHEN 'AB-' THEN ARRAY['O-','A-','B-','AB-']::public.blood_type[]
             WHEN 'A+'  THEN ARRAY['O-','O+','A-','A+']::public.blood_type[]
             WHEN 'A-'  THEN ARRAY['O-','A-']::public.blood_type[]
             WHEN 'B+'  THEN ARRAY['O-','O+','B-','B+']::public.blood_type[]
             WHEN 'B-'  THEN ARRAY['O-','B-']::public.blood_type[]
             WHEN 'O+'  THEN ARRAY['O-','O+']::public.blood_type[]
             WHEN 'O-'  THEN ARRAY['O-']::public.blood_type[]
             ELSE ARRAY[]::public.blood_type[]
           END
         )
     AND extensions.st_dwithin(
           d.geog,
           extensions.st_makepoint(v_lng, v_lat)::extensions.geography,
           10000
         )
   ORDER BY dist_meters NULLS LAST;
END;
$$;

-- T-VXW-02: GRANT to authenticated only, never anon.
-- Note: SECURITY DEFINER is mandatory because RLS blocks cross-user reads of profiles.phone.
GRANT EXECUTE ON FUNCTION public.callable_donors_for_request(uuid) TO authenticated;
