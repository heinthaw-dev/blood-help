# Project Research Summary

**Project:** Blood Help
**Domain:** Emergency blood-donor matching PWA (two-sided, serverless, Myanmar audience)
**Researched:** 2026-06-19
**Confidence:** HIGH

---

## Executive Summary

Blood Help is a push-driven emergency marketplace: a requester posts a blood need, the system finds nearby compatible donors in under two seconds, and those donors receive a real OS push notification with one tap to call back. All four research threads agree the architecture is serverless and well-precedented — Supabase (Postgres + PostGIS + anonymous auth + Edge Functions + Database Webhooks) handles data, matching, and the push trigger; Firebase Cloud Messaging handles delivery; React + Tailwind v4 handles UI. No custom backend is needed. The critical path is: auth → profile → PWA service worker → FCM token → blood request → DB webhook → Edge Function → FCM HTTP v1. Everything else hangs off that chain.

The most important cross-cutting decision is identity stability. The Stack and Architecture researchers both recommend `supabase.auth.signInAnonymously()` as the dummy-OTP mechanism, and this is the correct choice — it produces a real UUID-backed JWT, enables RLS immediately, and persists in localStorage so the same `auth.uid()` survives page reloads. The Pitfalls researcher's concern about unstable identity is valid but applies only if `signInAnonymously()` is called unconditionally on every page load — which would create a new UUID each visit. The correct implementation avoids this: call `signInAnonymously()` only when `supabase.auth.getSession()` returns null, then reuse the localStorage-persisted session on all subsequent visits. A phone-derived deterministic `signUp` would offer cross-device persistence but adds complexity out of scope for v1.

The single highest-risk technical area is the merged service worker. Every researcher flagged it independently: vite-plugin-pwa's default `generateSW` strategy cannot host FCM's `onBackgroundMessage` handler, and registering a separate `firebase-messaging-sw.js` alongside the PWA SW causes a scope collision that silently kills either push delivery or PWA caching. The fix — `injectManifest` strategy with a single hand-authored `src/sw.ts` — must be established in Phase 1 before any push code is written. iOS push is a related constraint: push only works after Add to Home Screen install, so `getToken()` must be gated on `display-mode: standalone`, and an in-app fallback list is mandatory for non-installed users.

---

## Resolved Cross-Cutting Decision: Identity Model

**Recommended approach: `signInAnonymously()` with session reuse (not fresh per visit).**

```
On app load:
  1. Call supabase.auth.getSession()
  2. If session exists → use it (same auth.uid() as before, localStorage-persisted)
  3. If no session → call signInAnonymously() to create a new identity
  4. During OTP flow → upsert profile row (phone, blood_type) using the now-established session
```

The same UUID survives every page reload and browser restart as long as localStorage is intact. The trade-off — identity loss on localStorage clear or device switch — is acceptable for v1 given the dummy-auth framing.

**Stability requirement (mandatory):** Call `signInAnonymously()` exactly once per identity, guarded by a session check. Never call it on every screen mount or OTP verification tap.

---

## Critical Constraints (All Researchers Agreed)

| Constraint | Implication |
|------------|-------------|
| Single merged SW (`injectManifest` + FCM `onBackgroundMessage`) | Decided before any SW code is written; cannot be retrofitted |
| iOS push only in standalone mode | Gate `getToken()` on `display-mode: standalone`; in-app fallback is mandatory |
| Blood compatibility matrix is directional (donor→recipient) | Full 8×8 unit tests before SQL migration; key is donor type, value is set of recipient types |
| RLS on every table from creation | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in every migration; test with anon key + non-owner JWT |
| Phone numbers + raw lat/lon never client-visible | Return distance only from matching RPC; reveal callback phone only after donor submits response |
| Push trigger: INSERT → DB webhook → Edge Function → FCM HTTP v1 (per-token loop) | No batch API in FCM HTTP v1; service account JSON in Supabase secrets |
| PostGIS `geography(POINT,4326)` + GiST index + `ST_DWithin` RPC | GiST index mandatory; verify with `EXPLAIN ANALYZE` before shipping |
| Anonymous identity must be session-persistent | Call `signInAnonymously()` only when `getSession()` returns null |

---

## Key Findings

### Recommended Stack

The project already ships React 19, Vite 8, Tailwind v4, TypeScript 6. Remaining installs:

