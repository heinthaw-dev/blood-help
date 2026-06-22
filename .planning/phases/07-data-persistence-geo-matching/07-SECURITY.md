---
phase: 07-data-persistence-geo-matching
status: secured
asvs_level: 1
threats_total: 19
threats_closed: 16
threats_accepted: 3
threats_open: 0
ratified_by: project-lead
ratified_at: 2026-06-23
---

# SECURITY.md — Phase 07: Data Persistence + Geo-Matching

**Audit date:** 2026-06-22
**Phase:** 07-data-persistence-geo-matching (plans 07-01 through 07-04)
**ASVS Level:** 1
**Auditor:** gsd-security-auditor

---

## Threat Verification Summary

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-07-01 | EoP — INSERT/UPDATE another user's donors row | mitigate | CLOSED | DB: donors_insert_own / donors_update_own RLS WITH CHECK profile_id = auth.uid() confirmed live (07-01-SUMMARY acceptance check). Client upsert keyed by uid: src/App.tsx:372 `{ profile_id: uid ... }` with `{ onConflict: 'profile_id' }` |
| T-07-02 | Info Disclosure — reading others' donors rows | mitigate | CLOSED | DB: donors_select_own RLS USING profile_id = auth.uid() confirmed live. No SELECT-others policy. database.ts types expose no cross-user select path. |
| T-07-03 | Info Disclosure — requests_within_radius SECURITY DEFINER over-returning | mitigate | CLOSED | src/types/database.ts:316-332: returns only {id, requester_id, blood_type, current_address, contact_phone, units_needed, units_collected, urgency, status, created_at, expires_at, dist_meters}. No donor PII column. WHERE status='active' AND expires_at>now() enforced in DB function (confirmed in 07-01-SUMMARY migration step 7). |
| T-07-04 | Info Disclosure — donors_within_radius leaking donor phone | mitigate | CLOSED | src/types/database.ts:302-312: Returns {id, profile_id, blood_type, donation_count, lat, lng, dist_meters} — no phone/contact column. |
| T-07-05 | Spoofing — donor_code enumeration | accept | CLOSED | Accepted risk. 32^5 ≈ 33M space, not exposed in Phase 7. See accepted risks log below. |
| T-07-06 | Tampering — wrong compatibility matrix | mitigate | CLOSED | src/blood.ts:11-20: All 8 keys present. O- → all 8 types (universal donor). AB+ → ['AB+'] only. Values verified against spec §3.1. |
| T-07-07 | Info Disclosure — raw uncoarsened GPS written to DB | mitigate | CLOSED | src/screens/DonorProfileSetup.tsx:119: `coarsenCoordinates(res.lat, res.lng)` before onSave. src/screens/CreateRequest.tsx:176: same pattern. App.tsx handlers receive only pre-coarsened coordinates via DonorProfile.lat/lng and RequestDraft.lat/lng. handleAvailableChange and handleEmergencyChange do NOT write lat/lng — only boolean fields are sent. |
| T-07-08 | Tampering — double-submit two active requests | mitigate | CLOSED | UI gate: src/App.tsx:539 `hasOpenRequest={requestDraft !== null}` — hydrated from DB on session restore (src/App.tsx:196-208). DB backstop: src/App.tsx:323 `if (error.code === "23505")` → duplicate AlertDialog. |
| T-07-09 | EoP — writing profiles/donors for another user | mitigate | CLOSED | src/App.tsx:350,372: both upserts keyed by `uid = user.supabaseId` (session user). RLS WITH CHECK profile_id=auth.uid() and id=auth.uid() enforce server-side. |
| T-07-10 | DoS/integrity — unhandled write error crashes app | mitigate | CLOSED | All DB calls use `{data, error}` destructuring. src/App.tsx: profileErr (line 361), donorErr (line 386), error in handlePosted (line 322) all surface via setWriteError AlertDialog. No throw statements. |
| T-07-11 | Info Disclosure — feed exposing donor phone/private data | mitigate | CLOSED | requests_within_radius returns only requester-side columns (confirmed T-07-03). No donor row queried in feed path. contact_phone is the requester's own number, intentionally shown per spec §3.4. |
| T-07-12 | Tampering — incompatible/own request shown | mitigate | CLOSED | src/screens/Home.tsx:242-243: `.filter(r => r.requester_id !== currentUserId)` and `.filter(r => COMPATIBLE_REQUEST_TYPES[donorBloodType].includes(r.blood_type))` both applied before setRequests. |
| T-07-13 | DoS — RPC null coords → broken feed | mitigate | CLOSED | src/screens/Home.tsx:225-230: Explicit null/undefined check for donorLat, donorLng, and donorBloodType before RPC call — returns early with setRequests([]) (empty state). |
| T-07-14 | Tampering — request posted with blank address | mitigate | CLOSED | src/screens/CreateRequest.tsx:52: `postDisabled = !bloodType \|\| phone.replace(/\D/g, '').length === 0 \|\| address.trim().length === 0`. Button disabled at line 398. |
| T-07-SC | Tampering — supply chain (installs) | accept | CLOSED | No new runtime packages added in Phase 7. See accepted risks log below. |

