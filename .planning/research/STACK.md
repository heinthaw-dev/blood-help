# Stack Research

**Domain:** Emergency blood-donor matching PWA (Myanmar audience)
**Researched:** 2026-06-19
**Confidence:** HIGH (versions verified against npm; FCM/PostGIS patterns verified against official docs and Context7)

---

## Already-Installed Baseline (do not reinstall)

From `package.json` as shipped:

| Package | Version |
|---------|---------|
| react | ^19.2.6 |
| react-dom | ^19.2.6 |
| @vitejs/plugin-react | ^6.0.1 |
| tailwindcss | ^4.3.1 |
| @tailwindcss/vite | ^4.3.1 |
| vite | ^8.0.12 |
| typescript | ~6.0.2 |

`vite.config.ts` already has `react()` and `tailwindcss()` plugins wired. Tailwind v4 `@theme` tokens already live in `src/index.css`. Do not add a `tailwind.config.*` file — Tailwind v4's Vite plugin reads `@theme` directly from CSS.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @supabase/supabase-js | ^2.108.2 | Database client, Realtime, auth helpers | Only official Supabase client for browser; v2 is current stable, v1 is EOL. Provides typed RPC, Realtime channels, and auth in one package. |
| firebase (modular SDK) | ^12.15.0 | Firebase Cloud Messaging push delivery | Modular tree-shakeable SDK. Only `firebase/app` and `firebase/messaging` are imported; everything else is excluded from the bundle. v12.x is current stable on npm as of June 2026. |
| vite-plugin-pwa | ^1.3.0 | Manifest injection, SW build pipeline, installability | Current stable (1.3.0). Handles manifest generation, SW compilation, and `useRegisterSW` hook for update prompts. Required to merge PWA + FCM into a single SW via `injectManifest` strategy. |
| workbox-precaching | ^7.4.1 | Precache manifest injection inside custom SW | Workbox 7.x is what vite-plugin-pwa 1.x requires. Provides `precacheAndRoute(self.__WB_MANIFEST)`. Must be a dev dependency — it's injected into the SW source, not the app bundle. |
| react-i18next | ^17.0.8 | EN/Burmese language switching | De-facto standard. `useTranslation` hook, namespace support, lazy-loaded JSON, no server required. Minimal runtime (~10 kB). |
| i18next | ^26.3.1 | i18n engine that react-i18next wraps | Required peer dep of react-i18next. Version must be ≥26 to match react-i18next 17.x. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workbox-routing | ^7.4.1 | Route-level caching strategies in custom SW | Add if the SW needs network-first or stale-while-revalidate caching for API calls beyond precache. |
| workbox-strategies | ^7.4.1 | CacheFirst / NetworkFirst / StaleWhileRevalidate | Same as above. Optional for blood-help v1 (FCM SW + precache is sufficient). |
| @types/serviceworker | (included in TS lib "WebWorker") | TypeScript types for `self` inside SW file | Not an npm install — add `"WebWorker"` to tsconfig `lib` array. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite `define` plugin option | Inject Firebase config env-vars into SW build | Service workers cannot access `import.meta.env`. Use Vite `define: { __FIREBASE_CONFIG__: JSON.stringify({...}) }` and declare it as `declare const __FIREBASE_CONFIG__` in the SW TypeScript file. |
| Supabase CLI | Local dev stack, DB migrations, type generation | `npx supabase gen types typescript --project-id <id>` produces `database.types.ts` for fully-typed RPC calls. |

---

## Installation

```bash
# Supabase client
npm install @supabase/supabase-js

# Firebase (modular)
npm install firebase

# PWA + Workbox (dev — SW is compiled, not bundled into app)
npm install -D vite-plugin-pwa workbox-precaching workbox-routing workbox-strategies

# i18n
npm install react-i18next i18next
```

---

## Integration Specifics

### 1. Supabase: PostGIS geo-distance queries

**Enable the extension** (run once in Supabase SQL editor or migration):

```sql
create extension if not exists postgis with schema extensions;
```

**Donors table** — use `geography(POINT, 4326)` (not `geometry`). Geography operates in meters automatically, which is what `ST_DWithin` expects for radius in meters:

