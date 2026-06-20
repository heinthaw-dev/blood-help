---
phase: 6
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — TypeScript type-check only (`npm run build`) |
| **Config file** | `tsconfig.app.json` |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (catches TypeScript errors immediately)
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green + Supabase dashboard checks
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 06-01-01 | 01 | 1 | BACK-01 | Schema deployed, no raw SQL injection vectors | manual | Supabase dashboard: list_tables via MCP | ⬜ pending |
| 06-01-02 | 01 | 1 | BACK-02 | RLS blocks anon reads of phone fields | manual | MCP execute_sql: test policy | ⬜ pending |
| 06-01-03 | 01 | 1 | BACK-04 | ST_DWithin RPC callable without error | manual | MCP execute_sql: call RPC with test lat/lng | ⬜ pending |
| 06-02-01 | 02 | 2 | BACK-03 | signInAnonymously() creates real session in Auth dashboard | manual | Supabase Auth dashboard | ⬜ pending |
| 06-02-02 | 02 | 2 | PRIV-03 | coarsenCoordinates(1.23456, 7.89012) → {lat:1.23, lng:7.89} | unit | `npm run build` (TypeScript) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No test framework — project uses TypeScript build + manual verification.*

Existing infrastructure covers phase requirements via:
- `npm run build` — TypeScript compilation (catches type errors in new code)
- `npm run lint` — ESLint (catches style and unused variable issues)
- Supabase MCP tools — `list_tables`, `execute_sql` for DB verification
- Supabase Auth dashboard — verifies anonymous sessions created

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema deployed with all 5 tables + 5 enums | BACK-01 | No test framework; DB state not assertable in TypeScript | MCP list_tables — verify profiles, device_tokens, blood_requests, request_responses, donations |
| RLS blocks reading other user's phone | BACK-02 | Requires 2 Supabase sessions to test cross-user access | MCP execute_sql: SELECT phone FROM profiles WHERE id != auth.uid() → should return 0 rows |
| PostGIS ST_DWithin RPC callable | BACK-04 | DB function; no TypeScript unit test applies | MCP execute_sql: SELECT * FROM nearby_donors(16.8, 96.1, 10) → no PG error |
| signInAnonymously creates real session | BACK-03 | Browser-only; requires running dev server | Open app, check Supabase Auth dashboard shows new anonymous user |
| Session restore skips PhoneEntry | BACK-03 | Browser behavior; not assertable in build | Refresh page after signing in → home screen shown (not phone entry) |
| Returning user found by phone | BACK-03 | Requires real DB profile row | Enter phone after setup → routes to home, not IntentChoice |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or manual step with clear instructions
- [ ] `npm run build` passes after each wave
- [ ] Supabase MCP verification commands listed per DB task
- [ ] `.env.local` created with real project URL and anon key before testing
- [ ] `nyquist_compliant: true` set in frontmatter when complete

**Approval:** pending
