---
phase: 06-foundation
verified: 2026-06-21T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
re_verification: null
gaps:
  - truth: "Any lat/lng value written through the app's coarsening utility rounds to 2 decimal places — raw GPS coordinates from navigator.geolocation are never sent to the DB (ROADMAP SC-5 / PRIV-03)"
    status: failed
    reason: "coarsenCoordinates() is defined and exported from src/geolocation.ts but has zero call sites. CreateRequest.tsx line 176 passes res.lat and res.lng directly to onPosted() without calling coarsenCoordinates. App.tsx stores the raw RequestDraft with full-precision coordinates. Any future Supabase INSERT from this state will write raw GPS — violating the privacy invariant the phase was supposed to enforce (CR-01 from 06-REVIEW.md)."
    artifacts:
      - path: "src/screens/CreateRequest.tsx"
        issue: "Line 176: onPosted({ bloodType, phone, address, units, urgency, lat: res.lat, lng: res.lng }) — no coarsenCoordinates call before constructing the draft"
      - path: "src/geolocation.ts"
        issue: "coarsenCoordinates is defined (line 45) but is a dead export — grep -rn 'coarsenCoordinates' src/ returns only the definition, no call sites"
    missing:
      - "Import coarsenCoordinates in src/screens/CreateRequest.tsx"
      - "Call coarsenCoordinates(res.lat, res.lng) before onPosted() at CreateRequest.tsx:176"
human_verification:
  - test: "Open app in browser, go through phone/OTP flow, check Supabase Auth dashboard > Users"
    expected: "A new anonymous user row appears in Supabase Auth Users list after app loads — confirms signInAnonymously() is actually firing against the real project"
    why_human: "Cannot verify live network calls to remote Supabase project via grep; requires browser interaction and dashboard observation"
  - test: "Tap 'Back' after OTP verification attempt fails (network down or Supabase unavailable) and check whether the app freezes or falls back gracefully"
    expected: "App falls back to intent screen rather than showing an unhandled rejection or frozen screen (CR-03: handleVerified is async but prop is typed void — errors are silently swallowed)"
    why_human: "Requires simulating a network failure; cannot be verified statically"
  - test: "On RequestLive screen, open the code sub-sheet and tap the dark QR scanner viewport area without entering any code"
    expected: "Nothing should happen (no confirmation should be triggered) — but the current code calls handleConfirmInApp unconditionally on that button click (CR-02)"
    why_human: "Requires UI interaction; the bug is a logic issue (missing confirmReady guard), not a type error — npm build cannot catch it"
  - test: "Complete OTP flow as a new user, then reload the page, complete OTP again — check Supabase Auth dashboard"
    expected: "Only ONE anonymous user should exist (or a session should be restored, not a second user created) — confirms the getSession-first order is actually working to prevent session multiplication"
    why_human: "Requires browser session state inspection across reloads"
---

# Phase 6: Foundation Verification Report

