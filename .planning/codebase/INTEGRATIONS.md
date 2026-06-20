# External Integrations

**Analysis Date:** 2026-06-20

## APIs & External Services

**Web Fonts (Active):**
- Google Fonts CDN — Inter and Noto Sans Myanmar typefaces
  - Loaded via CSS `@import url('https://fonts.googleapis.com/css2?...')` in `src/index.css`
  - No API key required; public CDN
  - Blocking: loads in `src/index.css` before Tailwind import

**Browser Geolocation API (Active):**
- Web standard `navigator.geolocation` — device GPS/location
  - Wrapper: `src/geolocation.ts` — `getCurrentPosition()` returns typed `GeoResult`
  - Options: `enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 0`
  - Permission prompt triggered on use; graceful fallback for `denied`, `unavailable`, `timeout`, `unsupported`
  - No external service; entirely client-side browser API

## Data Storage

**Databases:**
- Supabase — **Planned, not yet integrated**
  - `@supabase/supabase-js` not installed
  - No Supabase client initialized anywhere in `src/`
  - Current data is all in-memory React state (`src/App.tsx` `useState`)
  - Auth state is localStorage-only (`src/auth.ts`, key `bloodhelp.seenPhones`)

**File Storage:**
- None — no file/image upload features exist yet

**Caching:**
- `localStorage` — used only for dummy auth seen-phones list (`src/auth.ts`)
  - Key: `bloodhelp.seenPhones` (JSON array of phone digit strings)
  - No other client-side caching

## Authentication & Identity

**Auth Provider:**
- Dummy / local-only placeholder
  - Implementation: `src/auth.ts` — `hasLoggedInBefore(phone)` and `markLoggedIn(phone)` read/write `localStorage`
  - No real OTP, no SMS provider, no Supabase Auth
  - `App.tsx` `handleVerified()` calls `markLoggedIn` then navigates based on returning-user check
  - Planned: Supabase `signInAnonymously()` with dummy OTP UI (see `CLAUDE.md`)

## Push Notifications

**Firebase Cloud Messaging:**
- **Planned, not yet integrated**
  - `firebase` package not installed
  - No service worker registered (`vite.config.ts` has no `vite-plugin-pwa`)
  - No FCM token acquisition code exists
  - Planned: modular `firebase/messaging` + merged service worker at `src/sw.ts`

## PWA / Service Worker

**PWA Support:**
- **Not yet configured**
  - `index.html` has no `<link rel="manifest">` tag
  - No service worker registration in `src/main.tsx`
  - `vite-plugin-pwa` not installed
  - `dist/` build output contains no `manifest.webmanifest` or SW file
  - iOS home-screen install and background push require this to be set up

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, LogRocket, or equivalent installed or configured

**Logs:**
- `console.log` statements only, used as temporary placeholders in `App.tsx`:
  - `console.log('request posted (dummy)', draft)` — blood request submission
  - `console.log('donor profile saved (dummy)', profile)` — donor profile save

**Analytics:**
- None — no Posthog, Mixpanel, GA, or equivalent

## CI/CD & Deployment

**Hosting:**
- Not configured — no deployment config files found (`netlify.toml`, `vercel.json`, `firebase.json`, etc.)

**CI Pipeline:**
- None — no `.github/workflows/`, CircleCI, or equivalent

## Environment Configuration

**Required env vars:**
- None currently — the application runs entirely without environment variables
- Planned vars (when integrations are added):
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key
  - `VITE_FIREBASE_*` — Firebase project config (injected via Vite `define` for SW access)
  - `VITE_VAPID_PUBLIC_KEY` — FCM VAPID key for push token registration

**Secrets location:**
- No secrets present — no `.env` files exist in the repository

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Localization

**i18n:**
- Custom minimal implementation — `src/i18n.ts` exports `Lang` type (`'my' | 'en'`) and `formatNumber()` for Burmese numeral rendering
- No i18n library installed; translation strings are inline within each screen component
- `lang` state is lifted to `App.tsx` and passed as a prop to every screen
- Planned: `react-i18next` + `i18next` with JSON namespace files (see `CLAUDE.md`)

---

*Integration audit: 2026-06-20*
