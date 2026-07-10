---
marp: true
theme: default
paginate: true
transition: fade
---

# Blood Help

**Turning an hours-long search for blood into help within minutes.**

A free, non-profit PWA connecting people who urgently need blood with nearby, blood-compatible donors — Myanmar / Southeast Asia, Burmese-first, privacy-conscious.

---

# Tech Stack

**React 19 · Vite 8 · Tailwind CSS v4 · TypeScript 6** — installable PWA, one merged service worker

| Layer        | Tools                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| Frontend     | React 19.2, Vite 8, Tailwind v4 (CSS-only `@theme`, no config file), TypeScript 6 |
| Backend      | Supabase (Postgres + PostGIS, RLS, Edge Functions, `pg_cron`)                     |
| Realtime     | Supabase Realtime — live donor list over websockets (`wss`)                       |
| Push         | Firebase Cloud Messaging — donor alerts, "I'll help" responses, resolution pushes |
| Auth         | Phone number + OTP, anonymous Supabase session                                    |
| Location     | Browser geolocation — coarsened to ~1km grid before storage                       |
| Confirmation | `react-qr-code` / `react-zxing` — QR + 5-char code donation confirmation          |
| PWA          | `vite-plugin-pwa` — manifest + service worker                                     |

---

# AI Agents Used

| Agent                   | Purpose                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `gsd-executor`          | Executes planned implementation phases from `PLAN.md`                                                                     |
| `gsd-code-reviewer`     | Adversarial code review — found 11 issues (4 critical) in Phase 9 alone                                                   |
| `gsd-security-auditor`  | ASVS-level threat verification — 19 threats tracked, 16 closed, 3 accepted (Phase 7)                                      |
| `gsd-verifier`          | Goal-backward verification against requirements; caught a missing `coarsenCoordinates()` call before it shipped (Phase 6) |
| `code-quality-refactor` | Senior-engineer pass after every spec update — naming, duplication, privacy rules                                         |

Agents fire during GSD phase workflow (discuss → plan → execute → review → secure → verify) for the v2.0 Backend Core milestone (Phases 6–9).

---

# Skills Used

| Skill               | What It Enforces                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blood-help-design` | Design tokens only (`--color-primary` `#D13E2F`, 8px spacing grid), component reuse over duplication, Burmese-first layout (never size to English string length), calm/trustworthy tone for an emergency-use app |

**MCP — Supabase** — live link to the project's schema, migrations, and RLS policies, used by `gsd-executor` and directly in-session for all Phase 6–9 database work.

Referenced in `CLAUDE.md`; activates automatically on any screen, component, or copy change.

---

# Methodology

**GSD (Get Stuff Done)** — structured multi-phase workflow, used for the v2.0 Backend Core milestone:

1. **Discuss** — adaptive questioning captured in `DISCUSSION-LOG.md` / `CONTEXT.md` per phase
2. **Plan** — `gsd-planner` breaks phases into `PLAN.md`s, goal-backward checked before execution
3. **Execute** — `gsd-executor` implements each plan, produces `SUMMARY.md`
4. **Review** — `gsd-code-reviewer` finds bugs and issues → `REVIEW.md`
5. **Secure** — `gsd-security-auditor` verifies threat mitigations → `SECURITY.md`
6. **Verify** — `gsd-verifier` confirms requirements are actually met → `VERIFICATION.md`

**Quick-task lane** — `/gsd:quick` and `/gsd:fast` skip full ceremony for small fixes (19+ post-milestone tasks: FCM wiring, UI consistency, iOS PWA onboarding) but still get atomic commits and `STATE.md` logging.

---

# Trigger & Commands

| Tool                          | Trigger                                       | Command                                    |
| ----------------------------- | --------------------------------------------- | ------------------------------------------ |
| Skill (`blood-help-design`)   | Automatic — referenced in `CLAUDE.md`         | Activates on any UI/screen/component touch |
| GSD Phase Workflow            | Planned feature phases (6–9)                  | `/gsd:plan-phase`, `/gsd:execute-phase`    |
| Code Review                   | After each phase's implementation             | `/gsd:code-review`                         |
| Security Audit                | After phases touching data/auth (7, 8)        | `/gsd:secure-phase`                        |
| Quick Task                    | Small fixes, doc updates, ad-hoc work         | `/gsd:quick`                               |
| Trivial Task                  | One-line fixes, no planning overhead          | `/gsd:fast`                                |
| `code-quality-refactor` agent | After every spec update (standing preference) | `/agent code-quality-refactor`             |
| Dev Server                    | Manual                                        | `npm run dev` (from project root)          |

**MCP Server** — Supabase MCP (`mcp.supabase.com`) provides live schema, migration, and RLS access to Claude Code throughout every phase.
