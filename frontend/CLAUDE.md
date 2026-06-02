# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js 16 — Breaking Changes

This project uses **Next.js 16.2.6** (App Router). Versions 15+ have breaking changes from earlier Next.js. **Always read the bundled docs** in `node_modules/next/dist/docs/` before writing any code. Key areas to check:

- **Instant Navigation**: Fixing slow client-side navigations requires exporting `unstable_instant` from the route. See `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.mdx`.
- **Static/Server Rendering defaults may differ** from Next.js 14. Check `node_modules/next/dist/docs/01-app/03-api-reference/`.
- **ESLint**: Uses `eslint-config-next` v16 with the new `eslint/config` API (flat config in `eslint.config.mjs`). Do not use legacy `.eslintrc`.

## Commands

```bash
pnpm dev        # Start development server
pnpm build      # Production build
pnpm start      # Start production server
pnpm lint       # Run ESLint
```

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 (PostCSS), custom `@theme` tokens |
| State | Zustand 5 + TanStack React Query 5 |
| Animation | GSAP 3 (@gsap/react) + Motion 12 |
| Shaders | `shaders` package |
| Other | `@chenglou/pretext` |
| Package mgr | pnpm |

## Architecture

```
app/
  layout.tsx      — Root layout (metadata, fonts, globals.css import)
  page.tsx        — Root page, redirects to /home
  home/page.tsx   — Home page (stub)
  globals.css     — Tailwind v4 base + custom @theme design tokens
```

- **Routing**: Next.js App Router (file-system based). Pages live in `app/` directories.
- **Root layout** (`app/layout.tsx`): Sets up HTML/body wrappers. Import `globals.css` here. Add providers (TanStack Query, Zustand) here.
- **Redirect**: `/` → `/home` via `next/navigation` `redirect()`.
- **Design tokens**: Colors, fonts defined in `globals.css` via Tailwind v4's `@theme` directive. Available as `var(--color-*)` and Tailwind classes.
  - Fonts: `Playfair Display` (serif/display), `IBM Plex Mono` (mono), `Inter` (sans).
  - Colors: background, surface, card, foreground, muted, border, accent, accent-light, white.

## State Management Conventions

- **Zustand** for client-side UI state. Store files go in a top-level `stores/` directory (create if needed).
- **TanStack React Query** for server data fetching and caching. Wrap the layout with `QueryClientProvider` from the root layout when needed.

## Animation

GSAP is available via both the `gsap` package and the `@gsap/react` bindings. `motion` (Framer Motion's successor) is also available. Use whichever fits the animation complexity — GSAP for imperative timeline-based animations, Motion for declarative React animations.

## Project Purpose

Event landing page: **"Wild Week – Athens (2026)"**. A gathering in Athens themed around ancient gods.
