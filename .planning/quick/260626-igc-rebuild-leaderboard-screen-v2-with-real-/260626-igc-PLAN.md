---
quick_id: 260626-igc
title: Rebuild Leaderboard screen v2 with real Supabase data
status: in-progress
created: 2026-06-26
---

# Quick Task 260626-igc — Rebuild Leaderboard (v2) with real data

## Goal

Replace the dummy-data Leaderboard with the new Claude Design "Leaderboard v2"
layout, fed by **real** Supabase donor data. Because RLS on `donors`/`profiles`
is owner-only, the cross-user read must go through a `SECURITY DEFINER` RPC
(same pattern as `donors_within_radius` / `callable_donors_for_request`).

## Why an RPC (not a client query)

`donors_select_own` (`profile_id = auth.uid()`) and `own_profile_select`
(`auth.uid() = id`) mean a client `select` returns ONLY the current user's row.
A leaderboard must read all donors → needs a definer function that exposes only
public-safe columns (name, blood type, donation count, rank) — never phone/GPS.

## Tasks

### Task 1 — Migration: `public.leaderboard_top_donors`
- New file `supabase/migrations/<ts>_leaderboard_top_donors.sql`.
- `RETURNS TABLE(profile_id uuid, name text, blood_type blood_type, donation_count int, rank int, total_donations int)`.
- `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''` → all tables `public.`-qualified.
- Body: `public.donors d JOIN public.profiles p ON p.id = d.profile_id`,
  `WHERE d.donation_count > 0`, `row_number() OVER (ORDER BY donation_count DESC, name ASC NULLS LAST, profile_id)` as rank,
  `sum(donation_count) OVER ()` as total_donations, `ORDER BY donation_count DESC ...`, `LIMIT p_limit` (default 50).
- `GRANT EXECUTE ... TO authenticated, anon`.
- Apply to remote via MCP `apply_migration` AND keep the `.sql` file.
- verify: `mcp__supabase__get_advisors security` shows no new definer issues.

### Task 2 — Regenerate `src/types/database.ts`
- Use MCP `generate_typescript_types`; overwrite the file so `Functions.leaderboard_top_donors` is typed.
- verify: `npm run build` typechecks the `supabase.rpc('leaderboard_top_donors', ...)` call.

### Task 3 — Rewrite `src/screens/Leaderboard.tsx`
- Port "Leaderboard v2": header (logo), centered title + sub, community
  "lives saved" banner, top-3 medal hero cards (gold/silver/bronze local
  constants — precedent: Home.tsx inline `#B45309`), "All donors" section for
  rank 4+, loading + low-data ("be the first donor") states.
- Fetch via `supabase.rpc('leaderboard_top_donors', { p_limit: 50 })` in `useEffect`.
- Add `currentUserId` prop; mark the "You" row by `profile_id === currentUserId`.
- Keep `BottomNav active="leaderboard"`. EN + MY strings. Burmese numerals via `formatNumber`.

### Task 4 — Wire `src/App.tsx`
- Pass the logged-in user's Supabase id as `currentUserId` to `<Leaderboard>`.
- Drop `userName`/`userBloodType` props if no longer needed (server data carries them).

## Done when
- `npm run build` passes.
- Leaderboard renders real donors ranked by donation_count, with the logged-in
  user highlighted, and a correct community total — no `DUMMY` array remains.
- No phone numbers or GPS exposed by the RPC or the UI.

## Notes / deviations
- Executed directly by the orchestrator (not a worktree gsd-executor): the
  migration apply + type generation need the Supabase MCP tools the executor
  lacks, and the v2 design is a DesignSync MCP resource, not a local file.
- Post-implementation: run the `code-quality-refactor` agent (project practice).
