# Phase 7: Data Persistence + Geo-Matching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 7-Data Persistence + Geo-Matching
**Areas discussed:** Donor location & township, Request address mapping, Returning profile load + upsert, Duplicate-request & error UX

---

## Donor location & township

| Option | Description | Selected |
|--------|-------------|----------|
| GPS on save + township field | Add township field AND capture GPS on Save | |
| GPS on save only | Capture GPS, derive/leave township later | |
| Township field only | Township text field, no GPS at setup | |

**User's choice:** Free-text — store **GPS only** for donors; township NOT stored on the profile. Escalated into a schema redesign: split donor-only columns into a new `donors` table keyed by `profile_id`; remove `township` from `profiles`.
**Notes:** Reasoning was senior-architecture normalization — `profiles` should hold all users (requesters + donors) as identity; a separate `donors` table holds donor info with `profile_id` FK; a requester upgrades to donor by inserting a `donors` row. Avoids the sparse-row smell where requesters carry NULL donor columns.

| Option (showNumber mapping) | Description | Selected |
|--------|-------------|----------|
| emergency_callable | Map showNumber → emergency_callable | ✓ |
| App state only | Don't persist this phase | |

**User's choice:** `emergency_callable`.

| Option (is_donor) | Description | Selected |
|--------|-------------|----------|
| Existence of donors row | Drop the boolean; donor = row exists | ✓ |
| Keep is_donor flag | Keep boolean alongside donors row | |

**User's choice:** Existence of `donors` row.

| Option (donor location column) | Description | Selected |
|--------|-------------|----------|
| On donors table | lat/lng/location_updated_at on donors | ✓ |
| On profiles table | Keep on profiles for all users | |

**User's choice:** On the `donors` table.

**Location capture timing (free-text):** Donor → GPS prompt on registration Confirm; Requester → GPS prompt on submit (already built) + manual location text. Donor pre-permission flow must be added to `DonorProfileSetup` (currently only in `CreateRequest`).

---

## Request address mapping

| Option (rename scope) | Description | Selected |
|--------|-------------|----------|
| Both tables | Rename township → current_address on profiles + blood_requests | |
| profiles only | Rename only on profiles | |

**User's choice:** Free-text correction — `profiles` loses township entirely (no UI fills it); **only `blood_requests.township` is renamed to `current_address`**. The address field can hold a hospital name or township.

| Option (required?) | Description | Selected |
|--------|-------------|----------|
| Required | Mandatory current_address to post | ✓ |
| Keep optional | Leave optional | |

**User's choice:** Required.
**Notes:** It's the human-readable, donor-facing label requesters type so donors can locate them.

---

## Returning profile load + upsert

| Option | Description | Selected |
|--------|-------------|----------|
| Full hydration | Load profiles + donors into App state; Profile screen shows real data | ✓ |
| Minimal (form prefill only) | Load just enough to prefill edit form + route | |

**User's choice:** Full hydration.

| Option (Leaderboard) | Description | Selected |
|--------|-------------|----------|
| Defer Leaderboard | Leave on dummy data this phase | ✓ |
| Include Leaderboard | Query real donation_count now | |

**User's choice:** Defer Leaderboard.

---

## Duplicate-request & error UX

| Option (load active request) | Description | Selected |
|--------|-------------|----------|
| Yes, load active request | Query own status='active' request on restore | ✓ |
| No, in-memory only | Track open-request state only in memory | |

**User's choice:** Yes, load active request on restore.

| Option (duplicate action) | Description | Selected |
|--------|-------------|----------|
| Redirect to existing request | AlertDialog → take user to live request | |
| Block with error dialog | Show error, keep on form | |

**User's choice:** Free-text — neither. **Hide the "Request Blood" button** entirely when an active request exists, so the user can't attempt a second one. (DB unique index remains as a backstop.)

| Option (write failures) | Description | Selected |
|--------|-------------|----------|
| AlertDialog with retry | Reuse AlertDialog for errors | ✓ |
| Inline message near button | Inline error text | |

**User's choice:** AlertDialog with retry.

---

## Claude's Discretion

- Inverse "requests-near-donor" feed query (new RPC vs query) and where directional compatibility filtering runs (SQL vs JS) — must implement spec §3.1 directional matrix.
- Distance/time-ago formatting (incl. Burmese numerals); excluding the user's own request from their feed; whether availability gates the feed.
- `donor_code` generation (5-char Base32, unique) at `donors`-row creation; phone normalization to E.164; RLS policy SQL for the new `donors` table.

## Deferred Ideas

- Leaderboard wiring to real `donation_count` (counts stay 0 until Phase 9).
- Gated phone reveal + personal-data purge (v3 privacy).
- FCM push (v3).
- Cross-device session linking (v3).
