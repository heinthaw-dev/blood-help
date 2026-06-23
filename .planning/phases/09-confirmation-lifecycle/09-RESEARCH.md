# Phase 9: Confirmation + Lifecycle — Research

**Researched:** 2026-06-23
**Domain:** Supabase SECURITY DEFINER RPC, Postgres Changes Realtime, pg_cron, QR scanning (react-zxing), request lifecycle state machine
**Confidence:** HIGH (schema verified from generated types; library from npm registry + slopcheck; pg_cron and Realtime from official Supabase docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Status mapping: in-app code-confirm → `'fulfilled'` (auto, when units met); "got it outside" → `'fulfilled'` + `closed_at`; "cancel / no longer needed" → `'cancelled'` + `closed_at`.
- **D-02:** No personal-data purge in Phase 9. Retain all rows. Explicitly supersedes v3 purge plan.
- **D-03:** Honest copy — rewrite the outside/cancel closed-screen copy to drop the false "purged" claim. EN: "Marked as received. Glad you got the blood you needed."
- **D-04:** Anti-fraud participant check kept: confirm is only valid for a donor who is a `responding` participant on this exact request.
- **D-05:** Confirm via an owner-scoped `SECURITY DEFINER` RPC. Atomically: verify ownership → donor lookup by code → participant check → duplicate check → insert donations → increment donors.donation_count + set last_donation_date → increment units_collected → auto-fulfill if met.
- **D-06:** Error granularity: one generic "Invalid or unrecognized code" for unknown-code AND not-a-participant; specific "This donor is already confirmed" for duplicate.
- **D-07:** No blood-type compatibility check at confirm time — participation already implies compatibility.
- **D-08:** Real camera QR scan ships this phase. Library + payload = researcher/planner.
- **D-09:** Duplicate confirm blocked by unique `(request_id, donor_id)` constraint on donations.
- **D-10:** Multi-unit progress: replace dummy `setCollected` with real confirm RPC call; drive `collected` from DB `units_collected`.
- **D-11:** Donor congrats = full-screen takeover via app-wide Realtime subscription on donor's own `donations` rows, owned in `App.tsx`. Departs from Phase 8 D-12.
- **D-12:** Closed-app congrats = check-on-open. Query for unseen donations row on mount. Needs a small "unseen" marker in localStorage.
- **D-13:** pg_cron every 15 minutes. UPDATE blood_requests SET status='expired', closed_at=now() WHERE expires_at < now() AND status='active'.
- **D-14:** Dummy past-dated seed to verify pg_cron without waiting 24h.
- **D-15:** No expiry notification this phase.
- **D-16:** In-app extend ships Phase 9; closed-app push deferred.
- **D-17:** Pre-expiry warning when status='active' AND not yet extended AND within ~4h of expires_at. Banner on RequestLive + Home active-request card.
- **D-18:** "Extend +12h" sets expires_at = current expires_at + 12h.
- **D-19:** Once only. Requires `extended` boolean flag on blood_requests (currently absent — must be added via migration). RLS must allow owner UPDATE of expires_at + extended.

### Claude's Discretion
- Exact SECURITY DEFINER confirm-RPC SQL shape.
- QR scanner library and payload encoding.
- "Unseen donation" marker mechanism for D-12 (localStorage id vs timestamp).
- pg_cron deployment specifics via Supabase MCP.
- Whether extend (D-19) is a direct owner UPDATE vs a tiny RPC.
- Reuse existing formatters and AlertDialog.

### Deferred Ideas (OUT OF SCOPE)
- All FCM/push (PUSH-01 through PUSH-04, DNOR-03, pre-expiry push, congrats backup push).
- v2 one-time QR codes.
- v3 personal-data purge on close.
- Switching expiry to a scheduled Edge Function.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONF-02 | QR scan / 5-char code entry validates responding participant, creates donations row, increments donation_count + last_donation_date + units_collected | Confirm RPC shape in §Architecture Patterns; schema column mapping in §Live Schema Confirmation |
| CONF-03 | After each confirm, if units_collected >= units_needed: status='fulfilled', closed_at set; donor sees congrats screen via Realtime on own new donations row | App-wide Realtime subscription pattern in §Architecture Patterns; D-11 wiring |
| LIFE-01 | Request close action (resolve flow) writes correct status + closed_at per D-01 mapping | Locked via D-01; RLS direct owner UPDATE applies |
| LIFE-02 | Scheduled job (pg_cron) sets status='expired' where expires_at < now() and status='active'; dummy seed for dev verification | pg_cron confirmed enabled and verified in §pg_cron Auto-Expiry |
</phase_requirements>

---

## Summary

Phase 9 is a backend-wiring phase. Every major UI surface already exists; the work is replacing dummy local state with real Supabase operations and adding three new capabilities: a real QR camera scanner, an app-wide donations Realtime subscription for the congrats takeover, and a pg_cron expiry job.

**Schema confirmation (critical finding):** The live schema, as confirmed from the generated `src/types/database.ts` (authoritative source — regenerated by Supabase MCP after Phase 7 migration), shows the Phase 7 `profiles`/`donors` split is fully in place. `donor_code`, `donation_count`, and `last_donation_date` live on the **`donors`** table (not `profiles`). The `donations` table exists with the correct shape. `blood_requests` has `units_collected`, `units_needed`, `status`, `expires_at`, and `closed_at` — but **does NOT yet have an `extended` boolean flag** (D-19 requires a new migration). The `request_status` enum already includes `'expired'`.

**QR scanner recommendation:** `react-zxing` v3.0.0 — React 19 compatible, actively maintained (last release Jun 2026), slopcheck [OK], no postinstall scripts. The `useZxing` hook is a clean declarative API that fits the project's hook-heavy style. Payload is the bare 5-char `donor_code`.

**pg_cron:** Available on Supabase hosted projects. Enable with `CREATE EXTENSION IF NOT EXISTS pg_cron;`. Schedule syntax `*/15 * * * *` for every 15 minutes. The command is a plain SQL string. Requires Supabase MCP `execute_sql` for deployment.

**Primary recommendation:** Wire the confirm RPC first (it unblocks CONF-02 and CONF-03 together), then the donations Realtime subscription, then pg_cron, then the extend banner. The QR scanner can be integrated alongside the RPC since the payload is the same 5-char code the text input already handles.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Confirm RPC (D-05) | API / Backend (Supabase SECURITY DEFINER) | — | Must be server-gated: ownership check, participant lookup, atomic increments, auto-fulfill cannot be done safely client-side |
| Donations Realtime subscription (D-11) | Frontend Server / App.tsx | Browser (channel lifecycle) | App.tsx owns global state; congrats takeover needs to interrupt any screen |
| Check-on-open unseen donations (D-12) | Browser / App.tsx mount | localStorage marker | No websocket on closed app; plain DB query at mount time |
| QR camera scan (D-08) | Browser / RequestLive | — | getUserMedia is a browser-tier API; feeds same 5-char code to the same RPC |
| pg_cron expiry job (D-13) | Database / Postgres | — | In-DB cron; no client involvement |
| Extend +12h (D-19) | API / Backend (RLS-gated direct UPDATE or tiny RPC) | Browser (optimistic UI) | Owner UPDATE allowed by RLS; simpler than a full RPC since no security boundary beyond ownership |
| Pre-expiry warning computation (D-17) | Browser / App.tsx + Home + RequestLive | — | Client-side `Date.now()` vs `expires_at`; no server query |
| Copy corrections D-01/D-03 | Browser / RequestLive | — | Local string update in the `closedData` map |

---

## Live Schema Confirmation (BLOCKING — resolved)

**Source:** `src/types/database.ts` — generated by Supabase MCP `generate_typescript_types` after Phase 7+8 migrations. [VERIFIED: project codebase — authoritative generated types file]

### Column → Table Mapping for the Confirm RPC

| Column | Lives on | Type | Notes |
|--------|----------|------|-------|
| `donor_code` | `donors` | `text \| null` (unique) | Look up donor by code here, not profiles |
| `donation_count` | `donors` | `number` (default 0) | Increment here |
| `last_donation_date` | `donors` | `string \| null` (date) | Set here |
| `is_available` | `donors` | `boolean` | Read-only for confirm |
| `blood_type` (donor) | `donors` | `blood_type enum` | Record on donations row |

**profiles table** — confirmed to contain ONLY: `id`, `name`, `phone`, `language`, `created_at`, `updated_at`. No donor columns. No `donor_code` on profiles.

### donations Table Shape (confirmed)

```sql
donations (
  id            uuid PK,
  request_id    uuid → blood_requests(id) ON DELETE SET NULL,
  donor_id      uuid NOT NULL → profiles(id) ON DELETE CASCADE,
  recipient_id  uuid → profiles(id) ON DELETE SET NULL,
  blood_type    blood_type | null,
  confirmed_via text | null,       -- 'qr' | 'manual'
  donated_on    date DEFAULT current_date,
  created_at    timestamptz
)
```

**MISSING** from donations in the live schema (vs spec §4): a unique `(request_id, donor_id)` constraint. The spec says to add it (D-09 anti-duplicate). **This constraint must be added in the Phase 9 migration.** [VERIFIED: database.ts Row type has no unique annotation; spec §4.2 says "only valid for a `responding` participant" but the unique constraint enforcement is a Phase 9 migration task]

### blood_requests Table Shape (confirmed)

Confirmed columns: `id`, `requester_id`, `blood_type`, `current_address`, `lat`, `lng`, `contact_phone`, `units_needed`, `units_collected`, `urgency`, `status` (request_status), `alerted_count`, `created_at`, `expires_at`, `closed_at`.

**ABSENT — must be added by migration:**
- `extended` boolean (D-19 — once-only extend flag). NOT in the current schema.

**IMPORTANT NOTE:** `blood_requests` does NOT have a `hospital_name` column (it was dropped in the Phase 7 schema revision per D-05 there — `township` became `current_address`). The spec §4 schema is superseded by the Phase 7 migration.

### request_status Enum (confirmed)

`'active' | 'fulfilled' | 'cancelled' | 'expired'` — all four values the phase needs are already deployed. [VERIFIED: database.ts Enums]

### Existing RPCs (confirmed, carry forward)

| RPC | Purpose |
|-----|---------|
| `responders_for_request(p_request_id)` | Owner-scoped; template for confirm RPC |
| `donors_within_radius(lat, lng, radius_km)` | Used by RequestLive for truthful count |
| `requests_within_radius(lat, lng, radius_km)` | Home feed |
| `generate_donor_code()` | DB-side 5-char Base32 generator |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | (installed) | Supabase client, Realtime channels, RPC calls |
| `react` | 19.2.6 | Component framework |
| `vite` | 8.0.12 | Build |
| `tailwindcss` | 4.3.1 | Styling |

### New Dependency (Phase 9)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-zxing` | 3.0.0 | QR camera scanning via `useZxing` hook | React 19 compatible; wraps ZXing-C++ via WASM; clean hook API; slopcheck [OK]; actively maintained (last release Jun 2026) |

**Installation:**
```bash
npm install react-zxing
```

### Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `react-zxing` | npm | ~4 yrs (Aug 2022) | Moderate | github.com/adamalfredsson/react-zxing | [OK] | Approved |

- No postinstall scripts. [VERIFIED: npm view react-zxing scripts.postinstall — no output]
- peerDependencies: `react: '^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0'` — React 19 explicitly supported. [VERIFIED: npm view react-zxing peerDependencies]

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-zxing` | `html5-qrcode` | html5-qrcode is heavier, less performant on mobile, brings its own DOM manipulation that fights React; avoid |
| `react-zxing` | `jsQR` | jsQR is pure-JS decode only — no camera management; would need manual getUserMedia plumbing; more code, same result |
| `react-zxing` | `@zxing/browser` | Lower-level; react-zxing is the React wrapper over this exact library — prefer the wrapper |

---

## Architecture Patterns

### System Architecture Diagram

```
QR camera scan (useZxing)  ──► donor_code string
Manual 5-char input        ──►                   ──► confirm_donation RPC (SECURITY DEFINER)
                                                        │
                                                        ├── verify auth.uid() = request.requester_id
                                                        ├── look up donors WHERE donor_code = $code
                                                        ├── check request_responses: donor_id + request_id + status='responding'
                                                        ├── check donations unique (request_id, donor_id)
                                                        ├── INSERT donations row
                                                        ├── UPDATE donors SET donation_count++, last_donation_date = today
                                                        ├── UPDATE blood_requests SET units_collected++
                                                        └── IF units_collected >= units_needed:
                                                                UPDATE blood_requests SET status='fulfilled', closed_at=now()

Requester UI               ◄── RPC return: { units_collected, fulfilled: bool } + error codes
Donor (any screen)         ◄── App.tsx Realtime channel "donations:donor_id=eq.{uid}" → DonorCongrats takeover
App.tsx mount (check-on-open) ◄── SELECT donations WHERE donor_id = uid AND id > last_seen_id

pg_cron (*/15 * * * *)     ──► UPDATE blood_requests SET status='expired', closed_at=now()
                                  WHERE expires_at < now() AND status='active'

Extend flow (client-side)  ──► compute: status='active' AND NOT extended AND expires_at - now() < 4h
                           ──► UPDATE blood_requests SET expires_at = expires_at + '12h', extended = true
                                  WHERE id = $id AND requester_id = auth.uid()
```

### Pattern 1: Owner-Scoped SECURITY DEFINER Confirm RPC

**What:** A plpgsql function that performs the full confirmation transaction atomically. Runs with the definer's privileges to access donor phone data and cross-table updates, but gates everything on `auth.uid() = requester_id`.

**When to use:** Any multi-table write that needs to cross RLS boundaries safely (same pattern as Phase 8's `responders_for_request`).

**Template from Phase 8 (adapt for confirm):**
```sql
-- Source: Phase 8 responders_for_request SECURITY DEFINER pattern
CREATE OR REPLACE FUNCTION confirm_donation(
  p_request_id  uuid,
  p_donor_code  text,
  p_via         text  -- 'qr' | 'manual'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id  uuid;
  v_donor_id      uuid;
  v_donor_bt      blood_type;
  v_collected     int;
  v_needed        int;
  v_new_collected int;
  v_fulfilled     boolean := false;
BEGIN
  -- 1. Verify caller owns the request
  SELECT requester_id, units_collected, units_needed
    INTO v_requester_id, v_collected, v_needed
    FROM blood_requests
   WHERE id = p_request_id AND status = 'active';

  IF v_requester_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');  -- request not found / not active
  END IF;

  IF v_requester_id != auth.uid() THEN
    RETURN json_build_object('error', 'invalid_code');  -- not owner
  END IF;

  -- 2. Look up donor by code
  SELECT id, blood_type
    INTO v_donor_id, v_donor_bt
    FROM donors
   WHERE donor_code = upper(p_donor_code);

  IF v_donor_id IS NULL THEN
    RETURN json_build_object('error', 'invalid_code');  -- unknown code
  END IF;

  -- 3. Participant check (anti-fraud D-04)
  IF NOT EXISTS (
    SELECT 1 FROM request_responses
     WHERE request_id = p_request_id
       AND donor_id   = v_donor_id
       AND status     = 'responding'
  ) THEN
    RETURN json_build_object('error', 'invalid_code');  -- not a responding participant
  END IF;

  -- 4. Duplicate check (D-09)
  IF EXISTS (
    SELECT 1 FROM donations
     WHERE request_id = p_request_id AND donor_id = v_donor_id
  ) THEN
    RETURN json_build_object('error', 'already_confirmed');
  END IF;

  -- 5. Insert donations row
  INSERT INTO donations (request_id, donor_id, recipient_id, blood_type, confirmed_via)
  VALUES (p_request_id, v_donor_id, v_requester_id, v_donor_bt, p_via);

  -- 6. Credit donor
  UPDATE donors
     SET donation_count     = donation_count + 1,
         last_donation_date = current_date,
         updated_at         = now()
   WHERE id = v_donor_id;

  -- 7. Increment units_collected
  v_new_collected := v_collected + 1;
  UPDATE blood_requests
     SET units_collected = v_new_collected
   WHERE id = p_request_id;

  -- 8. Auto-fulfill if target met
  IF v_new_collected >= v_needed THEN
    UPDATE blood_requests
       SET status = 'fulfilled', closed_at = now()
     WHERE id = p_request_id;
    v_fulfilled := true;
  END IF;

  RETURN json_build_object(
    'units_collected', v_new_collected,
    'units_needed',    v_needed,
    'fulfilled',       v_fulfilled,
    'donor_id',        v_donor_id
  );
END;
$$;
```

**Gotchas:**
- `upper(p_donor_code)` — the 5-char code is stored as uppercase Base32; the input filter in RequestLive already uppercases, but normalize in the RPC too.
- Return `json` not `setof record` so the client gets a single typed response regardless of path.
- The function must NOT be callable by the donor — add `REVOKE EXECUTE ON FUNCTION confirm_donation FROM PUBLIC; GRANT EXECUTE ON FUNCTION confirm_donation TO authenticated;` and the RLS gate inside the function is sufficient.
- The unique `(request_id, donor_id)` constraint on `donations` must be added in the same migration or the INSERT at step 5 can silently race without error on concurrent submits.

### Pattern 2: App-Wide Donations Realtime Subscription (D-11)

**What:** A Supabase Postgres Changes channel on `donations` filtered to `donor_id=eq.{uid}`, subscribed in `App.tsx`'s `useEffect` (parallel to the existing Phase 8 subscription model in `RequestLive`). When a new donation row arrives for the current user, flip `screen` to `'donor-congrats'`.

**Requirements for the event to fire under RLS:**
1. `donations` must be in the `supabase_realtime` publication: `ALTER PUBLICATION supabase_realtime ADD TABLE donations;`
2. `donations` must have REPLICA IDENTITY: `ALTER TABLE donations REPLICA IDENTITY FULL;`
3. A SELECT RLS policy on `donations` must allow the donor (authenticated user whose `donor_id = auth.uid()`) to select their own rows.

**Pattern (mirrors Phase 8 `rr:${requestId}` channel but app-scoped):**
```typescript
// In App.tsx useEffect, gated on user.supabaseId
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
      // Mark the new donation id as "seen" in localStorage
      localStorage.setItem('bloodhelp.lastSeenDonationId', payload.new.id)
      // Update donation count from the new row's donor context (re-fetch or increment)
      setUser(u => ({ ...u, donationCount: u.donationCount + 1 }))
      setScreen('donor-congrats')
    }
  )
  .subscribe()
