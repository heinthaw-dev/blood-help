---
id: 260819-lkq
type: quick
status: planned
created: 2026-08-19
description: Fix QR scanner dead on Android+iOS — CSP blocks jsDelivr wasm fetch and WebAssembly compile; self-host zxing_reader.wasm via Vite and surface scanner errors
---

# Quick Task 260819-lkq — QR scanner never opens the camera

## Symptom

On both Android and iOS: tapping "scan QR" shows the app's own camera
pre-permission dialog, the user taps Continue/Allow, the dialog closes, and
nothing else happens — no camera feed, no error, no OS permission prompt.

## Root cause

Third CSP casualty from commit `23ee7bc`, same family as the FCM bug fixed in
`260819-hsx`.

`react-zxing@3` decodes via `barcode-detector` → `zxing-wasm@3.1.0`, which
fetches its WebAssembly binary from a CDN at runtime. The built bundle's
`locateFile` override resolves to:

```
https://fastly.jsdelivr.net/npm/zxing-wasm@3.1.0/dist/reader/zxing_reader.wasm
```

The CSP in `index.html` declares `default-src 'self'` with no jsDelivr host in
`connect-src`, so that fetch is blocked. `script-src` also lacks
`'wasm-unsafe-eval'`, which Chromium and Safari 16.4+ require before
`WebAssembly.instantiate` may compile a module — so even a successfully fetched
binary would not compile.

The failure is invisible because of the **call order** in
`node_modules/react-zxing/lib/esm/useZxing.js:112-123`:

```js
assertCameraAccess();                                  // pure check, no prompt
await prepareWasm({ wasmUrl });                        // ← throws here
const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
video.srcObject = stream;
```

WASM is prepared **before** `getUserMedia`. When `prepareWasm` rejects, the
function never reaches the camera call — which is why no OS permission prompt
appears and no video feed starts. The throw lands in `useZxing`'s catch and is
forwarded to `onError`, which in `src/screens/RequestLive.tsx:253` is:

```js
onError(err) {
  if (import.meta.env.DEV) console.warn("QR scan error:", err);
}
```

`import.meta.env.DEV` is false in the deployed build, so production swallows it
entirely. The dialog the user sees and dismisses is the app's own
`AlertDialog` at `src/screens/RequestLive.tsx:1161` ("Tap Allow when your
browser asks") — the browser never gets that far.

The code already anticipated this: `src/screens/RequestLive.tsx:238` carries the
note *"react-zxing loads zxing_reader.wasm from jsDelivr CDN by default. For
production PWA (offline use), pass a self-hosted wasmUrl — tracked as a
follow-up."*

## Approach

Self-host the binary rather than allowlisting jsDelivr. It fixes the CSP block,
removes a runtime CDN dependency from a PWA built for intermittent Myanmar
connectivity, and closes the follow-up the code already flagged — one change,
three wins. Allowlisting the CDN would fix only the first.

`zxing-wasm` publishes the binary as an explicit export subpath
(`"./reader/zxing_reader.wasm"` in its `exports` map), so Vite can emit it as a
hashed same-origin asset that is automatically version-locked to the installed
package. No `public/` copy to drift out of sync.

## Tasks

### T1 — Serve `zxing_reader.wasm` from our own origin

**Files:** `src/screens/RequestLive.tsx`, `src/vite-env.d.ts` (if a module
declaration is needed for the `?url` import)

**Action:** Import the wasm URL through Vite's asset pipeline and pass it to
`useZxing` as `wasmUrl`:

```ts
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
...
useZxing({ wasmUrl: zxingWasmUrl, ... })
```

**Verify:** `npm run build` emits the `.wasm` into `dist/assets/`; the built
bundle no longer resolves the fastly.jsdelivr.net URL for the reader binary.

**Done:** The wasm is fetched from our origin, satisfying `connect-src 'self'`.

### T2 — Allow WebAssembly compilation in the CSP

**Files:** `index.html`

**Action:** Add `'wasm-unsafe-eval'` to `script-src`. This permits WebAssembly
compilation *only* — it does not re-enable `eval()` or inline script, so it is a
far narrower grant than `'unsafe-eval'`.

**Verify:** Built `dist/index.html` carries the token in `script-src`.

**Done:** `WebAssembly.instantiate` is permitted under the policy.

### T3 — Stop swallowing scanner errors in production

**Files:** `src/screens/RequestLive.tsx`

**Action:** `onError` currently logs only under `import.meta.env.DEV`, so every
production failure is silent. Log unconditionally via `console.error` (kept in
production builds — `vite.config.ts` strips only `log`/`debug`/`info`), and show
the user a bilingual toast so a dead scanner is visibly dead rather than
mysteriously inert. Reuse the existing `showToast` helper.

**Verify:** `npm run build` + `npm run lint` green.

**Done:** A failing scanner reports itself on-screen and in the console.

## Must-haves

- No `fastly.jsdelivr.net` / `cdn.jsdelivr.net` reference for the reader wasm in
  the built bundle
- `zxing_reader.wasm` emitted into `dist/` and served same-origin
- `script-src` in `index.html` contains `'wasm-unsafe-eval'`
- QR scan failures surface to the user and to `console.error` in production
- `npm run build` and `npm run lint` green

## Out of scope

- Switching off `react-zxing` or changing the decode UX.
- Native `BarcodeDetector` fast-path (Android Chrome has it built in and could
  skip wasm entirely) — a worthwhile optimisation, but it would not fix iOS,
  which has no native `BarcodeDetector`.

## Manual retest (user)

After the Vercel deploy: open a live request, tap the QR scan action, confirm
the OS camera prompt now appears and the viewfinder shows a live feed. Scanning
a donor's QR should populate the 5-character code field.
