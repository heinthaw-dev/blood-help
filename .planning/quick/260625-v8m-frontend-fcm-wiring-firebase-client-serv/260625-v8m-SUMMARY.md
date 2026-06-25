---
quick_id: 260625-v8m
slug: frontend-fcm-wiring-firebase-client-serv
date: 2026-06-25
status: complete
branch: feat/fcm-frontend
---

# Quick Task 260625-v8m — Summary

## Outcome

Frontend FCM web-push wiring is **complete, build-verified, and committed** on
`feat/fcm-frontend`. This pulls the FCM push feature forward from its v3.0 deferral.

## Key finding

The implementation was **already written but uncommitted** in the working tree, and was
more complete than the original Part B plan — it uses `vite-plugin-pwa` `injectManifest`
to emit a single merged service worker at the site root (FCM background handler +
Workbox precache), matching spec §1.

So execution was **harden + checkpoint**, not greenfield.

## Changes

**Hardening (this task)**
- `.gitignore`: ignore `dev-dist/` (PWA dev output) and `supabase/.temp/` (CLI cache).
- `src/firebase-messaging-sw.js`: fixed notification `badge` from a missing
  `/pwa-72x72.png` to the existing `/pwa-192x192.png`.

**Committed (pre-existing FCM work, grouped atomically)**
| Commit | Scope |
|--------|-------|
| `f7ab0e9` | chore: gitignore dev-dist + supabase/.temp |
| `7ba6d63` | build: firebase + vite-plugin-pwa deps |
| `9df03ea` | feat(pwa): FCM client (`firebase.ts`, `push.ts`) + merged SW + manifest |
| (C4) | feat(fcm): push opt-in dialogs + deep-link alert overlays (App/Home/RequestLive) |
| (C5) | feat(supabase): notify-donors / notify-requester edge functions + RPC migrations |

## Verification

- `npm run build` green → emits `dist/firebase-messaging-sw.js`,
  `dist/manifest.webmanifest`, `dist/registerSW.js`.
- Secret scan clean: edge functions read `FIREBASE_SERVICE_ACCOUNT` /
  `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`; no keys committed.

## Decisions

- Push opt-in left on donor-setup-save + request-post (NOT the availability toggle) —
  user choice.
- Committed on `feat/fcm-frontend` (not `main`) per branch-first practice; ready to
  fast-forward merge or open a PR.

## Follow-ups (not in this task)

- Vercel deploy config: `vercel.json` (SPA rewrites + SW no-cache headers), env vars,
  deploy + on-device push test (Parts C–G of the deploy guide).
- Runtime push verification on a real device (build passing ≠ push delivered).
