# Blood Help — System Specification

A free, non-profit Progressive Web App that connects people who urgently need blood
with nearby compatible donors, so a donor can be reached within minutes. Built for
Myanmar / Southeast Asia, Burmese-first, privacy-conscious.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React (Vite) + TailwindCSS | Design tokens in Tailwind config (primary `#D13E2F`) |
| App shell | PWA | Installable, single merged service worker, iOS standalone gate for push |
| Backend / DB | Supabase (Postgres) | Auth, Row-Level Security, Edge Functions, scheduled jobs (pg_cron) |
| Realtime | Supabase Realtime (websockets) | Live donor list, donor congrats-on-scan |
| Push | Firebase Cloud Messaging (FCM) | Donor alerts, requester response notices, resolution notices |
| Auth | Phone + OTP | Dummy OTP in v1 (auto-fill); real SMS later |
| Localization | i18n (`my` default, `en` secondary) | Noto Sans Myanmar (Unicode), E.164 phone format |
| Geo | Browser Geolocation (foreground only) | Coarse storage; no background tracking |
| Confirmation | QR + 5-char donor code | Scan or manual fallback |
| Later (v2) | One-time QR, call masking (telephony proxy), real SMS OTP/fallback | |

**Key constraint:** a PWA cannot read location in the background. Requester location
is captured live at request time; donor location is "last-known," refreshed
opportunistically (app open, availability toggle, push tap).

---

## 2. User Flow

### 2.1 Auth & onboarding (shared)
1. Phone number entry → 2. OTP verify → 3. Intent: "What do you need now?"
   → "I need blood" or "I want to donate." This routes the first action only; a
   single user can do both later.

The language toggle (မြန်မာ / ENG, Burmese default) appears on all pre-login /
onboarding screens; afterward it lives in Profile settings.

### 2.2 Donor path
1. Register donor profile: name, blood type, township, availability,
   "let requesters call me directly in an emergency" opt-in.
2. **Thank-you screen** (heart-warming confirmation) → continue to Home.
3. Home (donor view): nearby blood requests feed, leaderboard, profile.
   - Profile shows the donor's **QR + 5-char code**, availability toggle,
     emergency-callable toggle, language, last donation date, donation count, logout.
4. Respond to a request (via FCM push or the nearby-requests feed):
   tap **"I'll help"** → call the requester (or be called) → meet in person.
5. At the meeting, donor shows their QR (or 5-char code) for the requester to scan.
6. On confirmation, donor sees a **congratulations screen** (delivered via Realtime,
   with on-open + FCM fallback).

### 2.3 Requester path
1. Create request: blood type **needed**, location (live GPS), contact phone,
   units needed, urgency.
2. **One open request per user** — cannot open a second while one is active.
3. **Request-live screen** (the session view):
   - Header: blood type, township, "Mark as fulfilled."
   - Transparency line: "We've alerted [X] nearby donors. Anyone who taps 'I'll help'
     appears here with a call button."
   - Donor list, realtime, three states:
     - **Will help** (green, pinned top) — donor responded; name, distance, number
       shown, call button.
     - **Can call** (neutral) — opted-in donor, not yet responded; call button reveals
       and dials on tap (gated + logged).
     - **+ [Y] more nearby donors notified** — single muted line, no names.
   - Updates every time the requester opens the app.
4. Minimize: requester can leave the live screen → Home shows an **info card** with the
   latest donor activity; tapping it re-opens the live screen.
5. The session persists in the backend until fulfilled or 24h expiry — the requester
   does not need to watch the screen. They get an **FCM push whenever a donor responds.**
6. **Close / resolve:** tap close → "Did you get blood from the app or outside?"
   - **Outside** → close session, purge personal data.
   - **Inside** → scan the donor's QR (or type the 5-char code; only valid for donors
     who responded to *this* request). On confirm:
     - donation recorded; donor `donation_count++`, `last_donation_date` updated;
     - request `units_collected++`;
     - if `units_collected >= units_needed` → fulfilled & closed; otherwise the
       session stays open and keeps searching for the remaining units.
