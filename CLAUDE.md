<!-- GSD:project-start source:PROJECT.md -->

## Project

**Blood Help**

Blood Help is a free, mobile-first PWA that instantly connects someone who urgently needs blood with nearby compatible donors, so a donor can call and help within minutes. It is built for a Myanmar audience (English + Burmese) and replaces the slow scramble of Facebook posts and word-of-mouth during a blood emergency with a direct, push-driven alert to the right donors nearby.

There is one unified user profile — "requesting blood" and "being available to donate" are *actions* a single user takes, not separate account types. The app runs as an installable PWA (Add to Home Screen) so donors receive push notifications even when the site isn't open.

**Core Value:** A person can post a blood request and have nearby, blood-compatible donors actually receive a push alert and call them back — turning an hours-long search into help within minutes. If everything else fails, this end-to-end loop (Request → nearby compatible donor alerted → callback) must work.

### Constraints

- **Tech stack**: Supabase + Firebase Cloud Messaging + React + Tailwind v4, PWA — chosen for a serverless, fast-to-ship two-sided app with real push.
- **Auth**: Dummy OTP flow only (no SMS provider) — keeps v1 demoable without telephony cost/setup.
- **Platform**: PWA, mobile-first — iOS web push requires the PWA be installed to the home screen, so install prompting + in-app fallback are required.
- **Localization**: Must support English and Burmese (Noto Sans Myanmar already in the design tokens).
- **UI source**: Screens come from the user's Claude Design prompts; GSD assembles and wires them rather than designing from scratch.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Already-Installed Baseline (do not reinstall)

| Package | Version |
|---------|---------|
| react | ^19.2.6 |
| react-dom | ^19.2.6 |
| @vitejs/plugin-react | ^6.0.1 |
| tailwindcss | ^4.3.1 |
| @tailwindcss/vite | ^4.3.1 |
| vite | ^8.0.12 |
| typescript | ~6.0.2 |

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

## Installation

# Supabase client

# Firebase (modular)

# PWA + Workbox (dev — SW is compiled, not bundled into app)

# i18n

## Integration Specifics

### 1. Supabase: PostGIS geo-distance queries

### 2. Firebase Cloud Messaging: web push in a Vite PWA

#### The core problem: one SW, not two

#### vite.config.ts

#### src/sw.ts (merged service worker)

#### tsconfig.json — add WebWorker to lib

#### App-side: token registration

#### VAPID key source

#### iOS push caveat

### 3. Dummy OTP auth with a real Supabase user/profile row

- Creates a genuine row in `auth.users` with a UUID and a JWT
- Sets up RLS correctly (`auth.uid()` works in all policies)
- Supabase's anonymous user is a first-class auth citizen — session is persisted in localStorage automatically
- Can be upgraded to a real phone/email account later without data loss
- The `is_anonymous` claim in the JWT can be used to gate certain policies if needed

### 4. Bilingual i18n (English + Burmese)

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

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vite-plugin-pwa@^1.3.0 | vite@^8.x | vite-plugin-pwa 1.x requires Vite 5+; Vite 8 in the project satisfies this. |
| workbox-precaching@^7.4.1 | vite-plugin-pwa@^1.3.0 | vite-plugin-pwa 1.x bundles Workbox 7 internally; use matching 7.x workbox-* if you install manually. Do NOT mix Workbox 6 and 7. |
| firebase@^12.15.0 | vite@^8.x, TypeScript@^6.x | Modular SDK is ESM-only; Vite handles ESM natively. No CJS shims needed. |
| react-i18next@^17.0.8 | i18next@^26.x, react@^19.x | react-i18next 17 requires i18next ≥26 and React ≥16.8. React 19 is supported. |
| @supabase/supabase-js@^2.108.2 | TypeScript@^6.x | supabase-js v2 ships its own types. No `@types/supabase` needed. |
| tailwindcss@^4.3.1 | @tailwindcss/vite@^4.3.1 | Tailwind v4 requires the Vite plugin (already installed). NO `tailwind.config.js` — configuration is CSS-only via `@theme`. Adding a config file will conflict. |

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

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
