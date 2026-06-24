---
phase: quick-260624-vxw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/database.ts
  - src/screens/RequestLive.tsx
autonomous: true
requirements: [QUICK-VXW-01]
must_haves:
  truths:
    - "When a requester opens RequestLive, donors with emergency_callable=true AND is_available=true who are blood-compatible and within 10km appear immediately — before tapping 'I'll help'"
    - "Each callable donor row shows blood type, name, distance, and a tappable tel: call button with the donor's phone"
    - "A callable donor who also taps 'I'll help' appears only once (in the Will Help list, not duplicated in the callable section)"
    - "A non-owner calling callable_donors_for_request gets zero rows (no phone leak)"
    - "Donors with emergency_callable=false never appear in the callable section"
  artifacts:
    - path: "src/types/database.ts"
      provides: "callable_donors_for_request entry in Functions"
      contains: "callable_donors_for_request"
    - path: "src/screens/RequestLive.tsx"
      provides: "Callable donors section + fetch effect"
      contains: "callable_donors_for_request"
  key_links:
    - from: "src/screens/RequestLive.tsx"
      to: "callable_donors_for_request"
      via: "supabase.rpc inside useEffect gated on requestId + currentUserId"
      pattern: "rpc\\(\\s*'callable_donors_for_request'"
    - from: "callable_donors_for_request RPC"
      to: "donors + profiles"
      via: "SECURITY DEFINER join with owner guard on blood_requests.requester_id"
      pattern: "requester_id = \\(SELECT auth.uid\\(\\)\\)"
---

<objective>
Make emergency-callable donors visible on the requester's RequestLive screen the instant a blood request is posted — without waiting for the donor to tap "I'll help". A new owner-scoped SECURITY DEFINER RPC returns compatible, available, within-radius donors flagged `emergency_callable=true`, and RequestLive renders them in a new "Available to Call" section above the existing Will-Help responder list, each with a direct tel: call button.

Purpose: Closes the gap where a sleeping/idle donor who opted into emergency calls cannot be reached. Turns "wait for a tap" into "call right now".
Output: New `callable_donors_for_request` RPC (deployed via Supabase MCP), regenerated DB types, and a new inline UI section in RequestLive.tsx.
</objective>

<execution_context>
@/Users/bhoneak/Desktop/Learning/VibeCodeTour/blood-help-old/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.claude/skills/frontend-design/SKILL.md
@src/screens/RequestLive.tsx
@src/types/database.ts
@src/blood.ts
@src/format.ts

<interfaces>
<!-- Contracts the executor needs. Mirror the existing responders_for_request RPC + ResponderRow exactly. -->

Existing RPC pattern to mirror (from 08-01-PLAN.md, deployed and live):
- `CREATE OR REPLACE FUNCTION public.responders_for_request(p_request_id uuid)`
- `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = ''`
- Owner guard: `SELECT r.lat, r.lng INTO ... FROM public.blood_requests r WHERE r.id = p_request_id AND r.requester_id = (SELECT auth.uid()); IF NOT FOUND THEN RETURN; END IF;`
- Distance via PostGIS, every PostGIS identifier `extensions.`-prefixed because search_path is empty: `extensions.st_distance(extensions.st_point(d.lng, d.lat)::extensions.geography, extensions.st_point(v_lng, v_lat)::extensions.geography)`
- `GRANT EXECUTE ON FUNCTION public.responders_for_request(uuid) TO authenticated;` — never anon

Frontend types already in RequestLive.tsx:
```typescript
interface ResponderRow {
  donor_id: string
  name: string
  phone: string
  dist_meters: number | null
  created_at: string
}
const [responders, setResponders] = useState<ResponderRow[]>([])
```

Existing fetch effect gating (Pitfall 2 — gate on BOTH ids):
```typescript
useEffect(() => {
  if (!requestId || !currentUserId) return
  // ... supabase.rpc('responders_for_request', { p_request_id: requestId })
}, [requestId, currentUserId])
```

Helpers already imported in RequestLive.tsx: `CallButton` (local component, takes `href`), `Badge` (from ../components/Badge, `<Badge>{bloodType}</Badge>`), `formatDistanceLabel(distMeters, lang)` and `formatPhone(e164)` from ../format.

Directional compatibility (src/blood.ts): `COMPATIBLE_REQUEST_TYPES[donorType].includes(requestType)` — donor can donate INTO requestType. The SQL CASE in the task uses the inverse (requested type → array of donor types that can serve it); both express the same truth.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create callable_donors_for_request RPC + regen types</name>
  <files>src/types/database.ts</files>
  <action>
Deploy a new owner-scoped SECURITY DEFINER RPC via Supabase MCP `apply_migration` (migration name: `callable_donors_for_request`). Mirror the existing `responders_for_request` function exactly for the security pattern — do NOT invent a new style.

Signature: `CREATE OR REPLACE FUNCTION public.callable_donors_for_request(p_request_id uuid)` RETURNS TABLE (`donor_id uuid, name text, phone text, blood_type text, dist_meters double precision`). Use `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = ''`.

