# Changelog

All notable changes to Grimoire are documented here. This project is in alpha:
storage format may change between pre-1.0 releases, so export (or back up) your
characters regularly.

## Unreleased

### Mortal Wounds — a knock-out is announced when it happens, not when the track fills

- **Taking the second wound is not a knock-out.** The sheet's wound roll
  announced *"Character knocked out! Death Saves begin next turn."* the moment
  the second wound landed — but the SRD's condition is narrower: a character is
  Knocked Out when they are **reduced to 0 HP with no Mortal Wound left to
  take**. Filling the last slot while they still stand is the Critical
  Condition (the block's ⚠ banner), and the knock-out is the *next* time they
  are reduced to 0 HP. The roll's `knockedOut` flag had been answering "is the
  track full?".
- **One definition, read by everything.** `isKnockedOut(slots, currentHP)` in
  `lib/mortalWounds.ts` is now that rules sentence and nothing else; the damage
  pipeline (`takeDamage`), both wound writers (`rollMortalWound`,
  `addMortalWound`) and the sheet's own read-out all resolve the state through
  it, so no surface can disagree about whether a character is out. `takeDamage`
  reached the same verdict before — it was the wound results that were wrong.
- **What each moment says.** A wound roll (or hand-picked wound) that fills the
  track raises the Critical Condition line — the very sentence the ⚠ banner
  prints, now shared as `CRITICAL_CONDITION_MESSAGE` — and stays quiet about a
  knock-out that has not happened. A wound resolved while the character is
  already at 0 HP (overkill can burn through both slots in one hit) *is* a
  knock-out, and says so. `MortalWoundResult` reports both facts separately now
  (`trackFull` and `knockedOut`) instead of conflating them.
- **The knock-out moment is announced on the sheet.** The Damage dialog's sheet
  branch words a real knock-out as one (it used to fold it into "Mortal Wound
  incurred" — or say nothing at all when the track was already full and the hit
  caused no wound), naming any wounds the same hit caused; and the HP `−`
  stepper, which runs the whole damage pipeline and can take the last point of
  HP, announces it too, instead of letting the HP bar and the Death Saves block
  rearrange themselves in silence.
- **Testing.** `isKnockedOut` / `mortalWoundsTaken` are pinned face by face
  (`lib/mortalWounds.test.ts` — full track standing is *not* out, 0 HP with a
  slot in hand is not either); the store's contracts are pinned at all three
  moments (the roll and the manual add that fill the last slot at positive HP,
  the same two at 0 HP, and the damage pair: a hit that fills the second wound
  is not a knock-out, the next 0 HP is); the sheet's block asserts which toast
  each moment raises and which it must not; and a Playwright walk takes a
  character 20 → 15 → 10 → 1 → 0 through the real sheet, asserting the
  knock-out toast appears exactly once — on the last step.

### The sheet's Mortal Wound block — a counter, one action row, one face

- **The empty slot boxes are gone.** An untouched track used to print two
  squircles that said "nothing here" a second time, right beside the block's own
  label. The block now opens with a header read-out —
  `[skull] MORTAL WOUNDS (0 / 2)` — the same shape the GM panel's wound row uses
  (`Wounds 1/2`), spelled the sheet's way (`1 / 2`, as every resource bar above
  it reads). The counter's pill fills in with the danger red once the track is
  full, so "no wound left to take" is visible before the next hit rather than
  after it (the fill, not the hue, is what carries it — the shipped theme's
  wound tone and danger red are the same color).
- **The wound actions are buttons, not bars.** **Add Mortal Wound…** and
  **Rest (Full Restore)** were `width: 100%` bars stacked down the whole Combat
  Stats block, which read as form fields and pushed the section's live-play
  controls apart. Both are now peer-sized buttons on **one row**, with an icon
  each (a `+` and a bed), and the roll — when a slot is waiting for its D20 —
  joins them as the row's primary button instead of a third full-width bar. The
  row wraps rather than overflowing on a phone.
- **The Death Save roll is the same button.** `Roll Death Save (d20)` was the
  last `width: 100%` bar in the block; it now wears the shared
  `sheet-action-btn` shape (natural width, one size, the same `Dices` icon as
  the wound roll), so the two D20s a knocked-out character rolls — the wound and
  the save — are visibly the same control. The pips, their ± steppers and the
  roll's result line are unchanged.
- **The knock-out warning reads like the panel's.** A full track still warns
  that the next 0 HP is a Knocked Out, but as a danger-tinted banner with a
  warning icon rather than a centered card that looked like a third wound.
- **One face per wound.** Edit mode used to draw its own squircle track, so the
  same wound looked different depending on which mode the sheet was in. It now
  renders `MortalWoundRoller` read-only — the same counter, the same cards, no
  roll/add/rest/clear — so the sheet has one wound vocabulary.