```sql
create table public.donors (
  id         uuid primary key references auth.users on delete cascade,
  blood_type text not null,          -- 'A+', 'B-', 'O-', etc.
  phone      text not null,
  fcm_token  text,
  is_available boolean not null default false,
  location   extensions.geography(POINT, 4326),
  updated_at timestamptz default now()
);

create index donors_location_idx
  on public.donors using gist (location);
```

**Insert/update a donor location** from the client:

```typescript
// longitude first, then latitude — this is ST_MakePoint(lng, lat) convention
await supabase
  .from('donors')
  .upsert({
    id: userId,
    location: `POINT(${lng} ${lat})`,   // WKT string accepted by PostgREST
  })
```

**RPC function for "donors within radius"** — blood compatibility is handled in the function via an array parameter, so the client doesn't need to replicate the matrix:

```sql
create or replace function public.donors_within_radius(
  req_lat        float8,
  req_lng        float8,
  radius_meters  float8,
  compatible_types text[]   -- caller passes the compatibility list
)
returns table (
  id         uuid,
  phone      text,
  fcm_token  text,
  distance_m float8
)
language sql
security definer
set search_path = ''
as $$
  select
    d.id,
    d.phone,
    d.fcm_token,
    extensions.st_distance(
      d.location,
      extensions.st_point(req_lng, req_lat)::extensions.geography
    ) as distance_m
  from public.donors d
  where
    d.is_available = true
    and d.blood_type = any(compatible_types)
    and d.fcm_token is not null
    and extensions.st_dwithin(
      d.location,
      extensions.st_point(req_lng, req_lat)::extensions.geography,
      radius_meters
    )
  order by d.location operator(extensions.<->) extensions.st_point(req_lng, req_lat)::extensions.geography;
$$;
```

**Call from supabase-js:**

```typescript
const { data, error } = await supabase.rpc('donors_within_radius', {
  req_lat: userLat,
  req_lng: userLng,
  radius_meters: 5000,           // 5 km
  compatible_types: ['O-', 'O+'] // blood compatibility matrix resolved client-side
})
```

Confidence: HIGH — pattern verified against official Supabase PostGIS docs and the `supabase-js` RPC API (Context7 `/supabase/supabase-js`).

---

### 2. Firebase Cloud Messaging: web push in a Vite PWA

#### The core problem: one SW, not two

FCM's default expectation is a file named exactly `firebase-messaging-sw.js` served from the root (`/`). If you let vite-plugin-pwa create its own `sw.js` AND you serve `firebase-messaging-sw.js` separately, you end up with **two service workers competing for the same scope** — the browser will only activate one. Background notifications will silently fail.

**Solution: `injectManifest` strategy — one merged SW file.**

vite-plugin-pwa's `injectManifest` strategy compiles *your* hand-written service worker file and injects the Workbox precache manifest into it. You write a single `src/sw.ts` that does both:
1. Workbox precaching (`precacheAndRoute(self.__WB_MANIFEST)`)
2. FCM background message handler (`onBackgroundMessage`)

You then call `getToken()` with an explicit `serviceWorkerRegistration` pointing to this merged SW, bypassing FCM's default `firebase-messaging-sw.js` lookup.

#### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    // Injected into the SW at build time (import.meta.env is NOT available in SW)
    __FIREBASE_APIKEY__:       JSON.stringify(process.env.VITE_FIREBASE_APIKEY ?? ''),
    __FIREBASE_AUTHDOMAIN__:   JSON.stringify(process.env.VITE_FIREBASE_AUTHDOMAIN ?? ''),
    __FIREBASE_PROJECT_ID__:   JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID ?? ''),
    __FIREBASE_MESSAGING_SENDER_ID__: JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''),
    __FIREBASE_APP_ID__:       JSON.stringify(process.env.VITE_FIREBASE_APP_ID ?? ''),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Blood Help',
        short_name: 'BloodHelp',
        theme_color: '#D13E2F',
        background_color: '#FAFAF9',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: false, // Enable only when actively testing SW in dev
        type: 'module',
      },
    }),
  ],
})
```

#### src/sw.ts (merged service worker)

```typescript
/// <reference lib="WebWorker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare const self: ServiceWorkerGlobalScope

// These are replaced by Vite `define` at build time
declare const __FIREBASE_APIKEY__: string
declare const __FIREBASE_AUTHDOMAIN__: string
declare const __FIREBASE_PROJECT_ID__: string
declare const __FIREBASE_MESSAGING_SENDER_ID__: string
declare const __FIREBASE_APP_ID__: string

