---
quick_id: 260625-vps
slug: add-vercel-json-spa-rewrites-service-wor
date: 2026-06-25
type: quick
---

# Quick Task 260625-vps — Add vercel.json (Part C)

## Goal

Add a `vercel.json` so the Blood Help PWA deploys correctly on Vercel and stays
FCM-compatible: SPA fallback, a no-cache policy on the service worker, and baseline
security headers.

## Tasks

1. Create `vercel.json`:
   - `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist`.
   - SPA rewrite `/(.*) -> /index.html` (filesystem is checked first, so the static
     SW / manifest / hashed assets are served directly and never shadowed).
   - `/firebase-messaging-sw.js` + `/registerSW.js`: `Cache-Control: public, max-age=0,
     must-revalidate` so SW updates apply; `Service-Worker-Allowed: /` for root scope.
   - Global security headers: `X-Content-Type-Options`, `X-Frame-Options`,
     `Referrer-Policy`, `Strict-Transport-Security`.
2. Validate JSON + confirm header paths match emitted `dist/` filenames.

## Out of scope

- Content-Security-Policy (needs traffic-derived policy + testing — would otherwise
  break Google Fonts / Supabase realtime / FCM).
- The actual Vercel import + env vars + deploy (Parts D/E) and edge-function deploy +
  device push test (Parts F/G).

## Verify / done

- `node -e JSON.parse(...)` passes.
- `dist/firebase-messaging-sw.js`, `dist/registerSW.js`, `dist/manifest.webmanifest`,
  `dist/index.html` all exist (header rules target real files).
