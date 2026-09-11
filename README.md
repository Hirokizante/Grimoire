# Grimoire

A character sheet creation and management app for the homebrew TTRPG **Divergence**. Built with React, TypeScript, and Vite — runs entirely in the browser, offline-first.

> Still in alpha. Storage format may change between pre-1.0 releases — export your characters regularly.

---

## Table of Contents

- [About Divergence](#about-divergence)
- [Features](#features)
- [GM Screen](#gm-screen)
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
- **Custom ability costs** — abilities can also spend any custom resource bar: "+ Add Cost" in the Ability Block editor picks a bar, and the cost renders as a color-matched badge next to AP/END/FP and auto-deducts on Activate (sub-abilities included).
- **Ability stat & attribute modifiers** — an ability can modify the sheet's Attributes (MAR, POW, AGI, VIT, GRT) and combat stats (Evasion, Armor, Movement, Save DC, Max HP, END Recovery). Ticking "Modifies combat stats / attributes" in the Ability Block editor reveals one row per modifier, where you pick the target, choose **+** (add) or **−** (subtract), and enter the amount. Switching the card's modifier toggle on in view mode applies every modifier; switching it off removes them. Every switched-on ability counts, wherever it sits (core, slotted, pool, or a custom tab) — the switch, not the slot, is what applies a modifier. Modifiers are never baked into the stored sheet — attributes, derived stats, dice rolls, and live-play maths all read the *effective* values, and modified values are flagged with a small delta chip. NPC abilities support the same feature (minus END Recovery, which NPCs don't have).
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
- **Ability modifier switches** — each ability that declares modifiers (see above) carries an on/off switch on its card. Switching it on instantly applies the ability's stat/attribute changes to the sheet; switching it off removes them. It is independent from the Activate button, costs no resources, and does not require the ability to be activated — so passive stances, forms, and auras work without spending AP.
- **GM Screen** — run several sheets at once on one surface; see [GM Screen](#gm-screen).

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
- **GM Screen tracking** — the same records back the GM Screen's per-panel status pills (see [GM Screen](#gm-screen)); that tracking state lives on the panel, not on any character sheet.

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
- **NPC sheets follow the app theme** — standalone NPC sheets (no per-sheet customization) adopt the app's palette, including the page and card backgrounds. Their Combat Stats tokens use a dedicated per-theme accent set (`NPC_STAT_TOKEN_COLORS` in `themeUtils.ts`) tuned so all six stripes — Evasion, Armor, Movement, Save DC, HP, and Mortal Wounds — stay clearly distinct from each other and from the card behind them in every theme (a unit test enforces the floor). NPC sections embedded in a player character sheet never apply colors of their own, so the player sheet's theme takes precedence there.

### Import / Export
- **Export as JSON** — downloads a versioned file (`Character Name v1.2.3.json`).
- **Automatic versioning** — each export bumps the patch version (or a manual override).
- **Version history** — every export creates a snapshot stored in IndexedDB; browse, re-download, restore, or delete past versions.
- **Import from JSON** — load a previously exported sheet back in.
- **Update existing** — importing a sheet whose name matches an existing character offers to update in place (preserving live-play state: HP, END, AP, FP, mortal wounds, death saves) or import as a new copy.
- **Version resolution** — when updating, the imported version is used if strictly newer; otherwise the existing version is bumped forward.
- **Attached NPCs** — when a character has NPC sections, the export includes those NPCs as a bundle (`attachedNpcs`). On import, each NPC is persisted as its own record and the parent's section references are rewritten to the fresh IDs, so the parent↔NPC link round-trips intact.
- **Full backup & restore** — Settings → Backup & Restore downloads *everything* (all characters and NPCs, the status compendium, GM screens, version history, and the roll log) as a single JSON file (`Grimoire Backup YYYY-MM-DD.json`). Restoring from a backup **replaces** all current data in one atomic IndexedDB transaction, after an explicit confirmation. Backups carry a `backupVersion` (currently **2**); newer-version backups are refused with a clear message, and **v1 backups still restore** — they simply carry no screens. Single-character exports are *not* backups — restore points you at the Characters page import instead.
- **Attached statuses** — statuses referenced by a sheet are bundled into the export (`attachedStatuses`). On import they are restored by id and name conflicts are resolved — references match by name, so they keep working even after a condition is renamed.

---

## GM Screen

The GM Screen is a saved, named surface that holds **panels** — one per sheet you want to run. It lives behind the **GM Screen** entry in the title bar (and on the home page) and is deliberately app chrome: it uses the active app theme, while each panel's sheet content keeps its own customization.

That split is deliberate and precise. The **panel chrome** — header, name, HP bar, the tracked status pills, the AP/END/FP and Evasion/Armor stat tokens, HP steppers — always follows the **app theme**, never the sheet's palette. A screen shows several sheets side by side, so per-sheet token colors would make every panel read differently and destroy the at-a-glance consistency that is the whole point of the GM Screen; a player panel and an NPC panel therefore color their shared stats identically. The sheet's own palette is injected only inside the **expanded panel's sheet content**, where a player's customization belongs.

### Two kinds of panel

| Panel | What it is |
| --- | --- |
| **Character panel** | A live **reference** to a player `Character`. HP/AP/END/FP changed from the panel is the same state the player sees on their own sheet, and vice versa — one source of truth, no copies. |
| **NPC instance** | A spawned instance of an NPC sheet used as a **template**. |

NPC instances follow one rule: **instances are deltas, not clones.** Spawning "Bandit" three times creates three panels with independent HP, temp HP, and condition, while stats, abilities, portrait, and description are all read from the base record at render time. Editing the base updates every instance of it, and the NPC list keeps showing only bases — there is never a "which Bandit is the real one?" question.

### Using it

- **Screens** — create as many as you like ("Session 4", "Dungeon Run"), switch between them with the pill row, rename inline, and delete with a confirmation. Screens persist in IndexedDB and survive reloads; the screen you had open reopens automatically.
- **Add Character** — searchable picker over your player sheets. A character can only appear once per screen (the row is disabled with "Already on this screen"); use NPC instances when you need multiples of one statblock.
- **Add NPC** — pick an NPC base to spawn an instance, with each row showing how many instances are already on the screen. **New NPC…** creates a base record *and* spawns an instance in one step, without navigating away.
- **Compact / expanded** — compact is a glance-height card (portrait, name, HP bar with −/+/Damage…, key stat tokens, condition badge); expanded renders the sheet content inline.
  - Expanded player and NPC panels use the **same condensed body** (`PanelSheet`), so a panel reads identically whichever kind of sheet it holds: Combat Stats → Attributes → (Core Ability) → Abilities → Skills. It is deliberately *not* the full `CharacterSheet`/`NPCSheet`, which are page-scale views far too tall for a panel sharing its row with another.
  - Three sections are deliberately omitted: the **player HP block** (the panel header already carries an HP bar with its own steppers and Damage dialog), the **NPC Core Ability** section (NPCs have no core abilities — those fields only ever hold the generated Basic Attack / Fatebreaker defaults), and **Description / Character Background** on both (reference material, not at-the-table information).
  - The `saving…` indicator reserves its width permanently and toggles only `visibility`, so it can never resize the header — saves fire on every panel action, and an in-flow badge made the screen name and pills jump sideways on each one.
  - Expanding a panel **animates** (~190ms, ease-out) rather than snapping. The body mounts and unmounts, so height cannot be transitioned directly; it transitions `grid-template-rows: 0fr → 1fr` instead, which needs no measurement, and the body stays mounted only for the duration of the collapse so a collapsed screen is not carrying every sheet's DOM. `prefers-reduced-motion` disables it.
  - Panel **stat tokens** are shaped like the sheet's cost badges (`.cost-badge` / `.dice-notation`): a 1px accent-tinted border on all four edges rather than a thick left stripe, keeping each token's own colour.
  - **Attributes** show the shorthand only (MAR/POW/…) in five strictly equal columns — the full names were what forced uneven column widths, since `repeat(5, 1fr)` is `minmax(auto, 1fr)` and that `auto` floor is the column's own content size. **Skills** render in even columns with uniform rows: the sheet's `nth-child(odd)` striping is neutralised inside panels, where a two-column grid would otherwise put every striped row in the left column and read as "the left column is highlighted".
  - The ability section is player *Slotted Abilities* (the Ability Pool is a build-time concept with no place on a live panel) or the NPC's *Abilities*, and is **always list view with no grid/list toggle** — a grid at panel width is unreadable, so grid is not offered at all.
  - Both render their ability cards against the panel's own entity, so dice notation like `1d6+MAR` resolves against *that* sheet's stats and Activate deducts from *that* record (previously the cards fell back to `currentCharacter`, which is null on the GM Screen).
- **Damage** — the same `DamageDialog` used on character sheets, targeting whichever panel opened it. Armor for an NPC instance comes from the base's `npcStats.armor` and max HP from `npcStats.hp`; temp HP is the instance's own. Reaching 0 HP **downs** an instance (NPCs roll no death saves); healing it revives it, and the panel menu can flag it `dead` (which healing never clears).
- **Statuses** — every panel (player *and* NPC instance) has an **Add Status** icon button at the end of its HP row that opens the compendium picker: search it, then pick one of the five SRD durations (Quick, Persistent, Countdown, Permanent, Conditional). Tracked statuses render as two-segment pills **inline with the HP number** — the **filled left segment** carries the status's icon and its full name, the quiet right segment the duration and the stack stepper — in a single line that scrolls sideways rather than wrapping, so a panel never grows taller because the GM stacked conditions on it.
  - The duration is shown as an **icon only** (label and rules reminder in its tooltip), which is what buys the room for the rest of the pill. It is a **label, not a timer**: nothing expires on its own, and a Countdown is ticked down by hand with the stepper.
  - Status names are **never truncated** — a pill keeps its natural width and the strip scrolls instead, so "Regeneration" always reads in full.
  - Each pill's `−`/`+` adjusts stacks; at one stack the `−` becomes an explicit `✕` remove, so a status can never vanish from a mis-click on a decrement. Stacks are clamped to `[1, 99]`.
  - Picking a duration chip on a status already on the panel **changes its duration in place** (the chips double as the duration editor and the applied one is filled in), and the modal stays open so several conditions can be applied in one pass.
  - Statuses are **GM Screen state only** — they live on the `ScreenPanel`, never on the character or NPC record, so nothing about them reaches a player's own sheet. They reference the compendium record by id (name/icon are read at render time), so a rename propagates and a deleted status leaves a clearly-marked "Missing status" pill that is still removable.
  - Each duration carries its own accent per app theme (`STATUS_DURATION_COLORS`), like the panel stat tokens: those tones sit shoulder to shoulder in one hairline pill (and as the picker's chips), so `themeUtils.test.ts` enforces ΔE ≥ 16 between every pair and ≥ 4.5:1 contrast on every theme's surface.
- **Rolls** — attribute, skill, and ability rolls from a panel resolve against that panel's entity and land in the roll log. Rolls from an instance are noted with the instance label ("Bandit 2"), so they stay distinguishable. The roll-log drawer is available on the screen in "all characters" mode.
- **Reordering** — drag a panel by its grip handle (a 6px activation distance keeps it from fighting page scrolling) to reorder it; panels flow in array order down each column.
- **Layout** — 2 columns above 700px, 1 column at ≤700px. Two wide columns beat three narrow ones: at three, panels were ~320px and every sheet name truncated. On phones the Add buttons collapse into a sticky bottom-right group, and panels never overflow horizontally.
- **Placeholders** — deleting an NPC base or a character that a screen references is still allowed; the delete confirmation lists the affected screens ("Referenced on GM screen: Session 4"), and those panels become a **Missing NPC / Missing character** placeholder with a Remove button. Nothing cascades, and the placeholder state is derived at render time rather than stored.

### Data model

A `GMScreen` is `{ id, name, panels, createdAt, updatedAt }`, where `ScreenPanel` is a discriminated union:

| Variant | Shape |
| --- | --- |
| `kind: 'character'` | `{ id, characterId, density, statuses }` — a reference to a player `Character` |
| `kind: 'npc-instance'` | `{ id, baseNpcId, label, density, statuses, state }` where `state` is `{ currentHP, tempHP, condition }` and `condition` is `'active' \| 'downed' \| 'dead'` |

`statuses` is the GM's own tracking list — `{ statusId, duration, stacks }[]`, where `duration` is `'quick' \| 'persistent' \| 'countdown' \| 'permanent' \| 'conditional'` and `statusId` references a compendium `StatusCondition`. It never leaves the panel: the referenced character/NPC record is untouched, and duplicating an NPC instance deliberately spawns a *fresh* instance with no inherited statuses.

Screens live in their own IndexedDB object store (`screens`, DB version 5) with no indexes — the panel lists are stored inline and the whole set is read at once. Like characters, screens are **normalized on read** (`normalizeScreen`), which backfills `panels: []`, guarantees every panel's `id`/`density`/`statuses`, completes instance state, and stamps timestamps — so hand-edited or older records load cleanly with no bulk migration (unusable status entries are dropped, and stacks are repaired into `[1, 99]`).

Screens travel **only** in full backups; there is no per-screen JSON export (yet).

### Store API

`gmScreenStore` mirrors `characterStore` conventions, autosaving the affected screen with a 500ms debounce:

| Action | Notes |
| --- | --- |
| `loadScreens`, `createScreen`, `renameScreen`, `deleteScreen`, `selectScreen`, `saveScreen` | Screen CRUD; the open screen id is mirrored to `localStorage` |
| `addCharacterPanel` | Returns `false` (no state change) for a character already on the screen |
| `addNpcInstancePanel` | Spawns at full HP with an auto-numbered label ("Bandit", "Bandit 2", …) |
| `duplicatePanel` | NPC instances only — spawns a *fresh* instance, never a copy of its HP |
| `createNpcBaseAndInstance` | Quick-create: writes a base NPC record without navigating, then spawns |
| `removePanel`, `movePanel`, `setPanelDensity`, `renameInstance` | Panel management (reorder is wired to @dnd-kit sortable) |
| `setPanelStatus`, `adjustPanelStatusStacks`, `removePanelStatus` | GM-screen-only status tracking on a panel (add/change duration, ±stacks clamped to `[1, 99]`, remove) |
| `updateInstanceState`, `setInstanceCondition` | Replace an instance's live state / condition |
| `damageInstance`, `healInstance`, `setInstanceTempHP`, `adjustInstanceHP` | Instance live play (armor → resistance → temp HP → HP) |
| `baseFor`, `screensReferencing` | Reference lookups used for placeholders and delete warnings |

Every live-play character mutation was refactored to be **id-targeted** (`takeDamage(id, …)`, `spendAP(id, …)`, …) so the GM Screen can drive several sheets in one tick. `updateCurrentCharacter(updater)` remains as a thin wrapper over `updateCharacter(id, updater)` for the sheet pages, and autosave now uses per-character debounce timers so edits to several panels each persist their own record.

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
│   │   ├── gmscreen/       # GM Screen panels & pickers
│   │   │   ├── CharacterPanel.tsx      # Live reference to a player sheet
│   │   │   ├── NpcInstancePanel.tsx    # NPC base + independent live state
│   │   │   ├── MissingPanel.tsx        # Placeholder for a deleted record
│   │   │   ├── PanelHeader.tsx         # Portrait, name, density, ⋯ menu
│   │   │   ├── PanelStatuses.tsx       # Tracked status pills + Add Status
│   │   │   ├── SortablePanel.tsx       # dnd-kit drag-handle shell
│   │   │   ├── AddCharacterModal.tsx   # Player-character picker
│   │   │   ├── AddNpcModal.tsx         # NPC spawner + quick-create
│   │   │   ├── AddStatusModal.tsx      # Compendium status + duration picker
│   │   │   └── gmscreen.css            # GM Screen styles
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
│   │   │   ├── AbilityModifierFields.tsx # Stat/attribute modifier editor rows
│   │   │   ├── AbilityModifierToggle.tsx # Card switch + modifier chips
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
│   │   ├── useMediaQuery.ts        # CSS media-query subscription (GM Screen columns)
│   │   └── useImportedFonts.ts     # Google Fonts link injection
│   ├── lib/
│   │   ├── calculations.ts  # Pure derived-stat formulas (HP, EVA, etc.)
│   │   ├── abilityModifiers.ts # Ability stat/attribute modifiers → effective values
│   │   ├── db.ts            # IndexedDB wrapper (characters, versions, roll logs, statuses, screens)
│   │   ├── gmScreenUtils.ts # Panel resolution, placeholders, column distribution
│   │   ├── dice.ts          # Single die roll utility
│   │   ├── diceParser.ts    # Tokenizer + parser for dice notation
│   │   ├── diceRoller.ts    # Evaluates parsed expressions with stats
│   │   ├── exportImport.ts  # JSON export/import, versioning, snapshots
│   │   ├── imageProcessing.ts # Canvas-based image resize + compression
│   │   ├── rollSourceUtils.ts # Human-readable roll source labels
│   │   ├── slotLogic.ts    # Minor/regular slot counting
│   │   ├── statusReference.ts # [Name] reference parsing + status mapping
│   │   └── themeUtils.ts   # SheetColors → CSS custom properties + NPC stat accents
│   ├── pages/
│   │   ├── HomePage.tsx          # Landing screen
│   │   ├── CharacterListPage.tsx # Grid/list of all characters
│   │   ├── CharacterSheetPage.tsx # Sheet wrapper with mode toggle
│   │   ├── NPCListPage.tsx       # Grid/list of all NPCs
│   │   ├── NPCSheetPage.tsx      # NPC sheet wrapper with mode toggle
│   │   ├── GMScreenPage.tsx      # Multi-sheet GM view (panels, pickers, reorder)
│   │   ├── StatusCompendiumPage.tsx # Status compendium browser
│   │   └── SettingsPage.tsx         # App preferences (theme picker)
│   ├── store/
│   │   ├── appThemeStore.ts   # Zustand store: app theme (localStorage)
│   │   ├── characterStore.ts  # Zustand store: characters + live play (id-targeted)
│   │   ├── gmScreenStore.ts   # Zustand store: saved GM screens + panels
│   │   ├── diceRollStore.ts    # Zustand store: dice roll modal lifecycle
│   │   ├── listPrefsStore.ts   # Zustand store: list sort/filter prefs (localStorage)
│   │   ├── rollLogStore.ts     # Zustand store: persistent roll log
│   │   └── statusStore.ts      # Zustand store: status compendium
│   ├── types/
│   │   ├── index.ts       # Barrel re-exports
│   │   ├── ability.ts     # AbilityBlock, AbilityCost
│   │   ├── character.ts   # Character, SheetConfig, SheetColors, etc.
│   │   ├── gmScreen.ts    # GMScreen, ScreenPanel, NpcInstanceState
│   │   ├── rollLog.ts      # RollLogEntry, RollSource
│   │   └── status.ts       # StatusCondition, StatusIconType
│   └── test/
│       └── setup.ts        # Vitest setup (jest-dom matchers)
├── e2e/
│   └── gm-screen.spec.ts   # Playwright: assemble, damage, persist, placeholders
└── playwright.config.ts    # E2E config (runs against `vite preview`)
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
| `npcStats` | Manually-entered combat stats (NPCs only: evasion, armor, movement, save DC, HP, mortal wounds) |
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
| `modifiers` | Stat/attribute modifiers applied while the card's modifier toggle is on (`[{ target, value }]`; signed — positive adds, negative subtracts) |
| `modifiersActive` | Whether those modifiers are currently applied to the sheet (view-mode switch; defaults to `false`) |

**CustomSection** is a discriminated union describing one section inside a custom tab:

| Variant | Shape |
| --- | --- |
| `CustomAbilitySection` (`kind: 'ability'`) | `{ kind, id, name, abilities: AbilityBlock[] }` — a free-form group of abilities |
| `CustomNPCSection` (`kind: 'npc'`) | `{ kind, id, name, npcId }` — a reference to a bundled NPC `Character` (with `kind: 'npc'`) |
| `CustomTextSection` (`kind: 'text'`) | `{ kind, id, name, content }` — a free-form Markdown body (mechanics, flavor text, lore) |

**GMScreen** is a saved, named list of panels (see [GM Screen](#gm-screen)):

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity; the name is shown in the screen switcher |
| `panels` | Ordered `ScreenPanel[]` — array order is display order |
| `createdAt`, `updatedAt` | Timestamps |

`ScreenPanel` is a discriminated union on `kind`: `'character'` carries `{ id, characterId, density }` (a reference to a player sheet), and `'npc-instance'` carries `{ id, baseNpcId, label, density, state }` where `state` is the instance's own `{ currentHP, tempHP, condition }`.

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

Ability modifiers layer on top of these formulas without ever changing them: attribute modifiers change the Attributes first (so `+1 VIT` also raises Max HP and Armor), then direct stat modifiers are added to the derived values. Everything that reads an attribute or a combat stat — display, dice rolls, damage/armor resolution, heal caps, END Recovery — uses the *effective* value, and switching the modifier off restores the base instantly.

### Slot Logic

- A regular Slotted Ability occupies **1 slot**.
- A Minor Slotted Ability occupies **0.5 slots**.
- Characters start with **3 slots** and gain an additional slot every 2 Milestones (or choose +1 Max FP instead).

### View Modes

- **Edit Mode** — all fields editable; live-play trackers hidden.
- **View Mode** — all fields read-only; live-play interactions enabled (resource bars, dice rolling, ability activation, ability modifier switches, damage, death saves, mortal wounds).

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

Six Zustand stores manage all application state:

- **`characterStore`** — the character list, the currently-selected sheet, live-play mutations (damage, healing, resource spending, milestone application), and version history. Every live-play action is **id-targeted** (`takeDamage(id, …)`, `spendAP(id, …)`, …) so several sheets can be driven at once; `updateCurrentCharacter` is a thin wrapper over `updateCharacter(id, …)`. Mutations are debounce-autosaved (500ms, per-character timers) to IndexedDB.
- **`gmScreenStore`** — saved GM screens and their panels: screen CRUD, panel add/remove/reorder, NPC instancing (spawn, duplicate, auto-labelling), instance live state (damage/heal/condition), and reference lookups for placeholders and delete warnings. Autosaved per screen with the same 500ms debounce.
- **`diceRollStore`** — the dice roll modal lifecycle: parse notation → evaluate with character stats → show result → forward to the roll log.
- **`rollLogStore`** — persistent roll history across all characters, stored in IndexedDB and filterable by character.
- **`statusStore`** — the status-condition compendium: CRUD, icon picking, and bundling referenced statuses into character exports. Persisted to IndexedDB.
- **`listPrefsStore`** — remembered list-page display prefs (sort key + filter selections for the character list, NPC list, and status compendium). Persisted to localStorage so choices survive page switches and reloads.

### Persistence

A thin promise wrapper around the native IndexedDB API (`src/lib/db.ts`) manages five object stores (DB version 5):

- `characters` — live `Character` records keyed by `id`.
- `versions` — `VersionSnapshot` records for export history, indexed by `characterId`.
- `roll_logs` — `RollLogEntry` records for the dice roll log, indexed by `characterId`.
- `statuses` — `StatusCondition` records for the status compendium, seeded with the built-in Divergence conditions on first run.
- `screens` — `GMScreen` records (panel lists stored inline; no indexes).

Schema migrations are handled on read via `normalizeCharacter` and `normalizeScreen`, which upgrade older records to the latest shape (e.g. migrating `innateAbility` → `innateAbilities`, adding `showActivate`, ensuring `customTabs` and `customResourceBars` exist, sanitizing ability `modifiers` (unknown targets / non-finite values dropped; the modifier switch is dropped when nothing survives), stamping the `kind` discriminator on legacy custom-tab sections, and completing GM-screen panels). No bulk migration is needed.

**Autosave durability:** debounced writes are flushed on `visibilitychange`/`pagehide` (`flushPendingCharacterSaves`, `flushPendingScreenSaves`, installed by `App`), which covers switching tabs and backgrounding. A write that is *initiated* during page unload is cancelled by the browser before it can commit, so reloading within the 500ms debounce window can still lose the last keystroke-level edit — the same last-writer-wins reality as running two tabs.

**The storage layer is self-healing.** Three failure modes are handled explicitly, because IndexedDB's are unusually hostile:

- **Blocked upgrade → no hang.** `indexedDB.open()` has a **10-second deadline** (`OPEN_TIMEOUT_MS`). A version upgrade is *blocked* — not failed — while another connection holds the database open (a stale tab, or a cached older build), and in that state the browser fires no useful event and the request never settles. Now `openDB` rejects, `loadCharacters`/`loadScreens` record a `loadError`, and the page shows the reason with a **Try again** button instead of spinning forever.
- **Half-applied upgrade → repaired on open.** If an upgrade is interrupted, the database can be stamped at the current version while an object store was never created. Re-opening at the same version can never fire `upgradeneeded` again, so every query fails with *"One of the specified object stores was not found."* `openDB` therefore **verifies the schema on every open** and, if a store is missing, closes and reopens at `version + 1` to create it — an upgrade never touches existing records. The repair is announced once via a toast (`wasSchemaRepaired()`).
- **One shared connection.** All helpers share a single long-lived connection (`withConnection`), which is what makes the repair safe: concurrent opens from `loadCharacters` and `loadScreens` used to race, and one of them minted a newer version while the other was still asking for the old one (`VersionError`). The connection is released on `versionchange` so another tab can upgrade, and `withConnection` transparently reconnects and retries if a connection was closed underneath a call. A single unreadable record is skipped and logged rather than failing an entire load.

### Theming

Every configurable color lives in `SheetColors`. `themeUtils.colorVars()` maps them onto CSS custom properties, which the entire sheet reads from. The `CustomizationPanel` is a slide-out drawer (right edge on desktop, bottom sheet on phones) that exposes every color as a swatch + hex input, organized into groups (Surfaces, Text, Borders, Accents, Resource Bars, Stat Tokens). The sheet stays visible and interactive while the drawer is open, so changes apply live via CSS variables and persist per-character.

### Drag and Drop

Built on `@dnd-kit`. The `AbilitiesDndContext` wraps the Slotted Abilities and Ability Pool sections, enabling cross-list moves (slotted ↔ pool) and reordering within a list. Custom ability sections have their own `CustomTabDndContext` (NPC sections are excluded from drag-and-drop and render inline instead). The GM Screen wraps its panel canvas in a `SortableContext` (`SortablePanel` + `verticalListSortingStrategy`); only the frameless grip handle activates a drag, with a 6px `PointerSensor` distance so touch scrolling and in-panel controls keep working.

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

Unit tests cover the pure logic modules (`calculations`, `diceParser`, `diceRoller`, `slotLogic`, `exportImport`, `db`, `backup`), the character store's id-targeted mutations and autosave, the GM Screen store (CRUD, panel ops, duplicate guard, auto-labelling, instance damage/heal/downed flow, panel status tracking, per-screen autosave), and the GM Screen components (panels, pickers, placeholder, status pills + Add Status picker, `DamageDialog` against an NPC instance).

End-to-end tests live in `e2e/` and run against the **production build** served by `vite preview` (not a dev server). `e2e/gm-screen.spec.ts` covers screen creation, mixing a character with two NPC instances, damaging one instance to 0 HP while its sibling is unaffected, persistence across a reload, player/panel state parity, delete-reference placeholders, status tracking (per-panel pills, durations, stacks, and a panel that stays exactly as tall with five statuses as with one — on desktop and at 360px), and a 360px-wide layout with no horizontal overflow. `e2e/storage-failure.spec.ts` pins the recovery contract for all three failure modes: a blocked upgrade must not hang (it must explain itself, and Retry must succeed once the blocking connection goes away), a half-applied upgrade must repair itself **without losing data**, and a sequence of mixed reads and writes must keep working on the shared connection (every helper used to close it on exit, silently breaking everything after the first call). Run `npx playwright install chromium` once before the first `npm run test:e2e`.

---

## Storage & Privacy

- **Everything is stored locally on the user's device** — in IndexedDB, with no server, no account, and no network requirement for normal operation.
- The only external network calls are to the Google Fonts API, and only when the user explicitly imports a font.
- Character data never leaves the browser unless the user explicitly exports a JSON file.
- Deleting a character removes it from IndexedDB. Clearing browser data for the site removes all stored characters, version history, and roll logs.

---

## License

This project is licensed under the MIT license.
