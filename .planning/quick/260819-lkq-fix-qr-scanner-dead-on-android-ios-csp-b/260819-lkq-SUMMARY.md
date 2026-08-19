---
id: 260819-lkq
type: quick
status: complete
completed: 2026-08-19
commits:
  - 6e3f9dc fix(qr): self-host zxing_reader.wasm so the scanner can start
  - b6f4914 fix(csp): permit WebAssembly compilation and blob: images
---

# Quick Task 260819-lkq — Summary

## What was broken

The QR scanner never opened the camera on either platform. The user saw the
app's own camera pre-permission dialog, tapped Continue, and then nothing — no
OS permission prompt, no viewfinder, no error.

Third CSP casualty from commit `23ee7bc`, after the FCM token registration bug
in `260819-hsx`.

Two independent blocks, either one fatal:

1. **`connect-src`** — `zxing-wasm@3.1.0` fetches its decoder binary at runtime
   from `https://fastly.jsdelivr.net/npm/zxing-wasm@3.1.0/dist/reader/zxing_reader.wasm`.
   `default-src 'self'` with no jsDelivr host blocked it.
2. **`script-src`** — no `'wasm-unsafe-eval'`, which Chromium and Safari 16.4+
   require before `WebAssembly.instantiate` may compile a module. Even a
   successfully fetched binary would not have compiled.

### Why it looked like the camera itself was broken

Call order in `node_modules/react-zxing/lib/esm/useZxing.js:112-123`:

```js
assertCameraAccess();                  // pure capability check, no prompt
await prepareWasm({ wasmUrl });        // ← rejected here
const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
video.srcObject = stream;
```

WASM is prepared *before* `getUserMedia`. The rejection meant execution never
reached the camera call — hence no OS prompt and no feed. The dialog the user
was dismissing was the app's own `AlertDialog` at `RequestLive.tsx:1161`.

The throw did reach `onError`, but that handler was
`if (import.meta.env.DEV) console.warn(...)` — and `vite.config.ts` strips
`console.log/debug/info` from production anyway. Production was silent by
construction.

## Changes

### Self-hosted decoder binary (`6e3f9dc`)

`zxing-wasm` publishes the binary under an explicit `exports` subpath, so
`import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'` lets Vite
emit it as a hashed same-origin asset and `useZxing({ wasmUrl })` points the
decoder at it.

Chosen over allowlisting jsDelivr because it also removes a runtime CDN
dependency from a PWA built for intermittent Myanmar connectivity, and closes
the follow-up the code already flagged at `RequestLive.tsx:238`. The binary is
now version-locked to `package-lock.json` — no `public/` copy to drift.

Build confirms: `dist/assets/zxing_reader-B47v7G7e.wasm` (1,089,670 bytes),
referenced from the bundle as `/assets/zxing_reader-B47v7G7e.wasm`, and
precache grew from 7 entries / 664 KiB to **8 entries / 1729 KiB** — so the
scanner now works offline too.

The default jsDelivr template string remains in the bundle as dead fallback
inside `zxing-wasm`; our `locateFile` override takes precedence.

### Error surfacing (`6e3f9dc`)

`onError` now calls `console.error` unconditionally and shows a bilingual toast
pointing the user at manual code entry, so a dead scanner is visibly dead.

### CSP (`b6f4914`)

- `script-src` gains `'wasm-unsafe-eval'` — permits WebAssembly compilation
  only; does not re-enable `eval()` or inline script.
- `img-src` gains `blob:` — `barcode-detector`'s decode path falls back to
  assigning a blob URL to an `Image` when `createImageBitmap` is unavailable.
  Defensive: `createImageBitmap` exists on iOS 15+ and Android Chrome, so the
  fallback should not fire on target devices.

## CSP audit performed

Rather than patch and hope, the full policy was swept against every external
origin and dynamic-execution primitive the built bundle actually uses:

| Found in bundle | Covered by |
|---|---|
| `dfrpqkutjsnfgkdmcadi.supabase.co` | `connect-src https://*.supabase.co` ✓ |
| `firebaseinstallations.googleapis.com` | `connect-src` ✓ (added in 260819-hsx) |
| `fcmregistrations.googleapis.com` | `connect-src` ✓ |
| `fastly.jsdelivr.net` | now unused — self-hosted ✓ |
| `github.com`, `react.dev` | comment/doc strings, not fetched ✓ |
| `new Worker(blobURL)` | supabase-js realtime heartbeat — **dormant**, `worker: true` is not set in `src/lib/supabase.ts`, so `worker-src 'self'` is fine ✓ |
| `createObjectURL` → `Image.src` | now covered by `img-src blob:` ✓ |
| `video.srcObject = MediaStream` | not a URL fetch — CSP `media-src` does not apply ✓ |

## Verification

- `npm run build` green; wasm emitted and precached
- `npm run lint` 0 errors (1 pre-existing warning in GSD tooling)
- Built `dist/index.html` carries both CSP changes

## Still needs a human

Device retest after the Vercel deploy: open a live request, tap the QR scan
action, confirm the OS camera prompt now appears and the viewfinder shows a
live feed. Scanning a donor QR should populate the 5-character code field.

## Note for future security work

Three separate features have now been broken by the one CSP commit
(`23ee7bc`): FCM token registration, and both halves of the QR scanner. The
policy was written from a checklist rather than derived from what the bundle
actually requests. The sweep table above is the derivation — worth re-running
whenever a dependency that fetches at runtime is added.