**Threats closed:** 15/15

---

## New Attack Surface — Post-Plan Auth Rebuild

The following threats arise from the deterministic phone-keyed auth scheme that was introduced **after** the plan-time threat model was authored. They are not covered by T-07-01 through T-07-SC.

### AUTH-01 — Credential Derivability (OPEN BLOCKER)

**Category:** Spoofing / Elevation of Privilege

**Surface:** `derivePassword()` in src/App.tsx:99-105 derives a Supabase password as `SHA-256("bloodhelp-auth-v1:" + e164)`. The pepper string `"bloodhelp-auth-v1:"` is shipped in the client JavaScript bundle. Anyone who knows a target user's phone number and this scheme (which is publicly readable in the shipped bundle) can compute the exact Supabase password and call `signInWithPassword` to impersonate that user.

**Impact:** Full account takeover for any user whose phone number is known — which in a blood-request app is the entire requester population (contact_phone is shown on every request card). Compromised session grants access to the user's profile, donors row, and all RLS-protected data.

**Accepted as prototype risk?** The code comments at src/App.tsx:96-97 acknowledge this: "NOTE: this is prototype-grade identity (anyone knowing the scheme + phone could log in) and will be replaced by real server-verified OTP in a later auth-hardening phase." This constitutes documented intent but NOT a formal accepted-risk entry.

**Classification:** ACCEPTED (ratified by project lead 2026-06-23) — logged in Accepted Risks Log as AUTH-01-ACCEPTED. Remediation = real server-verified OTP auth-hardening phase. Constraint: app stays in private/test deployment (no public users) until hardened.

---

### AUTH-02 — Open Signup (Account Squatting)

**Category:** Tampering / Spoofing

**Surface:** src/App.tsx:255 `supabase.auth.signUp({ email, password })` — because email confirmation is disabled in the Supabase project, any caller can register a Supabase account for any phone number before the legitimate user does, thereby claiming that uid. The legitimate user's subsequent signUp call would fail (email already taken), leaving them locked out. The legitimate user cannot override the squatted account because signInWithPassword would succeed for the attacker using the same derived password.

**Note:** This threat is partially collapsed into AUTH-01 — once an attacker can derive the password, they can sign in to an already-registered account (not just squat new ones). However, the open-signup path is a separate vector: race condition between first use and adversarial registration.

**Classification:** ACCEPTED (ratified by project lead 2026-06-23) — logged as AUTH-02-ACCEPTED. Remediation = real OTP verification before signUp is allowed (auth-hardening phase). Constraint: private/test deployment only until hardened.

---

### AUTH-03 — Phone Enumeration via profile_id_by_phone RPC

**Category:** Information Disclosure

**Surface:** A `profile_id_by_phone(text)` SECURITY DEFINER function is present in the DB and is GRANTed to both `authenticated` and `anon` roles (confirmed in db_facts). It returns a profile UUID for any phone number. It is no longer called by the client (confirmed: grep returns no call site in src/), but it remains callable by any browser with the public anon key. An attacker can enumerate whether a given phone is registered by calling this RPC.

**Impact at ASVS Level 1:** Phone enumeration enables targeted social engineering or allows an attacker to confirm that a victim uses the app before mounting an AUTH-01 attack. At pre-production prototype level this is lower urgency than AUTH-01/AUTH-02, but the function is unnecessary for the current feature set.

**Recommended action:** DROP FUNCTION public.profile_id_by_phone or REVOKE EXECUTE from anon and authenticated until a legitimate use case is implemented with proper access controls.

