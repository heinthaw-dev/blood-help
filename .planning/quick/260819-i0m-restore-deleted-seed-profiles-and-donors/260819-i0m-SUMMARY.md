---
id: 260819-i0m
type: quick
status: complete
completed: 2026-08-19
---

# Quick Task 260819-i0m — Summary

## What was restored

The three fixed-UUID development seed records, reconstructed from
`06-03-PLAN.md` and `07-RESEARCH.md` rather than invented:

| UUID suffix | Name | Phone | Lang | Blood | Available | Emergency callable | Donations | Coords |
|---|---|---|---|---|---|---|---|---|
| …0001 | Zaw Htike | +959111111111 | my | O+ | yes | no | 3 | 16.82, 96.15 (Bahan) |
| …0002 | Aye Myint | +959222222222 | my | A− | yes | yes | 7 | 16.83, 96.17 (Tamwe) |
| …0003 | Ko Kyaw | +959333333333 | en | B+ | **no** | no | 1 | 16.85, 96.13 (Sanchaung) |

`donor_code` was left NULL on insert so the `donors_set_donor_code` trigger
generated real-format codes (`2OLLO`, `7PXTJ`, `YRVMG`). The Phase 06 literals
`ZH001`/`AM002`/`KK003` were deliberately **not** reused — they predate
`generate_donor_code()` and contain `0`/`1`, which are absent from its `A-Z2-7`
alphabet, so they would have been malformed codes in the QR confirmation flow.

## Verification (all live against the hosted project)

- `profiles` = 3, `donors` = 3, 3 distinct donor codes
- `donors_within_radius(16.82, 96.15, 10.0)` → **2 rows** — Ko Kyaw correctly
  excluded on `is_available = false`; matches `06-03-SUMMARY.md:62`
- `leaderboard_top_donors()` → Aye Myint (7, rank 1) → Zaw Htike (3, rank 2) →
  Ko Kyaw (1, rank 3), total 11; matches `260626-igc-SUMMARY.md:32`
- Re-ran both inserts: counts unchanged at 3/3, no duplicate codes — idempotent

## New: `supabase/seed.sql`

The seed had never been checked in — it was applied ad hoc via MCP in Phase
06-03 and re-applied after the Phase 07 schema split, which is why the deletion
was not trivially reversible. It now lives in the repo, safe to re-run against a
database holding real users (it only ever touches the three seed UUIDs), and
carries the `auth.users` bootstrap so a fresh environment can be stood up from
scratch.

## Data loss that was NOT repaired

The deletes cascaded through all six inbound foreign keys on `profiles`, so
`blood_requests`, `request_responses`, `donations`, and `device_tokens` were
emptied too. Beyond the 3 seeds, **51 real phone-login accounts in `auth.users`
now have no profile row.**

That data is unrecoverable — `auth.users` holds only the id and the
phone-derived email (`959xxxxxxxxx@bloodhelp.local`); name, blood type,
location, donor code and donation history existed only in the deleted tables.

The accounts are not broken. `hydrateUserFromDb` returns `false` when the
profile is missing (`src/App.tsx:249`), which routes the user back through
onboarding, and `handleSaveDonor` writes a fresh `profiles` + `donors` pair. On
next login each user re-onboards and starts from a donation count of 0.

No rows were fabricated for them — inventing blood types for real people is not
something a seed script should do.

## Follow-up worth considering

Point-in-time recovery. Supabase retains PITR on paid plans; if this project has
it, restoring to just before the delete would bring back all 51 real profiles
and their donation history. Worth checking the dashboard before those users
start re-onboarding and writing new rows over the gap.
