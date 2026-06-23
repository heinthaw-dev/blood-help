# Phase 9: Confirmation + Lifecycle — Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 7 (6 modified + 1 migration artifact)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/screens/RequestLive.tsx` | screen | request-response + event-driven | itself (Phase 8 version) | self-modify |
| `src/App.tsx` | screen router / global state | event-driven + request-response | itself (Phase 8 version) | self-modify |
| `src/screens/Home.tsx` | screen | request-response | itself (Phase 8 version) | self-modify |
| `src/screens/DonorCongrats.tsx` | screen | request-response | itself (Phase 8 version) | self-modify (props only) |
| `src/lib/supabase.ts` | config | — | itself | self-modify (no-op) |
| `src/types/database.ts` | generated types | — | itself | regenerate via MCP |
| Migration (Supabase MCP) | migration | CRUD + batch | Phase 8 `responders_for_request` RPC migration | role-match |

---

## Pattern Assignments

### `src/screens/RequestLive.tsx` — 5 changes

This file is being modified in place across five distinct concerns. Each change has a directly extractable analog from the file's own current code.

---

#### Change 1: Replace `handleConfirmInApp` dummy with real RPC call (D-10)

**Analog:** `handleRespond` in `src/App.tsx` (lines 379–410) — optimistic update, Supabase write, typed-error branching, `AlertDialog` rollback.

**Also model on:** `App.tsx` lines 317–370 (`handlePosted`) — RPC call pattern with `error.code` branching.

**Current dummy** (RequestLive.tsx lines 212–228):
```typescript
const handleConfirmInApp = () => {
  const next = collected + 1
  if (next >= unitsNeeded) {
    setClosed('fulfilled')
    setSheet(null)
    setCode('')
    setCollected(next)
  } else {
    setSheet(null)
    setCode('')
    setCollected(next)
    showToast(
      toMyanmarDigits(next) + ' / ' + toMyanmarDigits(unitsNeeded) + ' unit ရရှိပြီး — ကျန်အတွက် ဆက်ရှာနေပါမည်',
      next + ' / ' + unitsNeeded + ' units — still searching for the rest.'
    )
  }
}
```

