# Changelog

All notable changes to Grimoire are documented here. This project is in alpha:
storage format may change between pre-1.0 releases, so export (or back up) your
characters regularly.

## v0.8.0-alpha — 2026-09-11

The GM Screen release. Eight commits since `v0.7.0-alpha`.

### GM Screen

- **Saved screens** — create as many named screens as you like ("Session 4",
  "Dungeon Run"), switch between them with the pill row, rename them inline,
  and delete them with a confirmation. Screens persist in IndexedDB, survive
  reloads, and the screen you had open reopens automatically.
- **Panels are live references, never copies** — a player panel reads and
  writes the character's real sheet, so HP/AP/END/FP changed at the table is
  what that player sees. NPC panels are instances that own only their live
  state (HP, temp HP, condition) and display label; stats, abilities, and
  portrait are read from the base record at render time, so base edits
  propagate and there is never a second NPC record to keep in sync.
- **Compact and expanded panels** — compact is a glance-height card (portrait,
  name, HP bar with −/+/Damage…, key stat tokens, condition badge); expanded
  renders the sheet body inline (Combat Stats, Attributes, Abilities, Skills).
- **Add Character / Add NPC** — a searchable picker over your sheets (each
  character can appear once per screen) and a base-statblock picker that spawns
  labelled instances ("Bandit 2"), with **New NPC…** creating a base *and*
  spawning an instance without leaving the screen.
- **Damage and downs** — the same `DamageDialog` as the sheets, targeting
  whichever panel opened it. NPC armor and max HP come from the base record,
  temp HP from the instance. Reaching 0 HP downs an instance (NPCs roll no
  death saves), healing revives it, and the panel menu can flag it `dead` —
  which healing never clears.
- **Rolls from panels** — attribute, skill, and ability rolls resolve against
  that panel's entity and land in the roll log, annotated with the instance
  label. The roll-log drawer is available in "all characters" mode.
- **Reordering and layout** — drag a panel by its grip handle to reorder it;
  two columns above 700px, one below. On phones the Add buttons collapse into
  a sticky bottom-right group and panels never overflow horizontally.
- **Missing references don't cascade** — deleting an NPC base or character that
  a screen references is still allowed (the delete confirmation lists the
  affected screens) and leaves a removable **Missing NPC / Missing character**
  placeholder, derived at render time.

### Panel status tracking

- **Add Status on every panel** — a searchable compendium picker offering the
  five SRD durations (Quick, Persistent, Countdown, Permanent, Conditional) as
  labels only, with no timers.
- **Two-segment pills inline with HP** — the filled left segment carries the
  status icon and full name, the quiet right segment the duration and the
  stack stepper. The strip is one non-wrapping, sideways-scrolling line, so a
  panel never grows taller as conditions accumulate and names are never
  truncated. Stacks clamp to [1, 99]; at one stack the − becomes an explicit ✕.
- **Pills are status references** — clicking the filled segment opens the
  condition's description in the global status modal, exactly like a
  `[StatusName]` reference on a sheet, and hovering or focusing it shows the
  shared icon/name/description card. The card is shared, not copied
  (`StatusTooltipCard` back both surfaces) and is portalled with a measured,
  flip-aware anchor so it renders in full outside the pill's clipped,
  scrolling strip without changing the panel's geometry.
- **Tracking belongs to the panel** — it references the compendium by id, so
  renames propagate, a deleted status leaves a removable placeholder,
  duplicating an instance inherits nothing, and nothing reaches the character
  sheet. `normalizeScreen` backfills and repairs the list on read.

### Ability stat & attribute modifiers

- **Abilities can modify the sheet** — signed modifiers against the five
  Attributes (MAR, POW, AGI, VIT, GRT) and the derived combat stats (Evasion,
  Armor, Movement, Save DC, Max HP, END Recovery). Ticking "Modifies combat
  stats / attributes" in the editor reveals one row per modifier.
- **Applied by an independent on/off switch** — each qualifying ability gains a
  card switch that applies every modifier on it, costs no resources, and is
  independent of Activate, so passive stances, forms, and auras work without
  spending AP. It applies wherever the ability sits: core, slotted, pool,
  custom tabs, or nested sub-abilities — the switch, not the slot, is what
  counts.
