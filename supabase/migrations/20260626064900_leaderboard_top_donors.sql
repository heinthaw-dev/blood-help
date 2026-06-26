-- Leaderboard: top donors ranked by lifetime donation_count.
-- SECURITY DEFINER because RLS on donors/profiles is owner-only (profile_id =
-- auth.uid()); a leaderboard needs a cross-user read. This function exposes ONLY
-- public-safe columns (name, blood type, donation count, rank, community total)
-- and deliberately never selects phone numbers or GPS coordinates.
create or replace function public.leaderboard_top_donors(p_limit int default 50)
returns table (
  profile_id uuid,
  name text,
  blood_type public.blood_type,
  donation_count int,
  rank int,
  total_donations int
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    d.profile_id,
    coalesce(p.name, '') as name,
    d.blood_type,
    d.donation_count,
    (row_number() over (order by d.donation_count desc, p.name asc nulls last, d.profile_id))::int as rank,
    (sum(d.donation_count) over ())::int as total_donations
  from public.donors d
  join public.profiles p on p.id = d.profile_id
  where d.donation_count > 0
  order by d.donation_count desc, p.name asc nulls last, d.profile_id
  limit p_limit;
$$;

grant execute on function public.leaderboard_top_donors(int) to authenticated, anon;