- **The wound accent is the sheet's own.** The block reads
  `--color-token-mortal-wounds` (Customization → Mortal Wounds), the one palette
  entry that until now was exposed but consumed nowhere on a player sheet; it is
  the player-sheet counterpart of the GM panel's `--mw-tone`. The clear ✕ is the
  lucide `X` the panel chip uses, not a `×` glyph.
- **Testing.** Unit tests pin the read-out (the counter and no slot boxes on an
  empty track, `1 / 2` once a wound lands, the pill's `--full` state, the
  knock-out banner), the action row (one row, both buttons the same class, an
  icon each, the Rest button alone on a full track), the Death Save roll wearing
  that same class, and edit mode's read-only track; a Playwright walk measures
  the two buttons on the sheet for real — one row, one height, an icon each,
  neither spanning the Combat Stats block.

### Mortal Wounds — apply a specific wound by hand, with no D20

- **A wound is not always rolled.** The D20 is the normal way onto the Mortal
  Wounds table, and every surface keeps it. But nothing about the *rules* needs
  the die: an ability in play, an NPC's authored effect or a GM ruling can name
  the wound outright, and rolling to discover what the table already agreed on
  is theatre. A specific entry can now be recorded directly, on a player's sheet
  and from either GM panel's ⋯ menu.
- **On the sheet, the wound block is always there in view mode.** `StatsSection`
  used to render the Mortal Wounds block only once a wound existed — which hid
  it exactly when the first wound had to be written down. View mode now always
  shows the track (its counter and its **Add Mortal Wound…** button, matching the
  GM panel's always-on read-out). Edit mode shows the same block read-only, and
  a clean track stays hidden while the sheet is being built.
- **The picker is the table, read as a list.** `MortalWoundPicker` (one
  component for the sheet and both panel kinds) lists all twenty entries in
  table order with their D20, name and rules text, searchable by name,
  description or number, and marks what is already on the target's track.
  Picking applies that entry — duplicates stay allowed, since two wounds can
  share a name. It stays open across picks (an NPC whose base allows several
  wounds takes them in one visit), portal-mounts to `document.body` so a
  downed/dead panel's dim cannot reach it, and re-reads the track as it writes:
  once there is no slot left it disables the list and says why, instead of
  leaving a dead click behind.
- **One table, one write per surface.** A player panel and the sheet write the
  character's real slots (`characterStore.addMortalWound`), so a wound added at
  the table shows up on the player's own sheet at once — and a wound written on
  the sheet shows up on the panel. An NPC instance appends to its own track
  (`gmScreenStore.addInstanceMortalWound`), storing the entry's D20 beside the
  name, so a hand-added chip reads exactly like an auto-rolled one ("Damaged
  Throat · 8") and its rules text resolves from the same table lookup.
- **A hand-added wound fills the oldest slot that can take a name** — an empty
  one, or one `takeDamage` parked on `Pending Roll`. Naming a pending slot is
  the manual alternative to the player's own roll (it resolves the wound that
  already happened rather than opening a second slot), and `rollMortalWound` now
  fills its slot through the same `nextMortalWoundSlot` helper, so the two paths
  can never disagree about which slot is next. Room follows the rule each
  surface already used: `MAX_MORTAL_WOUNDS` for a character, the base's live
  `npcStats.mortalWounds` for an instance — so a full track offers nothing to
  click, and the `mortalWounds: 0` mook case, which renders no track at all, is
  offered no add either.
- **Only table entries can be applied.** A wound's effects are looked up by name
  elsewhere on the sheet (halved healing, no passive END recovery, +1 END
  costs), so `addMortalWound` refuses a name the table does not define rather
  than letting an invented one take a slot and change nothing. The same guard
  covers the instance track.
- **The wound row did not grow a control.** Both entry points live in the ⋯
  menu, exactly where a player panel's pending-wound roll already lives, for the
  documented reason: `PanelMortalWounds` must stay one line at 360px on both
  panel kinds.
- **One place for the shared pieces.** `PENDING_MORTAL_WOUND` moved to
  `lib/mortalWounds.ts` (it was exported from `PanelMortalWounds`, which had the
  store and the sheet spelling `'Pending Roll'` by hand), and
  `characterMortalWounds(slots)` now owns the character-track projection both
  `CharacterPanel` and the picker read — so the chip's slot mapping and the
  "on track" marks cannot drift apart.
- **Testing.** Unit tests pin the table face by face and the slot rules
  (`lib/mortalWounds.test.ts`), the character store's manual add (filling the
  first empty slot, resolving a pending one, refusing off-table names and a full
  track, and a hand-added Circulatory Dysfunction really halving healing), the
  instance store's (the entry's D20 stored beside the name, refusal at the
  allowance and for off-table names, a raised base allowance read live, and
  per-panel isolation), the sheet's block (visible before the first wound, the
  picker's search and "on track" badges, the dialog locking on a full track, and
  a pending slot named instead of rolled), and both panel kinds' menus (the add
  appearing exactly when there is room, writing the right record). A Playwright
  walk records a wound by hand on the sheet, then one on each panel kind, and
  asserts both tracks survive a reload.

