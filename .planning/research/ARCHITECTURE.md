# Architecture Research

**Domain:** Serverless two-sided emergency matching PWA (blood donor + requester)
**Researched:** 2026-06-19
**Confidence:** HIGH (all key mechanisms verified against official Supabase, Firebase, and Postgres documentation)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  React PWA (Vite + Tailwind v4)                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ Auth UI  │ │Profile   │ │Request   │ │Donor Alert   │   │   │
│  │  │(dummy OTP│ │+ Avail.  │ │Creation  │ │+ Response    │   │   │
│  │  │ flow)    │ │ Toggle   │ │ Form     │ │  UI          │   │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │   │
│  │       │             │            │              │            │   │
│  │  ┌────▼─────────────▼────────────▼──────────────▼───────┐   │   │
│  │  │  Service Worker (sw.js)                               │   │   │
│  │  │  - FCM background push handler                        │   │   │
│  │  │  - PWA install prompt / manifest                      │   │   │
│  │  └──────────────────────────────┬────────────────────────┘   │   │
│  └─────────────────────────────────┼──────────────────────────┘   │
└────────────────────────────────────┼───────────────────────────────┘
                                     │ Supabase JS client (anon key + anon session JWT)
┌────────────────────────────────────▼───────────────────────────────┐
│                         DATA LAYER (Supabase)                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Postgres (with PostGIS + pg_net)                            │   │
│  │  Tables: profiles · blood_requests · request_responses       │   │
│  │          device_tokens · blood_compatibility (lookup)        │   │
│  │  RLS: all tables; auth.uid() from anonymous session JWT      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│              ┌─────────────────▼──────────────────┐                 │
│              │  Database Webhook (pg_net)           │                 │
│              │  Event: INSERT on blood_requests     │                 │
│              │  Method: async HTTP POST             │                 │
│              └─────────────────┬──────────────────┘                 │
│                                │                                     │
│              ┌─────────────────▼──────────────────┐                 │
│              │  Edge Function: notify-donors        │                 │
│              │  Runtime: Deno                       │                 │
│              │  1. Runs match query (blood compat   │                 │
│              │     + ST_DWithin radius)             │                 │
│              │  2. Fetches device tokens for        │                 │
│              │     matched donors                   │                 │
│              │  3. Signs JWT with Firebase SA key   │                 │
│              │  4. POSTs individual FCM v1 msgs     │                 │
│              │  5. Prunes dead tokens (404/400)     │                 │
│              └─────────────────┬──────────────────┘                 │
└────────────────────────────────┼───────────────────────────────────┘
                                 │ FCM HTTP v1 API
┌────────────────────────────────▼───────────────────────────────────┐
│                    PUSH DELIVERY (Firebase)                          │
│                                                                     │
│  Firebase Cloud Messaging                                           │
│  POST /v1/projects/{project_id}/messages:send                       │
│  One request per device token (no v1 multicast)                     │
│  → Android: background delivery                                     │
│  → iOS: requires PWA installed to home screen                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Boundary |
|-----------|---------------|----------|
| React PWA | All UI screens; calls Supabase JS directly; registers SW and FCM token; no server calls | Owns UI state; delegates data to Supabase |
| Service Worker | Intercepts FCM push events in the background; shows OS notification; handles notification clicks | No Supabase calls — pure push handler |
| Supabase Auth (anonymous) | Issues real UUID-backed anonymous session JWTs; `auth.uid()` returns UUID for RLS | Token stored in localStorage; auto-refreshed |
| Supabase Postgres | Stores all application data; enforces RLS; runs PostGIS geo queries and blood compatibility matching via RPC | Source of truth for all state |
| Database Webhook | Fires on `blood_requests` INSERT; sends async pg_net HTTP POST to Edge Function; non-blocking | Configured in Supabase dashboard |
| Edge Function: `notify-donors` | Finds compatible donors in radius; fetches their device tokens; fans out FCM pushes | Runs in Deno; reads service account from env secret |
| Firebase / FCM | Delivers push to donor devices; manages OS-level delivery on Android + iOS | No logic; pure delivery |

---

## Data Model

### ER-Style Table Definitions

