---
name: blood-help-design
description: Use whenever building or changing any UI for the Blood Help PWA — screens, components, layouts, Tailwind styles, or copy. Enforces the app's design system (color #D13E2F, Noto Sans Myanmar, Burmese-first, mobile-first, emergency-calm tone) so every screen looks consistent and intentional, not templated. Trigger for any React/Tailwind work, new screens (auth, donor home, request-live, congrats), or microcopy in Burmese/English.
---

# Blood Help — Frontend Design

You are the design lead for **Blood Help**, a free non-profit blood-donor PWA for
Myanmar / Southeast Asia. Burmese-first, privacy-conscious, used in real emergencies.
Every screen must feel calm, fast, and trustworthy — never flashy, never panic-inducing.

## Design tokens — single source of truth

**All tokens live in `src/index.css`** (the `@theme` block + `:root` aliases),
exported from the Claude Design system. **Never hardcode colors, spacing, radii, or
fonts** — always use the token utilities/variables defined there.

- Read `src/index.css` before styling anything, so you use the real token names.
- Use Tailwind utilities generated from the tokens: `bg-primary`, `text-primary`,
  `rounded-card`, `rounded-button`, `text-success`, etc. — not raw hex.
- Key tokens (defined in that file, don't redefine them):
  - **Primary (blood red):** `--color-primary` `#D13E2F` — one loud red action per screen, never red everywhere. Hover/press: `--color-primary-hover` / `--color-primary-press`.
  - **Success:** `--color-success` `#1E8E5A` — "Will help" / confirmed / available.
  - **Surfaces & text:** `--color-bg`, `--color-surface`, `--color-text-primary/secondary/hint`.
  - **Type:** `--font-sans` (Inter + Noto Sans Myanmar) and `--font-burmese`. Burmese is default — layouts must breathe with longer Burmese strings; never size to English length.
  - **Spacing:** 8px grid (`--spacing-screen` 20, `--spacing-card` 16, `--spacing-card-gap` 12, `--spacing-section` 28).
  - **Radius / elevation:** `--radius-card` 16, `--radius-button` 12, `--shadow-cta` for the primary button. Cards prefer a 1px border over shadow.
- **States:** green = "Will help"; neutral grey = "Can call" / pending; muted = "+ N more notified".
- **Phone format:** E.164 display.
- If a token is genuinely missing, add it to `index.css` first, then use it — don't inline a one-off value.

## Reuse components & keep screens consistent

- **Reuse before building.** Before making any UI, check `src/components/` (and the
  ported Claude Design screens) for an existing Button, Card, Input, bottom-sheet,
  donor-row, chip, etc. Extend or compose those — don't create a parallel version.
- **One component per job, app-wide.** The same Button looks and behaves the same on
  every screen (auth, donor home, request-live, congrats). No screen-specific
  re-styling of shared parts.
- **Match the ported layout conventions:** mobile-first full-bleed, the desktop phone
  frame (`.phone-entry-stage` / `.phone-entry-card` at ≥480px), screen edge padding
  `--spacing-screen`, card padding `--spacing-card`. New screens follow the same shell.
- If you must add a new shared component, build it from the tokens and place it with the
  others so the rest of the app can reuse it too.

## Layout principles

- **Mobile-first, thumb-first.** Primary action sits in the lower reach of the screen. Big tap targets — users may be stressed or one-handed.
- **One job per screen.** Request-live = the donor list. Donor home = nearby requests + leaderboard. Don't crowd.
- **Emergency calm.** Urgency is shown through clear hierarchy and the red accent, not loud animation. Avoid anything that adds anxiety.
- **Transparency is design.** The "We've alerted [X] donors" line and the three donor states (Will help / Can call / + N more) are core UI — make them legible and honest, never hide counts.

## Copy

- Burmese first, plain and warm. English secondary.
- Active voice on buttons: "I'll help", "Mark as fulfilled" — the button text matches the result.
- Errors and empty states give direction, not apology. ("No donors yet — we've alerted [X] nearby. Hang tight.")
- Never expose system terms (no "FCM token", "RLS"). Say what the user controls.

## Privacy in the UI (non-negotiable)

- Never print donor phone numbers in lists. Reveal only on intentional tap (gated, logged).
- Never show raw GPS or exact pins — coarse township-level only.
- Confirmation = QR + 5-char code screen; make the code large and easy to read aloud.

## Process

Follow the general frontend-design discipline: pick deliberate, non-templated choices,
spend boldness in one signature place (e.g. the request-live donor list or the congrats
screen), keep everything else quiet. Build to a quality floor: responsive to small
phones, visible focus, reduced-motion respected, works on slow networks.
