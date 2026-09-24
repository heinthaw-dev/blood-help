---
id: 260925-6qa
status: complete
date: 2026-09-25
---

# Quick Task 260925-6qa: Radius parameters were shadowed by table columns

## What was wrong

`donors_within_radius` and `requests_within_radius` declared parameters named
`lat` and `lng`, and each queried a table with columns of the same names. SQL
name resolution gives the table's columns priority, so `st_point(lng, lat)`
compiled to the row's own position. Every distance was measured from a row to
itself: `dist_meters` was always `0`, and `st_dwithin(x, x, anything)` is always
true, so the radius argument did nothing at all.

Found while placing a test donor 18 km away — `donors_within_radius(16.78,
96.14, 1)` returned all three seed donors at a 1 km radius.

`donors_in_ring` carried the identical bug and was fixed in `20260924190553`.
These two were never given the same treatment.

## Blast radius

| Call site | What it actually did |
|---|---|
| `supabase/functions/notify-donors/index.ts` | Pushed the initial alert to every available compatible donor in the database, not the 10 km ring |
| `src/screens/RequestLive.tsx` | The D-09 count reported how many compatible donors exist, not how many are nearby |
| `src/screens/Home.tsx` | A donor's feed listed every active request regardless of distance |

It also quietly defeated the radius-expansion work from `260925-5gb`: if the
first push already reaches everyone, widening the ring adds nothing.

## The fix

`20260924222131_fix_radius_param_shadowing.sql` — both functions dropped and
recreated with `p_lat` / `p_lng` / `p_radius_km`. Bodies otherwise unchanged.
`create or replace` cannot rename a parameter, hence the drop; both are
`security definer` with default `PUBLIC EXECUTE`, which a recreate restores.

Callers moved with it, because PostgREST resolves overloads by argument name and
a missed one fails loudly rather than silently: the three call sites above plus
the `Args` entries in `src/types/database.ts`.

## Verified on the live project

| Probe | Before | After |
|---|---|---|
| `donors_within_radius(16.78, 96.14, 1)` | 3 rows, all `dist_meters` 0 | 0 rows |
| `donors_within_radius(16.78, 96.14, 10)` | 3 rows | 2 rows |
| `donors_within_radius(16.78, 96.14, 20)` | 3 rows | 3 rows |
| `requests_within_radius(16.942649, 96.14, 1)` | 5 rows | 0 rows |

`npm run build` and `npm run lint` clean (one pre-existing warning in GSD
tooling). `notify-donors` redeployed with the new argument names.

## Worth carrying forward

Every geo RPC in this schema queries a table that has `lat` and `lng` columns,
so an unprefixed parameter of either name is silently captured — no error, no
warning, just a function that ignores its own arguments. `p_`-prefixing is not a
style preference here; it is what makes the parameter reachable. Audited the
remaining functions: `donors_in_ring`, `requests_for_donor`,
`callable_donors_for_request`, `responders_for_request` and
`leaderboard_top_donors` are all either `p_`-prefixed or take no coordinates.