**Core technologies:**
- `@supabase/supabase-js@^2.108.2` — database client, anonymous auth, Realtime, PostGIS RPC; v1 is EOL
- `firebase@^12.15.0` (modular) — FCM push delivery; tree-shakes to ~45 kB for messaging only; compat SDK is deprecated
- `vite-plugin-pwa@^1.3.0` + `workbox-precaching@^7.4.1` (dev) — `injectManifest` strategy; only way to host both Workbox precaching and FCM `onBackgroundMessage` in one SW
- `react-i18next@^17.0.8` + `i18next@^26.3.1` — bilingual EN/MY; lazy loading, interpolation, plurals
- PostGIS `geography(POINT,4326)` + GiST index + `ST_DWithin` RPC — O(log n) radius matching in meters
- `supabase.auth.signInAnonymously()` — real UUID, real JWT, RLS-ready, localStorage-persisted session

Do not add `tailwind.config.js` — Tailwind v4 reads `@theme` directly from CSS; a config file conflicts. Firebase env vars must be injected into the service worker via Vite `define` (not `import.meta.env`, which is unavailable in SW scope).

### Expected Features

**Must have (emergency loop cannot function without these):**
- Phone OTP auth (dummy, 3-second auto-fill) — identity anchor for RLS
- Blood type on profile — 8-value enum
- GPS location on request — the entire "nearby" value proposition
- Full ABO/Rh compatibility matrix in matching query — 8×8 directional lookup; wrong direction makes O− donors invisible to B− requesters
- FCM push to matched donors (background-capable via service worker)
- Donor "I'm responding" tap action
- Direct call via `tel:` link to requester callback phone
- Requester marks request fulfilled (stops alerts)
- Donor availability toggle (`is_available`) — opt-in, one tap from home
- PWA manifest + service worker
- In-app fallback list of nearby open requests (for non-installed users; mandatory)
- Bilingual UI: English + Burmese with Noto Sans Myanmar web font
- Request auto-expiry (24h)

**Should have (v1.x after core loop validated):**
- Responder list visible to requester (name + phone of responding donors)
- Request expiry re-post prompt
- Cooldown reminder text when donor re-activates availability
- `last_donated_at` field on profile (data only)

**Defer — v2+ only:**
- Enforced 56-day donation cooldown, real SMS OTP, hospital integration, in-app chat, gamification

### Architecture Approach

Serverless, hub-and-spoke. React PWA communicates directly with Supabase via anon-key client. The one server-side side effect (push fan-out) is triggered by a Database Webhook on `blood_requests` INSERT, which fires an async pg_net HTTP POST to the `notify-donors` Deno Edge Function. The Edge Function runs the match RPC via service-role client, fetches FCM tokens from `device_tokens`, signs a short-lived OAuth2 token from Firebase service account stored in Supabase secrets, and loops one POST per token to FCM HTTP v1. The service role key never leaves the Edge Function environment.

**Major components:**
1. **React PWA** — all UI; anon key + anonymous session JWT; registers merged SW; upserts FCM token on every app open
2. **Merged Service Worker (`src/sw.ts`)** — Workbox precaching + FCM `onBackgroundMessage`; compiled by vite-plugin-pwa `injectManifest`; single file, single scope
3. **Supabase Postgres** — source of truth; RLS on all tables; PostGIS geography columns + GiST indexes; `blood_compatibility` seeded lookup table; `find_compatible_donors` SECURITY DEFINER RPC
4. **Database Webhook (pg_net)** — watches `blood_requests` INSERT; async HTTP POST to Edge Function; non-blocking; secured with shared secret header
5. **Edge Function: `notify-donors` (Deno)** — match RPC → device tokens → FCM OAuth2 token → per-token FCM sends → prune stale tokens on 404/400
6. **Firebase / FCM** — pure delivery; no application logic

**Data model key decisions:**
- `profiles.id` IS `auth.users.id` — no surrogate key; simplifies every RLS policy
- `device_tokens` is separate from `profiles` — UNIQUE on `(user_id, fcm_token)`; handles reinstalls
- `blood_compatibility` is a seeded lookup table, not app code
- `blood_requests.status` is the lifecycle gate; all matching queries and FCM sends filter `status = 'open'`
- Raw lat/lon never returned to clients; matching RPC returns `distance_m` only

### Critical Pitfalls