Body:
1. Declare locals: `v_lat double precision; v_lng double precision; v_blood_type public.blood_type;`.
2. Owner guard (identical pattern to responders_for_request): `SELECT r.lat, r.lng, r.blood_type INTO v_lat, v_lng, v_blood_type FROM public.blood_requests r WHERE r.id = p_request_id AND r.requester_id = (SELECT auth.uid()); IF NOT FOUND THEN RETURN; END IF;` This is the only thing preventing a cross-user phone leak — a non-owner gets zero rows with no existence disclosure.
3. `RETURN QUERY SELECT d.profile_id AS donor_id, p.name, p.phone, d.blood_type::text AS blood_type, extensions.st_distance(d.geog, extensions.st_makepoint(v_lng, v_lat)::extensions.geography) AS dist_meters FROM public.donors d JOIN public.profiles p ON p.id = d.profile_id WHERE d.emergency_callable = true AND d.is_available = true AND d.profile_id <> (SELECT auth.uid()) AND d.blood_type = ANY (compatible_types) AND extensions.st_dwithin(d.geog, extensions.st_makepoint(v_lng, v_lat)::extensions.geography, 10000) ORDER BY dist_meters NULLS LAST;`

   Where `compatible_types` is computed from the requested type `v_blood_type` via a CASE expression returning `public.blood_type[]` — donor types that can donate INTO the requested type:
   - 'AB+' -> ARRAY['O-','O+','A-','A+','B-','B+','AB-','AB+']
   - 'AB-' -> ARRAY['O-','A-','B-','AB-']
   - 'A+'  -> ARRAY['O-','O+','A-','A+']
   - 'A-'  -> ARRAY['O-','A-']
   - 'B+'  -> ARRAY['O-','O+','B-','B+']
   - 'B-'  -> ARRAY['O-','B-']
   - 'O+'  -> ARRAY['O-','O+']
   - 'O-'  -> ARRAY['O-']
   - ELSE  -> ARRAY[]::public.blood_type[]
   Cast every array literal as `::public.blood_type[]`. Inline the CASE directly in the WHERE clause (`d.blood_type = ANY (CASE v_blood_type WHEN 'AB+' THEN ... END)`) or compute into a local before RETURN QUERY — either is fine.

CRITICAL constraints (search_path is empty, so unqualified names will fail):
- Every PostGIS function/cast MUST be `extensions.`-prefixed: `extensions.st_distance`, `extensions.st_dwithin`, `extensions.st_makepoint`, `::extensions.geography`.
- `d.geog` is the existing PostGIS geography column on donors — use it directly; do NOT reconstruct a point from d.lat/d.lng.
- Construct the request point from the request's lat/lng: `extensions.st_makepoint(v_lng, v_lat)::extensions.geography` (note lng,lat order).
- All table/type names schema-qualified: `public.donors`, `public.profiles`, `public.blood_requests`, `public.blood_type`.

After the function: `GRANT EXECUTE ON FUNCTION public.callable_donors_for_request(uuid) TO authenticated;` — GRANT to `authenticated` only, never `anon`. SECURITY DEFINER is mandatory because RLS blocks cross-user reads of profiles.phone.

Then run Supabase MCP `generate_typescript_types` and replace `src/types/database.ts` with the regenerated output. Verify the new `callable_donors_for_request` entry appears under `Functions` with Args `{ p_request_id: string }` and the Returns shape above. Do not hand-edit beyond pasting the regenerated file.
  </action>
  <verify>
    <automated>grep -q "callable_donors_for_request" /Users/bhoneak/Desktop/Learning/VibeCodeTour/blood-help-old/src/types/database.ts && grep -q "p_request_id" /Users/bhoneak/Desktop/Learning/VibeCodeTour/blood-help-old/src/types/database.ts && echo OK</automated>
  </verify>
  <done>RPC deployed via apply_migration (no SQL error); src/types/database.ts contains a callable_donors_for_request Functions entry with Args {p_request_id} and Returns donor_id/name/phone/blood_type/dist_meters. A non-owner test call (if exercised) returns zero rows.</done>
</task>

<task type="auto">
  <name>Task 2: Render the "Available to Call" section in RequestLive</name>
  <files>src/screens/RequestLive.tsx</files>
  <action>
Add the callable-donors feature inline in RequestLive.tsx. No new component files — render inline, reusing the existing `CallButton`, `Badge`, and `formatDistanceLabel`/`formatPhone`.

1. New interface near `ResponderRow`:
   `interface CallableDonorRow { donor_id: string; name: string; phone: string; blood_type: string; dist_meters: number | null }`

2. New state near the responders state:
   `const [callableDonors, setCallableDonors] = useState<CallableDonorRow[]>([])`

3. New useEffect, mirroring the existing responders fetch effect's gating and cleanup pattern (Pitfall 2 — gate on BOTH ids). This is a fetch-once-on-mount effect (no realtime subscription needed for this scope):
   - `if (!requestId || !currentUserId) return`
   - `let cancelled = false`
   - inner async fn calls `supabase.rpc('callable_donors_for_request', { p_request_id: requestId as string })`; on `error || cancelled` return; else `setCallableDonors(data ?? [])`
   - call it once; cleanup sets `cancelled = true`
   - deps: `[requestId, currentUserId]`