**Replace with (from RESEARCH.md §Code Examples, adapted to file's existing `showToast`/`setCollected`/`setClosed` state):**
```typescript
const handleConfirmInApp = async (via: 'manual' | 'qr' = 'manual') => {
  if (!requestId || !confirmReady) return

  const { data, error } = await supabase.rpc('confirm_donation', {
    p_request_id: requestId,
    p_donor_code: code.trim().toUpperCase(),
    p_via: via,
  })

  if (error || !data) {
    setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg })
    return
  }

  const result = data as { error?: string; units_collected?: number; fulfilled?: boolean }

  if (result.error === 'invalid_code') {
    showToast('ကုဒ် မမှန်ကန်ပါ', 'Invalid or unrecognized code')
    return
  }
  if (result.error === 'already_confirmed') {
    showToast('ဤသွေးလှူရှင်ကို အတည်ပြုပြီးဖြစ်သည်', 'This donor is already confirmed')
    return
  }

  const next = result.units_collected ?? collected + 1
  setCode('')

  if (result.fulfilled) {
    setCollected(next)
    setClosed('fulfilled')
    setSheet(null)
  } else {
    setCollected(next)
    setSheet(null)
    showToast(
      toMyanmarDigits(next) + ' / ' + toMyanmarDigits(unitsNeeded) + ' unit ရရှိပြီး — ကျန်အတွက် ဆက်ရှာနေပါမည်',
      next + ' / ' + unitsNeeded + ' units — still searching for the rest.'
    )
  }
}
```

**`writeError` state and `errStrings` must be added** to `RequestLive` following the same pattern as `App.tsx` lines 138–141 and 76–94:
```typescript
// Add to RequestLive state declarations (after existing `const [collected, setCollected]`)
const [writeError, setWriteError] = useState<{ title: string; message: string } | null>(null)
const errStrings = WRITE_ERROR_STRINGS[lang]  // same bilingual object as App.tsx WRITE_ERROR_STRINGS
```

**`AlertDialog` already imported in App.tsx** (line 16); add the same import to RequestLive and render it inside the outermost `<div>`, adjacent to the toast:
```typescript
// Render below the Toast block:
<AlertDialog
  open={writeError !== null}
  title={writeError?.title ?? ''}
  message={writeError?.message ?? ''}
  confirmLabel={errStrings.retry}
  cancelLabel={errStrings.dismiss}
  onConfirm={() => setWriteError(null)}
  onCancel={() => setWriteError(null)}
/>
```

---

#### Change 2: Replace QR placeholder `<button>` with real `useZxing` scanner (D-08)

**Analog:** `CreateRequest.tsx` / `DonorProfileSetup.tsx` — the two-step camera-permission `AlertDialog` before `navigator.geolocation` (same UX pattern for `getUserMedia`). See `src/screens/CreateRequest.tsx` for the exact `AlertDialog` + permission-gate structure; apply the same principle to the camera.

**Current QR placeholder** (RequestLive.tsx lines 595–618): a `<button>` element wrapping the corner-bracket overlay that calls `handleConfirmInApp` on click. The structural change is:

1. Replace the `<button>` element wrapping the dark viewport with a plain `<div>` (non-interactive container).
2. Add `useZxing` hook from `react-zxing` — attach its `ref` to a `<video>` element inside the viewport.
3. When a valid 5-char Base32 result is decoded, call `handleCodeInput` to populate the `code` state (which then enables the confirm button), OR call `handleConfirmInApp('qr')` directly if auto-confirm on scan is preferred.

**Import to add** (top of RequestLive.tsx, after existing imports):
```typescript
import { useZxing } from 'react-zxing'
```

**Hook placement** (inside the `RequestLive` function, near `handleCodeInput`):
```typescript
const { ref: zxingRef } = useZxing({
  formats: ['qr_code'],
  onDecodeResult(result) {
    const raw = result.rawValue.trim().toUpperCase()
    if (/^[A-Z2-7]{5}$/.test(raw)) {
      // Populate the text input — reuses the same validation path as manual entry
      setCode(raw)
    }
  },
  onError(err) {
    console.warn('QR scan error:', err)
  },
})
```

**Replace the `<button>` viewport** (lines 596–618) with:
```tsx
<div
  style={{
    position: 'relative', width: '100%', height: 188, marginTop: 16,
    borderRadius: 16, background: 'var(--text-primary)',
    overflow: 'hidden',
  }}
>
  <video
    ref={zxingRef}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
  />
  {/* Corner-bracket overlay — keep existing markup unchanged */}
  <div style={{ position: 'absolute', width: 130, height: 130, borderRadius: 14, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
    {/* ... existing corner spans ... */}
  </div>
</div>
```

**Camera permission gate (AlertDialog before opening the sheet):** Add a `cameraWarningOpen` state gated before `setSheet('code')`. Copy the two-step pattern from `DonorProfileSetup.tsx` (where `alertOpen` shows before `navigator.geolocation.getCurrentPosition`):
```typescript
const [cameraWarningOpen, setCameraWarningOpen] = useState(false)
// Replace the "From a donor in this app" button's onClick:
onClick={() => setCameraWarningOpen(true)}
// AlertDialog:
<AlertDialog
  open={cameraWarningOpen}
  title={lang === 'my' ? 'ကင်မရာ ခွင့်ပြုချက်' : 'Camera Permission'}
  message={lang === 'my' ? 'QR ကုဒ် ဖတ်ရှုရန် ကင်မရာ ခွင့်ပြုချက် လိုအပ်ပါသည်။' : 'Camera access is needed to scan the donor QR code.'}
  confirmLabel={lang === 'my' ? 'ဆက်လက်မည်' : 'Continue'}
  cancelLabel={lang === 'my' ? 'မလုပ်တော့ပါ' : 'Cancel'}
  onConfirm={() => { setCameraWarningOpen(false); setSheet('code') }}
  onCancel={() => setCameraWarningOpen(false)}
/>
```

---

#### Change 3: Fix `ClosedReason` mapping + honest copy (D-01, D-03)

**Analog:** Phase 8 D-09 honest-copy correction — the "alerted" → "can see your request" rename applied by the same direct edit pattern (string literal replacement in the `closedData` constant).

**Current false copy** (RequestLive.tsx lines 245–267, `closedData` object):

`outside` entry (lines 256–260):
```typescript
outside: {
  iconBg: 'var(--color-success-tint)',
  iconColor: 'var(--color-success)',
  title: 'တောင်းခံချက် ပိတ်ပြီးပါပြီ',
  body: 'အပြင်မှ ရရှိကြောင်း မှတ်သားပြီး — ကိုယ်ရေးအချက်အလက်များကို ဖျက်လိုက်ပါပြီ။',
  bodyEn: 'Marked as received outside the app. Your personal data was purged.',
},
```

`canceled` entry (lines 261–265):
```typescript
canceled: {
  iconBg: 'var(--color-bg)',
  iconColor: 'var(--text-hint)',
  title: 'တောင်းခံချက် ပယ်ဖျက်ပြီးပါပြီ',
  body: 'တောင်းခံချက်ကို ပိတ်ပြီး ကိုယ်ရေးအချက်အလက်များကို ဖျက်လိုက်ပါပြီ။',
  bodyEn: 'Request closed and personal data purged.',
},
```

**Replace** both entries, dropping the false purge claims (D-03). Also add the missing DB write for `outside` and `canceled` paths (the `onClick` handlers on lines 515 and 545 currently only call `setClosed(...)` — they must also call `onResolveClosed(reason)` which triggers the `App.tsx` handler to write `status` + `closed_at`).

The `ClosedReason` type (line 15) also needs `'outside'` to map to `status='fulfilled'` in the new `onResolveClosed` handler in App.tsx (D-01):
```typescript
// In App.tsx handleResolveClosed (new handler):
const statusMap = {
  fulfilled: 'fulfilled',
  outside:   'fulfilled',   // D-01
  canceled:  'cancelled',
} as const
```

---

#### Change 4: Add extend warning banner (D-17, D-18)

**Analog:** The existing `alerting` banner in `RequestLive.tsx` (lines 349–362) — same dismissable banner card pattern (primary-tint background, icon + text + conditional render).

**Current alerting banner structure** (lines 349–362) — copy this pattern:
```tsx
{alerting && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-primary-tint)', borderRadius: 'var(--radius-card)', padding: '13px 14px' }}>
    <span className="bh-pulse-dot" ... />
    <div>
      <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 14, fontWeight: 600, ... }}>...</div>
      <div style={{ fontSize: 12, ... }}>...</div>
    </div>
  </div>
)}
```

**New prop to add to `RequestLiveProps`:**
```typescript
/** Whether to show the expiring-soon extend banner (D-17). */
showExtendBanner?: boolean
/** Called when the user taps "Extend +12h" (D-18). */
onExtend?: () => void
```

**Banner JSX** (insert above the transparency card, after the alerting banner):
```tsx
{showExtendBanner && (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--color-warning-tint, #FFF3E0)',
    borderRadius: 'var(--radius-card)', padding: '13px 14px',
    border: '1px solid rgba(230,120,0,.18)',
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 14, fontWeight: 600, color: '#B45309' }}>
        {lang === 'my' ? 'တောင်းခံချက် မကြာမီ သက်တမ်းကုန်မည်' : 'Request expiring soon'}
      </div>
      <div style={{ fontSize: 12, color: '#92400E', marginTop: 2, opacity: 0.85 }}>
        {lang === 'my' ? 'နောက်ထပ် ၁၂ နာရီ တိုးမည်' : 'Extend by 12 hours'}
      </div>
    </div>
    <button type="button" onClick={onExtend} style={{
      flexShrink: 0, height: 34, padding: '0 14px', border: 'none',
      borderRadius: 'var(--radius-pill)', background: '#B45309', color: '#fff',
      fontFamily: 'var(--font-burmese)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    }}>
      {lang === 'my' ? '+12 နာရီ' : '+12h'}
    </button>
  </div>
)}
```

---

#### Change 5: Wire `onResolveClosed` for DB writes on outside/cancel (LIFE-01)

**Analog:** `handlePosted` in `App.tsx` (lines 317–370) — direct Supabase `.update()` call with the same `AlertDialog` error pattern. For close writes, it is a `.update()` on `blood_requests` scoped by `.eq('id', activeRequestId).eq('requester_id', uid)`.

**New prop** (no return value needed; App.tsx owns the write):
```typescript
onResolveClosed: (reason: 'outside' | 'canceled') => void
```

**App.tsx handler** (new function, follows `handlePosted` pattern):
```typescript
const handleResolveClosed = async (reason: 'outside' | 'canceled') => {
  const uid = user.supabaseId
  if (!uid || !activeRequestId) return
  const errStrings = WRITE_ERROR_STRINGS[lang]
  const status = reason === 'canceled' ? 'cancelled' : 'fulfilled'  // D-01

  const { error } = await supabase
    .from('blood_requests')
    .update({ status, closed_at: new Date().toISOString() })
    .eq('id', activeRequestId)
    .eq('requester_id', uid)

  if (error) {
    setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg })
    return
  }

  setRequestDraft(null)
  setActiveRequestId(null)
  // Navigation back to Home is driven by RequestLive's onGoHome callback
}
```

---

### `src/App.tsx` — 4 additions

---

#### Addition 1: App-wide donations Realtime subscription for congrats takeover (D-11)

**Analog:** The existing `request_responses` Realtime channel in `RequestLive.tsx` (lines 143–183). The structure is identical — `supabase.channel(...).on('postgres_changes', ...).subscribe()` in a `useEffect` with cleanup.

**Key difference:** This channel lives in `App.tsx`'s `useEffect`, gated on `user.supabaseId` (not `requestId`), and fires for INSERT events on `donations` filtered to `donor_id=eq.${uid}`.

**Analog excerpt from RequestLive.tsx** (lines 158–183):
```typescript
const channel = supabase
  .channel(`rr:${requestId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'request_responses',
      filter: `request_id=eq.${requestId}`,
    },
    () => {
      if (cancelled) return
      void refetchResponders()
      showToast('သွေးလှူရှင်တစ်ဦး တုံ့ပြန်ပါပြီ', 'A donor responded')
    },
  )
  .subscribe()

