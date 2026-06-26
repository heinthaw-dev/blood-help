---
quick_id: 260626-igc
title: Rebuild Leaderboard screen v2 with real Supabase data
status: complete
date: 2026-06-26
commits:
  - 882d032  # feat(supabase): leaderboard_top_donors RPC
  - 84be1d3  # feat(leaderboard): rebuild Leaderboard v2 with real donor data
---

# Quick Task 260626-igc — Summary

## What was done

Replaced the dummy-data Leaderboard with the Claude Design **"Leaderboard v2"**
layout, fed by real Supabase donor data.

### 1. Data layer — `leaderboard_top_donors` RPC
- New migration `supabase/migrations/20260626064900_leaderboard_top_donors.sql`,
  applied to the remote project.
- `SECURITY DEFINER`, `LANGUAGE sql STABLE`, `SET search_path TO ''` (all tables
  `public.`-qualified) — matches the existing `donors_within_radius` /
  `requests_within_radius` convention.
- Returns `profile_id, name, blood_type, donation_count, rank, total_donations`.
  Ranked by `donation_count DESC, name ASC NULLS LAST, profile_id`; community
  total via `SUM(donation_count) OVER ()`; `WHERE donation_count > 0`;
  `LIMIT p_limit` (default 50). Granted to `authenticated, anon`.
- **Why an RPC:** RLS on `donors`/`profiles` is owner-only (`profile_id =
  auth.uid()`), so a client `select` returns only the caller's own row. The
  definer function performs the controlled cross-user read and exposes ONLY
  public-safe columns — never phone numbers or GPS.
- Verified live: returns Aye Myint (7) → Zaw Htike (3) → Ko Kyaw (1),
  total_donations = 11.

### 2. Types
- Hand-added `Functions.leaderboard_top_donors` to `src/types/database.ts`
  (`p_limit?` optional; typed Returns row) so `supabase.rpc(...)` is type-safe.

### 3. Screen — `src/screens/Leaderboard.tsx` (full rewrite)
- Community "lives saved" banner, top-3 medal hero cards (gold/silver/bronze),
  "All donors" ranked list (rank 4+), plus loading and low-data
  ("be the first donor") states.
- Fetches via `supabase.rpc('leaderboard_top_donors', { p_limit: 50 })` in a
  `useEffect` (async-wrapped, cancellation-guarded).
- Logged-in user highlighted by `profile_id === currentUserId`.
- Medal hues are local constants (documented one-off, mirroring Home.tsx's
  inline `#B45309`); everything else uses design tokens. Burmese-first with EN
  variants; numbers via `formatNumber`.

### 4. Wiring — `src/App.tsx`
- `<Leaderboard>` now receives `currentUserId={user.supabaseId}`;
  `userName`/`userBloodType` props removed (server data carries them).

## Verification
- `npm run build` — clean (tsc + vite).
- `npm run lint` — no new findings in changed files (Leaderboard.tsx clean;
  pre-existing errors in RequestLive.tsx / App.tsx effects untouched).
- `code-quality-refactor` agent: removed a redundant `.trim()`, added
  `display:'inline-flex'` to the "You" pill for parity; confirmed no PII leak.
- Supabase security advisor: the new definer function raises the same advisory
  as every existing definer RPC (accepted codebase posture); no new issue class.

## Notes / deviations
- Executed directly by the orchestrator rather than a worktree `gsd-executor`:
  the migration apply + type generation require the Supabase MCP tools the
  executor lacks, and the v2 design is a DesignSync MCP resource (not a local
  file the executor could read).
- `src/firebase-messaging-sw.js` was rewritten in place by `vite build`
  (PWA injectManifest) and left **uncommitted** — unrelated to this task,
  flagged for the user.

## Follow-ups (optional, not done)
- Accessibility: consider `role="list"`/`aria-label` on the ranked list
  (additive change, left for a deliberate pass).
