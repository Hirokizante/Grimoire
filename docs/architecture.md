# Architecture

Grimoire is a static, client-only single-page app: there is no backend, no accounts, and all
application state lives in the browser. This page covers the technical foundations — state
management, persistence, theming and drag and drop — for contributors and agents changing state,
persistence or styling.

---

## Tech stack

| Technology | What it is used for |
| --- | --- |
| **React 19** | UI framework |
| **TypeScript 6** | type-safe codebase |
| **Vite 8** | build tool and dev server with HMR |
| **Zustand** | lightweight state management (character store, dice roll store, roll log store, status store, app theme store) |
| **@dnd-kit** | drag-and-drop for abilities (sortable lists, cross-list moves) |
| **Lucide Icons** | the app's own icon library (chrome, panels, sheet actions) |
| **RPG-Awesome** | the 496-icon fantasy pack the status icon picker offers |
| **unicode-emoji-json** | the Unicode emoji names/groups behind the picker's emoji search |
| **react-colorful** | color picker for the customization panel |
| **react-markdown** + **remark-gfm** + **rehype-raw** | Markdown rendering in ability descriptions and bio fields |
| **Vitest** + **Testing Library** | unit and component tests |
| **Playwright** | end-to-end tests |
| **oxlint** | fast linter |

---

## State management

Zustand stores manage all application state:

- **`characterStore`** — the character list, the currently-selected sheet, live-play mutations
  (damage, healing, resource spending, milestone application), and version history. Mutations are
  debounce-autosaved (500 ms, per-character timers) to IndexedDB.
- **`gmScreenStore`** — saved GM screens and their panels: screen CRUD, panel add/remove/reorder,
  NPC instancing (spawn, duplicate, auto-labelling), instance live state (damage/heal/condition),
  and reference lookups for placeholders and delete warnings. Autosaved per screen with the same
  500 ms debounce.
- **`diceRollStore`** — the dice roll modal lifecycle: parse notation → evaluate with character
  stats → show result → forward to the roll log.
- **`rollLogStore`** — persistent roll history across all characters, stored in IndexedDB and
  filterable by character.
- **`statusStore`** — the status-condition compendium: CRUD, icon picking, and bundling referenced
  statuses into character exports. Persisted to IndexedDB.
- **`listPrefsStore`** — remembered list-page display prefs (sort key + filter selections for the
  character list, NPC list, and status compendium). Persisted to localStorage so choices survive
  page switches and reloads.
- **`appThemeStore` / `uiStyleStore` / `homeAnimationStore` / `gmPanelThemeStore` / `diceDisplayStore`** —
  app-level UI preferences persisted to localStorage (synchronously available before first paint):
  the app chrome theme, the UI style (the original look or the Terminal reskin), the home page
  ambient animation, whether a GM panel's expanded sheet body follows the app theme instead of the
  character's own palette, and whether highlighted dice notation reads as written or as its min–max
  range. Preferences only — no sheet data is stored here.

Three conventions apply across the stores:

- **Every live-play action is id-targeted** — `takeDamage(id, …)`, `spendAP(id, …)`, … so
  several sheets can be driven at once.
- **`updateCurrentCharacter` is a thin wrapper** — over `updateCharacter(id, …)`.
- **Mutations are debounce-autosaved** — 500 ms, per-character timers, to IndexedDB.

---

## Persistence

A thin promise wrapper around the native IndexedDB API (`src/lib/db.ts`) manages five object stores
(DB version 5):

- `characters` — live `Character` records keyed by `id`.
- `versions` — `VersionSnapshot` records for export history, indexed by `characterId`.
- `roll_logs` — `RollLogEntry` records for the dice roll log, indexed by `characterId`.
- `statuses` — `StatusCondition` records for the status compendium, seeded with the built-in
  Divergence conditions on first run.
- `screens` — `GMScreen` records (panel lists stored inline; no indexes).

The record shapes themselves are owned by [data model](data-model.md).

Schema migrations are handled on read via `normalizeCharacter` and `normalizeScreen`, which upgrade
older records to the latest shape:

- migrating `innateAbility` → `innateAbilities`
- adding `showActivate`
- ensuring `customTabs`, `customResourceBars` and `customAttributes` exist
- sanitizing ability `modifiers` (unknown targets / non-finite values dropped; the modifier switch
  is dropped when nothing survives)
- stamping the `kind` discriminator on legacy custom-tab sections
- completing GM-screen panels

No bulk migration is needed.

**Autosave durability:** debounced writes are flushed on `visibilitychange`/`pagehide`
(`flushPendingCharacterSaves`, `flushPendingScreenSaves`, installed by `App`), which covers
switching tabs and backgrounding. A write that is *initiated* during page unload is cancelled by
the browser before it can commit, so reloading within the 500 ms debounce window can still lose the
last keystroke-level edit — the same last-writer-wins reality as running two tabs.

**The storage layer is self-healing.** Three failure modes are handled explicitly, because
IndexedDB's are unusually hostile:

### Blocked upgrade

**Blocked upgrade → no hang.** `indexedDB.open()` has a **10-second deadline**
(`OPEN_TIMEOUT_MS`). A version upgrade is *blocked* — not failed — while another connection
holds the database open (a stale tab, or a cached older build), and in that state the browser
fires no useful event and the request never settles. Now `openDB` rejects,
`loadCharacters`/`loadScreens` record a `loadError`, and the page shows the reason with a
**Try again** button instead of spinning forever.