```
┌──────────────────────────────────┐
│ profiles                         │
│  id            uuid  PK          │  ← same UUID as auth.users.id
│  phone         text  NOT NULL    │  ← display + callback number
│  blood_type    text  NOT NULL    │  ← enum: 'A+','A-','B+','B-',
│                                  │          'AB+','AB-','O+','O-'
│  location      geography(POINT)  │  ← nullable; updated when toggling donor
│  is_donor      boolean DEFAULT   │    false
│  created_at    timestamptz       │
│  updated_at    timestamptz       │
└──────────┬───────────────────────┘
           │ 1:1 with auth.users
           │
┌──────────▼───────────────────────┐
│ device_tokens                    │
│  id            uuid  PK          │
│  user_id       uuid  FK→profiles │
│  fcm_token     text  NOT NULL    │
│  platform      text              │  ← 'web', 'android', 'ios'
│  created_at    timestamptz       │
│  updated_at    timestamptz       │  ← updated on each app open
│  UNIQUE(user_id, fcm_token)      │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ blood_requests                   │
│  id            uuid  PK          │
│  requester_id  uuid  FK→profiles │
│  blood_type    text  NOT NULL    │  ← the type NEEDED
│  location      geography(POINT)  │  NOT NULL
│  hospital      text              │  ← optional human-readable location
│  callback_phone text             │  ← defaults to profile.phone
│  status        text  NOT NULL    │  ← 'open' | 'fulfilled' | 'expired'
│  radius_km     float DEFAULT 10  │
│  created_at    timestamptz       │
│  fulfilled_at  timestamptz       │
└──────────┬───────────────────────┘
           │ 1:many
           │
┌──────────▼───────────────────────┐
│ request_responses                │
│  id            uuid  PK          │
│  request_id    uuid  FK→blood_requests │
│  donor_id      uuid  FK→profiles │
│  status        text  NOT NULL    │  ← 'responding' | 'cancelled'
│  created_at    timestamptz       │
│  UNIQUE(request_id, donor_id)    │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ blood_compatibility  (lookup)    │
│  recipient_type  text  PK part   │  ← the type being requested
│  donor_types     text[]          │  ← all types that can donate TO recipient
│  PRIMARY KEY (recipient_type)    │
└──────────────────────────────────┘

-- Seed data (full ABO/Rh compatibility):
-- A+  ← ['A+','A-','O+','O-']
-- A-  ← ['A-','O-']
-- B+  ← ['B+','B-','O+','O-']
-- B-  ← ['B-','O-']
-- AB+ ← ['A+','A-','B+','B-','AB+','AB-','O+','O-']  (universal recipient)
-- AB- ← ['A-','B-','AB-','O-']
-- O+  ← ['O+','O-']
-- O-  ← ['O-']   (universal donor)
```

**Key design choices:**
- `blood_compatibility` is a static lookup table seeded once in a migration. Never hard-code the matrix in application code.
- `profiles.id` IS `auth.users.id` — no surrogate key indirection. Simplifies every RLS policy.
- `device_tokens` is separate from `profiles` so one user can have multiple tokens (reinstall, different browsers).
- `blood_requests.status` is the lifecycle gate: Edge Functions and UI should always filter on `status = 'open'`.

---

## Matching Mechanism

### Postgres RPC: `find_compatible_donors`

The matching query is a Postgres function called via `supabase.rpc()`. It is NOT implemented in JavaScript. All logic — blood compatibility join, PostGIS radius filter, donor availability filter — runs in the database.

```sql
CREATE OR REPLACE FUNCTION find_compatible_donors(
  p_request_id uuid
)
RETURNS TABLE (
  donor_id      uuid,
  donor_phone   text,
  distance_km   float
)
LANGUAGE sql
SECURITY DEFINER   -- runs as postgres owner, bypasses RLS for the match read
AS $$
  SELECT
    p.id                                                    AS donor_id,
    p.phone                                                 AS donor_phone,
    extensions.ST_Distance(
      p.location,
      r.location
    ) / 1000.0                                             AS distance_km
  FROM blood_requests r
  JOIN blood_compatibility bc ON bc.recipient_type = r.blood_type
  JOIN profiles p ON p.blood_type = ANY(bc.donor_types)
  WHERE
    r.id = p_request_id
    AND r.status = 'open'
    AND p.is_donor = true
    AND p.location IS NOT NULL
    AND extensions.ST_DWithin(
      p.location::extensions.geography,
      r.location::extensions.geography,
      r.radius_km * 1000   -- ST_DWithin takes metres
    )
  ORDER BY distance_km ASC;
$$;
```