### GM Screen — a dead panel no longer dims the dialogs it opens

- **The Add Status picker is a viewport overlay again.** Opening it from a panel
  whose instance is marked **dead** painted the whole dialog at 75%: a panel's
  dead state is `opacity: 0.75` on the panel itself, and `opacity` on an
  ancestor does two things to everything inside it — it multiplies into every
  descendant's paint, and it becomes the containing block for any
  `position: fixed` box. The picker was rendered inside the panel, so the dialog
  went translucent *and* its backdrop was sized to the panel's box instead of
  the viewport, which left the page behind it undimmed.
- **The picker now portals to `document.body`**, exactly as the panel pill's
  hover card already does (`StatusTooltip`), so no panel state can reach it: the
  dialog keeps its own full opacity, its backdrop covers the whole viewport,
  and it sits on the documented modal layer (z-index 2000, below the 3000 title
  bar). `useModalDialog`'s focus trap scopes itself to `.modal-overlay`, which
  travels with the portalled dialog, so Escape, the Tab cycle and focus restore
  are unchanged — as is the picker's wiring to the panel it was opened from
  (a status picked from a dead instance still lands on that panel).
- **The title bar recedes behind the portalled picker too.** Moving the dialog
  to `document.body` put it *outside* the `.app` subtree, and the "a modal is
  open" chrome state was hung off `.app:has(.modal-overlay)` rules — so with the
  picker up, the title bar stayed fully sharp (no blur, no scrim, nav still
  clickable) while every other modal dimmed it. Those rules are now scoped to
  `body:has(.modal-overlay)` in App.css, dice.css and sheet.css: a modal is a
  viewport overlay, `body` sees one wherever it is mounted, and `.app` is inside
  `body`, so every in-page modal keeps the behaviour it had. Only the guard
  moved — the bar still carries the `::after` scrim that matches the modal
  backdrop's tint rather than `opacity`/`filter` on the sticky element itself,
  and the 4px blur still lands on the title and nav only.
