# Technology Stack

**Analysis Date:** 2026-06-20

## Languages

**Primary:**
- TypeScript ~6.0.2 — All application source (`src/**/*.ts`, `src/**/*.tsx`) and build config (`vite.config.ts`)

**Secondary:**
- CSS — Design system tokens and layout shell (`src/index.css`, Tailwind v4 `@theme` blocks)
- HTML — Single-page entry (`index.html`)

## Runtime

**Environment:**
- Node.js v24.x (detected: v24.16.0) — Build tooling only; app ships as static SPA with no server runtime

**Package Manager:**
- npm 11.13.0
- Lockfile: `package-lock.json` present (lockfile version 3)

## Frameworks

**Core:**
- React 19.2.6 — UI rendering, screen state machine in `src/App.tsx`
- React DOM 19.2.6 — DOM mounting (`src/main.tsx`, `createRoot`)

**Build/Dev:**
- Vite 8.0.12 — Dev server and production bundler (`vite.config.ts`)
- `@vitejs/plugin-react` 6.0.1 — Babel-based fast refresh and JSX transform
- `@tailwindcss/vite` 4.3.1 — Tailwind v4 Vite plugin (replaces PostCSS config)

**Styling:**
- Tailwind CSS 4.3.1 — Utility classes generated from `@theme` tokens in `src/index.css`

**Testing:**
- None installed

## Key Dependencies

**Critical:**
- `react` 19.2.6 — Entire UI layer; all screens and components are React function components
- `tailwindcss` 4.3.1 — Styling system; design tokens live in `src/index.css` `@theme` block, not `tailwind.config.js` (v4 CSS-only config)

**Infrastructure:**
- `@types/react` 19.2.14 — TypeScript types for React 19
- `@types/react-dom` 19.2.3 — TypeScript types for ReactDOM
- `@types/node` 24.12.3 — Node types for Vite config file

## Configuration

**Environment:**
- No `.env` files present — application currently uses no environment variables
- No external API keys configured; all integrations are placeholder/dummy state

**Build:**
- `vite.config.ts` — Vite config with `react()` and `tailwindcss()` plugins only; no special define blocks, aliases, or PWA plugin yet
- `tsconfig.json` — Root references `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` — App source: target ES2023, `lib: ["ES2023", "DOM"]`, bundler module resolution, strict unused-locals/params, JSX via react-jsx transform, `noEmit: true`
- `tsconfig.node.json` — Vite config file: target ES2023, `lib: ["ES2023"]` (no DOM), `types: ["node"]`

**Linting:**
- `eslint.config.js` — Flat config using `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Targets: `**/*.{ts,tsx}`, ignores `dist/`

**Web Fonts:**
- Google Fonts CDN — Inter (400/500/600) and Noto Sans Myanmar (400/500/600) loaded via `@import url(...)` in `src/index.css`

## Platform Requirements

**Development:**
- Node.js 24.x
- npm 11.x
- `npm run dev` → Vite dev server with HMR
- `npm run build` → `tsc -b && vite build` (type-check then bundle)
- `npm run lint` → ESLint
- `npm run preview` → Vite production preview

**Production:**
- Static SPA — output is `dist/index.html` + `dist/assets/` (single JS bundle + CSS bundle)
- PWA plugin NOT yet installed — `index.html` has no `<link rel="manifest">` and no service worker registration
- No server-side runtime required; can deploy to any static host (Netlify, Vercel, Firebase Hosting, Cloudflare Pages)
- No `.nvmrc` or Node version pin file present

## Not-Yet-Installed Planned Stack

Per `CLAUDE.md`, the following packages are planned for future phases but are **not yet installed**:

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` ^2.108.2 | Database, auth, realtime |
| `firebase` ^12.15.0 | Firebase Cloud Messaging push |
| `vite-plugin-pwa` ^1.3.0 | PWA manifest + service worker |
| `workbox-precaching` ^7.4.1 | SW precache (dev dep) |
| `react-i18next` ^17.0.8 | EN/Burmese language switching |
| `i18next` ^26.3.1 | i18n engine |

---

*Stack analysis: 2026-06-20*
