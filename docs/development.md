# Development

How to set up, build, test, and ship Grimoire, plus a map of the codebase.
Written for contributors and for agents working in this repository; the
[README](../README.md) is the user-facing entry point and
[CONTRIBUTING.md](../CONTRIBUTING.md) covers the contribution workflow itself.

---

## Prerequisites

- **Node.js** ≥ 18 (20 or newer recommended; the deploy workflow uses Node 22).
- **pnpm** — the package manager this repo locks with. `package.json` pins
  `pnpm@11.22.0` in its `packageManager` field, and the Pages workflow installs
  from `pnpm-lock.yaml`, so pnpm keeps a local build identical to the deployed
  one. `npm run …` works for every script below.
- Nothing else: no database, no backend, no service to run. The app is a static
  SPA and keeps all data in the browser's IndexedDB.

```bash
node --version
pnpm --version
```

---

## Setup

```bash
git clone https://github.com/Hirokizante/Grimoire.git
cd Grimoire
pnpm install
pnpm run dev
```

The dev server prints a local URL (usually <http://localhost:5173>). Produce and
serve a production build with:

```bash
pnpm run build     # tsc -b && vite build → dist/
pnpm run preview   # serve dist/
```

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

---

## Project structure

`Divergence SRD.md`, `IDEA.md`, `.hermes.md` and `.hermes/` are local
development files and are **not tracked** by git — a fresh clone will not have
them. See [Local-only files](#local-only-files).

```
Grimoire/
├── .github/workflows/deploy.yml   # GitHub Pages CI: build, then deploy dist/
├── docs/                          # Documentation — index in docs/README.md
├── e2e/                           # Playwright specs (run against a real build)
├── public/                        # Static assets served as-is
│   ├── fonts/Camiro.ttf           #   Display font
│   ├── favicon.png / .svg, favicon_alt.png / .svg, apple-touch-icon.png
│   └── icons.svg                  #   SVG sprite
├── scripts/
│   └── generate-rpg-awesome-icons.mjs  # Regenerates the icon pack's key list
├── src/                           # Application source (see below)
├── index.html                     # Vite entry HTML
├── package.json                   # Dependencies, scripts, pnpm pin
├── pnpm-lock.yaml                 # Locked tree; CI installs --frozen-lockfile
├── vite.config.ts                 # base '/Grimoire/', '@' → ./src alias
├── vitest.config.ts               # Unit tests: jsdom, globals, setup file
├── playwright.config.ts           # E2E: vite preview on :4173, Chromium
├── tsconfig.json                  # Project references (app + node)
├── tsconfig.app.json              # src options: strict, '@/*' path alias
├── tsconfig.node.json             # vite.config.ts options
├── .oxlintrc.json                 # Lint rules (react, typescript, oxc)
├── CHANGELOG.md                   # Release history, grouped by area
├── CONTRIBUTING.md                # How to contribute
├── LICENSE                        # MIT
└── README.md                      # Install and user-facing overview

src/
├── App.tsx                        # Root component: page routing, autosave flush
├── main.tsx                       # React entry point
├── vite-env.d.ts                  # Vite client types
├── App.css / index.css            # App chrome / global styles and variables
├── components/
│   ├── TitleBar.tsx               # Top navigation bar
│   ├── dice/                      # Dice roller, overlay, log drawer
│   │   ├── DiceHighlighter.tsx    #   Inline dice notation → clickable links
│   │   ├── DiceRollOverlay.tsx    #   Modal wrapper for a roll
│   │   ├── DiceResultModal.tsx    #   Full-screen roll breakdown
│   │   ├── RollLogDrawer.tsx      #   Persistent roll history
│   │   └── dice.css
│   ├── gmscreen/                  # GM Screen panels and pickers
│   │   ├── CharacterPanel.tsx     #   Live reference to a player sheet
│   │   ├── NpcInstancePanel.tsx   #   NPC base + the instance's own live state
│   │   ├── MissingPanel.tsx       #   Placeholder for a deleted record
│   │   ├── PanelHeader.tsx        #   Portrait, name, density, ⋯ menu
│   │   ├── PanelHpBar.tsx         #   HP block shared by both panel kinds
│   │   ├── PanelApBar.tsx         #   Action Point meter under the HP bar
│   │   ├── PanelStepper.tsx       #   Square − / + control for both bars
│   │   ├── PanelExpand.tsx        #   grid-template-rows open/close animation
│   │   ├── PanelSheet.tsx         #   Condensed sheet body, player or NPC
│   │   ├── PanelMortalWounds.tsx  #   Wound track for BOTH panel kinds
│   │   ├── PanelStatuses.tsx      #   Tracked status pills + Add Status
│   │   ├── RechargeBadge.tsx      #   Live Recharge cooldown read-out
│   │   ├── SortablePanel.tsx      #   dnd-kit drag-handle shell
│   │   ├── AddCharacterModal.tsx  #   Player-character picker
│   │   ├── AddNpcModal.tsx        #   NPC spawner + quick-create
│   │   ├── AddStatusModal.tsx     #   Compendium status + duration picker
│   │   ├── gmscreen.css
│   │   └── *.test.tsx             #   Panels, pickers and statuses
│   ├── home/                      # Home page ambient animation
│   │   ├── ArcaneGlowAnimation.tsx    # Volumetric light + dust field
│   │   ├── bokehField.ts              # Pure dust geometry/layout
│   │   ├── BokehMote.tsx              # One mote (scene + settings preview)
│   │   └── TerminalBootAnimation.tsx  # Self-typing boot log
│   ├── sheet/                     # Character sheet: layout, editing, live play
│   │   ├── CharacterSheet.tsx     #   Full sheet layout
│   │   ├── TabBar.tsx             #   Sheet tab navigation
│   │   ├── HeroSection.tsx        #   Portrait, name, stats, attributes
│   │   ├── StatsSection.tsx       #   Combat stats, resources, live play
│   │   ├── AttributesSection.tsx  #   Five attributes with click-to-roll
│   │   ├── SkillsSection.tsx      #   Fifteen skills with click-to-roll
│   │   ├── CoreAbilitySection.tsx #   Innate, basic attack, fatebreaker
│   │   ├── SlottedAbilitiesSection.tsx / AbilityPoolSection.tsx
│   │   ├── AbilityBlockCard.tsx   #   Single ability card renderer
│   │   ├── AbilityBlockEditor.tsx #   Inline ability form
│   │   ├── AbilityEditorModal.tsx #   Full-screen ability editor
│   │   ├── AbilityActivation.tsx  #   Activate button + cost deduction
│   │   ├── AbilityUsesMeter.tsx   #   Remaining-uses meter + − / + steppers
│   │   ├── AbilityModifierFields.tsx  # Modifier editor rows
│   │   ├── AbilityModifierToggle.tsx  # Card switch + modifier chips
│   │   ├── SubAbilityBlock.tsx    #   Nested sub-ability card
│   │   ├── SubAbilityEditorModal.tsx # Standalone sub-ability editor
│   │   ├── SortableAbilityCard.tsx / AbilitiesDndContext.tsx
│   │   ├── CustomTabContent.tsx   #   Custom tab renderer
│   │   ├── CustomAbilitySection.tsx / CustomNPCSection.tsx
│   │   ├── CustomTextSection.tsx  #   Free-form Markdown section
│   │   ├── CustomTabDndContext.tsx
│   │   ├── AddSectionChoiceModal.tsx # Ability / NPC / Text chooser
│   │   ├── NPCSelectorModal.tsx   #   Attach an existing NPC to a tab
│   │   ├── SectionViewToggle.tsx  #   Shared grid/list section switch
│   │   ├── SectionReorderButtons.tsx # Edit-mode ↑ / ↓ section pair
│   │   ├── ResourceBar.tsx        #   Segmented bar + − / + controls
│   │   ├── DamageDialog.tsx       #   Apply damage modal
│   │   ├── RecoverAction.tsx      #   Recover + End Turn buttons
│   │   ├── DeathSaveTracker.tsx   #   Death save pips + roll
│   │   ├── MortalWoundRoller.tsx  #   Wound cards, roll, manual add, Rest
│   │   ├── MortalWoundPicker.tsx  #   The table as a searchable picker
│   │   ├── MilestoneDialog.tsx    #   Guided level-up wizard
│   │   ├── CustomResourceBarModal.tsx
│   │   ├── CustomizationPanel.tsx #   Colours, fonts, layout drawer
│   │   ├── FontImportSection.tsx  #   Google Fonts importer
│   │   ├── PortraitUploader.tsx / PortraitCropModal.tsx
│   │   ├── ExportDialog.tsx       #   Versioned export + version history
│   │   ├── UpdateCharacterModal.tsx  # Import conflict resolution
│   │   ├── ConfirmModal.tsx / ConfirmDeleteModal.tsx
│   │   ├── CreateCharacterModal.tsx
│   │   ├── EditLabelsModal.tsx / SheetLabelPills.tsx  # Sheet labels
│   │   ├── ProfileSection.tsx     #   Physical description, backstory
│   │   ├── CharacterSelector.tsx  #   Slide-out character/NPC list
│   │   ├── statTokenLabels.ts     #   Full + shorthand combat-stat labels
│   │   ├── npc/                   #   NPC-specific sheet components
│   │   │   ├── NPCSheet.tsx / NPCHeroSection.tsx / NPCStatsSection.tsx
│   │   │   ├── NPCAbilitiesSection.tsx  # NPC sheet, tabs, GM panels
│   │   │   ├── NpcAbilitiesDndContext.tsx  # Reorder-only drag context
│   │   │   ├── NPCDescriptionSection.tsx / NPCExportDialog.tsx
│   │   │   └── *.test.tsx         #   NPC ability/stats component tests
│   │   ├── sheet.css
│   │   └── *.test.tsx             #   Sheet component tests
│   ├── status/                    # Status compendium UI
│   │   ├── StatusModal.tsx        #   View/edit status modal
│   │   ├── CreateStatusModal.tsx  #   New-status form
│   │   ├── StatusIconPicker.tsx   #   Emoji / RPG-Awesome / upload picker
│   │   ├── StatusIcon.tsx         #   Status icon renderer
│   │   ├── StatusHighlighter.tsx  #   Inline [Name] reference highlighting
│   │   ├── StatusReference.tsx    #   Clickable reference + hover card
│   │   ├── StatusTooltip.tsx      #   Shared status card (+ portalled variant)
│   │   └── StatusIconPicker.test.tsx  # Icon picker tests
│   └── ui/                        # Low-level UI primitives
│       ├── SegmentedBar.tsx / MarkdownText.tsx
│       ├── FilterDropdown.tsx     #   Tri-state list filter panel
│       ├── SortDropdown.tsx       #   List sort control
│       └── SelectDropdown.tsx     #   Generic single-select dropdown
├── constants/
│   ├── gameData.ts                # Attribute/skill metadata, wounds table
│   ├── statuses.ts                # Built-in status conditions + defaults
│   ├── statusDurations.ts         # The five SRD durations + theme accents
│   ├── statusIcons.ts             # Icon-pack keys/labels + Lucide fallback
│   └── rpgAwesomeIcons.ts         # GENERATED: the pack's 496 icon keys
├── context/
│   └── NotificationContext.tsx    # Toast notification system
├── hooks/
│   ├── useAbilityActivation.ts    # Shared Activate planner (sheet or panel)
│   ├── useNpcInstanceActivation.tsx  # GM NPC turns: AP, uses, Recharge
│   ├── useSubAbilityEditor.tsx    # Sub-ability editor state + handlers
│   ├── useModalDialog.ts          # Scroll lock, Esc, focus trap/restore
│   ├── useViewportClampedPanel.ts # Keep dropdown panels on-screen
│   ├── useHorizontalWheelScroll.ts  # Wheel → sideways panel strips
│   ├── useMediaQuery.ts           # Media-query subscription (GM columns)
│   ├── useImportedFonts.ts        # Google Fonts link injection
│   └── useHorizontalWheelScroll.test.tsx  # Wheel-scroll hook test
├── lib/
│   ├── calculations.ts            # Pure derived-stat formulas (HP, EVA, …)
│   ├── abilityCosts.ts            # Custom cost resolution + affordability
│   ├── abilityModifiers.ts        # Modifiers → effective values, projections
│   ├── abilityTraits.ts           # "Name (Value)" trait parser + registry
│   ├── abilityRecharge.ts         # Recharge Die + cooldown resolution
│   ├── abilityUses.ts             # Limited-use budgets, instance projection
│   ├── mortalWounds.ts            # Table lookup, D20 roll, wound slot rules
│   ├── db.ts                      # IndexedDB wrapper + normalize-on-read
│   ├── backup.ts                  # Full-app backup & restore
│   ├── exportImport.ts            # JSON export/import, versioning, snapshots
│   ├── gmScreenUtils.ts           # Panel resolution, damage outcome wording
│   ├── dice.ts / diceParser.ts / diceRoller.ts  # Roll notation pipeline
│   ├── markdown.ts                # Markdown → plain text for previews
│   ├── rehypeInlineAnnotations.ts # Mark [Status]/dice text nodes for rendering
│   ├── imageProcessing.ts         # Canvas resize + compression
│   ├── emojiCatalog.ts            # Unicode emoji catalog + alias search
│   ├── slotLogic.ts               # Minor/regular slot counting
│   ├── statusReference.ts         # [Name] reference parsing + mapping
│   ├── themeUtils.ts              # SheetColors → CSS vars, stat accents
│   ├── rollSourceUtils.ts         # Human-readable roll source labels
│   └── *.test.ts                  # Unit tests (colocated)
├── pages/
│   ├── HomePage.tsx               # Landing screen
│   ├── CharacterListPage.tsx / CharacterSheetPage.tsx
│   ├── NPCListPage.tsx / NPCSheetPage.tsx
│   ├── GMScreenPage.tsx           # Multi-sheet GM view
│   ├── StatusCompendiumPage.tsx   # Status compendium browser
│   ├── SettingsPage.tsx           # Theme, GM panels, animation, backup
│   └── PlaceholderPage.tsx        # "Coming soon" screen for unbuilt sections
├── store/                         # Zustand stores (most with a *.test.ts)
│   ├── characterStore.ts          # Characters + id-targeted live play
│   ├── gmScreenStore.ts           # Saved GM screens and panels
│   ├── diceRollStore.ts           # Dice roll modal lifecycle
│   ├── rollLogStore.ts            # Persistent roll log
│   ├── statusStore.ts             # Status compendium CRUD
│   ├── appThemeStore.ts           # App theme (localStorage)
│   ├── homeAnimationStore.ts      # Home animation choice (localStorage)
│   ├── gmPanelThemeStore.ts       # GM panel sheet theming (localStorage)
│   └── listPrefsStore.ts          # List sort/filter prefs (localStorage)
├── types/
│   ├── index.ts                   # Barrel re-exports
│   ├── ability.ts                 # AbilityBlock, AbilityCost
│   ├── character.ts               # Character, SheetConfig, SheetColors, …
│   ├── gmScreen.ts                # GMScreen, ScreenPanel, NpcInstanceState
│   ├── rollLog.ts                 # RollLogEntry, RollSource
│   └── status.ts                  # StatusCondition, StatusIconType
└── test/
    └── setup.ts                   # Vitest setup (jest-dom matchers)

e2e/
├── custom-sections.spec.ts        # Custom-tab section reordering arrows
├── gm-screen.spec.ts              # Panels, damage, wounds, statuses, layout
├── mobile-layout.spec.ts          # 360/430px layout, no horizontal overflow
├── npc-abilities.spec.ts          # Drag-reorder on both NPC surfaces
├── status-icons.spec.ts           # Icon search, save, reload, font-face
└── storage-failure.spec.ts        # Blocked/half-applied upgrade recovery
```

---

## Testing

### Unit tests

```bash
pnpm run test         # once
pnpm run test:watch   # watch mode
```

Vitest runs in **jsdom** with `globals: true` and `css: true`, loads
`src/test/setup.ts` (jest-dom matchers), and collects
`src/**/*.{test,spec}.{ts,tsx}` — tests live next to the code they cover.
`@/…` resolves to `src/…` through the alias declared in `vitest.config.ts`,
`vite.config.ts` and `tsconfig.app.json`.

What they cover:

- **Pure logic** — `calculations`, `diceParser`, `diceRoller`, `slotLogic`,
  `exportImport`, `db`, `backup`, `themeUtils`, `statusReference`,
  `abilityTraits`, `abilityRecharge`, `abilityModifiers`, `abilityUses`,
  `abilityCosts`, `markdown`, `emojiCatalog`, and `nacht` (the reference
  character's calculated fields).
- **`mortalWounds`** — the table resolved face by face, the slot rules, the
  `{ slot, roll, name }` projection, and `isKnockedOut` (a full track standing
  is *not* out; 0 HP with a slot in hand is not either; 0 HP with none is).
- **`characterStore`** — id-targeted mutations and autosave, including
  `addMortalWound`: filling the oldest slot that can take a name, resolving a
  `Pending Roll` slot, refusing off-table names and a full track, and a
  hand-added wound really reaching healing.
- **`gmScreenStore`** — CRUD, panel ops, the duplicate guard, auto-labelling,
  the instance damage/heal/downed flow, per-screen autosave, panel status
  tracking, per-instance ability uses (spending, clamping, per-panel isolation,
  untouched base record), per-instance modifier switches (flipping, isolation,
  the HP clamp, effective Armor in the damage pipeline), and the instance
  Mortal Wound track: automatic rolls, spill-over, going down when the
  allowance runs out, per-instance isolation and clearing, and
  `addInstanceMortalWound` (the entry's D20 stored beside the name, refusal at
  the allowance and for off-table names, the live read of a raised allowance).
- **The player sheet's wound block** — the `n / max` counter with no empty slot
  boxes, the read-only track edit mode renders, one action row whose
  roll/add/rest buttons share the `sheet-action-btn` class and each carry an
  icon, the Death Save roll sharing that class, which toast each wound raises
  (the Critical Condition when the roll fills the last slot, the knock-out only
  at 0 HP with no slot left, and nothing for an ordinary wound), the picker's
  search and "on track" marking, the dialog locking itself on a full track, and
  a pending slot named by hand instead of rolled.
- **GM Screen components** — panels, pickers, the placeholder, status pills +
  the Add Status picker (including a pill's click-through to the status
  description and its hover card), limited-use cards on a panel (activation
  spending the instance's own use, working ± steppers, refusal at 0), modifier
  switches moving an instance's tokens/body without touching its sibling or the
  base, manual Mortal Wound adds on both panel kinds, and `DamageDialog`
  against an NPC instance (the mook case and an auto-rolled wound).
- **The status icon picker** — emoji search against the real shipped catalog
  (name ranking, a game term like "poisoned" reaching ☠️, every alias verified
  to point at an emoji that catalog contains, the pasted-emoji path, the result
  cap), the RPG-Awesome pack's 496 keys matching every word of a query, the
  selection mark on both grids, and `StatusIcon` drawing a saved RPG-Awesome
  key as a font glyph while still drawing the Lucide keys older records carry.

### End-to-end tests

```bash
pnpm run build              # vite preview serves dist/, it does not build it
npx playwright install chromium   # once per machine
pnpm run test:e2e
pnpm run test:e2e:ui        # Playwright's UI runner
```

The suite runs against the **production build** served by `vite preview` — not
a dev server. `playwright.config.ts` starts
`npx vite preview --port 4173 --strictPort` itself (reusing an already-running
server outside CI), points `baseURL` at <http://localhost:4173/Grimoire/>
because Vite's `base` is `/Grimoire/`, runs Chromium only, fully parallel, with
`trace: 'on-first-retry'` and two retries on CI. On an offline machine that
already has a Chromium build, set `PLAYWRIGHT_CHROMIUM_PATH` instead of
downloading one. The specs live in `e2e/`:

| Spec | What it pins |
| --- | --- |
| `gm-screen.spec.ts` | Screen creation; a character mixed with two NPC instances; damaging one instance to 0 HP while its sibling is unaffected; an instance's Mortal Wound track end to end (auto-rolled wound with its D20, spill-over refill, the full-track warning, going down on the next 0 HP, a cleared wound surviving a reload, and the row staying one line without overflow at 360px); a specific wound recorded by hand on the sheet and on both panel kinds; a character walked 20 → 15 → 10 → 1 → 0 HP to pin when the knock-out is announced; persistence across a reload; player/panel state parity; delete-reference placeholders; status tracking (per-panel pills, durations, stacks, a pill's hover card asserted to render un-clipped outside the pill, click-through to its description, and a panel that stays exactly as tall with five statuses as with one, on desktop and at 360px) |
| `status-icons.spec.ts` | The icon picker in a real browser — search the emoji tab, pick, search the RPG-Awesome pack, pick, save, reload — asserting the pack's `@font-face` actually resolved (`document.fonts.check('16px RPGAwesome')`), the one thing jsdom can never cover |
| `npc-abilities.spec.ts` | A real pointer drag on both NPC surfaces — the NPC's own sheet page and an NPC bundled into a character's custom tab — asserting the drop reorders the record, survives a reload, and that the two surfaces lay the list out identically |
| `custom-sections.spec.ts` | Reordering a custom tab holding one section of each kind (ability, text, bundled NPC) with the heading arrows: every section receives its real position (a section handed the defaults has both arrows disabled, so a missing prop reads as a dead control), the pair sits in the heading row's upper-right corner, a boundary-disabled arrow does nothing, sections shift up and down, and the order survives a reload while view mode renders no arrows at all. Plus two real pointer drags between ability sections: a card dropped on a sibling card reorders, and one dropped on another section's card — or on an empty section's drop zone — moves there, with the layout read back after a reload and no grips in view mode |
| `storage-failure.spec.ts` | The recovery contract for all three failure modes: a blocked upgrade must not hang (it explains itself, and Retry succeeds once the blocking connection goes away), a half-applied upgrade repairs itself **without losing data**, and mixed reads and writes keep working on the shared connection |
| `mobile-layout.spec.ts` | Phone-width geometry at 360px and 430px: the Filter/Sort panels stay inside the viewport (clamped by `useViewportClampedPanel`) and the status grid keeps two cards per row without cutting the second one off |

Two rules for writing e2e tests:

- **jsdom has no layout**, so anything geometric (drag-and-drop with a real
  pointer, overflow, viewport clamping, font resolution) needs a browser test;
  unit tests pin the handlers themselves.
- **Autosave is debounced by 500 ms.** A test that reloads after a mutation
  must pause (~700 ms) first: a write *initiated* during page unload is
  cancelled by the browser before it commits.

### Lint and type-check

```bash
pnpm run lint        # oxlint
pnpm run typecheck   # tsc --noEmit
```

`tsconfig.json` is a solution file that references `tsconfig.app.json` (for
`src`) and `tsconfig.node.json` (for `vite.config.ts`); `pnpm run build` runs
`tsc -b` over both. The app config is strict —
`strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`,
`noFallthroughCasesInSwitch`. `.oxlintrc.json` enables the react, typescript and
oxc plugins, with `react/rules-of-hooks` as an error and
`react/only-export-components` as a warning.

---

## Building for production

```bash
pnpm run build
```

This runs `tsc -b` (type-checking) followed by `vite build`. The static output
lands in `dist/`, deployable to any static host (Netlify, Vercel, S3, …).

Vite's `base` is `/Grimoire/`, which is what makes the GitHub Pages project-page
URL work. Override it to `/` in `vite.config.ts` when deploying to a custom
domain or another root-hosted static provider.

---

## Deployment

`.github/workflows/deploy.yml` publishes the app to GitHub Pages:

- **Triggers** — every push to `main`, plus manual runs from the Actions tab.
  A `pages` concurrency group cancels an in-flight run when a new push lands.
- **Build job** — checks out the repo, installs pnpm through
  `pnpm/action-setup@v4` (which reads the pinned version from
  `package.json`'s `packageManager` field — passing `version:` as well is an
  error), sets up Node 22 with the pnpm store cached, runs
  `pnpm install --frozen-lockfile` and `pnpm run build`, then uploads `dist/`
  as the Pages artifact.
- **Deploy job** — publishes the artifact with `actions/deploy-pages@v4` in the
  `github-pages` environment.
- **Lockfile discipline** — the build installs from the tracked
  `pnpm-lock.yaml`, so the deployed bundle is built from the same dependency
  tree as a local one. Bumping a dependency means committing the updated
  lockfile with it: the workflow fails rather than re-resolving.
- **One-time repo setting** — the Pages source must be set to
  **"GitHub Actions"** (repo Settings → Pages) for the workflow to deploy.

The live app is at <https://hirokizante.github.io/Grimoire/>.

---

## Contribution workflow

1. **Branch off `main`.** Never commit directly to `main` — a push there
   deploys to production Pages immediately.
2. **Keep the change focused.** Match the surrounding code's structure and
   naming, and prefer extending a shared component or helper over forking a
   second implementation of the same behaviour (see
   [architecture.md](architecture.md) for the shared layer, and
   [gm-screen.md](gm-screen.md) for the panel-specific rules).
3. **Write tests** for new logic and for any bug you fix. Unit tests go next to
   the code; add or extend an e2e spec when the change is visual, geometric, or
   spans a reload.
4. **Verify before opening a pull request:**

   ```bash
   pnpm run lint
   pnpm run typecheck
   pnpm run test
   pnpm run build      # for larger changes
   pnpm run test:e2e   # when behaviour or layout changed (build first)
   ```

5. **Update the docs your change affects.** [docs/README.md](README.md) maps
   each area of the app to the document that describes it.
6. **Add a changelog entry** under `## Unreleased` in
   [CHANGELOG.md](../CHANGELOG.md). It is hand-written: group entries under a
   `###` heading naming the area, and state the problem, the fix, and the test
   that pins it.
7. **Commit messages** follow the existing history:
   `<type>(<scope>): <summary>` — for example
   `feat(gmscreen): let NPC instances own their ability uses`,
   `fix(mobile): keep the list menus on-screen`,
   `chore: bump version to v0.9.0-alpha`. Types in use are `feat`, `fix`,
   `chore`, `docs`, `test` and `refactor`; the scope names the area
   (`sheet`, `gmscreen`, `status`, `mortal-wounds`, `mobile`, `dice`, …).

### Generated files

`src/constants/rpgAwesomeIcons.ts` is generated by
`pnpm run icons:rpg-awesome` from the installed `rpg-awesome` package — do not
hand-edit it; re-run the script when the dependency is bumped.

---

## Local-only files

These are gitignored, so they exist only in a working copy that has them:

| File | Purpose |
| --- | --- |
| `Divergence SRD.md` | The full game rules — the source of truth for mechanics. It is alpha and occasionally contradicts itself; where two rules clash, confirm the intent with the maintainer rather than guessing. |
| `IDEA.md` | The project vision. |
| `.hermes.md`, `.hermes/` | Agent instructions and design notes for work in this repository. |

---

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md) — the short version of the workflow.
- [architecture.md](architecture.md) — stores, persistence, theming, drag and
  drop.
- [data-model.md](data-model.md) — the domain types and derived values.
- [README.md](../README.md) — install and user-facing overview.