return () => { void supabase.removeChannel(channel) }
```

**Cleanup on logout:** call `supabase.removeChannel` in `handleLogout` (or the useEffect cleanup via dependency on `user.supabaseId`). [CITED: supabase.com/docs/guides/realtime/postgres-changes]

### Pattern 3: Check-on-Open Unseen Donations (D-12)

**What:** On App mount (after `hydrateUserFromDb` confirms a `uid`), query for donations where `donor_id = uid AND id > last_seen_id`. If found, show congrats.

**Unseen marker:** Store the last-seen donation UUID in `localStorage` under key `'bloodhelp.lastSeenDonationId'`. On mount, read this value and query:
```typescript
const lastSeen = localStorage.getItem('bloodhelp.lastSeenDonationId') ?? ''
const { data } = await supabase
  .from('donations')
  .select('id')
  .eq('donor_id', uid)
  .gt('created_at', lastSeenTimestamp)   // or .neq('id', lastSeenId) with ORDER BY + LIMIT 1
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
if (data) {
  localStorage.setItem('bloodhelp.lastSeenDonationId', data.id)
  setScreen('donor-congrats')
}
```
Use `created_at` timestamp comparison (stored as ISO string from the last-seen donation) rather than UUID comparison — timestamps are ordered and more reliable for "newer than" queries. Store the ISO string of the last-seen donation `created_at` under `'bloodhelp.lastSeenDonationAt'`.

**Logout cleanup:** clear `bloodhelp.lastSeenDonationAt` in `handleLogout` so one user's unseen donations don't trigger congrats for the next user on a shared device.

### Pattern 4: pg_cron Auto-Expiry Job (D-13)

**Enable and schedule via Supabase MCP `execute_sql`:**

```sql
-- Step 1: Enable extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Schedule expiry job (every 15 minutes)
SELECT cron.schedule(
  'auto-expire-requests',
  '*/15 * * * *',
  $$
    UPDATE blood_requests
       SET status    = 'expired',
           closed_at = now()
     WHERE expires_at < now()
       AND status    = 'active'
  $$
);