**Phase Goal:** Deploy Supabase backend foundation — schema, RLS, geo-match RPC, and React client wiring — so the app runs against a real database with authenticated sessions.
**Verified:** 2026-06-21
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 5 tables, 5 enums, and PostGIS extension exist in the Supabase project | ? UNCERTAIN | SUMMARY 06-01 claims deployment with MCP verification. No local files changed — cannot grep-verify. MCP was used during execution; SUMMARY shows passing `list_tables`, `pg_extension`, and `pg_type` checks. Accepted as UNCERTAIN (Supabase-only, requires dashboard) |
| 2 | RLS is enabled on all 5 tables; anonymous users cannot read another user's phone or contact_phone | ? UNCERTAIN | SUMMARY 06-02 claims 11 policies across 5 tables with `rowsecurity=true` verified via `pg_tables`. Plan 02 THREAD explicitly addresses the contact_phone Phase 6 posture (all authenticated users can read active requests; within-range gating deferred to Phase 7). Anonymous users hold `authenticated` role per Pitfall 2 — so phone protection is via own-row-only profile SELECT. Cannot grep-verify remote DB state. |
| 3 | Submitting OTP calls signInAnonymously() — user gets a real Supabase session UUID | VERIFIED | `src/App.tsx:81` — `signInAnonymously()` is called inside `initAuth` useEffect when `!session`. Call is wired to the real `supabase` singleton from `src/lib/supabase.ts`. `src/lib/supabase.ts` uses real credentials from `.env.local` (no placeholders; `npm run build` exits 0). |
| 4 | The ST_DWithin RPC function is deployed and callable from React via supabase.rpc() | ? UNCERTAIN | SUMMARY 06-03 claims `donors_within_radius` exists in `information_schema.routines` and has execute privilege for `authenticated`. `src/types/database.ts` line 279 contains `donors_within_radius` in generated types — confirms MCP `generate_typescript_types` found the function in the live schema. Cannot verify remote Postgres function body from local files alone. |
| 5 | Any lat/lng written through the app's coarsening utility rounds to 2 decimal places — raw GPS never sent to DB | FAILED | `coarsenCoordinates()` is defined in `src/geolocation.ts:45` but has zero call sites in the entire `src/` directory (`grep -rn 'coarsenCoordinates' src/` returns only the definition). `CreateRequest.tsx:176` passes `res.lat` and `res.lng` directly to `onPosted()` without coarsening. This violates PRIV-03 and ROADMAP SC-5. |

**Score:** 1 VERIFIED, 3 UNCERTAIN (Supabase-only, acceptable per instructions), 1 FAILED

**Effective score for local artifacts (Plans 04-05):** 4/5 truths satisfied at the code level. The one FAILED truth is a missing call site (CR-01 in 06-REVIEW.md).

---

## Required Artifacts

### Plan 04 Artifacts (local files)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.env.local` | VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY | VERIFIED | File exists (291 bytes). Both VITE_ vars present with real (non-placeholder) values. Gitignored via `*.local` in .gitignore. `git status` does not list it. |
| `src/vite-env.d.ts` | ImportMetaEnv augmentation | VERIFIED | File exists. Has `/// <reference types="vite/client" />`. Declares `readonly VITE_SUPABASE_URL: string` and `readonly VITE_SUPABASE_ANON_KEY: string`. No import/export statements (ambient augmentation intact — Pitfall 6 avoided). |
| `src/lib/supabase.ts` | Singleton `supabase` export | VERIFIED | File exists. Exports `const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)`. Uses `import type { Database }` (verbatimModuleSyntax compliant). Module-level JSDoc present. No default export. |
| `src/types/database.ts` | Generated Database type | VERIFIED | File exists (432 lines). Not a stub — contains full generated types for all 5 tables (blood_requests, profiles, device_tokens, request_responses, donations), 5 enums, and `donors_within_radius` function at line 279. Generated via MCP `generate_typescript_types`. |

