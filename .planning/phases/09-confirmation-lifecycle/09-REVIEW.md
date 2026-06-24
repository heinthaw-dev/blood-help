---
phase: 09-confirmation-lifecycle
reviewed: 2026-06-24T10:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/App.tsx
  - src/screens/Home.tsx
  - src/screens/RequestLive.tsx
  - src/types/database.ts
findings:
  critical: 4
  warning: 5
  info: 2
  total: 11
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-24T10:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 9 wired the confirmation lifecycle (QR scanner, `confirm_donation` RPC, `handleResolveClosed`, `handleExtend`, realtime donations channel, and check-on-open unseen-donation). The overall architecture is sound: the SECURITY DEFINER RPC is used correctly, optimistic updates have rollbacks, and the Realtime subscription pattern (refetch-on-INSERT rather than applying payload rows) is correct.

However, four blockers exist: (1) the extend banner is permanently broken in any session that starts with a fresh `handlePosted` because `activeRequestExpiresAt` is never set from the local `expiresAt` variable; (2) the `lastSeenAt` check-on-open query passes an empty string to `.gt()` when localStorage is empty, which makes every first-load return the most-recent donation and route to the congrats screen on brand-new donor accounts; (3) the `closed` overlay in RequestLive shows success UI before the DB write completes — if `handleResolveClosed` fails, the user sees "Request closed" but the row is still `active`; (4) a QR scan that successfully reads a code never triggers the confirmation — it only populates the input field, so the `p_via='qr'` audit path in `confirm_donation` is dead code and the user must manually tap the confirm button.

---

## Critical Issues

### CR-01: `handlePosted` never sets `activeRequestExpiresAt` — extend banner is permanently broken in new-post sessions

**File:** `src/App.tsx:390-443`

**Issue:** `handlePosted` computes `expiresAt` (line 394-396), writes it to the DB (line 410), but never calls `setActiveRequestExpiresAt(expiresAt)`. After a fresh post the state remains `null`. The `showExtendBanner` guard at line 649 checks `if (!activeRequestExpiresAt …) return false`, so the banner can never appear in the same session that created the request. It only works after a page reload (which triggers `hydrateUserFromDb` and sets `activeRequestExpiresAt` from the DB). This defeats the entire D-17 extend-within-session use case — the user who just posted a request within the 4-hour window before its expiry will never see the banner.

**Fix:**
```typescript
// In handlePosted, after the successful read-back, set activeRequestExpiresAt:
const { data: newRow } = await supabase
    .from("blood_requests")
    .select("id")
    .eq("requester_id", uid)
    .eq("status", "active")
    .maybeSingle();
setActiveRequestId(newRow?.id ?? null);
setActiveRequestExpiresAt(expiresAt);  // <-- ADD THIS LINE
setScreen("request-live");
```

---

### CR-02: Check-on-open unseen-donation query passes empty string to `.gt()` — routes every new donor to congrats screen on first login

**File:** `src/App.tsx:242-257`

**Issue:** When `localStorage.getItem("bloodhelp.lastSeenDonationAt")` returns `null` (first-ever load, shared device after logout, or private-mode), the fallback `?? ""` produces an empty string. The Supabase query `.gt("created_at", "")` compares the ISO timestamp column against an empty string. In Postgres string ordering `"" < any ISO timestamp`, so this is always true — every donation row for the donor satisfies the filter. As a result, any donor who has ever donated (i.e., has any row in the `donations` table) will be routed to `donor-congrats` on every first-load after clearing localStorage, including after logout on a shared device — even if the donation was months ago.

**Fix:**
```typescript
// Guard against missing marker — treat empty string as "never seen" and skip the check
const lastSeenAt = localStorage.getItem("bloodhelp.lastSeenDonationAt");
if (lastSeenAt) {
    const { data: unseenDonation } = await supabase
        .from("donations")
        .select("id, created_at")
        .eq("donor_id", uid)
        .gt("created_at", lastSeenAt)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (unseenDonation) {
        localStorage.setItem(
            "bloodhelp.lastSeenDonationAt",
            unseenDonation.created_at ?? new Date().toISOString(),
        );
        return "congrats";
    }
}
```

---

### CR-03: `setClosed` fires before `handleResolveClosed` DB write completes — success UI shown even on write failure

**File:** `src/screens/RequestLive.tsx:673-675` and `707-709`

**Issue:** Both "outside" and "canceled" resolve paths call `setClosed(...)` synchronously, then call `onResolveClosed(...)` which dispatches an async Supabase UPDATE in `App.tsx:handleResolveClosed`. The `closed` state drives a full-screen overlay (`closed && <div …>`) that presents "Request closed — Glad you got the blood you needed." If the DB write fails, `App.tsx` shows an `AlertDialog` error, but `RequestLive` is now behind the opaque closed overlay and unreachable — the request row is still `active` in the database while the UI shows it as complete. The user has no path to retry closing the request or navigate back.