- **Never baked into the stored sheet** — attribute modifiers resolve first (so
  `+1 VIT` also raises Max HP and Armor), then direct stat modifiers layer onto
  the derived values. Display, dice rolls, damage/armor resolution, heal caps,
  and END Recovery all read the *effective* value, and modified values are
  flagged with a delta chip. NPC abilities support the same feature (minus END
  Recovery), and HP is clamped so switching a Max HP modifier off can never
  leave the bar above its cap.

### Limited-use abilities

- **Use budgets** — flag an ability as limited in the Ability Block editor to
  set a maximum (1–99) and choose whether Activate spends a use (on by
  default; untick it to track a budget something else consumes). Retyping the
  maximum redefines the budget, so the authored number is the whole limit and a
  fresh ability starts full. The budget lives on the ability, so it follows it
  wherever it sits on the sheet.
- **Readable counts** — one circle per use at 5 or fewer (filled = available,
  hollow = spent), a plain `current / max` above that, with a single accessible
  label for the whole readout.
- **Manual steppers** — compact −/+ steppers flank every limited ability so a
  use can be spent out of turn, refilled by the GM, or handed back after a
  mis-click. They stop at the bounds, never cost resources, and never trigger
  the Activate logic; they appear in both sheet modes and wherever the ability
  lives, whether or not it has an Activate button. A GM panel's entity keeps a
  read-only meter, and drag ghosts render their steppers inert.
- **Exhausted and rest** — an ability with no uses left cannot be activated
  (the button is disabled with an explanatory tooltip and deducts nothing), and
  the single rest path (`fullRestore`) refills every limited ability on the
  sheet.

### Home page

- **Arcane Glow rebuilt as a light-shaft scene** — the default home background
  is no longer drifting blobs but a volumetric shaft of light falling through a
  dark room, air haze pooled where it lands, and a slow field of out-of-focus
  dust motes at three depths, the ones caught in the beam glowing warm. The
  shaft is SVG polygon geometry (a rotated rectangle cannot diverge like a
  light cone); the dust field is seeded in `bokehField.ts` instead of
  `Math.random()` in render, so motes no longer teleport on every re-render.
  The Settings preview samples the real field, so scene and thumbnail cannot
  drift apart. Blur and `screen` blending sit on the wrapper — one filter pass,
  only the wrapper animates, motes move `transform`/`opacity` only — and every
  animation freezes under `prefers-reduced-motion: reduce`.
- **Home nav fits five tiles** — the grid was still sized for four, so the
  tile added with the GM Screen wrapped onto a second row. Tracks are still
  capped at 9.5rem but may shrink to 4rem rather than wrap, and the grid is
  capped at `min(100%, 57.25rem)`, so the row stays on one line at any width.

### Storage & data

- **GM screens are part of a backup** — `backupVersion` is now **2** and
  Settings → Backup & Restore covers screens alongside characters, NPCs, the
  status compendium, version history, and the roll log; restoring replaces all
  of them in one atomic IndexedDB transaction. Newer-version backups are
  refused with a clear message, and **v1 backups still restore** (they simply
  carry no screens).
- **Blocked upgrade → no hang** — `indexedDB.open()` now has a 10-second
  deadline (`OPEN_TIMEOUT_MS`). A version upgrade is *blocked*, not failed,
  while another connection holds the database open (a stale tab, or a cached
  older build) and in that state the browser fires no useful event and the
  request never settles. `openDB` now rejects, `loadCharacters`/`loadScreens`
  record a `loadError`, and the page explains the reason with a **Try again**
  button instead of spinning forever.
- **Half-applied upgrade → repaired on open** — if an upgrade is interrupted,
  the database can be stamped at the current version while an object store was
  never created, and re-opening at that version can never fire `upgradeneeded`
  again. `openDB` therefore verifies the schema on every open and, if a store
  is missing, closes and reopens at `version + 1` to create it, never touching
  existing records. The repair is announced once via a toast
  (`wasSchemaRepaired()`).
- **One shared connection** — all helpers share a single long-lived connection
  (`withConnection`), which is what makes the repair safe: concurrent opens
  from `loadCharacters` and `loadScreens` used to race, and one minted a newer
  version while the other was still asking for the old one (`VersionError`).
  The connection is released on `versionchange` so another tab can upgrade,
  `withConnection` transparently reconnects and retries, and a single
  unreadable record is skipped and logged rather than failing a whole load.