// 1. Workbox precaching — injectManifest fills self.__WB_MANIFEST
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// 2. FCM background message handler
const firebaseApp = initializeApp({
  apiKey:            __FIREBASE_APIKEY__,
  authDomain:        __FIREBASE_AUTHDOMAIN__,
  projectId:         __FIREBASE_PROJECT_ID__,
  messagingSenderId: __FIREBASE_MESSAGING_SENDER_ID__,
  appId:             __FIREBASE_APP_ID__,
})

const messaging = getMessaging(firebaseApp)

onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? 'Blood Request Nearby'
  const body  = payload.notification?.body  ?? 'A compatible blood type is needed near you.'
  self.registration.showNotification(title, {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-96.png',
    data:  payload.data,   // pass through for click handler
  })
})

// Notification click → open/focus app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const appClient = clients.find((c) => c.url.includes(self.location.origin))
      if (appClient) return appClient.focus()
      return self.clients.openWindow('/')
    })
  )
})
```

#### tsconfig.json — add WebWorker to lib

```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "WebWorker"]
  }
}
```

#### App-side: token registration

```typescript
// src/lib/fcm.ts
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { firebaseApp } from './firebase'  // your initializeApp() singleton

export async function requestPushPermission(): Promise<string | null> {
  const messaging = getMessaging(firebaseApp)

  // Pass the SW registration explicitly — this is the critical call that
  // tells FCM to use YOUR merged SW instead of looking for firebase-messaging-sw.js
  const swReg = await navigator.serviceWorker.ready
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: swReg,
  })
  return token
}

export function listenForegroundMessages(callback: (payload: unknown) => void) {
  const messaging = getMessaging(firebaseApp)
  // onMessage is for foreground only; background is handled in sw.ts
  return onMessage(messaging, callback)
}
```

#### VAPID key source

Generate in Firebase Console → Project Settings → Cloud Messaging → Web push certificates → "Generate key pair". Copy the public key string into `.env`:

```
VITE_FIREBASE_VAPID_KEY=BExamplePublicKey...
```

The private key stays in Firebase; you never export it.

#### iOS push caveat

iOS 16.4+ supports Web Push **only when the PWA is installed to the Home Screen**. Push does not work from a Safari tab. The app must show an "Add to Home Screen" prompt and gate notification permission requests on `window.matchMedia('(display-mode: standalone)').matches`. iOS uses Apple Push Service endpoints internally — FCM routes through APNs for iOS — so the FCM token approach works unchanged, but the SW must be active (requires installation).

Confidence: HIGH — verified against Firebase JS SDK docs (`/firebase/firebase-js-sdk` on Context7), official FCM receive-messages page, and multiple working integration examples.

---

### 3. Dummy OTP auth with a real Supabase user/profile row

**What NOT to do:** Do not wire up Supabase Auth phone OTP (`signInWithOtp({ phone })`) — that requires a real Twilio/SMS provider and costs money. Do not mock at the Supabase Auth layer (messing with `auth.users` internals is fragile).

**Clean mock pattern — anonymous sign-in + immediate profile upsert:**

```typescript
// src/lib/auth.ts

import { supabase } from './supabase'

/** Step 1: user enters phone number, taps "Send OTP" */
export async function sendDummyOtp(_phone: string): Promise<void> {
  // No real SMS. Just store phone in session/local state for step 2.
  // Return immediately; the UI will show the OTP screen.
}

