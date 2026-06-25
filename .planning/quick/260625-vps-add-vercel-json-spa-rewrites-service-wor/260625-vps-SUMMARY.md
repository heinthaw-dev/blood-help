---
quick_id: 260625-vps
slug: add-vercel-json-spa-rewrites-service-wor
date: 2026-06-25
status: complete
branch: feat/fcm-frontend
---

# Quick Task 260625-vps — Summary

## Outcome

Added `vercel.json` configuring the Vercel deploy for the FCM-enabled PWA. Committed on
`feat/fcm-frontend`.

## Changes

- **`vercel.json`** (new):
  - `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist`.
  - SPA rewrite `/(.*) -> /index.html`.
  - `/firebase-messaging-sw.js` + `/registerSW.js`: `Cache-Control: public, max-age=0,
    must-revalidate`; SW also gets `Service-Worker-Allowed: /`.
  - Global: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
    `Referrer-Policy: strict-origin-when-cross-origin`,
    `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

## Verification

- `vercel.json` parses as valid JSON.
- All header-targeted paths exist in `dist/` (`firebase-messaging-sw.js`,
  `registerSW.js`, `manifest.webmanifest`, `index.html`).

## Decisions

- **CSP deferred** — a guessed policy would break Google Fonts / Supabase WSS / FCM;
  needs to be derived from observed traffic and tested.
- HSTS set with `includeSubDomains` (safe for a single-app domain; *.vercel.app already
  enforces HSTS platform-wide).

## Follow-ups (Parts D–G, not in this task)

- Push `feat/fcm-frontend`, import repo in Vercel, set 7 `VITE_FIREBASE_*` + 2
  `VITE_SUPABASE_*` env vars (Production + Preview), deploy.
- `supabase secrets set FIREBASE_SERVICE_ACCOUNT=…` + `supabase functions deploy
  notify-donors notify-requester`.
- On-device push test (Android Chrome / installed iOS PWA) + Lighthouse PWA audit.
