-- supabase/seed.sql — Blood Help development seed data
--
-- Three fixed-UUID dev donors used to exercise the geo-matching RPCs, the
-- leaderboard, and the donor-alert loop without needing three real phones.
-- Originally created in Phase 06-03 and migrated to the split profiles/donors
-- schema in Phase 07; reconstructed here on 2026-08-19 after the rows were
-- deleted from the hosted project, so the data now lives in the repo instead of
-- only in the database.
--
-- Fully idempotent — safe to run repeatedly and safe to run against a database
-- that already holds real users. It only ever touches the three
-- 00000000-0000-0000-0000-00000000000{1,2,3} UUIDs.
--
-- Apply locally:   supabase db reset   (runs this automatically)
-- Apply remotely:  psql "$DATABASE_URL" -f supabase/seed.sql
--
-- Expected end state:
--   donors_within_radius(16.82, 96.15, 10.0)  → 2 rows (Zaw Htike, Aye Myint;
--                                                Ko Kyaw excluded, is_available=false)
--   leaderboard_top_donors()                  → Aye Myint (7) → Zaw Htike (3) → Ko Kyaw (1)

begin;

-- ---------------------------------------------------------------------------
-- 1. auth.users — profiles.id is FK'd to auth.users(id), so the auth rows must
--    exist first. Guarded with NOT EXISTS rather than ON CONFLICT so the tuple
--    is never even built when the rows are already present.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  v.id::uuid,
  'authenticated', 'authenticated',
  v.email, '',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  false, true,
  '', '', '', '',
  now(), now()
from (values
  ('00000000-0000-0000-0000-000000000001', 'seed1@dev.local'),
  ('00000000-0000-0000-0000-000000000002', 'seed2@dev.local'),
  ('00000000-0000-0000-0000-000000000003', 'seed3@dev.local')
) as v(id, email)
where not exists (
  select 1 from auth.users u where u.id = v.id::uuid
);

-- ---------------------------------------------------------------------------
-- 2. profiles — identity only. Blood type, availability and location live on
--    the donors table since the Phase 07 schema split.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, name, phone, language)
values
  ('00000000-0000-0000-0000-000000000001', 'Zaw Htike', '+959111111111', 'my'),
  ('00000000-0000-0000-0000-000000000002', 'Aye Myint', '+959222222222', 'my'),
  ('00000000-0000-0000-0000-000000000003', 'Ko Kyaw',   '+959333333333', 'en')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. donors — coarsened Yangon coordinates (per D-10: never store a precise
--    home location). Bahan / Tamwe / Sanchaung, all within ~5km of each other
--    so radius queries return a useful mix.
--
--    donor_code is deliberately left NULL: the donors_set_donor_code BEFORE
--    INSERT trigger fills it from generate_donor_code(), which emits the real
--    5-character A-Z2-7 format. The Phase 06 literals (ZH001/AM002/KK003)
--    predate that generator and contain 0 and 1, which are not in its alphabet.
-- ---------------------------------------------------------------------------

insert into public.donors (
  profile_id, blood_type, is_available, emergency_callable,
  donation_count, lat, lng, location_updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', 'O+', true,  false, 3, 16.82, 96.15, now()),
  ('00000000-0000-0000-0000-000000000002', 'A-', true,  true,  7, 16.83, 96.17, now()),
  ('00000000-0000-0000-0000-000000000003', 'B+', false, false, 1, 16.85, 96.13, now())
on conflict (profile_id) do nothing;

commit;