- **Testing.** A component test opens the picker from a dead instance and pins
  the structure that makes the dim visible (the overlay is a child of
  `document.body`, never inside `.gm-panel--dead`) plus the still-working pick;
  a new Playwright walk marks an instance dead, opens the picker in a real
  browser and measures the painted result — the dialog's effective opacity is 1
  (every ancestor's opacity multiplied down the tree) and its backdrop covers
  the full viewport. Both fail against the previous in-panel rendering. A second
  browser walk pins the chrome state for both mount points: the bar is blurred
  (`filter: blur(4px)` on the title and nav), dimmed (the `::after` scrim at the
  backdrop's tint), and `pointer-events: none` behind the in-page Add NPC picker
  *and* behind the portalled status picker, then returns to normal when the
  dialog closes.

### GM Screen — an NPC instance owns its ability modifier switches

- **An NPC base sheet's modifier switch is visible but inert.** The switch on an
  ability that declares stat/attribute modifiers used to render on the base
  sheet (standalone and bundled into a player's custom tab) looking exactly like
  a player sheet's — and did nothing when clicked, because the store action it
  fell through to refuses to touch an `kind: 'npc'` record. A base record is the
  static reference the GM Screen spawns instances from, so its switches are
  template data: the switch and its modifier chips still read there, but the
  control is now `disabled` with a tooltip saying where it *can* be flipped.
  The switch also no longer falls through to the store from a card that is not
  the current character: that action is current-character-only, so on any other
  entity it could only ever have been a silent no-op against a record the card
  was not even drawn for.
- **Each spawned instance tracks its own switches.** `NpcInstanceState` gains a
  sparse `abilityModifiers` map (`{ abilityId: active }`), with the same delta
  rule as `abilityUses`: an absent entry means "untouched — still on the base
  ability's own `modifiersActive` flag", so a fresh instance matches its base
  sheet and only a switch the GM actually flipped is stored (flipping it back
  clears the entry). `withInstanceAbilityModifiers` projects the map onto the
  base record for rendering, and it is a projection, not a clone — an untouched
  instance still renders the base reference itself.
- **A flipped switch really applies to that instance.** The panel's chrome
  tokens (Eva/Arm/Move/DC), its HP bar cap, the expanded body's Combat Stats and
  Attributes rows, the dice resolved against them, and the damage pipeline all
  read the instance's effective stats through one shared projection
  (`gmScreenUtils.withInstanceState`, composing the uses and modifier maps), so
  an active Armor modifier reduces the next hit and a Max HP one moves the cap
  (clamping current HP when switched off) — and `DamageDialog`'s armor preview
  comes from the same numbers the store rolls. Three spawned Bandits can rage
  independently, and nothing reaches the base record.
- **Testing.** Unit tests pin the new helpers (map normalization, the
  base-flag fallback, projection identity, sub-abilities), the store action
  (per-panel isolation, the no-modifier refusal, switching a base flag off, the
  HP clamp, effective Armor in `damageInstance`, fresh duplicates),
  `normalizeScreen`'s backfill/repair, and the surfaces: the panel switch moves
  one instance's tokens/body and reaches the damage dialog while its sibling and
  the base stay put, and the standalone/attached NPC sheets render the switch
  disabled even when the NPC is the store's current character.

### GM Screen — an NPC instance owns its limited-ability uses

- **A base NPC sheet's use steppers are gone.** The ± control on a limited
  ability read `current / max` and let you move it on the NPC's own sheet page
  (and on an NPC bundled into a player's custom tab), but a base record is the
  **static reference the GM Screen spawns instances from** — nothing about a
  base sheet is live play, and its ability budgets are template data. The meter
  still reads there; the writer is simply not offered, which is also what
  removes the steppers (`AbilityUsesMeter` renders them only when it receives an
  adjuster). The store fallback writer is now gated to a player sheet that is
  the current character, so no NPC surface can grow the control back.
- **Each spawned instance tracks its own uses.** That same base count used to be
  rendered straight through to every instance, so three Bandits shared one
  number and an adjustment anywhere changed all of them. `NpcInstanceState`
  gains a sparse `abilityUses` map (`{ abilityId: remaining }`, spawned empty):
  an ability with no entry reads as its authored `max`, so every instance starts
  full and an ability added to the base later arrives full, while only a budget
  the instance actually spent into is stored. `withInstanceAbilityUses` projects
  the map onto the base record for rendering — a projection, not a clone, so an
  untouched instance still renders the base reference itself and base edits keep
  propagating. The base record's own `uses.current` is never read and never
  written.
- **Activating a limited ability on a panel spends one of that instance's
  uses**, exactly as it does on a sheet: `gmScreenStore.spendInstanceAbilityUse`
  mirrors `characterStore.spendAbilityUse` (unlimited, `expendOnActivate: false`
  and 0-left all refuse and report `false`, so the toast never claims a use it
  did not spend), the button is disabled with "No uses of X remaining" at 0, and
  the panel reports "1 use spent" like the sheet does.
- **The ± steppers work on the panel** — the instance's writer travels through
  `PanelSheet` → `NPCAbilitiesSection` → the card, and every write is clamped
  against the ability's authored maximum (a count handed back to full clears the
  entry rather than pinning today's number). Stepping spends no AP and never
  triggers the Activate path, and a duplicate instance spawns with full budgets,
  like its HP, AP and cooldowns.
- **Testing.** Unit tests pin the new helpers (the projection's identity
  behaviour, clamping, `findAbility`, map normalization), the store actions
  (per-panel isolation, clamping, refusal cases, the untouched base record, fresh
  duplicates), `normalizeScreen`'s backfill/repair, and the surfaces: a panel
  card spends and steps the instance's own count even when the base record is
  the store's current character, while the standalone NPC sheet and an attached
  NPC section render the readout with no steppers.

### GM Screen — a mouse wheel scrolls the panel strips

- **A panel's status pills and Mortal Wound chips answer a mouse wheel.** Both
  rows are ONE line that scrolls sideways with its scrollbar hidden, so a
  trackpad's two-finger swipe (`deltaX`) moved them while a mouse wheel — which
  only ever reports `deltaY`, which an `overflow-x` container never consumes —
  chained straight past the strip to the page. The rows could not be scrolled
  with a mouse at all. `useHorizontalWheelScroll` now translates a vertical
  wheel into the strip's `scrollLeft`, so one notch moves the pills or chips by
  the pixels the browser reported (line- and page-mode deltas included) and the
  page behind stays put.
- **The wheel is never trapped, and never taken when it isn't ours.** At either
  end of the strip the page gets the gesture back — the hook hands the delta to
  the nearest vertically scrollable ancestor itself, because Chromium stops
  chaining a wheel that a non-passive listener has seen, which is how "just let
  it bubble" silently killed page scrolling whenever the pointer rested on a
  full row. A trackpad's sideways swipe (momentum and all), `ctrl`+wheel (zoom)
  and `shift`+wheel stay with the browser untouched.
- **Testing.** Unit tests pin the decision for every gesture (translate, hand
  off to the page, leave the event alone, line/page deltas) plus listener
  teardown; component tests pin the wiring on both strips; and a Playwright walk
  wheels over a five-status strip and a full wound row in a real browser — the
  strip moves, the page does not, and the page takes over at the strip's edge.

### GM Screen — Mortal Wounds on player panels

- **A player panel now carries the same Mortal Wound track an NPC panel does** —
  the identical row under the HP bar
  (`[skull Wounds n/2 │ d20-and-name chips │ ⚠ next 0 HP: Knocked Out]`), the
  same per-chip ✕, the same panel-menu **Clear mortal wounds**, and the same
  one-line-that-scrolls-sideways discipline, so a wounded character never makes
  its panel taller than the one beside it. A character always allows two wounds,
  so the row is always present — the empty state doubles as the allowance
  read-out, exactly as it does on an NPC whose base allows wounds.
- **Damage dealt from a player panel rolls the D20 for the GM.**
  `characterStore.takePanelDamage` runs the character's own damage pipeline
  (armor → resistance → temp HP → HP, HP reset to max, spill-over) and then
  resolves the wound it caused, so the panel never parks a slot on
  "Pending Roll" for the GM to wait on. The player's **own sheet is untouched**:
  a hit they take there still leaves the slot pending for their Mortal Wound
  card, because that roll is theirs. The Damage… dialog and the panel's `−`
  stepper both use the panel pipeline and announce the outcome in the same
  sentence an NPC panel uses ("Vex takes a Mortal Wound: Fracture (d20 14) — HP
  reset to 15."), including `KNOCKED OUT` when the last slot fills.
- **A wound the player left pending is still resolvable from the screen.** A
  slot the player's own sheet put on "Pending Roll" renders as a dashed `?` chip
  — the row never invents a result — and the ⋯ menu offers **Roll Mortal Wound
  (d20)**, the same wording the sheet's own button uses, rolling through the
  same `characterStore.rollMortalWound`. It lives in the menu rather than in the
  row because the row is the same shape on both panel kinds and has no width to
  spare at 360px (a button beside the chips pushed the row 27px past the
  panel's edge, which the new e2e test now measures). A panel-applied hit
  resolves the oldest pending slot first, so its own damage can never *add* an
  unresolved one.
- **One row, one wording, one implementation.** `PanelMortalWounds` is now
  props-driven (wounds, allowance, the clear callback, the out-of-fight wording)
  instead of reading the GM store itself, so both panel kinds render the same
  markup — a component test pins the two rows segment for segment.
  `panelDamageOutcome` (`lib/gmScreenUtils.ts`) writes the damage sentence once
  for the dialog, both steppers and both panel kinds; the one word that genuinely
  differs is passed in, because an NPC instance is **Downed** while a character
  is **Knocked Out** and starts Death Saves — which is also what the character's
  full-track warning says, in place of the sheet's "Critical Condition" card.
- **The expanded body prints the track once.** `StatsSection` gained
  `hideMortalWounds`, passed by `PanelSheet` exactly as `hideHP`/`hideAP` are,
  so an expanded player panel does not show the chrome row and the sheet's wound
  cards at the same time. The sheet page keeps its own wound cards, its
  "Pending Roll" step and its roll button unchanged.
- **Testing.** Store tests pin the auto-roll, the spill-over arithmetic, the
  multi-wound knockout and the pending-slot rule; component tests cover the row
  on a player panel (parity with an NPC row, clearing the slot a chip actually
  belongs to, the menu's clear and roll entries, the full-track warning, the
  pending chip, the dialog's report, and the single row in an expanded panel),
  plus that a sheet outside the GM Screen still renders its own wound block; and
  a Playwright walk drives it end to end in a browser — damage → named chip →
  the character's own sheet showing the same wound with no roll left to make →
  the sheet's own damage leaving a pending slot → the panel's menu rolling it →
  the two-wound warning measured at 360px (one line, no overflow, nothing past
  the row's edge) → knockout → per-chip clear → reload.

### GM Screen — NPC Mortal Wounds

- **An NPC instance takes Mortal Wounds like a player character does** — with
  the roll made for the GM. Damage that drives an instance to 0 HP now rolls a
  D20 on the Mortal Wounds table automatically, resets its HP to maximum with
  the excess spilling over, and marks the wound on the panel. There is no
  "Pending Roll" step: a GM running four bandits gets four wound results
  without clicking a second card per knockout.
- **How many wounds it can take is the NPC's own Mortal Wounds stat.** The
  editable value on the NPC sheet (`Combat Stats → Mortal Wounds`) is the
  instance's allowance, read at damage time like max HP or Armor — so raising a
  boss to 2 or 3 applies to every instance of it already on the screen, and the
  stat's tooltip now says what it means. Healing never clears a wound.
- **`mortalWounds: 0` changes nothing.** The mook case rolls no dice, shows no
  new row, and still simply goes **Downed** at 0 HP — every existing panel is
  exactly the height and shape it was. Once the allowance is used up (or the
  base allows none), reaching 0 HP downs the instance instead of rolling, and
  the panel warns `⚠ Next 0 HP: Downed` while the track is full.
- **The track is marked in the panel chrome**, right under the HP bar:
  `[skull Wounds n/max | d20-and-name chips | warning]`. Each chip carries the
  D20 result and the wound's name with its full rules text on hover, and clears
  that one wound with its own ✕; the panel menu's **Clear mortal wounds** empties
  the track (the Rest equivalent). Like the status strip it is ONE line that
  scrolls sideways instead of wrapping, so a wounded boss never makes its panel
  taller than the mook beside it. The store keeps it per instance: three
  spawned Bandits bleed their own wounds and the base record is never written
  to.
- **One huge hit can cost several wounds** — each refill spills the remaining
  damage, so a 100-damage hit on a three-wound boss can burn the whole track and
  still down it.
- **The roll is announced where it would otherwise be invisible.** A wound
  refills the HP bar to max, which looks like nothing happened, so the Damage…
  dialog names the wound it rolled ("1 Mortal Wound rolled automatically:
  Fracture (d20 14). HP reset to 15.") and the panel's own `−` stepper — which
  runs the same pipeline — raises the same toast.
- **One implementation of the table.** `lib/mortalWounds.ts` owns the D20 roll
  and the table lookup for both surfaces; the player sheet's `MortalWoundRoller`
  and the instance's automatic roll resolve through the same function, and
  `normalizeScreen` backfills an empty wound track for screens written before
  it existed.
- **Testing.** Store tests pin the automatic roll, the spill-over arithmetic,
  multi-wound hits, going down when the allowance runs out, per-instance
  isolation and clearing; `normalizeScreen` tests pin the track repair; and
  component tests cover the mook case (no row, no roll), the marked chip, the
  full-track warning and the dialog's report.

### NPC abilities — one section, two surfaces, drag to reorder

- **An NPC's abilities can be dragged into order.** In edit mode every NPC
  ability card now carries the same grip handle the player sheet's Slotted
  Abilities use: drag a card onto another and the list reorders, on the NPC's
  own sheet page **and** in an NPC bundled into a player sheet's custom tab.
  The drop writes to whichever record owns the list — the NPC the page is
  showing, or the attached NPC inside the player's tab — so the order matches
  everywhere the NPC appears and survives a reload. An NPC has a single list,
  so there is no cross-list move (and no "Move to Pool"); a card can never be
  dragged out of an ability section into an NPC.
- **The two NPC surfaces are now one component, so they cannot drift.** A
  bundled NPC's abilities block used to be its own compact grid with an inline
  add button and no view toggle; it now renders the very section the NPC's
  sheet page renders — same heading row with the grid/list toggle on the right,
  same "+ Add Ability" button below it, same card grid (3-column masonry or a
  full-width list), same drag handles, same empty and drop-zone states. Only
  the section shell and the heading give way to the bundled NPC's compact `h5`
  block label, because there the NPC's name is the heading. The embedded
  section's grid/list choice belongs to the parent sheet's tab, exactly like a
  custom ability section's.
- **The grid/list toggle is one control again.** Slotted Abilities, Ability
  Pool, custom ability sections, an NPC's abilities and the character/NPC list
  pages all render the same `SectionViewToggle` instead of five hand-rolled
  copies of the same two buttons.
- **Nothing about live play changed.** NPC sheets outside the GM Screen are
  still static references — no Activate button, no AP meter, no cooldowns — and
  a GM panel's ability list stays a fixed list view with no toggle, read-only
  and undraggable.
- **Testing.** Unit tests pin the drop handler on both mount points (including
  the attached-NPC write and the layout parity), and a new Playwright spec
  (`e2e/npc-abilities.spec.ts`) performs the drag with a real pointer in a real
  browser on both surfaces, then reloads to prove the order persisted.

### GM Screen — NPC turns: Action Points & Recharge

- **NPC instances now take turns.** Every spawned instance is initialised with
  **3 AP**, shown in the panel through the same meter player sheets use
  (segmented bar, `−`/`+` steppers, app-theme AP color). Three spawned Bandits
  each spend their own AP — the base record never changes, and the standalone
  NPC sheet still tracks nothing.
- **Every NPC ability with a cost gets a working Activate button** in a panel,
  through the same plan, cost deduction, and toasts the player sheets use
  (`useAbilityActivation` with the panel's own resource adapter — one
  implementation, not two). The ability's *Show Activate* flag does not gate it:
  NPC abilities are authored in a mode that never offers the flag, and the
  panel's rule is "a cost means a button". Cost-free abilities stay static
  reference cards, except a cost-free ability carrying **Recharge**, which still
  activates because the cooldown is the thing being tracked.
- **Recharge (X) is implemented for NPC abilities.** Using one marks it **on
  cooldown** and disables its button ("On cooldown — Recharge X"). The trait
  chip under the ability name is the live read-out — it carries `⧗ Recharge X`
  in place of the authored `Recharge (X)` text and switches to `⧗ On cooldown —
  Recharge X` with a tinted chip, so the state never appears twice; a collapsed
  panel shows a `2 on cooldown` count beside the AP meter.
- **Start new turn** appears as a button the moment an instance's AP hits **0**
  (and is always available in the ⋯ panel menu). It refills AP to 3 and rolls
  one **Recharge Die (1d6)**: every cooling ability whose Recharge value is at
  or below the roll comes back, everything above stays cooling. The roll is
  announced in a toast and written to the roll log as a `1d6` entry tagged
  `Recharge Die: <instance>`.
- **One reusable trait parser.** `lib/abilityTraits.ts` turns any
  `Name` / `Name (Value)` tag — "Recharge (4)", "Multi-Hit(2)", "Status
  (Quick)" — into a structured trait (name, text, numeric value), matched
  case-insensitively by registry key or display name, so future traits
  (Cooldown, Reliable, …) add a registry entry and a rules module instead of a
  new regex. Recharge's rules live in `lib/abilityRecharge.ts`; cooldowns store
  bare ability ids and resolve against the base's traits at roll time, so
  editing or deleting an ability can never leave a stale cooldown behind.
- **Unchanged on purpose:** NPC sheets outside the GM Screen remain static
  references — no Activate buttons anywhere (sub-abilities included), no AP
  meter, no cooldown badges. Limited-use budgets also stay read-only in panels,
  since they live on the shared base record.
- **Player panels got the same AP meter.** AP used to exist on a player panel
  only inside the sheet body, which is collapsed by default — the resource a
  player spends on every activation was invisible at a glance. Every panel now
  renders the same `PanelApBar` under its HP bar (label row, segmented meter,
  `[−]`/`[+]` steppers), and at **0 AP** a player panel offers **Start new turn**,
  which runs the character sheet's own **End Turn** (unspent AP → END, then END
  Recovery, AP refilled) and reports the gain. The AP stat token was dropped
  from the player panel's token strip so the number is never printed twice, and
  the sheet body's AP bar is suppressed for the same reason. The remaining
  tokens all lead with an icon now — END takes the sheet's END Recovery heart,
  FP a spark — since AP and END share a hue in the default theme.
- **An out-of-AP panel dims.** When the entity in a panel reaches 0 AP its
  chrome recedes — header, HP bar, tokens, expanded sheet body — so a glance
  down the screen shows who has already acted. The AP block is exempt (it holds
  the manual `+` stepper and Start new turn), the dim is `opacity` only so every
  control stays interactive, and it clears the moment AP comes back.
- **One bar vocabulary for panel chrome.** The HP block is now one shared
  component (`PanelHpBar`) used by player *and* NPC panels, and both it and the
  AP meter are a label row plus a `[−] track [+]` row whose steppers are the same
  `PanelStepper` control: identical lucide glyphs, identical boxes, dead-centre
  icons (the old typed "−"/"+" sat high in its box), and the row's action button
  (Damage…, Start new turn) pinned at the end. Steppers disable only when their
  action is a no-op — and a disabled stepper keeps its box so the row never
  looks like it is missing a control.

### GM Screen — optional app-theme panel sheets

- **New setting: Settings → GM Screen → *Match app theme*.** With it on, a
  player panel's expanded sheet body drops its custom colors, card background,
  and fonts, and renders in the active app theme — the same body an NPC panel
  has always shown. Reading several sheets at a glance is the whole point of
  the screen, and a row of wildly different palettes defeats it; the panel
  *chrome* has followed the app theme from the start, and this extends the same
  voice to the sheet content. **Off by default**, so nothing changes unless the
  GM asks for it.
- **It is display only.** The switch is read while rendering and never written
  to the character: the character's own sheet page, its Customization panel,
  its exports, and its version history keep every custom color. A test renders
  the full sheet page with the setting on and asserts its palette is untouched.
- **Both panel kinds now build their body from one helper**
  (`gmPanelSheetPresentation` in `themeUtils.ts`), so "player panel with the
  setting on" and "NPC panel" cannot drift apart — a test compares the two
  bodies class-for-class and variable-for-variable under every app theme.

### Combat Stats — one color per stat, on every panel

- **A player panel and an NPC panel now color their Combat Stats tokens the
  same.** The two rows drew from different sources — an NPC's from the app
  theme's tuned stat palette, a player's from the character's own sheet colors —
  so Evasion could be blush on one panel and cyan on the next, Movement green on
  one and gold on the other. `NPC_STAT_TOKEN_COLORS` is now
  **`STAT_TOKEN_COLORS`**, covering both rows (Milestones and END Recovery
  joined the six), and the four stats the rows share — **Evasion, Armor,
  Movement, Save DC** — are read from the same entry by both panels.
- **The row is app chrome, like everything else in a panel.** A panel colors its
  Combat Stats from that shared palette whether or not *Match app theme* is on,
  and the panel chrome's own Eva/Arm/Move/DC tokens read the same entries, so a
  stat is one color everywhere on a panel. (END/FP keep the resource-bar colors:
  those are pools, not combat stats.) **Per-sheet customization is intact** — a
  character's own sheet page still paints its Combat Stats with the colors from
  their Customization panel, and nothing is written to the record.
- **Milestones and END Recovery got tuned accents per theme:** the sheet's own
  gold for Milestones, and a calm, restorative tone for END Recovery — mint in
  Midnight, warm sand in Parchment, Nord snow in Mikami, taupe in Pitch Black.
  The palette test now checks distinctness **per row** (ΔE(CIE76) ≥ 16 between
  every pair of stripes a GM reads side by side) plus ≥ 3.5:1 contrast against
  the card surface for all eight accents.

### Combat Stats — shorthand labels and one token height in expanded panels

- **An expanded panel's stat tokens print shorthand, not an ellipsis.** A
  panel's token column is ~7.5rem wide, so the full names were being cut to
  "MILEST…", "SAVE …" and "END RE…" — unreadable at a glance, which is the one
  thing the row exists for. Panels now read `Miles / Eva / Arm / Move / Save /
  END Rec` (and `Wounds` for an NPC's Mortal Wounds) from one shared vocabulary,
  `SHORT_STAT_LABELS` in `StatsSection.tsx`, chosen so the row agrees with the
  panel chrome's own **Eva/Arm/Move/DC** tokens — a stat can no longer be called
  one thing above the body and another inside it. Every token carries its full
  name as a **tooltip**, so the shorthand is never a loss of information, and a
  sheet page — which has the width — keeps the full names (`tokenLabels` defaults
  to `full`; only `PanelSheet` asks for `short`). A measured e2e check fails if
  any panel label is clipped again.
- **Every stat token is one line, one height, on every sheet — and the
  Milestones bonus rides in that line.** The bonus used to be its own line under
  the label ("+2 bonus"), which made the Milestones token ~48px against its
  row-mates' ~34px; and because grid cells stretch, its whole row stood taller
  than the row beneath it. Reserving that second line on every token made the
  rows agree but cost ~13px of slack per token. It is now printed inline —
  **`Miles +2`** (shorthand on a panel), **`Milestones +2`** on a sheet page —
  so a token is a single line of stat, every token in the app is the same
  ~34px, a player panel's row matches an NPC panel's beside it exactly, and the
  content stays centred. The number is its own element, so the label's ellipsis
  can never truncate it, and nothing is printed at all when the bonus is 0.

### Fixes

- **A pooled ability's sub-abilities no longer offer Activate.** The Ability
  Pool holds *inactive* abilities, so its cards have never carried an Activate
  button — but the sub-abilities nested under a pooled ability fell back to
  their own *Show Activate* flag and grew one anyway, spending the character's
  real AP from a card that is not in play. The pool now passes the same
  "nothing here activates" resolver the standalone NPC sheet uses; a resolver is
  the last word on activation, so it reaches the nested cards too. Slotted, core
  and custom-tab sub-abilities are untouched, as are the use steppers everywhere
  (a counter is not an activation), and an attached NPC section — a static
  reference like the NPC sheet — gets the same treatment.
- **The NPC sub-ability editor no longer offers *Show Activate*.** An NPC sheet
  outside the GM Screen never renders an Activate button (NPCs activate only
  through a GM Screen panel's own "a cost means a button" rule), so the
  sheet-level sub-ability editor now hides the toggle — along with the END/FP
  cost inputs and custom resource costs — exactly as the main NPC ability editor
  already did. Player sheets keep all of them.

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