**Fix:** `onResolveClosed` must be awaitable, or the `closed` state should only be set on success. Simplest approach — lift the success signal:
```typescript
// In RequestLive, don't set closed until the parent confirms success.
// Change onResolveClosed to return a Promise<boolean>:
//   onResolveClosed: (reason: 'outside' | 'canceled') => Promise<boolean>
// Then:
const ok = await onResolveClosed('outside')
if (ok) { setClosed('outside'); setSheet(null) }
```
In App.tsx `handleResolveClosed`, return `true` on success, `false` on error (instead of void). Until the full signature change, at minimum move `setClosed` to after a successful ack.

---

### CR-04: QR scan populates code but never auto-triggers confirm — `p_via='qr'` audit field is dead code

**File:** `src/screens/RequestLive.tsx:176-181`

**Issue:** The `onDecodeResult` callback (line 176-181) sets `code` state from the scanned value. The confirm button at line 815-817 is hardcoded to call `handleConfirmInApp('manual')`. There is no auto-trigger after a successful scan. This means: (a) the QR path always writes `p_via='manual'` to the `confirm_donation` audit log — the `'qr'` value is never passed; (b) the UX is broken: a donor hands over their QR, the requester scans it, and then must also manually tap "Confirm" — the scan shows no visual feedback that it worked, which will cause requsters to scan again and again thinking it failed.

**Fix:** After a successful scan, auto-trigger the confirmation:
```typescript
onDecodeResult(result) {
    const raw = result.rawValue.trim().toUpperCase()
    if (/^[A-Z2-7]{5}$/.test(raw)) {
        setCode(raw)
        // Auto-confirm immediately — QR scan is treated as an implicit submit
        void handleConfirmInApp('qr')
    }
},
```
Note: `handleConfirmInApp` references `code` from the closure. Since `setCode` is async (state update), the code value is not yet `raw` when `handleConfirmInApp` is called in the same tick. The function should accept an explicit `codeOverride` parameter or read from the scanned value directly:
```typescript
const handleConfirmInApp = async (via: 'manual' | 'qr' = 'manual', codeOverride?: string) => {
    const resolvedCode = (codeOverride ?? code).trim().toUpperCase()
    if (!requestId || resolvedCode.length !== 5) return
    const { data, error } = await supabase.rpc('confirm_donation', {
        p_request_id: requestId,
        p_donor_code: resolvedCode,
        p_via: via,
    })
    // ...
}
// In onDecodeResult:
void handleConfirmInApp('qr', raw)
```

---

## Warnings

### WR-01: `handleExtend` rollback captures stale closure value of `activeRequestExpiresAt`

**File:** `src/App.tsx:618-643`

**Issue:** `handleExtend` is defined inside the `App` function body without `useCallback`. It captures `activeRequestExpiresAt` by closure at definition time. The rollback on line 641 does:
```typescript
setActiveRequestExpiresAt(activeRequestExpiresAt);
```
This sets state back to the value at the time `handleExtend` was created, not the value at the time the error occurred. If `activeRequestExpiresAt` changed between render cycles (e.g., rapid double-tap), the rollback would set the wrong value. This is a latent bug that becomes active if `handleExtend` is ever memoized or if the extend button can be tapped while a previous extend is in-flight.

**Fix:** Capture the pre-optimistic value into a local variable at the top of `handleExtend`:
```typescript
const handleExtend = async () => {
    const uid = user.supabaseId;
    if (!uid || !activeRequestId || !activeRequestExpiresAt) return;
    const previousExpiry = activeRequestExpiresAt;  // snapshot before optimistic update
    // ...
    if (error) {
        setActiveRequestExtended(false);
        setActiveRequestExpiresAt(previousExpiry);  // use snapshot, not closure
        setWriteError({ ... });
    }
};
```

---

### WR-02: `DEFAULT_USER.donorCode` is hardcoded `"K7M2Q"` — shown in Profile until page reload

**File:** `src/App.tsx:63`

**Issue:** `DEFAULT_USER` initializes `donorCode` to `"K7M2Q"`. After `handleSaveDonor` completes successfully (line 538-548), the local state update does not include `donorCode`. The Profile screen then displays `"K7M2Q"` as the donor code until the page is reloaded. A newly registered donor who immediately checks their Profile screen will see a fake code, attempts to share it will fail `confirm_donation` validation, and the user might lose trust in the app. The trigger-assigned `donor_code` is in the DB but not read back.

**Fix:** After the successful donor upsert in `handleSaveDonor`, read back the `donor_code` from the DB:
```typescript
const { data: donorRow } = await supabase
    .from("donors")
    .select("donor_code")
    .eq("profile_id", uid)
    .maybeSingle();

setUser((u) => ({
    ...u,
    name: profile.name,
    bloodType: profile.bloodType,
    available: profile.available,
    emergencyCallable: profile.showNumber,
    showNumber: profile.showNumber,
    donorSetupComplete: true,
    lat: profile.lat,
    lng: profile.lng,
    donorCode: donorRow?.donor_code ?? u.donorCode,  // hydrate trigger-assigned code
}));
```

---

### WR-03: `toastTimer` is never cancelled on RequestLive unmount — setState-on-unmounted-component

**File:** `src/screens/RequestLive.tsx:157-165`