**Why `SECURITY DEFINER`:** The Edge Function calls this as the `service_role` or via a signed internal call. Using `SECURITY DEFINER` lets the function read across profiles/requests without exposing an `authenticated` bypass in RLS. Alternatively, call from the Edge Function using the Supabase service-role client — either approach works; the key is that the fan-out query is not blocked by donor-visibility RLS.

**Spatial index (required for performance):**
```sql
CREATE INDEX idx_profiles_location   ON profiles   USING GIST (location);
CREATE INDEX idx_blood_requests_loc  ON blood_requests USING GIST (location);
```

---

## Push Trigger Without a Custom Backend

### The Mechanism: Database Webhook → Edge Function → FCM HTTP v1

This is the verified Supabase-native pattern (confirmed against official Supabase docs). No custom server is required.

```
[Client] INSERT INTO blood_requests
    │
    │ (Postgres commit)
    ▼
[pg_net Database Webhook]
  - Watches: blood_requests, event: INSERT
  - Fires: async HTTP POST to Edge Function URL
  - Payload: { type: "INSERT", record: { id, requester_id, blood_type, location, ... } }
  - Non-blocking: does not delay the INSERT response to the client
    │
    ▼
[Edge Function: notify-donors]  (Deno runtime)
  1. Verify webhook secret (header check)
  2. Extract request_id from payload
  3. Call find_compatible_donors(request_id) via service-role Supabase client
  4. SELECT fcm_token FROM device_tokens WHERE user_id IN (matched donor ids)
  5. Obtain FCM OAuth2 access token (sign JWT with Firebase service account)
  6. Loop: POST to FCM HTTP v1 API once per device token
  7. On 404/400 response: DELETE that device_token row (stale token cleanup)
    │
    ▼
[FCM HTTP v1 API]
  POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send
  Authorization: Bearer {short-lived-oauth2-token}
  Body: { message: { token: "{device_token}", notification: {...}, data: {...} } }
    │
    ▼
[Donor device]
  - Android: background push arrives, SW fires push event, OS notification shown
  - iOS: only works if PWA is installed to home screen (iOS 16.4+ web push)
```

### Where Firebase Credentials Live

**NEVER in source code or the client bundle.**

```
Storage location: Supabase Edge Function secrets
CLI command:     supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"-----BEGIN RSA...",...}'
Access in Deno:  const sa = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
```

The service account JSON from Firebase Console (Project Settings → Service Accounts → Generate new private key) is stored as a single JSON-stringified environment variable. The Edge Function parses it, signs a short-lived OAuth2 JWT, and exchanges it for an FCM access token. This token is valid for 1 hour; it should be obtained fresh on each Edge Function invocation (Edge Functions are stateless).

**FCM access token acquisition flow in the Edge Function:**
```
1. Build a JWT:
   header:  { alg: "RS256", typ: "JWT" }
   payload: {
     iss: service_account.client_email,
     sub: service_account.client_email,
     aud: "https://oauth2.googleapis.com/token",
     iat: now,
     exp: now + 3600,
     scope: "https://www.googleapis.com/auth/firebase.messaging"
   }
2. Sign with service_account.private_key (RSA-SHA256)
3. POST to https://oauth2.googleapis.com/token
   body: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: <jwt> }
4. Response: { access_token: "...", expires_in: 3600 }
5. Use access_token as Bearer in FCM calls
```

### Fan-out Note: One Request Per Token (FCM HTTP v1)

The legacy FCM batch multicast API was deprecated. The FCM HTTP v1 API does not support sending to multiple tokens in a single request. The Edge Function must loop and send one POST per token. For an emergency blood app at Myanmar scale (tens to low hundreds of donors in a radius), this is not a bottleneck — pg_net's 200 req/s limit and Deno's fetch are both more than sufficient. If future scale demands it, FCM Topics can replace the loop.

### Webhook Security

The Edge Function should be deployed with `verify_jwt = false` (it is called by pg_net, not by a user client). Instead, protect it with a shared secret:

