# Grimoire

A character sheet creation and management app for the homebrew TTRPG **Divergence**. Built with React, TypeScript, and Vite — runs entirely in the browser, offline-first.

> Still in beta. Storage format may change between pre-1.0 releases — export your characters regularly.

---

## Table of Contents

- [About Divergence](#about-divergence)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Data Model Overview](#data-model-overview)
- [Key Concepts](#key-concepts)
- [Architecture](#architecture)
- [Testing](#testing)
- [Storage & Privacy](#storage--privacy)
- [License](#license)

---

## About Divergence

Divergence is a DIY tabletop RPG system — there is no compendium of spells or items. Players build their characters' abilities and equipment from scratch, using the system as a creative framework. Grimoire is built to support that freedom: structured text fields for abilities, full creative control over look and feel, and live-play tools for tracking resources and rolling dice.

For the full ruleset, see [`Divergence SRD.md`](Divergence SRD.md). For the product and UI design, see [`DESIGN.md`](DESIGN.md).

---

## Features

### Character Creation & Editing
- **Guided character creation** — start with a named sheet and begin filling in attributes, skills, and abilities immediately.
- **Five Attributes** (MAR, POW, AGI, VIT, GRT) allocated from the standard array (3, 2, 1, 0, -1), each with click-to-roll support.
- **Fifteen Skills** with selectable proficiencies and click-to-roll support.
- **Core Ability** — Innate narrative, Innate Abilities, Basic Attack, and Fatebreaker ultimate.
- **Slotted Abilities** — equip abilities for an encounter; drag-and-drop to reorder or move to/from the pool.
- **Ability Pool** — unlimited inactive abilities available to swap in before an encounter.
- **Minor Abilities** — flagged abilities that occupy half a slot instead of a full one.
- **Ability Block editor** — structured fields for name, traits, cost (AP/END/FP), damage, description, overcharge, and flavor text. Supports Markdown in description and overcharge.
- **Ability templates** — pre-filled starting points for common ability types (melee, ranged, buff, debuff) that remain fully editable.
- **Custom tabs & sections** — create up to 6 custom tabs, each with named ability sections, for organizing homebrew content.
- **Custom resource bars** — define named point pools (current/max) rendered below Endurance, with optional refill on Recover.
- **Portrait upload** — images are compressed and stored as base64 dataURLs (max 512px, JPEG 0.85 quality).
- **Physical description & backstory** — Markdown-supported bio fields.

### Live Play (View Mode)
- **Edit / View mode toggle** — Edit mode for building the sheet; View mode locks fields and enables live-play interactions.
- **Automatic HP tracking** — input damage and the system applies Armor reduction (1d6 per point), Resistance (halve), and Temp HP absorption, then handles Mortal Wound overflow and knock-out.
- **Temporary HP** — tracked separately; reduced before regular HP; highest value takes precedence.
- **Resource tracking** — FP, AP, and END bars with inline +/− controls; costs auto-deducted when abilities are activated.
- **Recover action** — spend 3 AP to regain all END.
- **End Turn** — converts unspent AP to END (1:1) and applies END Recovery.
- **Mortal Wound rolling** — D20 roll on the 20-entry Mortal Wounds table when HP reaches 0; up to 2 wounds tracked.
- **Death Save tracking** — success/failure pips, auto-roll with nat 20/nat 1 doubling, revive at 3 successes or die at 3 failures.
- **Exhaustion support** — the Exhaustion mortal wound adds +1 to all END costs automatically.

### Dice Roller
- **Inline dice notation** — `d20`, `2d6+4`, `1d6+POW`, `2d6+POW/MAR` are auto-detected in any text field and become clickable in view mode.
- **Variable substitution** — attribute abbreviations (MAR, POW, AGI, VIT, GRT) and skill names resolve to the character's actual values.
- **Roll breakdown** — full per-term breakdown showing each die, each substituted variable, and the total (e.g. `2d6+POW → 4 + 3 + 4 = 11`).
- **Critical / fumble detection** — nat 20 and nat 1 badges on d20 rolls.
- **Roll log** — persistent, per-character roll history in a slide-out drawer; entries are saved to IndexedDB and survive reloads.

### Customization
- **Full color palette** — every sheet element (surfaces, text, borders, accents, resource bars, stat tokens, etc.) exposed as color swatches — no custom CSS required.
- **Per-element font selection** — independent font families for headings, labels, body text, and helper text.
- **Google Fonts import** — type any Google Fonts family name to add it to the font pickers.
- **Background image** — upload an image, with darken and blur overlays.
- **Custom CSS** — advanced users can append raw CSS that overrides the sheet.
- **Section background toggle** — hide section backgrounds for a flatter layout.
- **View modes per section** — grid or list layout for Slotted Abilities, Ability Pool, and each custom section, persisted on the character.

### Import / Export
- **Export as JSON** — downloads a versioned file (`Character Name v1.2.3.json`).
- **Automatic versioning** — each export bumps the patch version (or a manual override).
- **Version history** — every export creates a snapshot stored in IndexedDB; browse, re-download, restore, or delete past versions.
- **Import from JSON** — load a previously exported sheet back in.
- **Update existing** — importing a sheet whose name matches an existing character offers to update in place (preserving live-play state: HP, END, AP, FP, mortal wounds, death saves) or import as a new copy.
- **Version resolution** — when updating, the imported version is used if strictly newer; otherwise the existing version is bumped forward.

---

## Tech Stack

- **React 19** — UI framework
- **TypeScript 6** — type-safe codebase
- **Vite 8** — build tool and dev server with HMR
- **Zustand** — lightweight state management (character store, dice roll store, roll log store)
- **@dnd-kit** — drag-and-drop for abilities (sortable lists, cross-list moves)
- **Lucide Icons** — icon library
- **react-colorful** — color picker for the customization panel
- **react-markdown** + **remark-gfm** + **rehype-raw** — Markdown rendering in ability descriptions and bio fields
- **Vitest** + **Testing Library** — unit and component tests
- **Playwright** — end-to-end tests
- **oxlint** — fast linter

---

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** ≥ 18 (20+ recommended) — [Download Node.js](https://nodejs.org/)
- **npm** ≥ 9 (bundled with Node.js)

To verify your installations:

```bash
node --version
npm --version
```

No other dependencies, databases, or services are required. The app runs entirely in the browser and stores data locally.

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/hirokizante/grimoire.git
cd grimoire

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`). Open it in your browser.

The first time you open the app you'll land on the Home screen. Click **Characters** to enter the character list, then **+ New** or **Import** to add your first character.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Lint with oxlint |
| `npm run typecheck` | Type-check only (no emit) |
| `npm run test` | Run unit tests once via vitest |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run Playwright e2e tests headless |
| `npm run test:e2e:ui` | Run Playwright with the UI runner |

---

## Building for Production

```bash
npm run build
```

This runs `tsc -b` (type-checking) followed by `vite build`. Static output lands in `dist/`. Deploy it to any static host (GitHub Pages, Netlify, Vercel, S3, etc.).

To preview the production build locally:

```bash
npm run preview
```

---

## Project Structure

```
Grimoire/
├── DESIGN.md              # Full design spec (source of truth)
├── Divergence SRD.md       # Full game rules
├── IDEA.md                 # Project vision
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript config
├── src/
│   ├── App.tsx             # Root component, routing between pages
│   ├── main.tsx            # React entry point
│   ├── index.css           # Global styles
│   ├── App.css            # App-level layout styles
│   ├── components/
│   │   ├── TitleBar.tsx    # Top navigation bar
│   │   ├── sheet/          # Character sheet layout & editing
│   │   │   ├── CharacterSheet.tsx      # Full sheet layout
│   │   │   ├── HeroSection.tsx         # Portrait, name, stats, attributes
│   │   │   ├── StatsSection.tsx         # Combat stats, resources, live play
│   │   │   ├── AttributesSection.tsx    # Five attributes with click-to-roll
│   │   │   ├── SkillsSection.tsx        # Fifteen skills with click-to-roll
│   │   │   ├── CoreAbilitySection.tsx   # Innate, basic attack, fatebreaker
│   │   │   ├── SlottedAbilitiesSection.tsx
│   │   │   ├── AbilityPoolSection.tsx
│   │   │   ├── AbilityBlockCard.tsx     # Single ability card renderer
│   │   │   ├── AbilityBlockEditor.tsx   # Inline ability form
│   │   │   ├── AbilityEditorModal.tsx   # Full-screen ability editor
│   │   │   ├── AbilityActivation.tsx    # Activate button + cost deduction
│   │   │   ├── SortableAbilityCard.tsx  # Draggable ability card
│   │   │   ├── AbilitiesDndContext.tsx # Drag-and-drop context
│   │   │   ├── CustomTabContent.tsx     # Custom tab renderer
│   │   │   ├── CustomAbilitySection.tsx # Custom section renderer
│   │   │   ├── CustomTabDndContext.tsx # DnD for custom sections
│   │   │   ├── TabBar.tsx              # Sheet tab navigation
│   │   │   ├── ProfileSection.tsx      # Physical description, backstory
│   │   │   ├── ResourceBar.tsx         # Segmented bar +/− controls
│   │   │   ├── DamageDialog.tsx        # Apply damage modal
│   │   │   ├── RecoverAction.tsx       # Recover + End Turn buttons
│   │   │   ├── DeathSaveTracker.tsx    # Death save pips + roll
│   │   │   ├── MortalWoundRoller.tsx   # Mortal wound table roller
│   │   │   ├── MilestoneDialog.tsx     # Guided level-up wizard
│   │   │   ├── CustomizationPanel.tsx  # Colors, fonts, layout editor
│   │   │   ├── FontImportSection.tsx   # Google Fonts importer
│   │   │   ├── PortraitUploader.tsx    # Image upload + compression
│   │   │   ├── ExportDialog.tsx        # Versioned export + history
│   │   │   ├── CreateCharacterModal.tsx
│   │   │   ├── ConfirmDeleteModal.tsx
│   │   │   ├── UpdateCharacterModal.tsx # Import conflict resolution
│   │   │   ├── CustomResourceBarModal.tsx
│   │   │   └── sheet.css               # Sheet-specific styles
│   │   ├── dice/          # Dice roller, overlay, log drawer
│   │   │   ├── DiceHighlighter.tsx     # Inline dice notation clicker
│   │   │   ├── DiceRollOverlay.tsx     # Modal wrapper
│   │   │   ├── DiceResultModal.tsx     # Full-screen roll breakdown
│   │   │   ├── RollLogDrawer.tsx       # Persistent roll history
│   │   │   └── dice.css
│   │   └── ui/            # Low-level UI primitives
│   │       ├── SegmentedBar.tsx        # Filled/empty segment bar
│   │       └── MarkdownText.tsx        # Markdown renderer
│   ├── constants/
│   │   └── gameData.ts    # Attribute/skill metadata, mortal wounds table, defaults
│   ├── context/
│   │   └── NotificationContext.tsx # Toast notification system
│   ├── hooks/
│   │   ├── useEscapeKey.ts        # Esc-to-close for modals
│   │   └── useImportedFonts.ts     # Google Fonts link injection
│   ├── lib/
│   │   ├── calculations.ts  # Pure derived-stat formulas (HP, EVA, etc.)
│   │   ├── db.ts            # IndexedDB wrapper (characters, versions, roll logs)
│   │   ├── dice.ts          # Single die roll utility
│   │   ├── diceParser.ts    # Tokenizer + parser for dice notation
│   │   ├── diceRoller.ts    # Evaluates parsed expressions with stats
│   │   ├── exportImport.ts  # JSON export/import, versioning, snapshots
│   │   ├── imageProcessing.ts # Canvas-based image resize + compression
│   │   ├── rollSourceUtils.ts # Human-readable roll source labels
│   │   ├── slotLogic.ts    # Minor/regular slot counting
│   │   └── themeUtils.ts   # SheetColors → CSS custom properties
│   ├── pages/
│   │   ├── HomePage.tsx          # Landing screen
│   │   ├── CharacterListPage.tsx # Grid/list of all characters
│   │   ├── CharacterSheetPage.tsx # Sheet wrapper with mode toggle
│   │   └── PlaceholderPage.tsx   # Stub page (NPCs, Settings)
│   ├── store/
│   │   ├── characterStore.ts  # Zustand store: characters + live play
│   │   ├── diceRollStore.ts    # Zustand store: dice roll modal lifecycle
│   │   └── rollLogStore.ts     # Zustand store: persistent roll log
│   ├── types/
│   │   ├── index.ts       # Barrel re-exports
│   │   ├── ability.ts     # AbilityBlock, AbilityCost
│   │   ├── character.ts   # Character, SheetConfig, SheetColors, etc.
│   │   └── rollLog.ts      # RollLogEntry, RollSource
│   └── test/
│       └── setup.ts        # Vitest setup (jest-dom matchers)
```

---

## Data Model Overview

The central domain object is a **`Character`**, which holds everything about a single Divergence character sheet:

| Field | Purpose |
| --- | --- |
| `id`, `name`, `playerName` | Identity |
| `version` | Semantic version (MAJOR.MINOR.PATCH) for export tracking |
| `milestones` | Character progression level |
| `attributes` | The five Attributes (MAR, POW, AGI, VIT, GRT) |
| `skills` | The fifteen Skills |
| `maxFP`, `maxAbilitySlots` | Caps that grow with milestones |
| `currentHP`, `tempHP`, `currentEND`, `currentAP`, `currentFP` | Live-play resource pools |
| `mortalWounds` | Up to 2 active wounds (by name) |
| `deathSaves` | Success/failure tracker |
| `innateDescription`, `innateAbilities` | Core Ability narrative + mechanical innates |
| `basicAttack`, `fatebreaker` | Fixed-shape core abilities |
| `slottedAbilities`, `abilityPool` | Active vs. inactive slotted abilities |
| `portrait` | Base64 data URL |
| `physicalDescription`, `backstory` | Bio fields |
| `customTabs` | User-created tabs with custom sections |
| `config` | Full aesthetic configuration (colors, fonts, CSS, background image) |
| `viewModes` | Per-section grid/list preference |
| `customResourceBars` | User-defined resource pools |
| `createdAt`, `updatedAt` | Timestamps |

**AbilityBlock** is the structured representation of any ability (Core, Slotted, or Pool):

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity |
| `traits` | Free-form tags (Action, Range, Type, Status, etc.) |
| `cost` | AP / END / FP costs (all optional) |
| `damage` | Dice notation string (e.g. `2d6+POW`) |
| `description`, `overcharge`, `flavorText` | Prose fields (Markdown-supported) |
| `isMinor` | Half-slot flag |
| `showActivate` | Whether to show the Activate button in view mode |

---

## Key Concepts

### Calculated Fields

The following are derived from Attributes and Milestones and are always read-only:

| Field | Formula |
| --- | --- |
| HP | `max(20, 20 + VIT × 5)` |
| Evasion | `10 + AGI` |
| Armor | `floor(VIT / 2)` |
| Movement | `5 + floor(AGI / 2)` |
| Milestone Bonus | `floor(Milestones / 2)` |
| Save DC | `10 + Milestone Bonus` |
| END Recovery | `max(1, 1 + floor(GRT / 2))` |

### Slot Logic

- A regular Slotted Ability occupies **1 slot**.
- A Minor Slotted Ability occupies **0.5 slots**.
- Characters start with **3 slots** and gain an additional slot every 2 Milestones (or choose +1 Max FP instead).

### View Modes

- **Edit Mode** — all fields editable; live-play trackers hidden.
- **View Mode** — all fields read-only; live-play interactions enabled (resource bars, dice rolling, ability activation, damage, death saves, mortal wounds).

### Dice Notation

The dice parser supports:

- Standard dice: `d20`, `2d6`, `3d8`
- Constants: `+4`, `-1`
- Variables: `POW`, `MAR`, `Sneak` (resolved to the character's actual value)
- Variable alternatives: `POW/MAR` (player's choice; higher used by default)
- Combined: `2d6+POW`, `d20+3`, `1d6+POW/MAR`

---

## Architecture

### State Management

Three Zustand stores manage all application state:

- **`characterStore`** — the character list, the currently-selected sheet, live-play mutations (damage, healing, resource spending, milestone application), and version history. Mutations made through `updateCurrentCharacter` are debounce-autosaved (500ms) to IndexedDB.
- **`diceRollStore`** — the dice roll modal lifecycle: parse notation → evaluate with character stats → show result → forward to the roll log.
- **`rollLogStore`** — persistent roll history across all characters, stored in IndexedDB and filterable by character.

### Persistence

A thin promise wrapper around the native IndexedDB API (`src/lib/db.ts`) manages three object stores:

- `characters` — live `Character` records keyed by `id`.
- `versions` — `VersionSnapshot` records for export history, indexed by `characterId`.
- `roll_logs` — `RollLogEntry` records for the dice roll log, indexed by `characterId`.

Schema migrations are handled on read via `normalizeCharacter`, which upgrades older records to the latest shape (e.g. migrating `innateAbility` → `innateAbilities`, adding `showActivate`, ensuring `customTabs` and `customResourceBars` exist). No bulk migration is needed.

### Theming

Every configurable color lives in `SheetColors`. `themeUtils.colorVars()` maps them onto CSS custom properties, which the entire sheet reads from. The `CustomizationPanel` exposes every color as a swatch + hex input, organized into groups (Surfaces, Text, Borders, Accents, Resource Bars, Stat Tokens). Changes apply live via CSS variables and persist per-character.

### Drag and Drop

Built on `@dnd-kit`. The `AbilitiesDndContext` wraps the Slotted Abilities and Ability Pool sections, enabling cross-list moves (slotted ↔ pool) and reordering within a list. Custom sections have their own `CustomTabDndContext`.

---

## Testing

```bash
# Unit tests (vitest + Testing Library)
npm run test

# Unit tests in watch mode
npm run test:watch

# End-to-end tests (Playwright)
npm run test:e2e

# E2E with Playwright's UI runner
npm run test:e2e:ui
```

Unit tests cover the pure logic modules (`calculations`, `diceParser`, `diceRoller`, `slotLogic`, `exportImport`, `db`) and the character store. E2E tests cover critical user flows in the browser.

---

## Storage & Privacy

- **Everything is stored locally on the user's device** — in IndexedDB, with no server, no account, and no network requirement for normal operation.
- The only external network calls are to the Google Fonts API, and only when the user explicitly imports a font.
- Character data never leaves the browser unless the user explicitly exports a JSON file.
- Deleting a character removes it from IndexedDB. Clearing browser data for the site removes all stored characters, version history, and roll logs.

---

## License

This project is licensed under the MIT license.