7. On close, **only the donors who tapped "I'll help"** receive a resolution notice
   ("no longer needed — thank you") so no one travels for nothing.

---

## 3. Matching & Notification Logic

### 3.1 Blood compatibility (directional)
Match donors who can donate **into** the requested type — never exact-match only.

| Recipient needs | Compatible donor types |
|---|---|
| O− | O− |
| O+ | O−, O+ |
| A− | O−, A− |
| A+ | O−, O+, A−, A+ |
| B− | O−, B− |
| B+ | O−, O+, B−, B+ |
| AB− | O−, A−, B−, AB− |
| AB+ | everyone |

### 3.2 Location & radius
- Requester: live GPS captured at request creation.
- Donor: coarse last-known location + `location_updated_at`; refreshed on app open,
  availability toggle, and push tap. Prompt "update your area" when it changes.
- Match: request's live location vs each donor's last-known location, within a radius.
- Two radii (configurable): `ALERT_RADIUS_KM` (broad, default ~25, who gets pushed) and
  `DISPLAY_RADIUS_KM` (starts ~10, expands when sparse, who shows on the list).

### 3.3 Push targeting
- One broad FCM push to: compatible (3.1) + available + last-known within alert radius.
- Not in expanding waves. Widen radius once as a fallback if zero matches.
- Optionally widen for rare types (O−, AB−).
- No alerts for fulfilled/expired requests; prune stale tokens.

### 3.4 Privacy guardrails
- Store location coarsened (rounded / grid-snapped); never send raw GPS to clients.
- Donor numbers never printed in lists; revealed only on intentional tap (logged,
  rate-limited) and only for opted-in or responding donors. Requester number is
  shown to matched donors (they want to be reached).
- Purge personal data (location, phone, responder rows) when a request closes — both
  paths. Keep only the minimal `donations` record.

---

## 4. Data Model (Supabase / Postgres)

```sql
-- ENUMS
create type blood_type      as enum ('A+','A-','B+','B-','O+','O-','AB+','AB-');
create type request_status  as enum ('active','fulfilled','cancelled','expired');
create type response_status as enum ('responding','declined');
create type urgency         as enum ('urgent','today');
create type lang            as enum ('my','en');

-- PROFILES (one row per user; donor and requester are the same person)
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text,
  phone               text,
  blood_type          blood_type,
  donor_code          text unique,            -- 5-char Base32 (QR + manual fallback)
  is_donor            boolean default false,  -- finished donor setup
  is_available        boolean default true,
  emergency_callable  boolean default false,  -- "let requesters call me in an emergency"
  donation_count      int default 0,          -- confirmed donations (leaderboard)
  last_donation_date  date,
  available_after     date,                   -- soft cooldown (v1: reminder only)
  township            text,                   -- coarse; display + GPS-denied fallback
  lat                 double precision,       -- approx, coarsened, last-known
  lng                 double precision,
  location_updated_at timestamptz,            -- freshness of last-known location
  language            lang default 'my',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- DEVICE TOKENS (FCM; a user may have several devices)
create table device_tokens (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  fcm_token   text not null unique,
  platform    text,                            -- 'android' | 'ios' | 'web'
  created_at  timestamptz default now()
);

-- BLOOD REQUESTS (the persistent "session")
create table blood_requests (
  id              uuid primary key default gen_random_uuid(),
  requester_id    uuid not null references profiles(id) on delete cascade,
  blood_type      blood_type not null,         -- type NEEDED
  township        text not null,
  lat             double precision,
  lng             double precision,
  hospital_name   text,
  contact_phone   text not null,
  units_needed    int not null default 1,
  units_collected int not null default 0,
  urgency         urgency,
  note            text,
  status          request_status default 'active',
  alerted_count   int default 0,               -- total donors pushed (the [X] line)
  created_at      timestamptz default now(),
  expires_at      timestamptz not null,        -- 24h auto-expiry
  closed_at       timestamptz
);

-- One OPEN request per user (REQ-04)
create unique index one_open_request_per_user
  on blood_requests (requester_id) where status = 'active';

-- REQUEST RESPONSES (participants who acted: responders + decliners)
create table request_responses (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references blood_requests(id) on delete cascade,
  donor_id    uuid not null references profiles(id) on delete cascade,
  status      response_status not null default 'responding',
  created_at  timestamptz default now(),
  unique (request_id, donor_id)
);

-- DONATIONS (confirmed via QR / 5-char code; powers count + leaderboard)
create table donations (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid references blood_requests(id) on delete set null,
  donor_id      uuid not null references profiles(id) on delete cascade,
  recipient_id  uuid references profiles(id) on delete set null,
  blood_type    blood_type,
  confirmed_via text,                          -- 'qr' | 'manual'
  donated_on    date default current_date,
  created_at    timestamptz default now()
);
```