```
Supabase webhook config: add header  x-webhook-secret: <random-uuid>
Edge Function:           check       req.headers.get('x-webhook-secret') === Deno.env.get('WEBHOOK_SECRET')
```

---

## Dummy Auth + Real RLS: The Resolution

### The Tension

The project uses a dummy OTP flow (no real SMS). The auth layer must still produce a stable user identity so RLS policies can function correctly, and so `profiles.id` can be tied to a user.

### The Answer: Supabase Anonymous Sign-In

`supabase.auth.signInAnonymously()` is the correct mechanism. It:

1. Creates a real row in `auth.users` with a real UUID
2. Returns a real JWT with `role: 'authenticated'` and `sub: <uuid>`
3. Sets `auth.uid()` to that UUID in all subsequent RLS evaluations
4. Marks the JWT with `is_anonymous: true` (usable in policies to restrict features)
5. Persists in `localStorage` — the same UUID survives page reloads

**The dummy OTP flow maps to this pattern:**
```
Phone Entry screen
  → User taps "Send OTP"
  → App calls supabase.auth.signInAnonymously()   ← actual auth happens here
  → 3-second timer shows OTP input
  → OTP auto-fills (dummy — any 6-digit value)
  → User taps "Verify"
  → App writes profile row (phone, blood_type) to profiles table
     using the now-established authenticated session
```

The OTP screen is purely cosmetic — the real identity is established by `signInAnonymously()` before the OTP is even shown. The app now has an authenticated session with a real UUID and `auth.uid()` works.

### RLS Policy Shape

**profiles table:**
```sql
-- Users can only read/write their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "user_insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "user_update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
```

**blood_requests table:**
```sql
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read open requests (donor sees them after notification)
CREATE POLICY "read_open_requests"
  ON blood_requests FOR SELECT
  TO authenticated
  USING (status = 'open');

-- Only the requester can insert
CREATE POLICY "insert_own_request"
  ON blood_requests FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = requester_id);

-- Only the requester can mark fulfilled
CREATE POLICY "requester_update_status"
  ON blood_requests FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = requester_id);
```

**request_responses table:**
```sql
ALTER TABLE request_responses ENABLE ROW LEVEL SECURITY;

-- Donors can insert their own response; requesters can read responses to their requests
CREATE POLICY "donor_insert_response"
  ON request_responses FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = donor_id);

CREATE POLICY "read_responses_for_own_request"
  ON request_responses FOR SELECT
  TO authenticated
  USING (
    donor_id = (SELECT auth.uid())
    OR request_id IN (
      SELECT id FROM blood_requests WHERE requester_id = (SELECT auth.uid())
    )
  );
```

**device_tokens table:**
```sql
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_manage_own_tokens"
  ON device_tokens FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
```

**Note on `(SELECT auth.uid())` vs `auth.uid()`:** Use `(SELECT auth.uid())` (the subquery form) in all `USING` clauses. This is a verified Supabase performance recommendation — it forces the function to be evaluated once per query rather than once per row, preventing catastrophic plan choices on large tables.

**The `find_compatible_donors` RPC uses `SECURITY DEFINER`** so it can read donor profiles across all users without needing RLS bypass in application code. Edge Functions that call it use the service-role client (bypasses RLS entirely) — this is safe because Edge Functions are not callable from the browser.

---

## Core Loop Data Flow