- **Every live-play mutation is id-targeted** — `takeDamage(id, …)`,
  `spendAP(id, …)`, and friends replace the "current character" assumption, so
  one tick can drive several sheets; `updateCurrentCharacter` is a thin wrapper
  over `updateCharacter(id, …)`. Autosave debounce timers are per-id (500ms)
  for characters and per-screen for GM screens.

### Fixes & refactors

- **Picker dialogs scroll from anywhere in the dialog** — the body carried
  `overflow-y: auto` while still being sized by its content, so it never
  scrolled itself and its `overscroll-behavior: none` swallowed the wheel
  instead of chaining to the dialog. The dialog is now a flex column whose body
  is the scroller (`min-height: 0`), which also keeps the header ✕ and footer
  action pinned at any scroll offset.
- **Aligned panel header controls** — the Add Status and ⋯ buttons were 49×35
  text boxes whose icons hugged the left edge once squared. All three square
  icon buttons now share one size, one right edge, and an explicit
  `justify-content: center`.
- **Use steppers show wherever a limited ability lives** — they were gated on
  `mode === 'view' && ability.showActivate`, hiding them in edit mode (where
  custom-tab cards are usually built) and on every ability with Activate turned
  off, including the sub-abilities nested under it. They now depend on exactly
  one thing: whether a writer exists for the entity the card belongs to.
- **NPC Combat Stats token accents** — the standalone NPC row swaps
  Milestones/END Recovery for HP/Mortal Wounds, so reusing the sheet palette
  left stripes indistinguishable (and colorless for HP and Mortal Wounds).
  `NPC_STAT_TOKEN_COLORS` gives each app theme a tuned six-hue set, with a unit
  test enforcing a distinctness floor. NPC sheets now follow the app theme;
  sections embedded in a player sheet still let the player theme win.
- **NPC mortal wounds** — the stat now exists on NPC records and is editable in
  the customization panel, and the ability-block cost/activation logic
  duplicated between `AbilityActivation` and `SubAbilityBlock` moved into a
  shared `useAbilityActivation` hook.

### Tests

- 557 unit tests across 33 files, plus 10 Playwright tests in `e2e/` against
  the production build: `e2e/gm-screen.spec.ts` drives screen setup,
  instancing, damage, persistence, status pills and stacks, picker scrolling,
  header alignment, the status card rendering un-clipped outside its pill, and
  a 360px layout — and `e2e/storage-failure.spec.ts` pins all three
  storage-recovery contracts.

## v0.7.0-alpha — 2026-08-26

- **Custom resource bars** — abilities can spend costs from custom resource
  bars (pick the bar and amount at activation), and existing bars can be edited
  directly from the sheet
- **Flavor text** — ability flavor text displays before the description
- **Tri-state list filters** — gallery filters support include / exclude /
  neutral states
- **Persistent list preferences** — sort and filter choices are remembered
  across sessions
- Stopped overscroll chaining and page rubber-banding
- Scoped the drawer gutter transition to drawer states only
- Animated the customize drawer's exit before hiding it
- Docked panels use the live-measured header height
- Modal dimming covers everything behind the modal, including the sticky title
  bar, and dialogs are sized to the overlay content box
- Scroll chaining works from sub-panels into the modal body

## v0.6.0-alpha — 2026-08-24

- **Sub-abilities** — ability blocks support nested sub-abilities under the
  description and overcharge fields
- **Custom labels** for character and NPC sheets, shown on gallery pages
- **NPC hero enhancements** — hero sections embed combat stats and attributes
  with click-to-roll
- **Filter & sort on gallery pages**, and a **live-preview customization
  drawer** replacing the modal
- **Roll source tracking** — ability damage and description rolls record their
  source in the roll log
- **Theme-matched chrome and dice UI**
- Unified modal behavior behind the `useModalDialog` hook; fixed title-bar
  z-index and NPC Ability Block Editor controls

## v0.5.0-alpha — 2026-08-19

- More UI customization options

## v0.4.0-alpha — 2026-08-18

- A settings menu for changing the app theme and creating/restoring backups

## v0.3.0-alpha — 2026-08-18

- The **Status Compendium**: create custom conditions and reference them in
  descriptions as `[StatusName]`, plus a portrait crop tool

## v0.2.0-alpha — 2026-08-16

- NPC support, and custom tabs that can embed NPC sheet and text block sections

## v0.1.0-alpha — 2026-07-15

- First pre-release: sheet creation and sheet management