4. Compute the de-duplicated list (a donor who already tapped "I'll help" lives in `responders` and must NOT appear twice):
   `const visibleCallable = callableDonors.filter(d => !responders.find(r => r.donor_id === d.donor_id))`

5. New UI section in the scrollable body (the `.bh-scroll` div), rendered ABOVE the existing "Will-Help donor list OR calm empty state" block — i.e., insert it just before the `<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>` that wraps the responders list. Render nothing when `visibleCallable.length === 0` (the whole section is hidden).
   - Section header row: bilingual, neutral/secondary tone (this is "Can call" = neutral grey per the design skill, not the green "Will help" treatment). Burmese: "ခေါ်ဆိုနိုင်သောသွေးလှူရှင်များ", English secondary line: "Available to Call". Use `var(--font-burmese)`, `var(--text-primary)` for the Burmese line and `var(--text-hint)` for the English subline, matching existing header typography sizes.
   - Map `visibleCallable` to rows styled like the existing responder card (`background: var(--surface-card)`, `border: 0.5px solid var(--border-card)`, `borderRadius: 16`, `padding: 14`) but neutral, not green. Each row contains, left-to-right: a `<Badge>{donor.blood_type}</Badge>`, a middle block with the name (`var(--font-burmese)`, fontSize 15, fontWeight 600, `var(--text-primary)`) and a distance subline using `formatDistanceLabel(donor.dist_meters, lang)` when `dist_meters != null` (use `var(--text-hint)`), and a `<CallButton href={\`tel:${donor.phone}\`} />` on the right.
   - Use `key={donor.donor_id}`.

Honor the design skill: tokens only (no raw hex except the existing `#fff` exception), neutral grey for the "can call" state, calm hierarchy, layouts must breathe with longer Burmese strings. Reuse existing styling conventions from the responder rows — do not invent a new card style.

Do not modify the existing responders list, realtime subscription, confirm flow, or any other behavior.
  </action>
  <verify>
    <automated>cd /Users/bhoneak/Desktop/Learning/VibeCodeTour/blood-help-old && grep -q "callable_donors_for_request" src/screens/RequestLive.tsx && grep -q "visibleCallable" src/screens/RequestLive.tsx && npm run build</automated>
  </verify>
  <done>RequestLive.tsx fetches callable_donors_for_request gated on requestId+currentUserId, dedupes against responders into visibleCallable, and renders an "Available to Call" section above the Will-Help list with blood-type Badge, name, distance, and a tel: CallButton per row; the section is hidden when empty. `npm run build` (tsc -b && vite build) passes with no type errors.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → RPC | Requester's browser calls callable_donors_for_request; donor phone numbers (PII) cross this boundary and must only reach the request owner |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-VXW-01 | Information Disclosure | callable_donors_for_request returning donor phone | mitigate | SECURITY DEFINER + owner guard `requester_id = (SELECT auth.uid())` with `IF NOT FOUND THEN RETURN` — non-owner gets zero rows, no existence leak. Mirrors responders_for_request (D-06/D-07). |
| T-VXW-02 | Elevation of Privilege | RPC granted to anon | mitigate | `GRANT EXECUTE ... TO authenticated` only; never anon. |
| T-VXW-03 | Tampering | SQL injection via search_path | mitigate | `SET search_path = ''` + fully schema-qualified identifiers (public./extensions.) — same hardening as existing RPCs. |
| T-VXW-04 | Information Disclosure | Self appearing as own callable donor | accept→mitigate | `d.profile_id <> (SELECT auth.uid())` excludes the requester. |
| T-VXW-SC | Tampering | npm/pip/cargo installs | mitigate | No new packages installed this plan — no install step. |
</threat_model>

<verification>
- `npm run build` passes (TypeScript + Vite) after both tasks.
- Supabase: `callable_donors_for_request` exists; a call by the request owner returns compatible callable donors within 10km; a call by a non-owner returns zero rows.
- Manual (user, two devices): post a request, confirm a nearby compatible donor with emergency_callable=true + is_available=true appears in "Available to Call" immediately with a working call button; a donor with emergency_callable=false does not appear; a callable donor who taps "I'll help" appears once (in Will Help only).
</verification>

<success_criteria>
- Emergency-callable, available, compatible, within-10km donors appear on RequestLive immediately on request open, with a direct tel: call button.
- Non-callable donors still follow the existing tap-to-help flow only.
- No duplicate rows for a donor present in both lists.
- Donor phones are server-gated to the request owner (non-owner gets zero rows).
- Design skill honored: tokens only, neutral "can call" treatment, reused components.
</success_criteria>

<output>
Create `.planning/quick/260624-vxw-implement-pre-visible-emergency-callable/260624-vxw-SUMMARY.md` when done.
</output>