```
[Requester: Create Request]
     │
     │  supabase.rpc or .from('blood_requests').insert({
     │    requester_id: auth.uid(),
     │    blood_type: 'B-',
     │    location: ST_Point(lon, lat),
     │    status: 'open'
     │  })
     ▼
[Postgres: blood_requests INSERT]
     │
     │  RLS: insert_own_request passes (requester_id = auth.uid())
     │  Commit succeeds; row is live
     ▼
[Database Webhook fires] (async, does not block INSERT response to client)
     │
     │  pg_net HTTP POST → /functions/v1/notify-donors
     │  Payload: { record: { id, requester_id, blood_type, location, radius_km, ... } }
     ▼
[Edge Function: notify-donors]
     │
     │  1. Authenticate webhook secret
     │  2. supabase_admin.rpc('find_compatible_donors', { p_request_id: record.id })
     │     → returns [{donor_id, donor_phone, distance_km}, ...]
     │  3. supabase_admin.from('device_tokens')
     │       .select('fcm_token, user_id')
     │       .in('user_id', donor_ids)
     │  4. Get FCM access token (sign JWT with service account)
     │  5. for each token:
     │       POST https://fcm.googleapis.com/v1/projects/{pid}/messages:send
     │       body: { message: { token, notification: { title, body }, data: { request_id } } }
     │       if 404 or 400 → delete device_tokens row
     ▼
[FCM delivers to donor device]
     │
     │  Service worker push event fires
     │  self.registration.showNotification('Blood Needed Nearby', { body, data })
     ▼
[Donor sees OS notification]
     │
     │  Taps notification → PWA opens to /requests/{request_id}
     │  Reads request details; sees callback phone
     ▼
[Donor responds]
     │
     │  supabase.from('request_responses').insert({
     │    request_id, donor_id: auth.uid(), status: 'responding'
     │  })
     │  App dials callback_phone via tel: link
     ▼
[Requester sees response] (via Supabase Realtime subscription on request_responses)
     │
     │  supabase.channel('responses').on('postgres_changes', ...)
     ▼
[Requester marks fulfilled]
     │
     │  supabase.from('blood_requests')
     │    .update({ status: 'fulfilled', fulfilled_at: now() })
     │    .eq('id', request_id)
     │    .eq('requester_id', auth.uid())   -- RLS double-guard
     │
     │  Status change stops new notifications (Edge Function filters status = 'open')
```

---

## Recommended Project Structure

```
blood-help/
├── public/
│   ├── manifest.json              # PWA manifest (name, icons, display: standalone)
│   └── sw.js                      # Service worker: FCM push handler, install event
├── src/
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client singleton (anon key)
│   │   ├── firebase.ts            # Firebase app init + FCM getToken()
│   │   └── blood-compatibility.ts # Client-side copy for display only (RPC is truth)
│   ├── auth/
│   │   ├── useAuth.ts             # signInAnonymously + session state
│   │   └── AuthProvider.tsx       # Context; blocks render until session ready
│   ├── features/
│   │   ├── profile/               # Profile CRUD, donor toggle, location update
│   │   ├── requests/              # Create request, list open requests, mark fulfilled
│   │   ├── responses/             # Donor responds, realtime subscription
│   │   └── notifications/         # FCM token registration, permission prompt
│   ├── screens/                   # Screen-level components (wired from user's designs)
│   └── i18n/                      # en.json + my.json (Burmese)
└── supabase/
    ├── migrations/
    │   ├── 0001_profiles.sql
    │   ├── 0002_blood_requests.sql
    │   ├── 0003_request_responses.sql
    │   ├── 0004_device_tokens.sql
    │   ├── 0005_blood_compatibility_seed.sql
    │   ├── 0006_postgis_indexes.sql
    │   └── 0007_find_compatible_donors_rpc.sql
    └── functions/
        └── notify-donors/
            └── index.ts           # Edge Function (Deno)
```

---

## Build Order (What Must Exist Before What)

These are hard dependencies — building out of order creates blocked work:

| Step | Build | Requires | Rationale |
|------|-------|----------|-----------|
| 1 | Supabase project + anonymous auth enabled | Nothing | Foundation for all identity |
| 2 | `profiles` table + RLS | Auth | Every other table FK references profiles |
| 3 | `device_tokens` table + RLS | Profiles | FCM token storage needed before push works |
| 4 | PWA shell: manifest + service worker | Nothing | Can run in parallel with step 2-3 |
| 5 | FCM token acquisition in app | Service worker | Token needs SW to receive pushes |
| 6 | `device_tokens` upsert on app open | Profiles + device_tokens table | User must be authed before writing token |
| 7 | `blood_compatibility` seed + PostGIS | Supabase project | Needed before the RPC function is valid |
| 8 | `blood_requests` table + RLS | Profiles | Requesters must have profiles |
| 9 | `find_compatible_donors` RPC | blood_compatibility + PostGIS | RPC depends on lookup table and extension |
| 10 | `notify-donors` Edge Function + secret | RPC + device_tokens + FCM credentials | All data must exist to fan out |
| 11 | Database Webhook (INSERT on blood_requests → Edge Function) | Edge Function deployed | Webhook calls deployed function URL |
| 12 | `request_responses` table + RLS | Profiles + blood_requests | Donors respond to existing requests |
| 13 | Realtime subscription (requester watches responses) | request_responses table | Final loop closure |

