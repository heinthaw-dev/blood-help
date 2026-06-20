# Codebase Concerns

**Analysis Date:** 2026-06-20

---

## Tech Debt

**No backend installed — core value proposition is entirely unimplemented:**
- Issue: `package.json` lists zero backend packages. `@supabase/supabase-js`, `firebase`, `vite-plugin-pwa`, `workbox-precaching`, `react-i18next`, and `i18next` are all documented in CLAUDE.md as required but have never been installed.
- Files: `package.json`, `src/App.tsx`, `src/auth.ts`
- Impact: The entire request→alert→callback loop (the app's core value) does not exist. No push notifications, no donor matching, no data persistence, no PWA installability. The app is a UI-only demo.
- Fix approach: Install the stack from CLAUDE.md in order — `@supabase/supabase-js`, `firebase` (modular), `vite-plugin-pwa`, `workbox-*`, `react-i18next`, `i18next` — then wire up each layer per the integration notes.

**Dummy auth stored in `localStorage` with raw phone numbers:**
- Issue: `src/auth.ts` stores raw phone numbers in `localStorage` under the key `bloodhelp.seenPhones` to gate the "first login" Intent Choice screen. This is a placeholder, not a real auth session.
- Files: `src/auth.ts`, `src/App.tsx` (lines 59–60)
- Impact: No JWT, no RLS, no FCM token binding. The "returning user" check will produce false results across devices. Phone numbers are PII sitting unencrypted in localStorage.
- Fix approach: Replace with `supabase.auth.signInAnonymously()` and check whether a `profiles` row exists to determine first-time status. Remove the `SEEN_KEY` localStorage approach entirely.

**All user state is ephemeral in-memory React state:**
- Issue: `App.tsx` holds `UserState` (name, bloodType, available, donationCount, lastDonation, showNumber) in `useState`. The `DEFAULT_USER` object is the starting value. Refreshing the page resets everything.
- Files: `src/App.tsx` (lines 36–83)
- Impact: Any data the user enters — donor profile, availability toggle — is lost on page reload or navigation. The app cannot function as a real-use product.
- Fix approach: Persist to a Supabase `profiles` table. Load profile on mount from Supabase auth session. Toggle changes (`available`, `showNumber`) should immediately `upsert` to Supabase.

**Blood request is dropped after submission — no persistence, no fanout:**
- Issue: `handlePosted` in `App.tsx` (line 70) does `console.log('request posted (dummy)', draft)` and navigates to Profile. No database write, no push fanout occurs.
- Files: `src/App.tsx` (lines 68–72), `src/screens/CreateRequest.tsx`
- Impact: The request is silently discarded. No donors are alerted. The core product loop does not function.
- Fix approach: On `onPosted`, call a Supabase RPC (e.g. `create_blood_request`) that inserts the request row and triggers the push fanout via a Supabase Edge Function + FCM.

**Custom inline i18n duplicated across every screen:**
- Issue: Each screen defines its own `strings = { my: {...}, en: {...} }` object and resolves copy via `strings[lang]`. This pattern is duplicated verbatim in `PhoneEntry.tsx`, `OtpVerification.tsx`, `IntentChoice.tsx`, `CreateRequest.tsx`, `DonorProfileSetup.tsx`, and `Profile.tsx`.
- Files: `src/screens/*.tsx` (all six screen files)
- Impact: No shared string registry, no namespace separation, no lazy loading. Adding a third language requires editing every screen. There is no interpolation support for dynamic strings (e.g. `resendWaiting` bakes the countdown number into a static string object that is recreated on every render, at lines 82 and 92 of `OtpVerification.tsx`).
- Fix approach: Install `react-i18next` + `i18next` per CLAUDE.md. Extract all strings into `public/locales/my/` and `public/locales/en/` JSON files. Replace inline string objects with `useTranslation()` hook.

**Language toggle UI code duplicated in every screen:**
- Issue: The `tabBase`, `activeTab`, `idleTab` CSSProperties objects and the two-button `မြန်မာ / ENG` pill toggle are copy-pasted into `PhoneEntry.tsx`, `OtpVerification.tsx`, `IntentChoice.tsx`, `CreateRequest.tsx`, `DonorProfileSetup.tsx`, and `Profile.tsx`. The same ~15 lines of inline style appear six times.
- Files: `src/screens/*.tsx`
- Impact: Any style change to the language toggle must be applied in six places. High risk of drift.
- Fix approach: Extract into a shared `<LangToggle lang={lang} onChange={onLangChange} />` component in `src/components/`.

**PWA not configured — no manifest, no service worker:**
- Issue: `vite.config.ts` only loads `@vitejs/plugin-react` and `@tailwindcss/vite`. No `vite-plugin-pwa` with `injectManifest` strategy. No `src/sw.ts`. No `manifest.webmanifest`. The `public/` folder has `favicon.svg` and `icons.svg` but no manifest file.
- Files: `vite.config.ts`, `public/` directory
- Impact: The app cannot be installed to the Home Screen on iOS, which means iOS push notifications (which require Home Screen installation) can never work. No offline caching. No install prompt.
- Fix approach: Install `vite-plugin-pwa` + `workbox-precaching`. Configure `injectManifest` strategy in `vite.config.ts`. Create `src/sw.ts` with `precacheAndRoute` + FCM `onBackgroundMessage`. Add `manifest.webmanifest` to `public/`.

**`index.html` uses Vite default boilerplate title and favicon:**
- Issue: `index.html` has `<title>blood-help</title>` and `<link rel="icon" href="/favicon.svg" />`. The favicon.svg in `public/favicon.svg` is actually the default Vite lightning-bolt icon (purple, from the Vite brand), not a Blood Help drop icon.
- Files: `index.html`, `public/favicon.svg`
- Impact: Wrong app name shown in browser tab/shelf and on Android install. Wrong icon on install. Minor brand issue for demo, breaking issue for production.
- Fix approach: Replace `<title>` with "Blood Help". Replace `public/favicon.svg` with the blood drop SVG that is already used inline in the screens. Add proper PWA icon sizes (192x192, 512x512) to `public/`.

**`src/App.css` is the unmodified Vite scaffold stylesheet:**
- Issue: `src/App.css` contains Vite scaffold styles (`.counter`, `.hero`, `.vite`, `#center`, `#next-steps`, etc.) that are leftover from `npm create vite@latest`. It is not imported anywhere in the Blood Help codebase.
- Files: `src/App.css`
- Impact: Dead code. Confusing to future developers. No functional harm currently.
- Fix approach: Delete `src/App.css`.

**Unused default Vite assets in `src/assets/`:**
- Issue: `src/assets/react.svg`, `src/assets/vite.svg`, and `src/assets/hero.png` are Vite scaffold assets. None are imported in any Blood Help source file.
- Files: `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`
- Impact: Dead files. Minor bundle and repo noise.
- Fix approach: Delete all three files.

---

## Known Bugs

**OTP verification accepts any 6-digit code — no real check:**
- Symptoms: Tapping "Verify" with any 6 digits in the OTP boxes calls `onVerified(code)` without any validation. The `setError` path in `handleVerify` is dead code — the condition `code.length === OTP_LENGTH` is the only gate.
- Files: `src/screens/OtpVerification.tsx` (lines 145–147)
- Trigger: Enter any 6 random digits, tap Verify — succeeds unconditionally.
- Workaround: This is intentional for the dummy prototype. Replace with `supabase.auth.verifyOtp()` when real auth lands.

**OTP auto-fill re-triggers if user manually clears the boxes:**
- Symptoms: The auto-fill `useEffect` (lines 65–73 in `OtpVerification.tsx`) fires when `isCodeEmpty` becomes `true`. If the user manually clears all six digits, a new dummy code auto-fills 3 seconds later, replacing what they might have been typing.
- Files: `src/screens/OtpVerification.tsx` (lines 65–73)
- Trigger: Auto-fill a code, clear all boxes manually, wait 3 seconds.
- Workaround: None in the current code. A `hasFired` ref could gate the auto-fill to run only once per screen mount.

**`CreateRequest.tsx` does not validate phone format before submission:**
- Symptoms: `postDisabled` is computed as `!bloodType || phone.replace(/\D/g, '').length === 0` (line 50). This means any non-empty string of digits enables the Post button, including a single digit. No minimum length check.
- Files: `src/screens/CreateRequest.tsx` (line 50)
- Trigger: Enter blood type, type "1" in the phone field, tap Post — the geolocation flow starts.
- Workaround: None. Requires adding `phone.replace(/\D/g, '').length >= 9` to the disabled guard, matching the `PhoneEntry` screen's validation.

**Intent Choice cards are not keyboard-accessible:**
- Symptoms: The two intent cards in `IntentChoice.tsx` use `<div role="button" tabIndex={0}>` but have no `onKeyDown` handler. Pressing Enter or Space on the keyboard does not trigger `onChoose`.
- Files: `src/screens/IntentChoice.tsx` (lines 188–216, 219–251)
- Trigger: Tab to a card, press Enter or Space — nothing happens.
- Workaround: Add `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onChoose('need') }}` to each card.

**`AlertDialog` dismisses on scrim click even during active geolocation request:**
- Symptoms: In `CreateRequest.tsx`, the `AlertDialog` for the pre-permission warning remains open during `geoPhase === 'requesting'` (line 404). The scrim's `onClick={onCancel}` calls `setGeoPhase('idle')`. If the user taps the scrim while `getCurrentPosition()` is in flight, the UI resets but the geolocation promise is still running. When it resolves, it calls `onPosted` with stale state.
- Files: `src/components/AlertDialog.tsx` (line 46), `src/screens/CreateRequest.tsx` (lines 403–412)
- Trigger: Tap "Continue" on the location pre-alert, tap the scrim behind the spinner before the permission dialog resolves.
- Workaround: Disable scrim click-to-dismiss while `geoPhase === 'requesting'` by guarding `onCancel` in the `AlertDialog` open condition.

**`main.tsx` uses non-null assertion on `document.getElementById('root')`:**
- Symptoms: `createRoot(document.getElementById('root')!)` will throw a runtime error if the `#root` div is ever absent from `index.html`.
- Files: `src/main.tsx` (line 6)
- Trigger: Only if `index.html` is modified to remove `<div id="root">`.
- Workaround: Low priority. Add a null guard: `const el = document.getElementById('root'); if (!el) throw new Error('Root element not found'); createRoot(el).render(...)`.

---

## Security Considerations

**Phone numbers stored as plaintext in `localStorage`:**
- Risk: `src/auth.ts` writes an array of raw phone numbers to `localStorage.bloodhelp.seenPhones`. Any JavaScript on the page (including injected third-party scripts) can read these. Phone numbers are PII under GDPR/PDPA.
- Files: `src/auth.ts`
- Current mitigation: None.
- Recommendations: Replace this mechanism entirely with Supabase session persistence. If local storage of phone is truly needed, store only a hash. Clear the key on logout.

**`console.log` statements expose user data in production builds:**
- Risk: `App.tsx` lines 70 and 76 log full `RequestDraft` (including GPS coordinates and phone number) and `DonorProfile` objects. Vite does not strip `console.log` calls in production builds by default.
- Files: `src/App.tsx` (lines 70, 76)
- Current mitigation: None.
- Recommendations: Remove both console.log calls. If development logging is needed, gate on `import.meta.env.DEV`.

**No Content Security Policy (CSP) configured:**
- Risk: `index.html` has no CSP meta tag. Google Fonts are loaded from `fonts.googleapis.com` and `fonts.gstatic.com`. Without a CSP, injected scripts or style injections are not blocked.
- Files: `index.html`, `src/index.css` (line 3)
- Current mitigation: None.
- Recommendations: Add a CSP meta tag permitting `fonts.googleapis.com`, `fonts.gstatic.com`, and the app's own origin. When Supabase and Firebase are added, extend the CSP to include their domains.

**`html lang` attribute does not reflect the selected language:**
- Risk: `index.html` has `<html lang="en">` hardcoded. The app defaults to Burmese (`my`) and allows switching to English. Assistive technologies and search engines see the wrong language declaration.
- Files: `index.html` (line 2), `src/App.tsx` (line 51)
- Current mitigation: None.
- Recommendations: Update `document.documentElement.lang` whenever `lang` state changes in `App.tsx`. For Burmese, set `lang="my"`; for English, `lang="en"`.

---

## Performance Bottlenecks

**Google Fonts loaded via network on every page load:**
- Problem: `src/index.css` line 3 issues a blocking `@import url('https://fonts.googleapis.com/...')` for Inter and Noto Sans Myanmar. This is a render-blocking cross-origin resource.
- Files: `src/index.css` (line 3)
- Cause: External CDN font load on first paint. On slow Myanmar mobile connections this can delay text rendering by 2–5 seconds.
- Improvement path: Add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` to `index.html`. When the PWA SW is set up, cache font responses via Workbox `StaleWhileRevalidate` strategy.

**Entire screen tree re-renders on `lang` toggle:**
- Problem: `lang` state in `App.tsx` is passed as a prop to every active screen. Every language toggle re-renders the full active screen component, which rebuilds all inline `CSSProperties` objects and `strings` lookup objects.
- Files: `src/App.tsx`, `src/screens/*.tsx`
- Cause: No memoization. All style objects are created inline during render.
- Improvement path: Move `lang` to React Context or install `react-i18next`. This allows only the text-consuming components to subscribe, reducing the re-render surface.

---

## Fragile Areas

**Screen router is a chain of `if` statements in `App.tsx`:**
- Files: `src/App.tsx` (lines 99–179)
- Why fragile: Navigation state is a single `Screen` string. Adding screens requires inserting new `if` blocks, and any unhandled `Screen` value silently falls through to the `PhoneEntry` screen — the last `return` statement is the fallback with no explicit guard. Navigating "back" from any screen manually resets to `'profile'` or `'phone'` with no history stack.
- Safe modification: Always add a new `if (screen === 'new-screen')` block before the final `return`. When implementing a proper router (React Router or TanStack Router), all navigation intent will need to be mapped to routes.
- Test coverage: None.

**`OtpVerification.tsx` inline string objects are recreated on every render including countdown ticks:**
- Files: `src/screens/OtpVerification.tsx` (lines 75–98)
- Why fragile: The `strings` object containing all copy is defined inside the component body. The countdown `useEffect` calls `setCountdown` every second, re-rendering the component and rebuilding the entire `strings` object. The `resendWaiting` string (which embeds `countdown` directly, e.g. `"Resend in " + countdown + "s."`) cannot be statically extracted without i18next interpolation.
- Safe modification: Move static strings out of the component body. Only the countdown-interpolated strings need to stay reactive. Resolve by installing `react-i18next` with `t('resendWaiting', { seconds: countdown })`.
- Test coverage: None.

**`geolocation.ts` has no abort/cancel mechanism:**
- Files: `src/geolocation.ts`
- Why fragile: `getCurrentPosition()` returns a `Promise` with no way to cancel an in-flight geolocation request. If the `CreateRequest` screen unmounts while the browser is still prompting for permission (e.g. the user presses the device back button), the promise resolves and calls `onPosted` on an unmounted component, which in the current React-state-only setup causes a no-op but would cause a state update on unmounted component warning in React dev mode.
- Safe modification: Use `AbortController` or a `cancelled` flag ref in the calling component to gate whether `onPosted` is called after the component unmounts.
- Test coverage: None.

**`BloodTypeSelector` has no `aria-label` or group role:**
- Files: `src/components/BloodTypeSelector.tsx`
- Why fragile: The 8 blood-type chips are rendered as individual `<button>` elements in a grid with no surrounding `<fieldset>` / `<legend>` or `role="group"` / `aria-label`. Screen readers announce each chip button in isolation with no group context indicating they are a single-select blood type picker.
- Safe modification: Wrap the grid in `<div role="group" aria-label="Blood type">` and add `aria-pressed={value === t}` to each chip button.
- Test coverage: None.

---

## Scaling Limits

**`Leaderboard` uses hardcoded dummy data — real ranking not implemented:**
- Current capacity: 8 hardcoded entries in `DUMMY` array in `src/screens/Leaderboard.tsx` (lines 26–35).
- Limit: No database query exists. A real leaderboard with hundreds of donors requires a Supabase query (`ORDER BY donation_count DESC LIMIT N`) and pagination.
- Scaling path: Add a `get_leaderboard` Supabase RPC that returns top N donors. Add infinite scroll or pagination for the list.

**Phone number as sole user identity is not scalable internationally:**
- Current capacity: Phone input hardcodes `+95` (Myanmar country code) in `PhoneEntry.tsx` (line 182) and `App.tsx` `formatPhone` (line 47). Digits are stored without the country code prefix in state.
- Limit: App cannot onboard non-Myanmar numbers. If the app expands beyond Myanmar, the hardcoded prefix becomes incorrect.
- Scaling path: Replace the hardcoded `+95` chip with a country code selector. Store phone as E.164 format (`+959XXXXXXX`) from the start.

---

## Dependencies at Risk

**`react-i18next` and `i18next` are not installed despite being planned and required:**
- Risk: The custom inline string system (6 separate `strings` objects) will need to be migrated to i18next when the proper i18n layer is installed. The migration involves touching all 6 screen files simultaneously.
- Impact: Any string additions made before migration increase migration cost.
- Migration plan: Install `react-i18next@^17.0.8` and `i18next@^26.3.1` as documented in CLAUDE.md. Extract all strings in a single batch migration. Do not add new inline string objects after that point.

**Tailwind v4 config-file restriction:**
- Risk: Tailwind v4 is used with `@tailwindcss/vite`. CLAUDE.md explicitly warns "NO `tailwind.config.js` — configuration is CSS-only via `@theme`. Adding a config file will conflict." The `@theme` block in `src/index.css` is the single source of truth.
- Impact: Any developer accustomed to v3 who adds `tailwind.config.js` or `tailwind.config.ts` will break the token system silently.
- Migration plan: Document this constraint in a prominent comment at the top of `src/index.css`. It is already noted in CLAUDE.md.

---

## Missing Critical Features

**No push notification system:**
- Problem: Firebase Cloud Messaging is not installed. No service worker exists. No FCM token is requested. No `onBackgroundMessage` handler exists.
- Blocks: Background push to donors when a blood request is posted. This is the app's core differentiator vs. Facebook posts.

**No database — zero data persistence:**
- Problem: Supabase client is not installed. No schema exists. No `profiles` table, no `blood_requests` table, no PostGIS extension.
- Blocks: User profiles, blood requests, donor matching, leaderboard — every feature that requires stored data.

**No PWA installability:**
- Problem: No `manifest.webmanifest`, no service worker, no `vite-plugin-pwa` configuration.
- Blocks: "Add to Home Screen" on iOS and Android. iOS push requires the PWA to be installed to the Home Screen.

**Home tab in BottomNav is non-functional:**
- Problem: `BottomNav` renders a "Home" tab (`src/components/BottomNav.tsx` line 50). `handleNavigate` in `App.tsx` (lines 87–91) has no `if (tab === 'home')` branch — tapping Home does nothing.
- Blocks: The active request feed (real-time list of open blood requests near the user).

**No geolocation prompt for donor profile setup:**
- Problem: `DonorProfileSetup.tsx` collects name, blood type, phone, and availability but never asks for the donor's location. Without a stored GPS coordinate, the matching query (`ST_DWithin`) cannot find this donor.
- Blocks: Donor matching. A donor who sets up their profile will never receive push alerts.

---

## Test Coverage Gaps

**No test files exist anywhere in the repository:**
- What's not tested: All screens, all components, all utility functions, navigation logic, auth helpers, geolocation wrapper.
- Files: Entire `src/` directory.
- Risk: Any refactoring or backend integration work has no regression safety net. The navigation state machine in `App.tsx` is particularly at risk — wrong screen transitions could leave users in dead-end states.
- Priority: High. At minimum, unit tests for `src/auth.ts`, `src/blood.ts`, `src/i18n.ts`, and `src/geolocation.ts` should be added before backend integration begins.

---

*Concerns audit: 2026-06-20*