1. **Merged service worker before any SW code** — two SWs at root scope fight; the loser's push handler or Workbox cache silently dies. Use `injectManifest` + single `src/sw.ts` from day one.
2. **iOS push only after Add-to-Home-Screen install** — gate `getToken()` behind `window.matchMedia('(display-mode: standalone)').matches`; show custom Safari install prompt UI; in-app fallback is mandatory.
3. **Anonymous identity must be session-persistent** — call `signInAnonymously()` only when `getSession()` returns null; reuse the localStorage session on all subsequent visits.
4. **Blood compatibility matrix is directional** — key is donor type; value is set of recipient types that donor can give to. Write all 64 unit-test cells before the SQL migration. Test O− donor → AB+ (match) and AB+ donor → O− (no match) explicitly.
5. **RLS on every table from day one; phone numbers and GPS never client-visible** — enable RLS at table creation; test with anon key + non-owner JWT; return distance only from matching RPC; reveal callback phone only after donor submits response.
6. **Stale FCM tokens cause silent push failure** — subscribe to token refresh, upsert on change, upsert on every app open; delete token row on FCM 404/400 in Edge Function.
7. **Burmese must use Noto Sans Myanmar as a loaded web font** — OS fallback on Zawgyi-system Android devices renders Unicode Burmese as garbled glyphs. Load Noto Sans Myanmar explicitly. Use `myanmar-tools` to detect and convert Zawgyi input before storage.

---

## Implications for Roadmap

### Suggested phase shape

1. **Foundation** — Supabase project + anonymous identity (session-persistent) + merged service worker + installable PWA shell + dummy OTP screen. Locks the two irrevocable decisions (merged SW, stable identity).
2. **FCM push token registration + iOS install flow** — token in `device_tokens`, `display-mode: standalone` gate, A2HS prompt, foreground `onMessage` in-app alert.
3. **Blood compatibility data + matching RPC + PostGIS** — `find_compatible_donors` RPC, GiST index verified, 64-cell directional test suite.
4. **Blood request creation + push trigger** — `blood_requests` table + RLS, DB webhook, `notify-donors` Edge Function, FCM HTTP v1 per-token loop, auto-expiry, rate limit. **This is the core emergency loop — validate end-to-end.**
5. **Donor response + requester fulfilled + Realtime** — "I'm responding", `tel:` call, mark fulfilled, Supabase Realtime, callback phone revealed only after response.
6. **Bilingual UI + localization + Burmese font** — react-i18next, Noto Sans Myanmar, Zawgyi detection, E.164 phone normalization.
7. **In-app fallback + polish + end-to-end audit** — polled nearby-requests fallback, physical-device verification of the "Looks Done But Isn't" checklist.

### Research Flags (for plan-phase research)

- **Push-token phase:** Verify exact token-refresh API in Firebase modular SDK v12.
- **Push-trigger phase:** Cross-reference FCM OAuth2 JWT signing in Deno against the Supabase push-notifications official example; verify `net._http_response` monitoring; test Deno fan-out concurrency for 20+ donors.
- **Standard patterns (skip research):** Foundation auth/SQL, matching matrix/RPC, Realtime, i18n — all fully specified in STACK.md / FEATURES.md / ARCHITECTURE.md.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry; FCM/PostGIS/anonymous auth verified against official docs and Context7 |
| Features | HIGH | Blood compatibility matrix from three independent medical authorities; feature landscape from comparable apps |
| Architecture | HIGH | Mechanisms verified against official Supabase docs (webhooks, anonymous auth, Edge Functions, PostGIS, RLS); FCM HTTP v1 per-token pattern confirmed |
| Pitfalls | HIGH (technical) / MEDIUM (Myanmar locale) | FCM/iOS/RLS pitfalls verified from CVEs, official docs, community incidents; Zawgyi severity estimated |

**Overall confidence: HIGH**

### Gaps to Address

- **Edge Function cold start / push latency SLA:** Measure in the push-trigger phase; decide if a keep-warm pg_cron ping is needed.
- **Myanmar Zawgyi device share:** No current percentage; mitigation (`myanmar-tools` + explicit web font) is correct regardless.
- **FCM token-refresh API in modular SDK v12:** Confirm exact method name during the push-token phase.
- **FCM fan-out concurrency cap in Deno:** Test safe `Promise.allSettled` concurrency for 20+ matched donors.

---

*Research completed: 2026-06-19*
*Ready for roadmap: yes*