/** Step 2: after 3-second auto-fill delay, auto-submit the random code */
export async function verifyDummyOtp(phone: string): Promise<void> {
  // 1. Create or retrieve a real Supabase user via anonymous sign-in
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error

  const userId = data.user!.id

  // 2. Upsert a profile row — this is the real persistent record
  await supabase
    .from('profiles')
    .upsert({
      id:    userId,
      phone,               // store the phone they typed (no verification)
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' })
}
```

**Why `signInAnonymously`:**
- Creates a genuine row in `auth.users` with a UUID and a JWT
- Sets up RLS correctly (`auth.uid()` works in all policies)
- Supabase's anonymous user is a first-class auth citizen — session is persisted in localStorage automatically
- Can be upgraded to a real phone/email account later without data loss
- The `is_anonymous` claim in the JWT can be used to gate certain policies if needed

**profiles table:**

```sql
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  phone        text,
  display_name text,
  blood_type   text,
  fcm_token    text,
  is_donor     boolean not null default false,
  updated_at   timestamptz default now()
);

-- Auto-create profile row on any user creation (including anonymous)
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**UI pattern for the 3-second auto-fill:**

```typescript
// OtpScreen.tsx
useEffect(() => {
  const timer = setTimeout(async () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString()
    setOtpValue(randomCode)           // fill the input visibly
    await verifyDummyOtp(phone)       // sign in + upsert profile
    navigate('/home')
  }, 3000)
  return () => clearTimeout(timer)
}, [])
```

Confidence: HIGH — anonymous sign-in pattern verified against Supabase anonymous auth docs and user management docs. Trigger pattern from official Supabase managing-user-data guide.

---

### 4. Bilingual i18n (English + Burmese)

**Use:** `react-i18next` v17 + `i18next` v26. Do NOT use a custom React context for this — react-i18next provides `useTranslation`, namespace lazy-loading, and language detection out of the box.

**Minimal setup:**

```typescript
// src/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import my from './locales/my.json'   // Burmese (Myanmar)

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, my: { translation: my } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
```

```typescript
// main.tsx — import side-effect before rendering
import './i18n'
```

```typescript
// Any component
const { t, i18n } = useTranslation()
i18n.changeLanguage('my')   // switch to Burmese
t('request.title')          // " သွေးတောင်းဆိုမှု" or "Blood Request"
```

**Font strategy:** `--font-sans` in the existing `@theme` already sets `'Inter', 'Noto Sans Myanmar'` — Burmese characters naturally fall through to Noto Sans Myanmar without any additional CSS. Use `font-burmese` utility class on elements that are primarily Burmese to force the correct font first.

Confidence: HIGH — verified against Context7 `/i18next/react-i18next`.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `vite-plugin-pwa` (injectManifest) | Manual SW + Vite `publicDir` | No manifest injection, no update prompts, no `useRegisterSW` hook — more boilerplate for identical result. |
| Single merged SW (`src/sw.ts`) | Two SWs: `sw.js` (PWA) + `firebase-messaging-sw.js` | Two SWs on the same scope conflict — browser activates only one; the other's message handler silently dies. Background push breaks. |
| Firebase modular SDK (`firebase/messaging`) | Firebase compat SDK (`firebase/app-compat`) | Compat SDK is deprecated and loads the entire SDK tree. Modular SDK tree-shakes to ~45 kB for messaging only. |
| `signInAnonymously()` for mock auth | Fake/local-only state (no Supabase call) | Local-only state means no FCM token storage, no RLS session, no donor row — matching and push both break. |
| `react-i18next` | Custom i18n React context | Custom context lacks lazy loading, plurals, interpolation, namespace splitting — reinventing the wheel at higher maintenance cost. |
| PostGIS `geography(POINT)` column + `ST_DWithin` | Haversine formula in JS after fetching all donors | Fetching all donors is O(n) egress + client CPU. PostGIS `ST_DWithin` on a GiST index is O(log n) and returns only matching rows. |
| Supabase RPC for geo query | PostgREST row filter with `ST_DWithin` in `.filter()` | PostgREST doesn't expose spatial operators natively; `.filter()` raw SQL strings are fragile. RPC is the correct abstraction for complex spatial queries. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `firebase/app-compat` / `firebase-compat` imports | Deprecated compatibility layer; bundles entire Firebase SDK (~200 kB). No tree-shaking. Will be removed in Firebase v13. | Modular `firebase/app`, `firebase/messaging`, `firebase/messaging/sw` |
| `importScripts('https://www.gstatic.com/firebasejs/...')` in SW | Pins to an old SDK version (often 8.x). Breaking changes when gstatic URL is retired. No TypeScript types. | Import from `firebase/messaging/sw` npm package directly; vite-plugin-pwa compiles it. |
| `generateSW` strategy in vite-plugin-pwa | Plugin generates the SW automatically — no entry point to add FCM's `onBackgroundMessage`. You cannot inject custom push handlers. | `injectManifest` strategy with custom `src/sw.ts` |
| Supabase Auth phone OTP (`signInWithOtp({phone})`) | Requires SMS provider (Twilio). No free tier for production. Adds $$/complexity. Explicitly out-of-scope per PROJECT.md. | `signInAnonymously()` + dummy OTP UI |
| `geometry` column type (not `geography`) | `geometry` is planar (degrees), so distance calculations use degree-based math that breaks at scale. `ST_DWithin` distance unit is degrees, not meters. | `geography(POINT, 4326)` — distances in meters, works globally |
| `getToken()` without `serviceWorkerRegistration` option | Without explicit SW registration, FCM looks for `firebase-messaging-sw.js` at `/`. That file doesn't exist in the merged-SW setup, so token registration fails silently or raises "Service worker not found". | Always pass `serviceWorkerRegistration: await navigator.serviceWorker.ready` |
| Two separate service worker scopes | Registering both a PWA SW and `firebase-messaging-sw.js` on the same origin (`/`) — the second registration overwrites the first's activation. Background push or PWA caching breaks non-deterministically. | Single merged `src/sw.ts` with both `precacheAndRoute` and `onBackgroundMessage` |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vite-plugin-pwa@^1.3.0 | vite@^8.x | vite-plugin-pwa 1.x requires Vite 5+; Vite 8 in the project satisfies this. |
| workbox-precaching@^7.4.1 | vite-plugin-pwa@^1.3.0 | vite-plugin-pwa 1.x bundles Workbox 7 internally; use matching 7.x workbox-* if you install manually. Do NOT mix Workbox 6 and 7. |
| firebase@^12.15.0 | vite@^8.x, TypeScript@^6.x | Modular SDK is ESM-only; Vite handles ESM natively. No CJS shims needed. |
| react-i18next@^17.0.8 | i18next@^26.x, react@^19.x | react-i18next 17 requires i18next ≥26 and React ≥16.8. React 19 is supported. |
| @supabase/supabase-js@^2.108.2 | TypeScript@^6.x | supabase-js v2 ships its own types. No `@types/supabase` needed. |
| tailwindcss@^4.3.1 | @tailwindcss/vite@^4.3.1 | Tailwind v4 requires the Vite plugin (already installed). NO `tailwind.config.js` — configuration is CSS-only via `@theme`. Adding a config file will conflict. |

---

## Sources

- Context7 `/supabase/supabase-js` (v2.58.0 in Context7 index; npm latest 2.108.2) — RPC method signature, realtime channel pattern
- Context7 `/firebase/firebase-js-sdk` — `getToken`, `onMessage`, `onBackgroundMessage`, `firebase/messaging/sw` import path
- Context7 `/vite-pwa/vite-plugin-pwa` and `/websites/vite-pwa-org_netlify_app` — `injectManifest` strategy, `__WB_MANIFEST` injection, `srcDir`/`filename` options
- Context7 `/i18next/react-i18next` — `initReactI18next`, `useTranslation`, namespace setup
- [Supabase PostGIS docs](https://supabase.com/docs/guides/database/extensions/postgis) — `geography(POINT)` column, `ST_DWithin` RPC pattern, GiST index
- [Supabase anonymous sign-in docs](https://supabase.com/docs/guides/auth/auth-anonymous) — `signInAnonymously()`, `is_anonymous` JWT claim
- [Supabase managing-user-data docs](https://supabase.com/docs/guides/auth/managing-user-data) — profile table trigger pattern
- [Firebase FCM receive-messages docs](https://firebase.google.com/docs/cloud-messaging/js/receive) — `onMessage` vs `onBackgroundMessage`, SW naming rules, `serviceWorkerRegistration` override
- [Firebase FCM client setup docs](https://firebase.google.com/docs/cloud-messaging/js/client) — VAPID key setup, `getToken()` API
- [vite-pwa-org injectManifest guide](https://vite-pwa-org.netlify.app/workbox/inject-manifest) — `precacheAndRoute(self.__WB_MANIFEST)`, workbox dep list
- npm registry — confirmed versions: vite-plugin-pwa@1.3.0, firebase@12.15.0, @supabase/supabase-js@2.108.2, react-i18next@17.0.8, i18next@26.3.1, workbox-*@7.4.1
- [MagicBell: PWA iOS Limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS 16.4+ push only when installed to Home Screen
- [David Melo: Firebase + Vite Push Notifications](https://dmelo.eu/blog/vite_pwa/) — working injectManifest + FCM integration example

---
*Stack research for: Blood Help — emergency blood-donor matching PWA*
*Researched: 2026-06-19*