return () => {
  cancelled = true
  void supabase.removeChannel(channel)
}
```

**New channel for donations** (in `App.tsx`, add to `useEffect` gated on `user.supabaseId`):
```typescript
useEffect(() => {
  const uid = user.supabaseId
  if (!uid) return

  const channel = supabase
    .channel(`donations:${uid}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'donations',
        filter: `donor_id=eq.${uid}`,
      },
      (payload) => {
        // Mark this donation as seen so check-on-open skips it (D-12)
        localStorage.setItem('bloodhelp.lastSeenDonationAt', payload.new.created_at ?? new Date().toISOString())
        // Optimistically increment donation count (D-11 open question 3)
        setUser(u => ({ ...u, donationCount: u.donationCount + 1 }))
        setScreen('donor-congrats')
      },
    )
    .subscribe()

  return () => { void supabase.removeChannel(channel) }
}, [user.supabaseId])
```

**Cleanup on logout** (add to `handleLogout`, lines 509–519, after `setRespondedIds(new Set())`):
```typescript
localStorage.removeItem('bloodhelp.lastSeenDonationAt')
```

---

#### Addition 2: Check-on-open unseen donations (D-12)

**Analog:** The existing `hydrateUserFromDb` function in `App.tsx` (lines 151–231) — same async DB read pattern (`supabase.from(...).select(...).maybeSingle()`) called inside a `useEffect`, updating state on result.

**Analog excerpt** (lines 176–183):
```typescript
const { data: activeRequest, error: requestErr } = await supabase
  .from('blood_requests')
  .select('*')
  .eq('requester_id', uid)
  .eq('status', 'active')
  .maybeSingle()
if (requestErr)
  console.error('active request load error:', requestErr.message)
```

**Add inside `hydrateUserFromDb`** (after the active request hydration block):
```typescript
// D-12: check for unseen donation (closed-app congrats)
const lastSeenAt = localStorage.getItem('bloodhelp.lastSeenDonationAt') ?? ''
const { data: unseenDonation } = await supabase
  .from('donations')
  .select('id, created_at')
  .eq('donor_id', uid)
  .gt('created_at', lastSeenAt)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
if (unseenDonation) {
  localStorage.setItem('bloodhelp.lastSeenDonationAt', unseenDonation.created_at ?? new Date().toISOString())
  // Will be overridden by setScreen('home') caller — must set screen after hydrate
  // Callers must check this flag and setScreen('donor-congrats') instead of 'home'
  return 'congrats'  // signal to callers
}
return true
```

Note: the return type of `hydrateUserFromDb` must change from `Promise<boolean>` to `Promise<boolean | 'congrats'>`. Callers (`initAuth` lines 245–246, `handleVerified` lines 293–309) must handle the new `'congrats'` return value:
```typescript
const hydrated = await hydrateUserFromDb(uid)
if (hydrated === 'congrats') {
  setScreen('donor-congrats')
} else if (hydrated) {
  setScreen('home')
}
```

---

#### Addition 3: `extended` flag hydration + expiring-soon computation (D-17, D-19)

**Analog:** The `requestDraft` hydration block in `hydrateUserFromDb` (App.tsx lines 200–215) and the `hasOpenRequest` derived state pattern.

**Current hydration** (lines 200–215) maps `blood_requests` columns to `RequestDraft`. The `extended` column is new (not yet in `RequestDraft` type or the select). Add it:

```typescript
// In the setRequestDraft call (lines 200–214), add extended to the mapped object
// Also add to the blood_requests select (line 179): .select('*') already covers it after regeneration
```

**New state in App.tsx** (after `activeRequestId` state):
```typescript
/** Whether the active request has already been extended once (D-19). */
const [activeRequestExtended, setActiveRequestExtended] = useState(false)
/** ISO expiry timestamp of the active request — for client-side banner computation (D-17). */
const [activeRequestExpiresAt, setActiveRequestExpiresAt] = useState<string | null>(null)
```

**Populate in `hydrateUserFromDb`** (inside the `setRequestDraft` block):
```typescript
setActiveRequestExtended(activeRequest?.extended ?? false)
setActiveRequestExpiresAt(activeRequest?.expires_at ?? null)
```

**Expiring-soon computation** (pure client-side, no query):
```typescript
const EXTEND_WARN_MS = 4 * 60 * 60 * 1000  // 4h

const showExtendBanner = (() => {
  if (!activeRequestExpiresAt || activeRequestExtended) return false
  const msLeft = new Date(activeRequestExpiresAt).getTime() - Date.now()
  return msLeft > 0 && msLeft < EXTEND_WARN_MS
})()
```

Pass `showExtendBanner` and `onExtend={handleExtend}` to both `RequestLive` and `Home`.

---

#### Addition 4: `handleExtend` + optimistic rollback (D-18, D-19)

**Analog:** `handleRespond` in App.tsx (lines 379–410) — optimistic state update, Supabase write, rollback on non-23505 error, `AlertDialog` via `setWriteError`.

**New handler** (copy the optimistic+rollback structure from `handleRespond`):
```typescript
const handleExtend = async () => {
  const uid = user.supabaseId
  if (!uid || !activeRequestId || !activeRequestExpiresAt) return
  const errStrings = WRITE_ERROR_STRINGS[lang]

  const newExpiry = new Date(new Date(activeRequestExpiresAt).getTime() + 12 * 60 * 60 * 1000).toISOString()

  // Optimistic: hide banner immediately (D-18)
  setActiveRequestExtended(true)
  setActiveRequestExpiresAt(newExpiry)

  const { error } = await supabase
    .from('blood_requests')
    .update({ expires_at: newExpiry, extended: true })
    .eq('id', activeRequestId)
    .eq('requester_id', uid)

  if (error) {
    // Roll back optimistic update
    setActiveRequestExtended(false)
    setActiveRequestExpiresAt(activeRequestExpiresAt)
    setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg })
  }
}
```

---

### `src/screens/Home.tsx` — 1 addition (D-17)

**Analog:** The existing active-request card block in `Home.tsx` (lines 466–544) — an inline `div` tree rendering a conditional card. The extend banner is an additional row inside this same card.

**Current active-request card structure** (lines 466–544): `hasOpenRequest` gates a `div` with a header row, a body row (lines 497–517 — the `activityLine` section), and a "View" button. The extend banner is a fourth row inside this same `div`, inserted between the body row and the "View" button.

**New props to add to `HomeProps`:**
```typescript
/** Whether to show the expiring-soon extend banner on the active-request card (D-17). */
showExtendBanner?: boolean
/** Called when the requester taps "Extend +12h" (D-18). */
onExtend?: () => void
```

**Banner row** (insert after line 516, before the "View" button at line 518):
```tsx
{showExtendBanner && (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    marginTop: 10, paddingTop: 10,
    borderTop: '1px solid rgba(230,120,0,.18)',
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-burmese)', fontSize: 13.5, fontWeight: 600, color: '#B45309', lineHeight: 1.4 }}>
        {lang === 'my' ? 'တောင်းခံချက် မကြာမီ သက်တမ်းကုန်မည်' : 'Request expiring soon'}
      </div>
    </div>
    <button type="button" onClick={onExtend} style={{
      flexShrink: 0, height: 32, padding: '0 12px', border: 'none',
      borderRadius: 'var(--radius-pill)', background: '#B45309', color: '#fff',
      fontFamily: 'var(--font-burmese)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>
      {lang === 'my' ? '+12 နာရီ' : '+12h'}
    </button>
  </div>
)}
```

---

### `src/screens/DonorCongrats.tsx` — no structural change

DonorCongrats receives `donationCount` from `App.tsx` (already wired at line 581). The only change required is ensuring `App.tsx` increments `user.donationCount` by 1 on the Realtime event (D-11 Addition 1 above) before navigating to this screen — no changes to DonorCongrats itself.

If a `requestId` or `donorCode` prop is needed to show additional context (not in current scope), that would be an additive prop change following the existing `DonorCongratsProps` interface pattern (lines 26–31).

---

### `src/lib/supabase.ts` — no change

The `supabase` singleton (lines 1–11) requires no modification. The new `donations` Realtime channel is created by calling `supabase.channel(...)` in `App.tsx`, same as the `request_responses` channel in `RequestLive.tsx`. The typed `Database` generic automatically picks up new columns after `src/types/database.ts` regeneration.

---

### `src/types/database.ts` — regenerate via Supabase MCP

Regenerate after the migration adds:
- `blood_requests.extended: boolean` (new column, `DEFAULT false`)
- `confirm_donation(p_request_id, p_donor_code, p_via)` RPC in `Functions`

The existing `donations` Row type (lines 111–164 of the current file) already has the correct shape — the only new addition is the unique `(request_id, donor_id)` constraint (invisible in TypeScript types) and publication membership (migration-only concern).

**Confirm the `donations.donor_id` FK points to `profiles(id)`** — verified at line 143–150 of current `database.ts`:
```typescript
{
  foreignKeyName: "donations_donor_id_fkey"
  columns: ["donor_id"]
  referencedRelation: "profiles"
  referencedColumns: ["id"]
}
```
This means the Realtime filter `donor_id=eq.${uid}` uses the Supabase auth UID directly (profile ID = auth UID in this project).

---

### Migration (Supabase MCP) — 6 SQL blocks

**Analog:** Phase 8 `responders_for_request` SECURITY DEFINER RPC migration. No codebase file to read — the pattern is in RESEARCH.md §Pattern 1 (full SQL) and the Phase 8 migration was applied via Supabase MCP `execute_sql` / `apply_migration`.

**Block 1 — `extended` column (D-19):**
```sql
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS extended boolean NOT NULL DEFAULT false;
```

**Block 2 — donations unique constraint (D-09):**
```sql
ALTER TABLE donations ADD CONSTRAINT donations_request_donor_unique UNIQUE (request_id, donor_id);
```

**Block 3 — donations Realtime publication + REPLICA IDENTITY (D-11 prerequisite):**
```sql
ALTER TABLE donations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE donations;
```

**Block 4 — `confirm_donation` SECURITY DEFINER RPC (D-05):**
Full SQL from RESEARCH.md §Pattern 1. Key points for the planner:
- Runs `SECURITY DEFINER SET search_path = public`
- Ownership gate: `auth.uid() != v_requester_id` → return `json_build_object('error', 'invalid_code')`
- Donor lookup: `SELECT id, blood_type FROM donors WHERE donor_code = upper(p_donor_code)`
- Participant check on `request_responses WHERE status = 'responding'`
- Duplicate check before INSERT (belt+suspenders alongside the unique constraint)
- Returns `json_build_object('units_collected', ..., 'fulfilled', ..., 'donor_id', ...)`
- Grants: `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated`

**Block 5 — pg_cron auto-expiry (D-13):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('auto-expire-requests')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-expire-requests');

SELECT cron.schedule(
  'auto-expire-requests',
  '*/15 * * * *',
  $$UPDATE blood_requests SET status = 'expired', closed_at = now()
    WHERE expires_at < now() AND status = 'active'$$
);
```

**Block 6 — past-dated seed for D-14 verification:**
```sql
INSERT INTO blood_requests (requester_id, blood_type, current_address, contact_phone,
                            expires_at, status, units_needed, urgency)
VALUES (
  (SELECT id FROM profiles LIMIT 1),  -- any valid profile
  'O+', 'Test — Phase 9 expiry seed', '+959000000099',
  now() - interval '1 second',
  'active', 1, 'today'
);
-- After triggering the cron job manually: SELECT * FROM blood_requests WHERE contact_phone = '+959000000099';
-- Expect: status = 'expired'
```

---

## Shared Patterns

### Supabase Realtime Channel (apply to: D-11 in App.tsx)

**Source:** `src/screens/RequestLive.tsx` lines 143–183

Pattern summary:
- `useEffect` gated on the filter key (`requestId` there, `user.supabaseId` for donations)
- `let cancelled = false` guard inside async callbacks
- Channel name is stable and unique: `rr:${requestId}` / `donations:${uid}`
- Cleanup always calls `void supabase.removeChannel(channel)`
- Never apply the payload row directly — either refetch (RequestLive) or use `payload.new.field` only for metadata (App.tsx donations channel)

### AlertDialog Write-Error Pattern (apply to: RequestLive confirm, App.tsx handleExtend)

**Source:** `src/App.tsx` lines 75–94 (`WRITE_ERROR_STRINGS`) + lines 379–410 (`handleRespond`) + lines 628–637 (JSX `AlertDialog` render)

Pattern summary:
- `WRITE_ERROR_STRINGS` holds bilingual `genericTitle`, `genericMsg`, `retry`, `dismiss`
- `writeError` state: `{ title: string; message: string } | null`
- On write failure: `setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg })`
- `AlertDialog` rendered at JSX level with `open={writeError !== null}`, both `onConfirm`/`onCancel` call `setWriteError(null)`
- 23505 duplicate errors get a specific message (`duplicateTitle`/`duplicateMsg`) rather than generic

### Optimistic UI + Rollback (apply to: handleExtend in App.tsx)

**Source:** `src/App.tsx` lines 379–410 (`handleRespond`)

Pattern summary:
- Apply the state change before the DB write
- On error (except 23505): revert the state change using the previous value captured in a closure
- Surface `AlertDialog` on error; silent on 23505

### Inline CSS Style Object (apply to: all new JSX in RequestLive/Home)

**Source:** All existing screens — `CSSProperties` objects, never Tailwind utility classes on inner elements.

Pattern summary:
- Import `type { CSSProperties } from 'react'` if referencing named style objects
- `var(--color-primary)`, `var(--font-burmese)`, `var(--radius-card)` etc. — never hardcode hex except `'#fff'` for white
- Token reference for the warning color: no `--color-warning` exists in the current theme — use inline `'#B45309'` (amber-700) and `'rgba(230,120,0,.18)'` for the border, consistent with the one-off inline exception pattern (the `rgba(26,26,26,0.45)` scrim already in use)

### Formatters (reuse, do not duplicate)

| Formatter | Location | Used by |
|---|---|---|
| `toMyanmarDigits(n)` | `RequestLive.tsx` line 33 | Local to RequestLive — already used for progress subtitle |
| `formatPhone(e164)` | `src/format.ts` line 12 | Import from `'../format'` |
| `formatDistanceLabel(m, lang)` | `src/format.ts` line 24 | Import from `'../format'` |
| `formatNumber(n, lang)` | `src/i18n.ts` | Import from `'../i18n'` |

---

## No Analog Found

All files had direct analogs. No file in this phase requires patterns sourced exclusively from RESEARCH.md — however, the following patterns from RESEARCH.md are load-bearing supplements to the codebase analogs:

| Pattern | Source | Why supplemental |
|---|---|---|
| `confirm_donation` full RPC SQL | RESEARCH.md §Pattern 1 | No equivalent RPC SQL exists in the codebase to read; Phase 8 `responders_for_request` is analogous in structure but reads-only (no writes) |
| pg_cron `cron.schedule` syntax | RESEARCH.md §Pattern 4 | First time pg_cron is used in this project |
| `useZxing` hook API | RESEARCH.md §Pattern 6 | First time `react-zxing` is used |

---

## Metadata

**Analog search scope:** `src/screens/`, `src/App.tsx`, `src/lib/supabase.ts`, `src/types/database.ts`, `src/format.ts`
**Files read:** 8 (RequestLive.tsx, App.tsx, Home.tsx, DonorCongrats.tsx, supabase.ts, database.ts [partial], format.ts, CONTEXT.md, RESEARCH.md)
**Pattern extraction date:** 2026-06-23