### 4.1 What is persisted vs computed live
- **Persisted:** the request (session), and `request_responses` rows — created the
  moment a donor acts (responds / declines) or the requester reveals/calls them. These
  stay on the requester's list until the request closes.
- **Computed live on read:** the "Can call" nearby pool and the alerted count
  (stored as a single `alerted_count` number, not per-donor rows) — so the list stays
  fresh and there's no permanent "who-was-near-whom" trail.

### 4.2 Server-side logic (triggers / Edge Functions / cron)
- **On donation confirm (QR or 5-char):** create `donations` row → `donation_count++`,
  set `last_donation_date`, set soft `available_after`; `units_collected++`; if
  `units_collected >= units_needed` → status `fulfilled`, set `closed_at`, stop FCM.
  *Manual code entry is only valid for a donor who is a `responding` participant on
  this request* (v1 anti-fraud guardrail until one-time QR ships in v2).
- **On close (fulfilled / cancelled):** FCM resolution notice to `responding` donors
  only; purge personal data (location, phone, responder rows), keep `donations`.
- **On donor response:** FCM push to the requester (so they can leave the live screen).
- **Donor congrats:** donor's client subscribes via Realtime to its own new `donations`
  row → shows congrats; fallback = check-on-app-open + a backup FCM push.
- **Scheduled (pg_cron / scheduled Edge Function):** flip `active → expired` where
  `expires_at < now()`, and notify that request's responders.

### 4.3 Row-Level Security (high level)
- Users read/write their own profile; others see only public fields (name, blood type,
  township, donation count for the leaderboard).
- A request is visible to compatible nearby donors; `contact_phone` exposed to matched
  donors only.
- A donor's `phone` is never sent to clients; reachability is via reveal-on-tap, gated
  by `emergency_callable` or an active response.
- Responses and donations are visible only to the two parties involved.

---

## 5. Privacy & Safety Notes
- Data minimization is the prime directive: store coarse location, never raw GPS;
  purge personal data on close.
- Designed for a context where the backend could be a target — keep no trail you
  don't need.
- Gated, logged, rate-limited phone reveals to prevent number harvesting / scam abuse.

---

## 6. Scope: v1 vs Later

| Area | v1 | Later (v2) |
|---|---|---|
| Auth | Dummy OTP (auto-fill) | Real SMS OTP |
| Donation confirm | Static QR + 5-char code, participant-only crediting | One-time, request-scoped QR |
| Reachability | Reveal-on-tap (gated/logged) | Call masking via telephony proxy |
| Alerts | FCM push only | + SMS fallback for reliability |
| Cooldown | Soft reminder (`available_after`, data only) | Optional enforcement |

---

## 7. End-to-end loop (summary)
`request → directional match → broad push → respond ("I'll help") → requester
notified → meet → QR / 5-char confirm → donor credited + congrats → units check →
close → responders notified → personal data purged.`