**Classification:** CLOSED — FIXED 2026-06-23. Migration `drop_unused_profile_id_by_phone` dropped the function entirely (it was dead code — deterministic phone-keyed auth made the lookup obsolete). Stale type entry also removed from src/types/database.ts. Enumeration surface eliminated.

---

### AUTH-04 — OTP Bypass (Prototype Dummy OTP)

**Category:** Spoofing

**Surface:** The OTP flow (`src/screens/OtpVerification.tsx`) is a dummy — any 6-digit code is accepted. There is no server-side SMS verification. The auth-hardening phase has not yet been implemented.

**Status:** This was documented as a consciously accepted prototype risk in the project context ("Dummy OTP (any code accepted). Real server-verified OTP is a PLANNED later auth-hardening phase — the team has consciously accepted prototype-grade identity for this milestone") — but there is no explicit entry in SECURITY.md. Per audit config this must be documented as an accepted risk with a remediation path to carry forward.

**Classification:** ACCEPTED (ratified by project lead 2026-06-23) — logged as AUTH-04-ACCEPTED. Remediation = Supabase Auth phone OTP (or equivalent) in the auth-hardening phase. Constraint: private/test deployment only until hardened.

---

## Accepted Risks Log

| Risk ID | Category | Description | Remediation Path | Accepted By |
|---------|----------|-------------|-----------------|-------------|
| T-07-05 | Spoofing | donor_code enumeration — 32^5 ≈ 33M space, UNIQUE constraint, not exposed in Phase 7 | Revisit in Phase 9 when donor_code is used for direct contact | Plan-time decision |
| T-07-SC | Tampering | No new npm packages in Phase 7 — no supply chain surface introduced | N/A for this phase | Plan-time decision |
| AUTH-01-ACCEPTED | Spoofing/EoP | Deterministic SHA-256 password derivable from phone + public pepper string. Account takeover possible for any known phone number. This is explicitly prototype-grade. | Replace with real server-verified OTP (Supabase Auth + Twilio/local SMS) in the auth-hardening phase. Pepper string must be replaced with a server secret. Until then this system must not be exposed to the public. | **Project lead, ratified 2026-06-23** |
| AUTH-02-ACCEPTED | Tampering/Spoofing | Open signup (email confirmation disabled) allows account squatting — anyone can pre-register a victim's synthetic email. | Gate account creation behind real OTP verification in the auth-hardening phase. | **Project lead, ratified 2026-06-23** |
| AUTH-04-ACCEPTED | Spoofing | Dummy OTP accepts any 6-digit code — no server-side SMS verification. | Replace with Supabase Auth phone OTP (or equivalent) in the auth-hardening phase. | **Project lead, ratified 2026-06-23** |

**Deployment constraint (condition of acceptance):** while AUTH-01/02/04 remain accepted, the app must stay in private/test deployment only — no public/real users — until the auth-hardening phase ships real server-verified OTP.

---

## Unregistered Flags

| Flag ID | Surface | Severity | Notes |
|---------|---------|----------|-------|
| AUTH-03 | `profile_id_by_phone` SECURITY DEFINER RPC — callable by anon+authenticated, not used by client | ~~WARNING~~ **CLOSED** | FIXED 2026-06-23 via migration `drop_unused_profile_id_by_phone` — function dropped, type entry removed. Enumeration surface eliminated. |

---

## Security Audit 2026-06-23

| Metric | Count |
|--------|-------|
| Plan-time threats verified closed | 15 |
| New auth-surface threats found | 4 (AUTH-01/02/03/04) |
| Fixed this session | 1 (AUTH-03 — RPC dropped) |
| Accepted (project-lead ratified) | 3 (AUTH-01/02/04, prototype risks, real-OTP remediation) |
| **Open** | **0** |

**Disposition:** Phase 7 threat-secure. The three accepted auth risks are conscious prototype trade-offs with a defined remediation (the planned real-OTP auth-hardening phase) and a deployment constraint (private/test only until then).

---

## Implementation Files (READ-ONLY — no changes made)

- src/App.tsx
- src/screens/DonorProfileSetup.tsx
- src/screens/CreateRequest.tsx
- src/screens/Home.tsx
- src/geolocation.ts
- src/blood.ts
- src/lib/supabase.ts
- src/types/database.ts