### Half-applied upgrade

**Half-applied upgrade → repaired on open.** If an upgrade is interrupted, the database can be
stamped at the current version while an object store was never created. Re-opening at the same
version can never fire `upgradeneeded` again, so every query fails with *"One of the specified
object stores was not found."* `openDB` therefore **verifies the schema on every open** and, if a
store is missing, closes and reopens at `version + 1` to create it — an upgrade never touches
existing records. The repair is announced once via a toast (`wasSchemaRepaired()`).

### One shared connection

- **One long-lived connection** — all helpers share a single long-lived connection
  (`withConnection`), which is what makes the repair safe.
- **The `VersionError` race** — concurrent opens from `loadCharacters` and `loadScreens` used to
  race, and one of them minted a newer version while the other was still asking for the old one
  (`VersionError`).
- **Release on `versionchange`** — the connection is released on `versionchange` so another tab
  can upgrade, and `withConnection` transparently reconnects and retries if a connection was
  closed underneath a call.
- **Skip one unreadable record** — a single unreadable record is skipped and logged rather than
  failing an entire load.

---

## Theming

Every configurable color lives in `SheetColors`. `themeUtils.colorVars()` maps them onto CSS custom
properties, which the entire sheet reads from.

- **`CustomizationPanel`** — a slide-out drawer (right edge on desktop, bottom sheet on phones)
  that exposes every color as a swatch + hex input, organized into groups (Surfaces, Text, Borders,
  Accents, Resource Bars, Stat Tokens).
- **Live, per-character changes** — the sheet stays visible and interactive while the drawer is
  open, so changes apply live via CSS variables and persist per-character.

### UI styles

The color theme is orthogonal to the **UI style** (`uiStyleStore`, Settings → Interface): `default`
is the original look, `terminal` is a retrofuturistic reskin — hard edges, monospace chrome,
phosphor glow, a CRT scanline overlay over the home page, and stepped motion. It is applied as
`data-ui-style` on `<html>`; the whole override sheet is `src/terminal-ui.css`, imported last in
`main.tsx` so its scoped rules win cascade ties against every component stylesheet. The style is
deliberately color-agnostic (glows derive from the active theme's `--accent-violet-soft`), and
per-character sheet fonts stay untouched — only the app chrome turns monospace.

---

## Drag and drop

Built on `@dnd-kit`. Four contexts cover the app's drag surfaces:

- **`AbilitiesDndContext`** — wraps the Slotted Abilities and Ability Pool sections, enabling
  cross-list moves (slotted ↔ pool) and reordering within a list.
- **`CustomTabDndContext`** — custom ability sections have their own context, so a card can be
  reordered inside its section or moved into another ability section of the same tab. Both ends of
  the drag are resolved against the **tab record**, never against a `kind` on the drag payload: the
  payload names only the list a card was rendered in, and a section's `kind` exists in the store
  alone. A cross-section drop appends to the target list (the pool ↔ slotted rule), and a drop on an
  NPC section is refused.
- **`NpcAbilitiesDndContext`** — an NPC has a single ability list, so this one only reorders. It
  is mounted *inside* `NPCAbilitiesSection`, so the same drag works on the NPC's own sheet page
  and in an NPC section bundled into a player sheet's custom tab while staying out of that tab's
  cross-section drags (a card can never be dropped from an ability section into an NPC).
- **GM Screen `SortableContext`** — the GM Screen wraps its panel canvas in a `SortableContext`
  (`SortablePanel` + `verticalListSortingStrategy`); only the frameless grip handle activates a
  drag, with a 6px `PointerSensor` distance so touch scrolling and in-panel controls keep working.

Every ability list uses that same activation constraint, `closestCorners` collision detection,
keyboard sensor and drag overlay, so a reorder feels identical wherever it happens.

What a list shows while the card is in the air is shared too, and it is computed from the one index
the drop itself will use (`previewOffsets` / `dropLineTarget` in `src/lib/abilityDropTarget.ts`):
the lifted card is drawn in the slot it is about to take, the cards it passes slide up to close the
gap it left, and a thin bar marks that slot's leading edge. dnd-kit's own sorting strategies are
switched off deliberately — `rectSortingStrategy` resolves the destination from the hovered card
alone (one slot away from the pointer-side rule the drop uses) and *scales* each card to the box it
moves onto, which squashes and stretches cards of different heights in the masonry grid. The slots
those translations are measured against are captured once per drag by `useAbilityCardSlots`, so the
preview never feeds back into the hit-testing.

The line is the **list's** element, positioned on the slot's measured box rather than hung inside
the card it marks: Chromium positions an absolutely positioned box inside a multi-column item
against the column box instead of the item, so a line drawn on a card in the second or third column
of the masonry grid landed in the wrong column entirely.

---

## Storage & privacy

- **Everything is stored locally on the user's device** — in IndexedDB, with no server, no
  account, and no network requirement for normal operation.
- The only external network calls are to the Google Fonts API, and only when the user explicitly
  imports a font.
- Character data never leaves the browser unless the user explicitly exports a JSON file.
- Deleting a character removes it from IndexedDB. Clearing browser data for the site removes all
  stored characters, version history, and roll logs.

---

## Related

- [Data model](data-model.md) — domain type shapes and derived-stat formulas.
- [Development](development.md) — local development workflow and tooling.
- [GM screen](gm-screen.md) — the GM Screen feature and its panels.
- [README](../README.md) — installation and user-facing basics.
