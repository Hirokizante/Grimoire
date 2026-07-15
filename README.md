# Grimoire

A character sheet creation and management app for the homebrew TTRPG **Divergence**. Built with React, TypeScript, and Vite — runs entirely in the browser, offline-first.

## Features

- Create, edit, and manage character sheets with a clean, customizable UI
- Attribute and skill sliders, ability creation with structured fields
- Built-in dice roller with inline dice notation (`d20`, `2d6+4`, etc.) and roll log
- Custom theme editor — colors, fonts (import from Google Fonts), layout
- Portrait upload and character images
- Export / import characters as JSON files
- Local-only storage via IndexedDB (with localStorage fallback). No accounts, no servers.

## Tech Stack

- **React 19** + **TypeScript 6**
- **Vite 8** (build tool)
- **Zustand** (state management)
- **@dnd-kit** (drag-and-drop)
- **Lucide Icons**
- **Vitest** + **Testing Library** (unit tests)
- **Playwright** (e2e tests)

## Prerequisites

- **Node.js** ≥ 18 (20+ recommended)
- **npm** ≥ 9

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/<you>/grimoire.git
cd grimoire

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`). Open it in your browser.

## Scripts

| Command                    | Description                              |
| -------------------------- | ---------------------------------------- |
| `npm run dev`              | Start Vite dev server with HMR           |
| `npm run build`            | Type-check + production build to `dist/` |
| `npm run preview`          | Preview the production build locally     |
| `npm run lint`             | Lint with oxlint                         |
| `npm run typecheck`        | Type-check only (no emit)                |
| `npm run test`             | Run unit tests once via vitest           |
| `npm run test:watch`       | Run unit tests in watch mode             |
| `npm run test:e2e`         | Run Playwright e2e tests headless        |
| `npm run test:e2e:ui`      | Run Playwright with the UI runner        |

## Build for Production

```bash
npm run build
```

Static output lands in `dist/`. Deploy it to any static host (GitHub Pages, Netlify, Vercel, S3, etc.).

## Project Structure

```
src/
  components/
    sheet/        # Character sheet layout & editing
    dice/         # Dice roller, overlay, log drawer
    ui/           # Low-level UI primitives
  constants/      # Game data (attributes, skills, etc.)
  context/        # React contexts (notifications)
  hooks/          # Shared hooks
  lib/            # DB, dice parsing, calculations, import/export
  pages/          # Home, CharacterList, CharacterSheet, Placeholder
  store/          # Zustand stores
  types/          # Shared TypeScript types
  test/           # Vitest setup
```

## License

[Add your license here]

---

> Still in beta. Storage format may change between pre-1.0 releases — export your characters regularly.
