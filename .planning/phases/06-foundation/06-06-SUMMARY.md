---
plan: "06-06"
phase: "06-foundation"
status: complete
completed: 2026-06-21
gap_closure: true
gap_source: 06-VERIFICATION.md
requirements_closed:
  - PRIV-03
commits:
  - aef091e
key-files:
  modified:
    - src/screens/CreateRequest.tsx
---

# Plan 06-06 Summary: Close PRIV-03 Gap — Wire coarsenCoordinates

## What Was Done

Wired the defined-but-unused `coarsenCoordinates()` export from `src/geolocation.ts` into `src/screens/CreateRequest.tsx`, closing the sole Phase 6 verification gap (PRIV-03 / CR-01).

**Changes applied (1 file, 3 insertions / 2 deletions):**

1. **Import extended** — `src/screens/CreateRequest.tsx:8`
   - Before: `import { getCurrentPosition } from '../geolocation'`
   - After: `import { getCurrentPosition, coarsenCoordinates } from '../geolocation'`

2. **Call site inserted** — `src/screens/CreateRequest.tsx:176`
   - Before: `onPosted({ bloodType, phone, address, units, urgency, lat: res.lat, lng: res.lng })`
   - After:
     ```tsx
     const { lat, lng } = coarsenCoordinates(res.lat, res.lng)
     onPosted({ bloodType, phone, address, units, urgency, lat, lng })
     ```

Raw GPS coordinates from `navigator.geolocation` are now rounded to 2 decimal places (~1 km grid) before reaching `onPosted()`. The `RequestDraft` interface was unchanged — types remain `lat: number`, `lng: number`.

## Gap Resolution Proof

```
grep -n 'coarsenCoordinates' src/screens/CreateRequest.tsx
  8:import { getCurrentPosition, coarsenCoordinates } from '../geolocation'
  176:      const { lat, lng } = coarsenCoordinates(res.lat, res.lng)

npm run build  → exit 0 (✓ 81 modules transformed)
npm run lint   → 0 errors, 0 warnings in src/
```

## Self-Check: PASSED

- [x] `coarsenCoordinates` imported in CreateRequest.tsx
- [x] `coarsenCoordinates(res.lat, res.lng)` called before `onPosted()`
- [x] Raw GPS never reaches `onPosted()` directly
- [x] `npm run build` exits 0
- [x] `npm run lint` exits 0 errors
- [x] `grep -rn 'coarsenCoordinates' src/` returns ≥2 lines (definition + import + call)
