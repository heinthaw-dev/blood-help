---
quick_id: 260627-k3p
slug: extract-card-component-route-all-surfaces
status: complete
date: 2026-06-27
---

# Summary — Extract Card component; route all 9 card surfaces

## What changed

### New file
- `src/components/Card.tsx` — `<div>` wrapper that owns the four card "frame" properties:
  - `border`: always `1px solid var(--border-card)` (or `--color-primary` when `selected`)
  - `borderRadius`: always `var(--radius-card)`
  - `background`: defaults to `var(--surface-card)`, overridable via `background` prop
  - `padding`: preset `sm='12px 14px'` / `md='16px'` / `lg='20px'`
  - Spreads `...HTMLAttributes<HTMLDivElement>` so interactive cards (role, onClick, tabIndex) work transparently.
  - `borderColor` prop for non-standard border colors (Leaderboard medal cards, "You" row).
  - `selected` prop replaces the 1.5px emphasis pattern with a 1px primary-color border.

### Bug fixes (the whole point of this task)
| File | Bug | Fix |
|------|-----|-----|
| `RequestLive.tsx` (transparency card) | `border: '0.5px'` | → `1px` via Card |
| `RequestLive.tsx` (callable donor rows ×N) | `border: '0.5px'`, `borderRadius: 16` hardcoded | → `1px`, token via Card |
| `RequestLive.tsx` (responder rows ×N) | `border: '0.5px'`, `borderRadius: 16` hardcoded | → `1px`, token via Card |
| `Home.tsx` (RequestCard) | `borderRadius: 16` hardcoded | → token via Card |
| `IntentChoice.tsx` (choice cards) | `border: '1.5px'` | → `1px` via Card `selected` prop |

### Padding standardized
| Card | Old | New preset |
|------|-----|------------|
| Profile stats | `16` | `md` (16px) |
| Profile QR | `20` | `lg` (20px) |
| Home availability | `'14px 16px'` | `md` (16px) |
| Home feed (RequestCard) | `15` | `md` (16px) |
| RequestLive transparency | `'13px 14px'` | `sm` ('12px 14px') |
| RequestLive callable/responder | `14` | `sm` ('12px 14px') |
| Leaderboard list rows | `'12px 14px'` | `sm` (exact match) |
| Leaderboard top-3 | `18` | `lg` (20px) |
| IntentChoice cards | `'22px 20px'` | `lg` (20px) |

### Files modified
- `src/screens/IntentChoice.tsx` — deleted `cardStyle` fn, replaced 2 `<div>` cards with `<Card selected background style>`
- `src/screens/Home.tsx` — replaced `RequestCard` inline object + availability card `<div>` with `<Card>`; removed now-unused `CSSProperties` import
- `src/screens/Profile.tsx` — replaced stats card + QR card `<div>` with `<Card>`
- `src/screens/RequestLive.tsx` — replaced transparency card + callable donor rows + responder rows with `<Card>`
- `src/screens/Leaderboard.tsx` — replaced top-3 medal cards + all-donors list rows with `<Card>` (background/borderColor props for medal palette and "You" row)

## Verification
- `npm run build`: **exit 0, no type errors**, bundle emitted.
- `npm run lint`: **5 problems — unchanged pre-existing baseline** (App.tsx Date.now ×2, Home/RequestLive setState-in-effect, state.cjs unused-disable). Zero new problems.

## Commit
- `a9a117c` — `feat(ui): extract Card component; route all 9 card surfaces through it`
