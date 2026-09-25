---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Backend Core
status: complete
stopped_at: v2.0 milestone complete — all 4 phases shipped, E2E loop verified
last_updated: "2026-07-03T00:00:00.000Z"
last_activity: 2026-07-03 -- Cleared pre-existing build/lint reds — quick 260703-grn: tsc + eslint now green (34bf6d2)
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 19
  completed_plans: 19
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-20)

**Core value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes.
**Current focus:** iOS PWA install/push onboarding — phases 1–4 done + wired in; feature functionally complete, pending manual device test. Build/lint now green (260703-grn cleared 5 pre-existing reds). v3.0 items (DNOR-03, PRIV-01, PRIV-02 remainder) parked.

## Current Position

Phase: 9 (last roadmapped) — complete
Plan: 09-03 complete — all plans done
Status: v2.0 milestone complete — all phases shipped & verified; iOS PWA onboarding feature in progress (quick tasks)
Last activity: 2026-09-25 -- Donor-setup saves no longer fail silently: the write-error dialog is mounted above every screen (it lived only in the home/profile branches), the form holds a saving phase through the awaited write, and Retry actually retries. Follow-up pass converged all eight write-error sites on genericWriteError and made the logging rule uniform (console.error never DEV-guarded)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 16 (v2.0 milestone — all phases complete)
- Average duration: ~15-20 min/plan
- Total execution time: 3 sessions

**By Phase:**

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 6 — Foundation | 6 (5+1 gap) | ✓ Complete | 2026-06-21 |
| 7 — Data Persistence + Geo-Matching | 4 | ✓ Complete | 2026-06-22 |
| 8 — Donor Response + Realtime | 3 | ✓ Complete | 2026-06-22 |

**Recent Trend:**

- Last 3 plans: Phase 8 realtime wiring (DB foundation, donor I'll help, RequestLive live list)
- Trend: On track, v2.0 complete

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 init]: Anonymous Supabase session behind dummy OTP — profiles FK requires auth.users
- [v2.0 init]: Data model is fixed from blood-help-spec.md — deviations require user sign-off
- [v2.0 init]: Use Supabase MCP tools for all migrations and dummy data seeding
- [v2.0 init]: FCM push is deferred to v3.0 — not in scope for this milestone
- [v2.0 init]: Coarsened GPS only for privacy this milestone; purge and phone reveal deferred to v3
- [08-03]: Read-back pattern for handlePosted — bare insert + separate maybeSingle() to recover new request id (bare-insert convention maintained)
- [08-03]: compatibleCount initialized from alertedCount prop so transparency line renders a number before the async donors_within_radius fetch completes
- [08-03]: Export formatPhone/formatDistanceLabel from Home.tsx — single source of truth, not duplicated in RequestLive

### Pending Todos

None yet.

### Blockers/Concerns