-- Verify:
SELECT * FROM cron.job WHERE jobname = 'auto-expire-requests';
```

**Dummy seed to verify without waiting 24h (D-14):**
```sql
-- Insert a blood_requests row with expires_at in the past
INSERT INTO blood_requests (requester_id, blood_type, current_address, contact_phone,
                            expires_at, status, units_needed)
VALUES (
  '<any valid profile_id>',
  'O+',
  'Test Address',
  '+959000000001',
  now() - interval '1 second',   -- already expired
  'active',
  1
);
-- After the next cron tick (or SELECT cron.run_job(job_id)), verify status = 'expired'
```

**Unschedule:**
```sql
SELECT cron.unschedule('auto-expire-requests');
```

[CITED: github.com/citusdata/pg_cron — cron.schedule() function signature and SQL command support]

### Pattern 5: Extend +12h (D-16 to D-19)

**Client-side computation:**
```typescript
const EXTEND_WARN_MS = 4 * 60 * 60 * 1000  // 4h before expiry
const now = Date.now()
const expiresAt = new Date(requestDraft.expiresAt).getTime()  // needs expiresAt in RequestDraft
const showExtendBanner =
  requestDraft !== null &&
  activeRequestStatus === 'active' &&
  !activeRequestExtended &&           // D-19 once-only flag
  expiresAt - now < EXTEND_WARN_MS &&
  expiresAt - now > 0                 // not yet expired