**Critical path:** Steps 1 → 2 → 7 → 9 → 10 → 11 is the minimal path to a working push notification. Everything else can be wired incrementally.

---

## Architectural Patterns

### Pattern 1: Anonymous Session as Persistent Identity

**What:** Call `signInAnonymously()` on first app load. Store session in localStorage. All subsequent Supabase calls carry the authenticated JWT automatically.

**When to use:** Any v1 where you want real auth.uid()-based RLS without building a full auth flow.

**Trade-offs:** User loses their account if they clear localStorage or switch browsers. For v1 this is acceptable — the dummy OTP framing means users do not expect persistence across devices.

### Pattern 2: Webhook-triggered Edge Function for Server-side Logic

**What:** Database Webhook on INSERT → pg_net async HTTP POST → Edge Function (Deno). The client INSERT returns immediately; fan-out happens asynchronously.

**When to use:** Any side effect (push notifications, emails, external API calls) that must happen after a DB write but cannot block the write response.

**Trade-offs:** The fan-out is eventually consistent — it fires after commit, not within the transaction. If the Edge Function fails, there is no automatic retry built into pg_net. For v1, log failures in the Edge Function; add a dead-letter retry table later if needed.

### Pattern 3: SECURITY DEFINER RPC for Cross-User Reads

**What:** The matching query must read ALL donor profiles, not just the current user's. `SECURITY DEFINER` lets the function run with elevated privileges while RLS still protects direct table access from clients.

**When to use:** Any query that legitimately needs to read across user boundaries (matching, leaderboards, aggregations) without exposing a table-wide SELECT policy.

**Trade-offs:** `SECURITY DEFINER` functions can be abused if they accept unsanitised inputs. Always validate inputs inside the function (e.g., check that `p_request_id` belongs to a real open request).

---

## Anti-Patterns

### Anti-Pattern 1: Running the Match Query in the Client

**What people do:** Fetch all donors from Supabase to the browser, filter by blood type in JavaScript, calculate distances using Haversine in JS.

**Why it's wrong:** Leaks all donor location data to all clients. Defeats RLS. Scales poorly. Distances will be less accurate than PostGIS spherical calculations.

**Do this instead:** All matching logic in `find_compatible_donors` RPC with `SECURITY DEFINER`. Client only receives its own matches.

### Anti-Pattern 2: Using the Service Role Key in the Client Bundle

**What people do:** Import `SUPABASE_SERVICE_ROLE_KEY` into the React app (via `.env`) to bypass RLS for admin operations.

**Why it's wrong:** The service role key is visible in the browser bundle. Anyone can inspect it and make arbitrary database calls.

**Do this instead:** Service role key only inside Edge Functions (Deno env). Client uses anon key + anonymous session JWT + correct RLS policies.

### Anti-Pattern 3: Storing FCM Tokens Only in Memory

**What people do:** Call `getToken()` on app open, keep it in React state, never persist it.

**Why it's wrong:** FCM tokens change on reinstall, browser data clear, or after 270 days. If the token in your database is stale, pushes silently fail. The user is invisible to the matching fan-out.

**Do this instead:** Upsert to `device_tokens` table on every app open (unique constraint on `user_id, fcm_token` prevents duplicates). On FCM 404/400 error in Edge Function, delete the dead token row immediately.

### Anti-Pattern 4: Single Webhook Payload Contains All Fan-Out Logic

**What people do:** Put the full compatibility matrix and distance calculation in the Edge Function in TypeScript, querying raw donor rows and filtering in Deno.

**Why it's wrong:** Duplicates business logic. TypeScript haversine != PostGIS spheroid. Matrix encoded twice = drift risk.

