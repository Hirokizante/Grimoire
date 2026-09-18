# Grimoire

A character sheet app for the homebrew TTRPG **Divergence** — create, customize,
and run characters entirely in the browser. Built with React, TypeScript, and
Vite; offline-first, with no account and no server.

[![Deploy to GitHub Pages][deploy-badge]][deploy-workflow]

**Live app:** <https://hirokizante.github.io/Grimoire/>

> **Alpha.** The storage format may still change before 1.0 — export your
> characters regularly.

[deploy-badge]: https://github.com/Hirokizante/Grimoire/actions/workflows/deploy.yml/badge.svg
[deploy-workflow]: https://github.com/Hirokizante/Grimoire/actions/workflows/deploy.yml

---

## What it is

Divergence is a DIY tabletop RPG system: there is no compendium of spells or
items, and players build their characters' abilities and equipment from scratch.
Grimoire is built to support that freedom — structured text fields for
abilities, full creative control over how a sheet looks, and live-play tools for
tracking resources and rolling dice.

---

## Features

- **Character sheets** — the five Attributes (MAR, POW, AGI, VIT, GRT) and
  fifteen Skills with click-to-roll support, a Core Ability, slotted abilities
  with drag-and-drop, an unlimited ability pool, sub-abilities, custom tabs and
  sections, your own **custom attributes** (with optional view-mode steppers),
  portraits, and Markdown-supported bio fields.
- **Live play** — a View mode that locks the sheet and enables resource
  tracking: HP with Armor / Resistance / Temp HP handling, AP, END and FP,
  Recover and End Turn, Mortal Wounds, and Death Saves.
- **Dice roller** — inline notation (`d20`, `2d6+4`, `1d6+POW`, `2d6+POW/MAR`,
  a custom attribute like `2d6+SAN`, or a whole calculation such as
  `(1d6+POW)*2/2d6+MAR`) that becomes clickable in view mode, with a per-die
  breakdown, critical and fumble badges, **Advantage/Disadvantage** (roll the
  net d6s and add or subtract the highest), and a persistent roll
  log. An ability can also **roll its own dice on activation** — accuracy,
  damage, and any custom rolls you add — shown together in one result window;
  an attack roll of 20+ is a **critical hit**, rolling the damage twice and
  keeping the higher result, and a damage roll can be marked critical by hand.
- **GM Screen** — a saved surface holding one panel per sheet you are running:
  live references to player characters, or NPC instances with their own HP,
  turns, Recharge cooldowns, Mortal Wounds, limited uses, and tracked statuses.
- **Status compendium** — reference conditions with icons and rules text, plus
  inline `[StatusName]` references that render as clickable tooltips on any
  sheet.
- **Customization** — every sheet colour as a swatch, 14 one-click theme
  presets, per-element font selection, a background image, and an optional raw
  CSS box.
- **Import / export** — versioned JSON exports with a browsable version history
  and an "update existing" merge, plus a full backup and restore of all app data
  in Settings.
- **App settings** — app-wide themes and the home page animation.

This is a summary: the complete behaviour reference — every option, default, and
limitation — lives in [docs/features.md](docs/features.md).

---

## Quick start

### Prerequisites

- **Node.js** ≥ 18 (20 or newer recommended) — <https://nodejs.org/>
- **pnpm** — the package manager this repo locks with. `package.json` pins
  `pnpm@11.22.0` in its `packageManager` field. `npm` works too, but the deploy
  workflow installs from `pnpm-lock.yaml`, so pnpm keeps a local build identical
  to the deployed one.

```bash
node --version
pnpm --version
```

No database or other service is required: the app runs entirely in the browser
and stores everything locally.

### Install and run

```bash
# 1. Clone the repo
git clone https://github.com/Hirokizante/Grimoire.git
cd Grimoire

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm run dev
```

Vite prints a local URL (usually <http://localhost:5173>). Open it in your
browser.

### First steps

You land on the Home screen. Click **Characters** to open the character list,
then **+ New** to build a sheet or **Import** to load a previously exported one.
**GM Screen** — in the title bar and on the home page — opens the multi-sheet
view for running a session.

### Production build

```bash
pnpm run build     # tsc -b && vite build → dist/
pnpm run preview   # serve the built output locally
```

`dist/` is static and deployable to any static host. Pushing to `main` deploys
to GitHub Pages automatically — see
[docs/development.md](docs/development.md#deployment) for the workflow and the
`base` path.

---

## Scripts

| Command | Description |
| --- | --- |
| `pnpm run dev` | Start the Vite dev server with HMR |
| `pnpm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `pnpm run preview` | Preview the production build locally |
| `pnpm run lint` | Lint with oxlint |
| `pnpm run typecheck` | Type-check only (no emit) |
| `pnpm run test` | Run the unit tests once (Vitest) |
| `pnpm run test:watch` | Run unit tests in watch mode |
| `pnpm run test:e2e` | Run the Playwright end-to-end tests headless |
| `pnpm run test:e2e:ui` | Run Playwright's UI runner |
| `pnpm run icons:rpg-awesome` | Regenerate the status icon pack's key list |

Every command also works with `npm run …`.

---

## Documentation

| Document | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Index of all documentation, and which file to update when you change something |
| [docs/features.md](docs/features.md) | Complete feature reference |
| [docs/gm-screen.md](docs/gm-screen.md) | GM Screen: panels, turns, damage, Mortal Wounds, statuses, store API |
| [docs/data-model.md](docs/data-model.md) | Domain types, derived stats, slot logic, dice notation |
| [docs/architecture.md](docs/architecture.md) | Stores, persistence and IndexedDB invariants, theming, drag and drop |
| [docs/development.md](docs/development.md) | Environment, scripts, project layout, testing, deployment |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [docs/custom-css-guide.md](docs/custom-css-guide.md) | Player's guide to the sheet's Custom CSS box |
| [docs/custom-css-recipes.md](docs/custom-css-recipes.md) | Paste-ready custom CSS looks |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Tech stack

**React 19** · **TypeScript 6** · **Vite 8** · **Zustand** · **@dnd-kit** ·
**lucide-react** · **RPG-Awesome** · **react-markdown** (with remark-gfm and
rehype-raw) · **react-colorful** · **Vitest** + **Testing Library** ·
**Playwright** · **oxlint**.

[docs/architecture.md](docs/architecture.md#tech-stack) explains what each one is
used for.

---

## Data and privacy

- Everything is stored **locally on your device**, in IndexedDB. There is no
  server, no account, and no network connection required for normal use.
- Character data never leaves the browser unless you export a JSON file.
- The only external network call is to the Google Fonts API, and only when you
  explicitly import a font.
- Deleting a character removes it from IndexedDB. Clearing your browser data for
  the site removes all characters, version history, and roll logs — export
  regularly, especially while the app is in alpha.

---

## License

This project is licensed under the MIT license — see [LICENSE](LICENSE).

Bundled third-party work keeps its own license: the status icon pack is
[RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) (font under SIL
OFL 1.1, CSS under MIT), drawn from [Game Icons](https://game-icons.net/), and
the emoji names and groups behind the picker's emoji search come from
[unicode-emoji-json](https://github.com/muan/unicode-emoji-json) (MIT), which
repackages Unicode's emoji data.