None active — Phase 9 complete. E2E loop verified (request → donor alerted → responds → requester confirms QR → congrats). Two quick tasks landed post-phase: progress bar persistence fix and pre-visible emergency-callable donors feature.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260624-vxw | Implement pre-visible emergency-callable donors on RequestLive screen | 2026-06-24 | 8645ff2 | [260624-vxw-implement-pre-visible-emergency-callable](./quick/260624-vxw-implement-pre-visible-emergency-callable/) |
| 260625-taj | Fix callable_donors_for_request RPC referencing non-existent d.geog column | 2026-06-25 | 9ab4240 | [260625-taj-fix-callable-donors-for-request-rpc-refe](./quick/260625-taj-fix-callable-donors-for-request-rpc-refe/) |
| 260625-v8m | Frontend FCM wiring — firebase client, merged service worker, manifest, push opt-in (harden + checkpoint; pulls FCM forward from v3.0 deferral) | 2026-06-25 | 8886500 | [260625-v8m-frontend-fcm-wiring-firebase-client-serv](./quick/260625-v8m-frontend-fcm-wiring-firebase-client-serv/) |
| 260625-vps | Add vercel.json — SPA fallback, service-worker no-cache, security headers (Part C of Vercel/FCM deploy) | 2026-06-25 | a8090ba | [260625-vps-add-vercel-json-spa-rewrites-service-wor](./quick/260625-vps-add-vercel-json-spa-rewrites-service-wor/) |
| 260626-igc | Rebuild Leaderboard screen v2 with real Supabase data (leaderboard_top_donors SECURITY DEFINER RPC) | 2026-06-26 | 84be1d3 | [260626-igc-rebuild-leaderboard-screen-v2-with-real-](./quick/260626-igc-rebuild-leaderboard-screen-v2-with-real-/) |
| 260925-535 | Show requester's own address on RequestLive instead of hardcoded placeholder | 2026-09-25 | 208c0f6 | [260925-535-show-requester-s-own-address-on-requestl](./quick/260925-535-show-requester-s-own-address-on-requestl/) |
| 260925-5gb | Build the missing auto-expanding search radius job — pg_cron tick, SQL state machine, durable ring queue, expand-radius delivery worker | 2026-09-25 | 9ffddb8 | [260925-5gb-auto-expanding-search-radius-job](./quick/260925-5gb-auto-expanding-search-radius-job/) |
| fast | SearchRadiusRings: empty reach says "no donors found within N km yet" instead of "reaching 0 donors" | 2026-09-25 | 8d404e8 | — (gsd:fast, no task dir) |
| fast | RequestLive transparency line: drop the "sent to 0 nearby donors" sentence at zero; keep the callback sentence | 2026-09-25 | 0566c91 | — (gsd:fast, no task dir) |
| 260925-6qa | Fix donors_within_radius and requests_within_radius ignoring their radius (lat/lng params captured by the queried table's own columns) | 2026-09-25 | 773eaab | [260925-6qa-fix-radius-param-shadowing](./quick/260925-6qa-fix-radius-param-shadowing/) |
| fast | expand_request_radius: truncate radius_last_expanded_at to the minute so cron jitter cannot delay a widening by a full tick | 2026-09-25 | 0cf4738 | — (gsd:fast, no task dir) |
| fast | SearchRadiusRings: 100x100, wider ring spacing, continuous outward ping whose travel distance is the current reach | 2026-09-25 | d29d8b1 | — (gsd:fast, no task dir) |
| fast | SearchRadiusRings: one dot per found donor on the band that reached them, angle hashed from the donor id (stable, carries no bearing) | 2026-09-25 | 234802e | — (gsd:fast, no task dir) |
| fast | SearchRadiusRings: cap donor dots at 4 per ring (nearest first, stable pick); subline still reports the true total | 2026-09-25 | 4f0ddbd | — (gsd:fast, no task dir) |
| fast | Unbreak the requester push: notify-requester filtered a non-existent responder_id column, and the CORS allowlist omitted the live Vercel origin (which also killed notify-donors in prod) | 2026-09-25 | 6a7c762 | — (gsd:fast, no task dir) |
| 260626-r5y | Redesign donor FCM alert modal to "Incoming Request Alert" (centered two-state modal, gated phone reveal) | 2026-06-26 | beb448b | [260626-r5y-redesign-donor-fcm-alert-modal-to-incomi](./quick/260626-r5y-redesign-donor-fcm-alert-modal-to-incomi/) |
| 260627-0lt | Extract shared ScreenHeader + LanguageToggle; route all 9 screens (behavior-preserving; resolves ui-consistency-report §1, §6) | 2026-06-27 | a49379a | [260627-0lt-extract-shared-screenheader-and-language](./quick/260627-0lt-extract-shared-screenheader-and-language/) |
| 260627-7gx | Add Notifications screen + shared header bell on Home/Leaderboard/Profile | 2026-06-27 | 3d14dc1 | [260627-7gx-add-notifications-screen-and-shared-head](./quick/260627-7gx-add-notifications-screen-and-shared-head/) |
| 260627-k3p | Extract shared Card component; route all 9 card surfaces through it (resolves ui-consistency-report §2) | 2026-06-27 | a9a117c | [260627-k3p-extract-card-component-route-all-surfaces](./quick/260627-k3p-extract-card-component-route-all-surfaces/) |
| 260627-p07 | Rebuild Donor Thank You screen to new Claude Design with push-enable states (idle/needsInstall/enabled), wired to real lib/push; removed double-prompt | 2026-06-27 | bf5da7b | [260627-p07-rebuild-donor-thank-you-screen-to-new-cl](./quick/260627-p07-rebuild-donor-thank-you-screen-to-new-cl/) |
| fast | Remove OTP screen header back button (left-aligned wordmark; change-number link remains) | 2026-06-27 | e508d7c | — (gsd:fast, no task dir) |
| fast | Donor Thank You header matches Phone Entry (left wordmark + language toggle) | 2026-06-27 | bd96737 | — (gsd:fast, no task dir) |
| 260629-pjl | Fix logout button vertically squashed on Profile screen (flexShrink:0 in shared Button base) | 2026-06-29 | f378859 | [260629-pjl-fix-logout-button-vertically-squashed-on](./quick/260629-pjl-fix-logout-button-vertically-squashed-on/) |
| 260630-43p | Design top-tier README.md — replace Vite boilerplate with overview, problem/advantages, donor + requester user flows (screenshots), tech stack, getting started, roadmap | 2026-06-30 | a043a72 | [260630-43p-design-top-tier-readme](./quick/260630-43p-design-top-tier-readme/) |
| 260702-ipw | iOS PWA install/push detection lib — src/lib/pwa.ts + usePwaState hook (pure detection, no UI); phase 1 of iOS onboarding feature | 2026-07-02 | da18ab8 | [260702-ipw-ios-pwa-detection-hook](./quick/260702-ipw-ios-pwa-detection-hook/) |
| 260703-pia | Push + install action layer — enablePush (renamed from registerPushToken, 6 call sites) + promptAndroidInstall; controllerchange guard; phase 2 of iOS onboarding | 2026-07-03 | 76e8ab0 | [260703-pia-push-install-actions](./quick/260703-pia-push-install-actions/) |
| 260703-pnu | PushNudge onboarding component — usePwaState-driven Card+Button nudge (iOS add-to-home / open-in-Safari / enable-push, Android install); Burmese-first; phase 3 of iOS onboarding | 2026-07-03 | a9787ba | [260703-pnu-push-nudge-ui](./quick/260703-pnu-push-nudge-ui/) |
| 260703-wir | Wire PushNudge — thank-you primary action + quiet skip, Home donor nudge (dismissible), main.tsx capture arm; phase 4 of iOS onboarding | 2026-07-03 | 0483354 | [260703-wir-wire-pushnudge](./quick/260703-wir-wire-pushnudge/) |
| 260703-grn | Clear pre-existing build/lint reds — dead titleStyle, Date.now→module helpers, 2× set-state-in-effect fixes; tsc + eslint green | 2026-07-03 | 34bf6d2 | [260703-grn-fix-build-lint-reds](./quick/260703-grn-fix-build-lint-reds/) |
| 260819-hsx | Fix FCM push registration — CSP connect-src missing firebaseinstallations, SW-ready timeout guard, surface enablePush failure in PushNudge | 2026-08-19 | f881749 | [260819-hsx-fix-fcm-push-registration-csp-connect-sr](./quick/260819-hsx-fix-fcm-push-registration-csp-connect-sr/) |
| 260819-i0m | Restore deleted seed profiles and donors — 3 dev seed rows + checked-in supabase/seed.sql for repeatability | 2026-08-19 | 0032dfa | [260819-i0m-restore-deleted-seed-profiles-and-donors](./quick/260819-i0m-restore-deleted-seed-profiles-and-donors/) |
| 260819-lkq | Fix QR scanner dead on Android+iOS — self-host zxing_reader.wasm, add 'wasm-unsafe-eval' + blob: to CSP, surface scanner errors | 2026-08-19 | b6f4914 | [260819-lkq-fix-qr-scanner-dead-on-android-ios-csp-b](./quick/260819-lkq-fix-qr-scanner-dead-on-android-ios-csp-b/) |
| 260819-me4 | Fix Android FCM never registering a token — add android-enable-push state, register on session hydrate, prune dead tokens server-side instead of deleting other devices | 2026-08-19 | 48051b7 | [260819-me4-fix-android-fcm-never-registering-a-devi](./quick/260819-me4-fix-android-fcm-never-registering-a-devi/) |
| 260819-mpc | Record real device platform (ios/android/web) in device_tokens instead of hardcoded 'web' | 2026-08-19 | d9a4666 | [260819-mpc-record-real-device-platform-ios-android-](./quick/260819-mpc-record-real-device-platform-ios-android-/) |
| 260906-fid | Lower PhoneEntry 'Send code' enable threshold from 9 digits to 7 (Myanmar numbers may be 7 digits and need not start with 9) | 2026-09-06 | 6f5e42d | [260906-fid-lower-phone-entry-send-code-threshold-to-7](./quick/260906-fid-lower-phone-entry-send-code-threshold-to-7/) |
| 260906-hjj | Profile logout button: primary color + loading spinner while handleLogout runs (matches OTP Verify/login CTA pattern) | 2026-09-06 | c3d6ab4 | [260906-hjj-logout-button-primary-color-with-loading-spinner](./quick/260906-hjj-logout-button-primary-color-with-loading-spinner/) |
| 260925-0e1 | Add date of birth to donor profile setup + profiles.date_of_birth | 2026-09-24 | 1ab8849 | [260925-0e1-add-date-of-birth-to-donor-profile-setup](./quick/260925-0e1-add-date-of-birth-to-donor-profile-setup/) |
| 260925-31f | Search-radius range rings on RequestLive (real search_radius_km, one-shot ring pulse per widening, no radar sweep); fixes D-09 count pinned to hardcoded 10 km | 2026-09-25 | d610704 | [260925-31f-add-expanding-search-radius-range-rings](./quick/260925-31f-add-expanding-search-radius-range-rings/) |
| 260925-m9b | Fix donor-setup save failing silently — mount write-error dialog above every screen (was home/profile only), hold a 'saving' phase through the awaited write, make Retry actually retry, try/catch thrown fetch errors, unguard write-failure logs; + quality pass converging all 8 write-error sites on genericWriteError | 2026-09-25 | dc43fe9, fedd22d, a856908 | [260925-m9b-fix-donor-setup-save-failure-ux](./quick/260925-m9b-fix-donor-setup-save-failure-ux/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Push | FCM push loop PUSH-01–04 (donor alert + requester notice) | ✅ Shipped early via quick tasks + edge fns | 2026-06-25 |
| Push | DNOR-03 — resolution notice to responding donors on close | Deferred to v3.0 (not started) | 2026-06-20 |
| Privacy | Personal data purge on request close (PRIV-01) | Deferred to v3 | 2026-06-20 |
| Privacy | Phone reveal logging + rate-limiting (PRIV-02 remainder) | Deferred to v3 (gating/masking already shipped) | 2026-06-20 |
| Auth | Real SMS OTP via Twilio | Deferred to v4 | 2026-06-20 |
| i18n | react-i18next library | Not blocking backend | 2026-06-20 |

## Session Continuity

Last session: 2026-06-27T00:00:00.000Z
Stopped at: Quick task 260925-m9b complete — donor-setup save failures are now visible and retryable (build + lint green)
Resume with: On a real iOS/Android PWA, save a donor profile and confirm the spinner holds to the Thank You screen with no second tap; if a failure dialog appears, capture the console error it now logs (that is the transport failure this task made visible, not yet fixed). Then run code-quality-refactor agent (standing preference)