```

**DB write — direct owner UPDATE (preferred over RPC since no security boundary beyond ownership):**
```typescript
const { error } = await supabase
  .from('blood_requests')
  .update({
    expires_at: new Date(currentExpiresAt.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    extended: true,
  })
  .eq('id', activeRequestId)
  .eq('requester_id', user.supabaseId)  // RLS belt-and-suspenders
```
RLS policy needed: `UPDATE ON blood_requests FOR AUTHENTICATED WHERE requester_id = auth.uid()` — this policy already likely covers the request owner; confirm it also allows `expires_at` and the new `extended` column to be updated. If the existing UPDATE policy uses `USING (requester_id = auth.uid())` without a restrictive `WITH CHECK`, it covers the new column automatically.

**Migration tasks for D-19:**
```sql
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS extended boolean NOT NULL DEFAULT false;
```

### Pattern 6: useZxing QR Scanner Integration (D-08)

```typescript
// Source: react-zxing v3.0.0 — github.com/adamalfredsson/react-zxing
import { useZxing } from 'react-zxing'

function QrScannerViewport({ onScan }: { onScan: (code: string) => void }) {
  const { ref } = useZxing({
    formats: ['qr_code'],
    onDecodeResult(result) {
      const raw = result.rawValue.trim().toUpperCase()
      // Payload is the bare 5-char donor_code — no URL wrapping
      if (/^[A-Z2-7]{5}$/.test(raw)) {
        onScan(raw)
      }
    },
    onError(err) {
      // Camera permission denied or WASM load failure
      console.warn('QR scan error:', err)
    },
  })
  return <video ref={ref} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
}
```

**Camera permission UX:** `useZxing` calls `getUserMedia` internally and fires `onError` on denial. Mirror the geolocation pre-permission `AlertDialog` pattern from `CreateRequest.tsx` / `DonorProfileSetup.tsx` — show an `AlertDialog` warning before opening the scanner, so the user understands why the camera permission prompt appears. This is the same two-step pattern Phase 7 established for GPS.

**HTTPS requirement:** `getUserMedia` requires a secure context. Vite dev server on `localhost` is sufficient. LAN IP (`http://192.x.x.x`) will fail — test on `localhost` or with `vite --host --https`.

**WASM loading:** `react-zxing` loads `zxing_reader.wasm` from jsDelivr CDN by default. In production (offline PWA), pass a `wasmUrl` pointing to a bundled copy. For Phase 9 (PWA plugin not yet installed), the CDN default is acceptable — note this as a follow-up for the PWA manifest phase.

**QR payload:** Bare 5-char `donor_code` string. No URL wrapping — the same value the text input accepts. The `generate_donor_code()` DB function already generates Base32 (A–Z, 2–7). The regex `/^[A-Z2-7]{5}$/` validates a scanned result.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR decode from camera | Custom getUserMedia + Canvas decode loop | `react-zxing` | WASM decoder handles skew, lighting, orientation; hand-rolled canvas approach is 100–200 lines with poor mobile decode rates |
| Atomic multi-table DB update | Client-side sequential UPDATE calls | `SECURITY DEFINER` RPC | Race conditions + partial failure impossible to recover from client-side; requires transaction |
| pg_cron scheduling | Node/Edge Function cron equivalent | `pg_cron` extension | In-DB; no cold start; no Edge Function credentials needed when the job is a plain SQL UPDATE |
| Realtime RLS gate | Loosening `donations` RLS to allow reads | REPLICA IDENTITY FULL + SELECT policy scoped to donor | Security boundary; spec §4.3 — donations visible only to the two parties |

---

## Common Pitfalls

### Pitfall 1: Subscribing to donations WITHOUT adding to supabase_realtime publication
**What goes wrong:** Channel subscribes successfully but no events fire. Silent failure.
**Why it happens:** Tables not in the `supabase_realtime` publication don't emit Postgres Changes events, regardless of RLS or REPLICA IDENTITY settings.
**How to avoid:** Migration must include `ALTER PUBLICATION supabase_realtime ADD TABLE donations;` before any Realtime code is deployed.
**Warning signs:** Channel status is SUBSCRIBED but no INSERT events arrive even after a known donation is created.

### Pitfall 2: Forgetting REPLICA IDENTITY FULL on donations
**What goes wrong:** Realtime fires events but they contain only the primary key (`id`), not the full row data needed to set `localStorage.lastSeenDonationId`.
**Why it happens:** Default REPLICA IDENTITY is DEFAULT (primary key only) for UPDATE/DELETE. For INSERT the new row is always fully available, so this pitfall is less critical for the D-11 INSERT subscription — but set FULL anyway for completeness and to avoid confusion if UPDATE subscriptions are added later.
**How to avoid:** `ALTER TABLE donations REPLICA IDENTITY FULL;` in the migration.

### Pitfall 3: Calling confirm_donation without SECURITY DEFINER grants
**What goes wrong:** The RPC call fails with a permission error when it tries to read `donors.phone` or update another user's row.
**Why it happens:** SECURITY DEFINER without explicit GRANT means the function runs as the definer (superuser) but authenticated callers may not have EXECUTE permission.
**How to avoid:** After CREATE FUNCTION: `REVOKE EXECUTE ON FUNCTION confirm_donation FROM PUBLIC; GRANT EXECUTE ON FUNCTION confirm_donation TO authenticated;`

### Pitfall 4: Using the RequestLive QR viewport button's `onClick` for real scanner activation
**What goes wrong:** The existing QR viewport button calls `handleConfirmInApp` directly (dummy). Replacing the button with a real video feed requires structural change — the `<button>` wrapping must become a container `<div>`, and the `<video ref={ref}>` goes inside.
**Why it happens:** The Phase 8 code kept the button as a tap-to-confirm placeholder.
**How to avoid:** Render `useZxing`'s `ref` on a `<video>` element inside the dark viewport div. When a valid decode fires, call `handleCodeInput` with the scanned value (or directly trigger confirm if the code is valid length). Keep the text input as the manual fallback below it.

### Pitfall 5: Reading `extended` flag from App state that was never loaded from DB
**What goes wrong:** The extend banner shows again after page reload because `activeRequestExtended` defaults to `false` in local state, even though the DB row has `extended = true`.
**Why it happens:** `hydrateUserFromDb` loads `blood_requests` into `requestDraft`, but `extended` is a new column not yet in `RequestDraft` type or the hydration select.
**How to avoid:** Add `extended: boolean` to `RequestDraft` (or a separate `activeRequestExtended` state) and load it from the hydration query.

### Pitfall 6: pg_cron job name collision
**What goes wrong:** Re-running the migration creates a second job with the same name (or throws a duplicate error).
**Why it happens:** `cron.schedule` with the same job name creates a new job, not an upsert.
**How to avoid:** Guard with `SELECT cron.unschedule('auto-expire-requests') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-expire-requests');` before scheduling, or use a migration that is idempotent.

### Pitfall 7: WASM fetch blocked by Content Security Policy
**What goes wrong:** `react-zxing` fails to load `zxing_reader.wasm` from jsDelivr in production.
**Why it happens:** Supabase / hosting adds a restrictive CSP header.
**How to avoid:** Either self-host the WASM file (`wasmUrl` prop) or add `script-src cdn.jsdelivr.net` to the CSP. For Phase 9, note this as a pre-production follow-up.

---

## Runtime State Inventory

> This phase is primarily backend-wiring on existing schema — not a rename/refactor. The one new column (`blood_requests.extended`) starts as DEFAULT false on all existing rows.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `donations` table — no existing rows in dev; pg_cron will produce `expired` rows from past-dated seed | None — columns added with DEFAULT values; no data migration |
| Live service config | pg_cron job `auto-expire-requests` does not yet exist | Deploy via Supabase MCP `execute_sql` |
| OS-registered state | None | None |
| Secrets/env vars | No new secrets; `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` already in `.env.local` | None |
| Build artifacts | `src/types/database.ts` — stale after migration (missing `extended` column, new `confirm_donation` RPC) | Regenerate via Supabase MCP `generate_typescript_types` after migration |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build | ✓ | v24.16.0 | — |
| npm | Package install | ✓ | 11.13.0 | — |
| Supabase project | All DB/Realtime ops | ✓ | dfrpqkutjsnfgkdmcadi (ap-southeast-1) | — |
| pg_cron extension | D-13 auto-expiry | Needs enablement | — | Enable via MCP execute_sql |
| HTTPS context | QR camera (getUserMedia) | ✓ on localhost | — | Use `vite` dev server (localhost is secure context) |

**Missing dependencies with no fallback:** none (pg_cron can be enabled in-place via MCP).

---

## Code Examples

### Confirm RPC Client Call (RequestLive)

```typescript
// Replace dummy handleConfirmInApp with this
const handleConfirmInApp = async () => {
  if (!requestId || !confirmReady) return

  const { data, error } = await supabase.rpc('confirm_donation', {
    p_request_id: requestId,
    p_donor_code: code.trim().toUpperCase(),
    p_via: 'manual',  // or 'qr' when called from scanner path
  })

  if (error || !data) {
    // Generic write failure
    setConfirmError(/* AlertDialog */ )
    return
  }

  const result = data as { error?: string; units_collected?: number; fulfilled?: boolean }

  if (result.error === 'invalid_code') {
    // D-06: generic message for unknown code + not-a-participant
    showToast('ကုဒ် မမှန်ကန်ပါ', 'Invalid or unrecognized code')
    return
  }
  if (result.error === 'already_confirmed') {
    // D-06: specific duplicate message
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

### Extend Banner Visibility Computation

```typescript
// In App.tsx (or passed as a prop to Home + RequestLive)
const EXTEND_WARN_MS = 4 * 60 * 60 * 1000

const expiresAtMs = activeRequest ? new Date(activeRequest.expires_at).getTime() : null
const msUntilExpiry = expiresAtMs ? expiresAtMs - Date.now() : null
const showExtendBanner =
  activeRequest !== null &&
  activeRequest.status === 'active' &&
  !activeRequest.extended &&
  msUntilExpiry !== null &&
  msUntilExpiry > 0 &&
  msUntilExpiry < EXTEND_WARN_MS
```

### Extend Write (direct owner UPDATE)

```typescript
const handleExtend = async () => {
  if (!activeRequestId || !activeRequest) return
  const newExpiry = new Date(new Date(activeRequest.expires_at).getTime() + 12 * 60 * 60 * 1000).toISOString()

  // Optimistic: hide banner immediately
  setActiveRequest(r => r ? { ...r, extended: true, expires_at: newExpiry } : r)

  const { error } = await supabase
    .from('blood_requests')
    .update({ expires_at: newExpiry, extended: true })
    .eq('id', activeRequestId)
    .eq('requester_id', user.supabaseId)

  if (error) {
    // Roll back optimistic update + show AlertDialog
    setActiveRequest(r => r ? { ...r, extended: false, expires_at: activeRequest.expires_at } : r)
    setWriteError({ title: errStrings.genericTitle, message: errStrings.genericMsg })
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| QR viewport as a dummy button tap | `useZxing` hook with real camera | Actual scanning; getUserMedia camera permission prompt |
| `setCollected(next)` local state | `confirm_donation` RPC + DB-driven `units_collected` | Multi-device consistency; leaderboard accuracy |
| No expiry enforcement | pg_cron every 15 min | Stale requests auto-clear; DB stays clean |
| "data was purged" copy (false) | Honest closed-screen copy (D-03) | Consistency with Phase 8 honesty principle |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pg_cron extension is available on this Supabase project's tier (not all tiers support it) | pg_cron pattern | Planner must verify via Supabase MCP `list_extensions` before including pg_cron migration; fallback is a scheduled Edge Function |
| A2 | The existing UPDATE RLS policy on `blood_requests` allows the owner to update `expires_at` (no restrictive WITH CHECK clause blocking specific columns) | Extend pattern | If blocked, a tiny RPC with SECURITY DEFINER is needed instead of a direct UPDATE |
| A3 | `react-zxing` v3.0.0 WASM loading from jsDelivr CDN works in the Vite dev environment without CSP issues | QR scanner | Dev likely fine (localhost); may need self-hosted WASM for production PWA |

---

## Open Questions

1. **Is pg_cron enabled on this Supabase project?**
   - What we know: pg_cron is available on Supabase Pro and above; the project is active.
   - What's unclear: the exact plan tier; `create extension pg_cron` may fail silently or with an error on free tier.
   - Recommendation: Planner's Wave 0 task — use Supabase MCP `list_extensions` to check. If not enabled, `CREATE EXTENSION IF NOT EXISTS pg_cron;` via `execute_sql`. If unavailable, fall back to a scheduled Edge Function (same SQL UPDATE, different invocation method).

2. **Does the existing `blood_requests` UPDATE RLS policy cover the new `extended` column?**
   - What we know: Phase 7 added an UPDATE policy for the request owner; it likely uses `USING (requester_id = auth.uid())`.
   - What's unclear: whether a `WITH CHECK` clause restricts which columns can be updated.
   - Recommendation: Planner reads the existing policy SQL via `list_policies` before writing the extend handler; if restricted, use a `SECURITY DEFINER` RPC for extend.

3. **Should `DonorCongrats` receive the updated `donationCount` from the RPC result or from a re-fetch?**
   - What we know: The RPC returns `units_collected` (request scope), not the donor's new `donation_count`.
   - What's unclear: the exact increment value — could optimistically increment `user.donationCount + 1` or re-fetch `donors WHERE profile_id = uid`.
   - Recommendation: Optimistic `+1` on the Realtime event (same pattern as `handleRespond`); a refetch is overkill for a display-only count.

---

## Validation Architecture

> This project has no automated test framework. Verification is manual + Supabase dashboard checks.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — manual verification |
| Quick run command | `npm run build` (type-check via `tsc -b`) |
| Full suite command | Manual two-device walkthrough |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | How to Verify |
|--------|----------|-----------|----------------|
| CONF-02 | Valid code (responding participant) creates donations row, increments counts | Manual | Enter donor_code in RequestLive code sheet; verify via Supabase table viewer |
| CONF-02 | Invalid code (non-participant) returns generic error toast | Manual | Enter a non-participant's code; confirm toast, no DB row |
| CONF-02 | Duplicate code returns "already confirmed" toast | Manual | Re-enter the same confirmed code |
| CONF-02 | QR scan decodes and confirms same as text entry | Manual | Donor shows QR in Profile screen; requester scans it |
| CONF-03 | Auto-fulfill when units_collected >= units_needed | Manual | 1-unit request: confirm once; verify status='fulfilled' in DB, congrats screen shown to donor |
| CONF-03 | Multi-unit: partial confirm shows progress toast | Manual | 2-unit request: confirm one donor; verify progress subtitle updates; confirm second donor; verify fulfilled |
| LIFE-01 | "Outside" → status='fulfilled' | Manual | Tap "got it outside"; verify DB status='fulfilled', closed_at set; closed screen shows honest copy |
| LIFE-01 | "Cancel" → status='cancelled' | Manual | Tap cancel; verify DB status='cancelled', closed_at set |
| LIFE-02 | pg_cron flips active→expired | Manual | Insert past-dated seed row; wait or trigger cron tick; verify status='expired' in Supabase |
| D-17/D-18 | Extend banner shows within 4h of expiry | Manual | Set expires_at = now()+2h via SQL; reload; verify banner appears on Home card and RequestLive |
| D-19 | Extend once only | Manual | Tap extend; verify extended=true in DB; confirm banner hidden; attempt second extend is blocked |
| D-11 | Donor congrats fires on second device while donor is on a different screen | Manual | Two-device test: requester confirms donor's code; donor's device (on Home) flips to congrats screen |
| D-12 | Check-on-open congrats when app was closed | Manual | Close donor's app; have requester confirm; reopen donor's app; verify congrats screen |

### Wave 0 Gaps

- [ ] Migration file: `confirm_donation` RPC + `donations` unique constraint + `extended` column + pg_cron setup + donations publication + RLS policies
- [ ] `src/types/database.ts` regeneration after migration
- [ ] `react-zxing` install

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (RPC ownership gate) | `auth.uid() = requester_id` check inside SECURITY DEFINER RPC |
| V3 Session Management | No | Handled in Phase 6 auth |
| V4 Access Control | Yes | Anti-fraud participant check (D-04); donor phones never returned to requester directly |
| V5 Input Validation | Yes | `upper(p_donor_code)` normalization; `/^[A-Z2-7]{5}$/` regex on scan result; RPC checks all inputs server-side |
| V6 Cryptography | No | Not applicable this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Confirming a non-participating donor (code guessing) | Spoofing | Participant check in RPC (D-04); generic error hides whether code is real |
| Double-crediting same donor | Tampering | Unique `(request_id, donor_id)` constraint + explicit duplicate check in RPC (D-09) |
| Requester calling confirm_donation on another user's request | Elevation of Privilege | `auth.uid() = requester_id` ownership check in RPC step 1 |
| Direct UPDATE to `blood_requests.status` bypassing business logic | Tampering | Status changes only through RPC (confirm) or pg_cron (expiry) — table-level UPDATE RLS should restrict `status` changes to the request owner, and the close/cancel writes go through the client only for owner-permitted paths |

---

## Sources

### Primary (HIGH confidence)
- `src/types/database.ts` (project codebase, generated by Supabase MCP) — live schema for all tables, enums, and existing RPCs
- `github.com/citusdata/pg_cron` — `cron.schedule()` signature, SQL command string support, `*/15 * * * *` syntax, `cron.unschedule()`
- `supabase.com/docs/guides/realtime/postgres-changes` — publication setup, REPLICA IDENTITY, RLS SELECT policy requirement, `filter: 'donor_id=eq.${uid}'` syntax

### Secondary (MEDIUM confidence)
- `github.com/adamalfredsson/react-zxing` — `useZxing` hook API, v3.0.0 release (Jun 2026), peer deps `react >= 16.8 || ... || ^19.0.0`, onDecodeResult / onError callbacks, WASM CDN loading
- `npm view react-zxing` — version 3.0.0, peerDependencies confirmed [VERIFIED: npm registry]
- slopcheck — `react-zxing` rated [OK] [VERIFIED: slopcheck 0.6.1]

### Tertiary (LOW confidence)
- Training knowledge on `SECURITY DEFINER` plpgsql pattern — validated against Phase 8 codebase pattern but exact SQL is planner discretion

---

## Metadata

**Confidence breakdown:**
- Live schema (table/column mapping): HIGH — sourced from generated `database.ts` (authoritative)
- Confirm RPC shape: HIGH (contract) / MEDIUM (exact SQL) — contract locked by D-05; SQL is planner discretion
- QR scanner (react-zxing): HIGH — npm verified, slopcheck [OK], peer deps confirmed
- pg_cron syntax: HIGH — official GitHub docs fetched
- Realtime donations subscription: HIGH — official Supabase docs fetched
- Extend flag (extended column absent): HIGH — confirmed absent from database.ts

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable stack; react-zxing v3.0.0 just released)