### Plan 05 Artifacts (local files)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/auth.ts` | SessionResult, getSession(), onAuthStateChange() | VERIFIED | File exists. Old functions `SEEN_KEY`, `hasLoggedInBefore`, `markLoggedIn` confirmed absent (grep returns 0). New exports: `SessionResult` type (lines 7-9), `getSession()` async function (lines 12-18), `onAuthStateChange()` (lines 21-26). Uses `import type` for Session/AuthError. |
| `src/geolocation.ts` | coarsenCoordinates(lat, lng) added | VERIFIED (definition) / FAILED (call site) | Definition exists at lines 44-50 with correct `Math.round(lat*100)/100` implementation and privacy JSDoc. However, zero call sites exist in the codebase — the function is a dead export (CR-01). |
| `src/App.tsx` | mount useEffect, sessionLoading guard, async handleVerified | VERIFIED | useEffect at line 75 with correct getSession-first order. signInAnonymously only when `!session` (line 80-87). sessionLoading state declared at line 73, guard at line 109. handleVerified is async (line 111), queries profiles by phone (line 113-117). hasLoggedInBefore/markLoggedIn absent (grep returns 0). supabaseId in UserState interface (line 46) and DEFAULT_USER (line 59). |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/App.tsx` | `src/lib/supabase.ts` | `import { supabase }` | WIRED | Line 18: `import { supabase } from './lib/supabase'`; used at lines 78, 81, 93, 113, 155 |
| `src/App.tsx` | `src/auth.ts` | `import { getSession }` | WIRED | Line 17: `import { getSession } from './auth'`; used at line 90 |
| `src/lib/supabase.ts` | `src/types/database.ts` | `import type { Database }` | WIRED | Line 6: `import type { Database } from '../types/database'`; used in `createClient<Database>()` |
| `src/lib/supabase.ts` | `import.meta.env.VITE_SUPABASE_URL` | Vite env injection | WIRED | Lines 8-9 read both VITE_ vars; vite-env.d.ts types them as `readonly string` |
| `src/geolocation.ts (coarsenCoordinates)` | `src/screens/CreateRequest.tsx` | import + call | NOT_WIRED | coarsenCoordinates is never imported or called from CreateRequest.tsx or anywhere else in src/ |
| `React client` | `donors_within_radius RPC` | `supabase.rpc()` | UNCERTAIN | Function exists in database.ts types; no call site in React code yet (Phase 7 will wire this) — this is a deferred wiring, not a Phase 6 gap per ROADMAP Phase 7 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `src/App.tsx` (initAuth) | `session` | `supabase.auth.getSession()` + `supabase.auth.signInAnonymously()` | Yes — real Supabase Auth call | FLOWING (real auth, not mocked) |
| `src/App.tsx` (handleVerified) | `profile` | `supabase.from('profiles').select('id').eq('phone', phone).maybeSingle()` | Yes — real DB query via RLS | FLOWING |
| `src/App.tsx` (requestDraft) | `lat`/`lng` in draft | `CreateRequest → onPosted → res.lat/res.lng` | Raw GPS (not coarsened) | HOLLOW — coordinates reach App state without coarsening; any future DB write will write full-precision GPS |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation passes | `npm run build` | Exits 0; 81 modules transformed; bundle 501.94 kB | PASS |
| ESLint passes | `npm run lint` | 0 errors, 1 warning in GSD internal file (not src/) | PASS |
| supabase.ts exports supabase constant | `grep -c 'export const supabase' src/lib/supabase.ts` | 1 | PASS |
| auth.ts old functions removed | `grep -c 'hasLoggedInBefore\|markLoggedIn\|SEEN_KEY' src/auth.ts` | 0 | PASS |
| auth.ts new exports present | `grep -c 'getSession\|onAuthStateChange\|SessionResult' src/auth.ts` | 5 | PASS |
| coarsenCoordinates call sites | `grep -rn 'coarsenCoordinates' src/` | Only definition; 0 call sites | FAIL |
| App.tsx signInAnonymously count | `grep -c 'signInAnonymously' src/App.tsx` | 1 | PASS |
| App.tsx old auth calls removed | `grep -c 'hasLoggedInBefore\|markLoggedIn' src/App.tsx` | 0 | PASS |
| App.tsx supabaseId wiring | `grep -c 'supabaseId' src/App.tsx` | 3 | PASS |
| database.ts is generated (not stub) | Line count + donors_within_radius presence | 432 lines; donors_within_radius at line 279 | PASS |

---

## Probe Execution

Step 7c: SKIPPED — Phase 6 has no probe scripts (`scripts/*/tests/probe-*.sh` not present).

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| BACK-01 | 06-01 | Schema deployed — 5 enums, 5 tables, PostGIS | UNCERTAIN | SUMMARY claims MCP verification passed; no local files; cannot grep-verify Supabase state |
| BACK-02 | 06-02 | RLS policies on all 5 tables | UNCERTAIN | SUMMARY claims 11 policies, rowsecurity=true for all tables; cannot grep-verify Supabase state |
| BACK-03 | 06-04, 06-05 | signInAnonymously + real session | SATISFIED | supabase.ts singleton wired; initAuth in App.tsx calls signInAnonymously; build passes |
| BACK-04 | 06-03 | ST_DWithin RPC callable | UNCERTAIN | SUMMARY claims function deployed; database.ts generated types contain donors_within_radius (line 279) — this is the strongest local evidence |
| PRIV-03 | 06-05 | Location coarsened to 2dp before DB write | BLOCKED | coarsenCoordinates defined but never called; raw GPS flows from CreateRequest into App state |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/screens/CreateRequest.tsx` | 176 | Raw `res.lat`/`res.lng` passed to onPosted without coarsenCoordinates | Blocker | Violates PRIV-03 — full-precision GPS will reach DB in Phase 7 when INSERT is wired |
| `src/App.tsx` | 95 | `is_donor` fetched from profiles but never read (dead column) | Warning | Wasted network bytes; returning-user routing ignores donor status |
| `src/App.tsx` | 98-101 | supabaseId not set for new anonymous users (no profile row yet) | Warning | New users will have supabaseId=null for entire first session |
| `src/auth.ts` | 21-26 | `onAuthStateChange` exported but has zero call sites | Warning | Dead export; subscription leak risk if ever used without cleanup |
| `src/lib/supabase.ts` | 8-11 | No runtime guard on VITE_ env vars — createClient receives undefined if .env.local absent | Warning | Produces opaque runtime crash instead of actionable error message |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file.

---

## Human Verification Required

### 1. Anonymous session creation — live Supabase Auth check

**Test:** Load the app in a browser (npm run dev), open Supabase dashboard > Authentication > Users, observe the Users list before and after the first load.
**Expected:** A new anonymous user row appears in the Supabase Auth Users list within seconds of the app loading — confirming signInAnonymously() is firing against the real project credentials in .env.local.
**Why human:** Cannot verify live network calls to a remote Supabase project programmatically. The code path is correct but execution requires a browser and dashboard access.

### 2. Session restore on reload — no session duplication

**Test:** Load the app, let initAuth run (observe console), reload the page, observe Supabase Auth dashboard.
**Expected:** No second anonymous user is created on reload — the existing session is detected by getSession() and reused; the user remains on the same session UUID.
**Why human:** Requires browser session state inspection across page reloads; cannot be automated without running the dev server.

### 3. CR-02 QR viewport bug — code bypass via dark area tap

**Test:** On the RequestLive screen, open the code sub-sheet. Without entering any 5-character code, tap/click the dark QR scanner viewport area.
**Expected:** Nothing should happen — but the current code (RequestLive.tsx:550) calls handleConfirmInApp unconditionally on that button click, bypassing the confirmReady guard.
**Why human:** Logic bug in click handler; requires UI interaction to observe the incorrect behavior.

### 4. CR-03 async handleVerified — unhandled rejection on network failure

**Test:** Disable network (DevTools > Network > Offline), complete OTP entry on the OTP screen, observe app behavior when handleVerified fires and the Supabase profiles query fails.
**Expected:** App should fall back gracefully (e.g., route to 'intent' with an error log), not freeze or throw an unhandled Promise rejection.
**Why human:** Requires network failure simulation; the type mismatch (async fn assigned to () => void prop) is not caught by TypeScript.

---

## Gaps Summary

**1 BLOCKER — PRIV-03 / ROADMAP SC-5 violated (CR-01):**

`coarsenCoordinates()` was added to `src/geolocation.ts` as required by this phase's privacy mandate, but was never connected to its intended call site in `src/screens/CreateRequest.tsx`. The function has zero call sites across the entire `src/` directory. As a result, the raw `res.lat` / `res.lng` values from `navigator.geolocation` are passed directly into `RequestDraft` and stored in App state. When Phase 7 wires the Supabase INSERT for blood requests, full-precision GPS coordinates (6+ decimal places) will be written to the database — exactly the privacy leak that PRIV-03 was designed to prevent.

**Fix is small:** Import `coarsenCoordinates` in `CreateRequest.tsx` and call it before constructing the draft at line 176.

**Supabase-only truths (SC-1, SC-2, SC-4):** The three success criteria that verify remote Supabase state (schema, RLS, RPC) cannot be verified by static code analysis. The SUMMARY files document MCP verification passes that occurred during execution. These are classified as UNCERTAIN rather than FAILED — the database.ts generated types at 432 lines containing all 5 tables and the donors_within_radius function provide strong indirect evidence that the schema was actually deployed. Human verification (Supabase dashboard) is needed to confirm.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