**Issue:** `showToast` stores a `setTimeout` handle in `toastTimer.current`. There is no `useEffect` cleanup that calls `clearTimeout(toastTimer.current)` on unmount. If `RequestLive` unmounts while a toast is pending (e.g., the user taps "Back" within 3.6 seconds of a toast appearing), the callback fires and calls `setToast(null)` on an unmounted component. In React 18+ this is a no-op (the warning was removed), but the timer still fires unnecessarily, and if `setToast` were replaced with something that has side effects (logging, analytics) the behaviour would be wrong.

**Fix:** Add a cleanup effect:
```typescript
useEffect(() => {
    return () => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
    };
}, []);
```

---

### WR-04: TOCTOU race in `handlePosted` — read-back of new request ID can return a different row

**File:** `src/App.tsx:435-441`

**Issue:** `handlePosted` does a bare `.insert()` then immediately runs a separate `.select("id").eq("requester_id", uid).eq("status", "active").maybeSingle()` to recover the new row's UUID. If a second device posts a request before the read-back executes (RLS enforcement allows only one active request, so `23505` would fire on insert — but there is a race window between the insert commit and the read-back), or if the unique-index constraint is relaxed in future, the read-back might return a different active row's ID. The safe fix is to chain `.select("id").single()` on the original insert so the UUID is returned atomically.

Additionally, if the read-back returns `null` (network hiccup), `setActiveRequestId(null)` is called and the user is navigated to `request-live` with `requestId=null`. The realtime subscription guard (`if (!requestId || !currentUserId) return`) fires, leaving RequestLive in a permanently empty state with no way to recover.

**Fix:** Use chained select on the insert call:
```typescript
const { data: insertData, error } = await supabase
    .from("blood_requests")
    .insert({ /* ... */ })
    .select("id")
    .single();

if (error) { /* ... existing error handling ... */ return; }
setRequestDraft(draft);
setActiveRequestId(insertData.id);
setActiveRequestExpiresAt(expiresAt);  // also fixes CR-01
setScreen("request-live");
```
This eliminates the read-back entirely and atomically returns the UUID.

---

### WR-05: Donations Realtime subscription uses `user.supabaseId` from render-time closure — channel never updates on late login

**File:** `src/App.tsx:292-323`

**Issue:** The donations subscription `useEffect` depends on `[user.supabaseId]`. When a user logs in via `handleVerified`, the sequence is: (1) `setUser((u) => ({ ...u, supabaseId: uid }))` is called; (2) `hydrateUserFromDb` runs and calls `setUser(...)` again with the full hydrated state including `supabaseId`. Between these two `setUser` calls, the component re-renders twice. Each render creates a new `uid` value from `user.supabaseId`, and the `useEffect` re-runs twice — creating then tearing down then re-creating the channel. While this is functionally correct (cleanup removes the old channel), it means two `supabase.channel(...)` calls in rapid succession, potentially causing a brief period with no active subscription. This is a robustness concern, not a hard bug, but worth noting.

More importantly: if `initAuth` from the startup `useEffect` finds a session and calls `hydrateUserFromDb`, but `hydrateUserFromDb` finishes before React batches the `setUser` call, there could be a render with the old `supabaseId: null` before the new value arrives, causing the subscription effect to run with `uid = null` (early return), and then run again with the real uid — this is the intended behavior, but any lag in the realtime channel setup window could miss events during that gap.

**Fix:** This is acceptable for prototype phase, but the channel setup should be moved to fire only once, after full hydration is confirmed (e.g., inside `hydrateUserFromDb` after all state is set, or using a `ref` to track whether the channel is already established for a given uid).

---

## Info

### IN-01: `WRITE_ERROR_STRINGS` is duplicated between `App.tsx` and `RequestLive.tsx`

**File:** `src/App.tsx:75-94` and `src/screens/RequestLive.tsx:40-53`

**Issue:** Both modules define `WRITE_ERROR_STRINGS` with identical `my/en` shape. The `App.tsx` version has additional `duplicateTitle`/`duplicateMsg`/`retry`/`dismiss` keys, while `RequestLive.tsx` has a minimal subset. When adding new error types or updating Burmese translations, both must be updated in sync.

**Fix:** Extract the common error string shape to a shared utility module (e.g., `src/i18n.ts` or a new `src/errors.ts`) and import from there.

---

### IN-02: Magic inline `rgba` and hex colour tokens bypass the design system in extend banners

**File:** `src/screens/Home.tsx:509` and `src/screens/RequestLive.tsx:469-478`

**Issue:** The extend banner uses `'#FFF3E0'`, `'#B45309'`, `'#92400E'`, and `'rgba(230,120,0,.18)'` directly in inline styles. The project convention (CLAUDE.md Styling Pattern) requires all colours to reference CSS custom properties. These amber values are not in the `src/index.css` `@theme` block, so they cannot be changed globally via the design token. The Home and RequestLive banners also use slightly different amber hex values for the same semantic meaning, creating a visual inconsistency.

**Fix:** Add `--color-warning`, `--color-warning-tint`, and `--color-warning-press` tokens to `src/index.css` and replace all inline amber hex values with `var(--color-warning)` etc.

---

_Reviewed: 2026-06-24T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