**Do this instead:** Edge Function calls `find_compatible_donors` RPC. Postgres owns the matching; Edge Function owns the push transport. Clear boundary.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Firebase (FCM push delivery) | Edge Function POSTs to `https://fcm.googleapis.com/v1/projects/{pid}/messages:send` using OAuth2 Bearer token derived from service account JSON stored in Supabase secrets | Token expires in 1 hour; obtain fresh per Edge Function invocation |
| Supabase Auth (anonymous) | Client calls `supabase.auth.signInAnonymously()`; session persists in localStorage; JWT auto-attaches to all subsequent API calls | Enable Anonymous Sign-ins in Supabase Dashboard > Auth > Providers |
| PostGIS | Enable via Supabase Dashboard > Extensions; columns use `extensions.geography(POINT)`; functions call `extensions.ST_DWithin`, `extensions.ST_Distance`, `extensions.ST_Point` | Always use the `extensions.` prefix in Supabase-managed Postgres |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React PWA ↔ Supabase | Supabase JS client with anon key + session JWT | RLS enforced server-side; client cannot bypass |
| React PWA ↔ FCM | Firebase JS SDK (`getToken()` in SW context) | FCM token sent to Supabase, never directly to Edge Function |
| Database Webhook ↔ Edge Function | pg_net async HTTP POST with JSON payload + webhook secret header | Edge Function deployed with `verify_jwt = false`; secured by shared secret |
| Edge Function ↔ Supabase (admin) | Supabase JS client initialised with service_role key inside Deno | Safe: Edge Function environment is not accessible to browser |
| Edge Function ↔ FCM HTTP v1 | Deno `fetch()` with OAuth2 Bearer token | One POST per donor device token; prune 404/400 responses |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-5k users | Current architecture is sufficient. pg_net 200 req/s limit is never hit for blood emergencies (low frequency, small radius). |
| 5k-50k users | Add exponential backoff + retry queue if Edge Function FCM calls start failing under burst. Consider FCM Topics per city district as fan-out optimization. |
| 50k+ users | Replace Database Webhook + Edge Function with Supabase Queues (if available) or an external queue (e.g., Upstash Redis) for durable fan-out. PostGIS index performance remains strong up to millions of rows with GIST index in place. |

### Scaling Priorities

1. **First bottleneck:** FCM token fan-out in Edge Function if many donors match simultaneously — HTTP/2 multiplexing with Promise.allSettled mitigates. Not a concern at Myanmar v1 launch scale.
2. **Second bottleneck:** pg_net call rate if blood request creation surges — unlikely for an emergency app; events are low-frequency by nature.

---

## Sources

- [Database Webhooks | Supabase Docs](https://supabase.com/docs/guides/database/webhooks) — confirmed pg_net async pattern, payload format, INSERT trigger
- [Sending Push Notifications | Supabase Docs](https://supabase.com/docs/guides/functions/examples/push-notifications) — confirmed database webhook → Edge Function → FCM HTTP v1 pattern; service account storage in `service-account.json` / env secret
- [Anonymous Sign-Ins | Supabase Docs](https://supabase.com/docs/guides/auth/auth-anonymous) — confirmed auth.uid() returns real UUID for anonymous users; is_anonymous JWT claim
- [Supabase: Anonymous Sign-Ins blog post](https://supabase.com/blog/anonymous-sign-ins) — confirmed anonymous users get authenticated role (not anon role); RLS works normally
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — (SELECT auth.uid()) subquery performance pattern; policy shapes
- [Environment Variables | Supabase Docs](https://supabase.com/docs/guides/functions/secrets) — Deno.env.get(); JSON.parse() for multi-line secrets; supabase secrets set CLI
- [PostGIS: Geo queries | Supabase Docs](https://supabase.com/docs/guides/database/extensions/postgis) — geography(POINT) column type; ST_Distance; GIST index; RPC pattern
- [Best practices for FCM registration token management | Firebase](https://firebase.google.com/docs/cloud-messaging/manage-tokens) — 270-day expiry; 404/400 = delete token; update timestamp on app open
- [FCM HTTP v1 multicast / individual send](https://eladnava.com/send-multicast-notifications-using-node-js-http-2-and-the-fcm-http-v1-api/) — confirmed no batch endpoint in v1; must send one request per token; HTTP/2 multiplexing recommended for performance
- [Real-Time Push Notifications with Supabase Edge Functions and Firebase | Medium](https://medium.com/@vignarajj/real-time-push-notifications-with-supabase-edge-functions-and-firebase-581c691c610e) — implementation confirmation; ~1.5s delivery in testing

---
*Architecture research for: Blood Help — serverless emergency blood donor matching PWA*
*Researched: 2026-06-19*
