# Grimoire

A character sheet creation and management app for the homebrew TTRPG **Divergence**. Built with React, TypeScript, and Vite — runs entirely in the browser, offline-first.

> Still in alpha. Storage format may change between pre-1.0 releases — export your characters regularly.

---

## Table of Contents

- [About Divergence](#about-divergence)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Building for Production](#building-for-production)
- [Deployment](#deployment)
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

---

## Features

### Character Creation & Editing
- **Guided character creation** — start with a named sheet and begin filling in attributes, skills, and abilities immediately.
- **Labels** — tag any character or NPC sheet with custom labels (each with an optional value) from the sheet page; labels also appear on the list pages for at-a-glance organization. Labels are local-only metadata — they are never included in exports. (Sheet filtering by label is coming soon.)
- **Five Attributes** (MAR, POW, AGI, VIT, GRT) allocated from the standard array (3, 2, 1, 0, -1), each with click-to-roll support.
- **Fifteen Skills** with selectable proficiencies and click-to-roll support.
- **Core Ability** — Innate narrative, Innate Abilities, Basic Attack, and Fatebreaker ultimate.
- **Slotted Abilities** — equip abilities for an encounter; drag-and-drop to reorder or move to/from the pool.
- **Ability Pool** — unlimited inactive abilities available to swap in before an encounter.
- **Minor Abilities** — flagged abilities that occupy half a slot instead of a full one.
- **Ability Block editor** — structured fields for name, traits, cost (AP/END/FP), damage, description, overcharge, and flavor text. Supports Markdown in description and overcharge.
- **Ability templates** — pre-filled starting points for common ability types (melee, ranged, buff, debuff) that remain fully editable.
- **Custom tabs & sections** — create up to 6 custom tabs, each with named sections, for organizing homebrew content. When adding a section, choose between an **Ability Block** group, an **NPC Sheet** (a blank, editable NPC bundled directly into the tab), or a **Text** section (a free-form Markdown body for unique mechanics, flavor text, or lore).
- **NPC sections** — attach a full NPC to a custom tab. NPC sheets show portrait, combat stats, attributes, skills, abilities, and description in a compact inline layout, and are editable in place within the tab; NPC attributes and skills are click-to-roll, matching the main sheet. Attached NPCs are exported and re-imported alongside their parent character, and removing an NPC section only detaches the reference — the NPC record stays in the NPC list.
- **Custom resource bars** — define named point pools (current/max) rendered below Endurance, with optional refill on Recover.
- **Portrait upload** — square-crop your portrait first (rule-of-thirds grid overlay with a zoom slider), then it is compressed and stored as a base64 dataURL (max 512px, JPEG 0.85 quality); "Use Original" skips the crop.
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

### Status Compendium
- **Status conditions** — reference records for game effects like "Poisoned" or "Hidden", each with an icon, rules text, and categorization tags. The compendium ships seeded with the built-in Divergence conditions and supports player-created custom ones.
- **Inline references** — write `[StatusName]` in any sheet markdown (ability descriptions, overcharge, flavor text, innate description, custom text sections); it renders as a highlighted, clickable reference with a tooltip showing the condition's details. Matching is case-insensitive.
- **Compendium page** — browse, sort, create, edit, and delete conditions; pick an icon from emoji, the bundled icon pack, or an uploaded image.
- **Referencing sheets** — the compendium shows which characters reference each condition, and character exports bundle every status the sheet references.

### Customization
- **Full color palette** — every sheet element (surfaces, text, borders, accents, resource bars, stat tokens, etc.) exposed as color swatches — no custom CSS required.
- **Theme presets** — one-click themes that replace the palette in a single click, including presets that match each app theme (Parchment, Mikami, Pitch Black) for a cohesive app + sheet look. Full list: Default, Midnight, Parchment, Mikami, Pitch Black, Solar, Ocean, Sakura, Dracula, Nord, Gruvbox, Solarized Dark, Tokyo Night, Catppuccin.
- **Per-element font selection** — independent font families for headings, labels, body text, and helper text.
- **Google Fonts import** — type any Google Fonts family name to add it to the font pickers.
- **Background image** — upload an image, with darken and blur overlays.
- **Custom CSS** — advanced users can append raw CSS that overrides the sheet.
- **Section background toggle** — hide section backgrounds for a flatter layout.
- **View modes per section** — grid or list layout for Slotted Abilities, Ability Pool, and each custom section, persisted on the character.

### App Settings
- **App themes** — switch the app's own color scheme (header, list pages, modals, dice UI — everything *around* the sheets) in Settings. Ships with **Midnight** (the default violet-dark palette), **Parchment** (warm charcoal `#262626` with parchment `#c5b8a0` highlights, plus a matching alternate title-bar glyph), **Mikami** (Nord on near-black, from Ghostty), and **Pitch Black** (pure black with cream, gold, and muted teal, from Ghostty). The choice persists in `localStorage` and applies before first paint. Sheet color themes are unaffected — those stay per-character in the Customization panel.
- **Home page animation** — pick the ambient effect behind the home page title in Settings: **Arcane Glow** (the default drifting light + floating dust particles) or **Terminal Boot** (a startup log that types itself out, as if Grimoire were launched from a shell, then settles to a dim static trace). Animations can also be switched off entirely for a plain, motion-free home page. The choice persists in `localStorage`.
- **NPC sheets follow the app theme** — standalone NPC sheets (no per-sheet customization) adopt the app's palette, including the page and card backgrounds. NPC sections embedded in a player character sheet never apply colors of their own, so the player sheet's theme takes precedence there.

### Import / Export
- **Export as JSON** — downloads a versioned file (`Character Name v1.2.3.json`).
- **Automatic versioning** — each export bumps the patch version (or a manual override).
- **Version history** — every export creates a snapshot stored in IndexedDB; browse, re-download, restore, or delete past versions.
- **Import from JSON** — load a previously exported sheet back in.
- **Update existing** — importing a sheet whose name matches an existing character offers to update in place (preserving live-play state: HP, END, AP, FP, mortal wounds, death saves) or import as a new copy.
- **Version resolution** — when updating, the imported version is used if strictly newer; otherwise the existing version is bumped forward.
- **Attached NPCs** — when a character has NPC sections, the export includes those NPCs as a bundle (`attachedNpcs`). On import, each NPC is persisted as its own record and the parent's section references are rewritten to the fresh IDs, so the parent↔NPC link round-trips intact.
- **Full backup & restore** — Settings → Backup & Restore downloads *everything* (all characters and NPCs, the status compendium, version history, and the roll log) as a single JSON file (`Grimoire Backup YYYY-MM-DD.json`). Restoring from a backup **replaces** all current data in one atomic IndexedDB transaction, after an explicit confirmation. Backups carry a `backupVersion`; newer-version backups are refused with a clear message. Single-character exports are *not* backups — restore points you at the Characters page import instead.
- **Attached statuses** — statuses referenced by a sheet are bundled into the export (`attachedStatuses`). On import they are restored by id and name conflicts are resolved — references match by name, so they keep working even after a condition is renamed.

---

## Tech Stack

- **React 19** — UI framework
- **TypeScript 6** — type-safe codebase
- **Vite 8** — build tool and dev server with HMR
- **Zustand** — lightweight state management (character store, dice roll store, roll log store, status store, app theme store)
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
git clone https://github.com/Hirokizante/Grimoire.git
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

This runs `tsc -b` (type-checking) followed by `vite build`. Static output lands in `dist/` — deployable to any static host (Netlify, Vercel, S3, etc.). See [Deployment](#deployment) for the built-in GitHub Pages setup.

To preview the production build locally:

```bash
npm run preview
```

---

## Deployment

The repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes the app to GitHub Pages:

- Every push to `main` (and manual runs via the Actions tab) builds the app and deploys `dist/` automatically.
- Vite's `base` is set to `/Grimoire/` so the app works under the project-page subpath.
- The live app is hosted at **https://hirokizante.github.io/Grimoire/** — the repo's Pages source must be set to "GitHub Actions" (repo Settings → Pages) for the workflow to be able to deploy.

---

## Project Structure

```
Grimoire/
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
│   │   │   ├── CustomNPCSection.tsx     # Compact bundled-NPC section
│   │   │   ├── CustomTextSection.tsx    # Free-form Markdown text section
│   │   │   ├── AddSectionChoiceModal.tsx # Ability / NPC / Text section chooser
│   │   │   ├── CustomTabDndContext.tsx # DnD for custom sections
│   │   │   ├── npc/                     # NPC-specific sheet components
│   │   │   │   ├── NPCSheet.tsx
│   │   │   │   ├── NPCHeroSection.tsx
│   │   │   │   ├── NPCStatsSection.tsx
│   │   │   │   ├── NPCAbilitiesSection.tsx
│   │   │   │   ├── NPCDescriptionSection.tsx
│   │   │   │   └── NPCExportDialog.tsx
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
│   │   ├── status/        # Status conditions compendium
│   │   │   ├── StatusModal.tsx          # View/edit status modal
│   │   │   ├── CreateStatusModal.tsx    # New-status form
│   │   │   ├── StatusIconPicker.tsx     # Emoji / icon pack / image picker
│   │   │   ├── StatusIcon.tsx           # Status icon renderer
│   │   │   ├── StatusHighlighter.tsx    # Inline [Name] reference highlighting
│   │   │   └── StatusReference.tsx      # Tooltip popover for references
│   │   └── ui/            # Low-level UI primitives
│   │       ├── SegmentedBar.tsx        # Filled/empty segment bar
│   │       └── MarkdownText.tsx        # Markdown renderer
│   ├── constants/
│   │   ├── gameData.ts    # Attribute/skill metadata, mortal wounds table, defaults
│   │   ├── statuses.ts    # Built-in status conditions + defaults
│   │   └── statusIcons.tsx # Built-in status icon pack
│   ├── context/
│   │   └── NotificationContext.tsx # Toast notification system
│   ├── hooks/
│   │   ├── useModalDialog.ts      # Shared modal behavior: scroll lock, Esc, focus trap/restore
│   │   └── useImportedFonts.ts     # Google Fonts link injection
│   ├── lib/
│   │   ├── calculations.ts  # Pure derived-stat formulas (HP, EVA, etc.)
│   │   ├── db.ts            # IndexedDB wrapper (characters, versions, roll logs, statuses)
│   │   ├── dice.ts          # Single die roll utility
│   │   ├── diceParser.ts    # Tokenizer + parser for dice notation
│   │   ├── diceRoller.ts    # Evaluates parsed expressions with stats
│   │   ├── exportImport.ts  # JSON export/import, versioning, snapshots
│   │   ├── imageProcessing.ts # Canvas-based image resize + compression
│   │   ├── rollSourceUtils.ts # Human-readable roll source labels
│   │   ├── slotLogic.ts    # Minor/regular slot counting
│   │   ├── statusReference.ts # [Name] reference parsing + status mapping
│   │   └── themeUtils.ts   # SheetColors → CSS custom properties
│   ├── pages/
│   │   ├── HomePage.tsx          # Landing screen
│   │   ├── CharacterListPage.tsx # Grid/list of all characters
│   │   ├── CharacterSheetPage.tsx # Sheet wrapper with mode toggle
│   │   ├── NPCListPage.tsx       # Grid/list of all NPCs
│   │   ├── NPCSheetPage.tsx      # NPC sheet wrapper with mode toggle
│   │   ├── StatusCompendiumPage.tsx # Status compendium browser
│   │   └── SettingsPage.tsx         # App preferences (theme picker)
│   ├── store/
│   │   ├── appThemeStore.ts   # Zustand store: app theme (localStorage)
│   │   ├── characterStore.ts  # Zustand store: characters + live play
│   │   ├── diceRollStore.ts    # Zustand store: dice roll modal lifecycle
│   │   ├── rollLogStore.ts     # Zustand store: persistent roll log
│   │   └── statusStore.ts      # Zustand store: status compendium
│   ├── types/
│   │   ├── index.ts       # Barrel re-exports
│   │   ├── ability.ts     # AbilityBlock, AbilityCost
│   │   ├── character.ts   # Character, SheetConfig, SheetColors, etc.
│   │   ├── rollLog.ts      # RollLogEntry, RollSource
│   │   └── status.ts       # StatusCondition, StatusIconType
│   └── test/
│       └── setup.ts        # Vitest setup (jest-dom matchers)
```

---

## Data Model Overview

The central domain object is a **`Character`**, which holds everything about a single Divergence character sheet:

| Field | Purpose |
| --- | --- |
| `id`, `name`, `playerName` | Identity |
| `kind` | Discriminator: `'character'` (player sheet) or `'npc'` (static NPC reference) |
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
| `customTabs` | User-created tabs with sections (`CustomAbilitySection`, `CustomNPCSection`, or `CustomTextSection`) |
| `config` | Full aesthetic configuration (colors, fonts, CSS, background image) |
| `viewModes` | Per-section grid/list preference |
| `customResourceBars` | User-defined resource pools |
| `npcStats` | Manually-entered combat stats (NPCs only: evasion, armor, movement, save DC, HP) |
| `description` | Long-form NPC description (NPCs only) |
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

**CustomSection** is a discriminated union describing one section inside a custom tab:

| Variant | Shape |
| --- | --- |
| `CustomAbilitySection` (`kind: 'ability'`) | `{ kind, id, name, abilities: AbilityBlock[] }` — a free-form group of abilities |
| `CustomNPCSection` (`kind: 'npc'`) | `{ kind, id, name, npcId }` — a reference to a bundled NPC `Character` (with `kind: 'npc'`) |
| `CustomTextSection` (`kind: 'text'`) | `{ kind, id, name, content }` — a free-form Markdown body (mechanics, flavor text, lore) |

**StatusCondition** is a compendium record referenced from any sheet text:

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity; `[name]` references match case-insensitively |
| `icon`, `iconType` | Icon payload (`'emoji'`, `'pack'` lucide key, or `'image'` data URL) |
| `description` | Full rules text for the condition |
| `tags` | Categorization tags; built-ins carry `'Default'` |
| `createdAt`, `updatedAt` | Timestamps |

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

Four Zustand stores manage all application state:

- **`characterStore`** — the character list, the currently-selected sheet, live-play mutations (damage, healing, resource spending, milestone application), and version history. Mutations made through `updateCurrentCharacter` are debounce-autosaved (500ms) to IndexedDB.
- **`diceRollStore`** — the dice roll modal lifecycle: parse notation → evaluate with character stats → show result → forward to the roll log.
- **`rollLogStore`** — persistent roll history across all characters, stored in IndexedDB and filterable by character.
- **`statusStore`** — the status-condition compendium: CRUD, icon picking, and bundling referenced statuses into character exports. Persisted to IndexedDB.

### Persistence

A thin promise wrapper around the native IndexedDB API (`src/lib/db.ts`) manages three object stores:

- `characters` — live `Character` records keyed by `id`.
- `versions` — `VersionSnapshot` records for export history, indexed by `characterId`.
- `roll_logs` — `RollLogEntry` records for the dice roll log, indexed by `characterId`.
- `statuses` — `StatusCondition` records for the status compendium, seeded with the built-in Divergence conditions on first run.

Schema migrations are handled on read via `normalizeCharacter`, which upgrades older records to the latest shape (e.g. migrating `innateAbility` → `innateAbilities`, adding `showActivate`, ensuring `customTabs` and `customResourceBars` exist, and stamping the `kind` discriminator on legacy custom-tab sections). No bulk migration is needed.

### Theming

Every configurable color lives in `SheetColors`. `themeUtils.colorVars()` maps them onto CSS custom properties, which the entire sheet reads from. The `CustomizationPanel` exposes every color as a swatch + hex input, organized into groups (Surfaces, Text, Borders, Accents, Resource Bars, Stat Tokens). Changes apply live via CSS variables and persist per-character.

### Drag and Drop

Built on `@dnd-kit`. The `AbilitiesDndContext` wraps the Slotted Abilities and Ability Pool sections, enabling cross-list moves (slotted ↔ pool) and reordering within a list. Custom ability sections have their own `CustomTabDndContext` (NPC sections are excluded from drag-and-drop and render inline instead).

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
