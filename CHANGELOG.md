# Changelog

All notable changes to Grimoire are documented here. This project is in alpha:
storage format may change between pre-1.0 releases, so export (or back up) your
characters regularly.

## Unreleased

### Ability card drag — a preview that shows the landing slot, undeformed

- **The drag preview squashed and stretched the cards it moved.** Every ability
  list hangs off dnd-kit's `rectSortingStrategy`, which moves each card onto the
  *box* of another card and **scales** it to that box's size. That is fine for a
  uniform grid and wrong for this one: the card grid is a masonry of cards with
  different heights, so the cards sliding past were visibly deformed, and the
  lifted card's own faded placeholder — the translucent preview that shows where
  the block will land — was deformed too as it was scaled into the destination
  slot. It also resolved the destination from the hovered card alone, which is
  one slot away from the pointer-side rule the drop itself uses, so the preview
  could promise a slot the release did not take. The preview is now computed from
  the resolved drop index (`previewOffsets`): each card is **translated** onto
  the slot the drop will leave it in and never scaled, and the lifted card is
  drawn in the destination slot itself. dnd-kit's sorting transform is switched
  off in `AbilityBlockList` so the two can't disagree; the slots the translations
  are measured against are captured once per drag by the new
  `useAbilityCardSlots`, so the preview never feeds back into hit-testing.
- **The line indicator was vertical, stretched and in the wrong place.** It was a
  full-height bar in the left gutter of whichever card had the dragged card's
  index — in the first column that meant a stray bar outside the grid, and when
  the drag moved forward the card it was drawn on had already slid up a slot, so
  the line sat where the card had *come from* rather than where it was going. It
  is now a thin horizontal bar spanning the full width of the slot the card lands
  in, drawn in the gap on that slot's leading edge, in the masonry grid and the
  list view alike (both flow cards down a column). "After the last card" is
  marked under the last card it will follow instead of in a zero-width trailing
  slot, which is gone. The line is the **list's** element, drawn on the slot box
  the preview translates cards onto, rather than a child of the card it marks:
  Chromium positions an absolutely positioned box inside a multi-column item
  against the column box instead of the item, so a line hung inside a card in the
  second or third column of the masonry grid was painted in another column
  entirely — the drop preview test now uses cards of *different* heights, which
  is what makes that measurable.
- **Dropping a card in the gap under the last one did nothing.** The gap is a
  gap index one past the end of the list, and `reorderAbility` rejected any
  `toIndex` outside the list — so the drag was silently dropped while the preview
  drew the card landing at the end. It now clamps, the way `moveAbility` already
  did, so the card appends (and a card already last stays put).
- **Testing.** `abilityDropTarget.test.ts` pins the arithmetic: the lifted card
  is drawn in the slot it takes, a drop past the end previews as the last slot, a
  card arriving from another list moves nothing, and — across every
  active/gap pair on a six-card list — reading the drawn boxes back in slot order
  reproduces the reorder exactly, as a permutation of the slots with nothing
  stacked or lost. `characterStore.test.ts` pins the append.
  `e2e/ability-card-drag.spec.ts` drags a card past a *taller* neighbour with a
  real pointer and asserts every card's drawn box still matches its laid-out size
  (a scaled card is exactly what that compares), that the line spans the landing
  slot's width on its leading edge, and that the card settles where the preview
  drew it; it also pins the "after the last card" line.
  `e2e/custom-sections.spec.ts` does the same for a custom tab's sections, and
  now waits for a previous drag's lifted copy to unmount before starting the next
  one — it is a fixed overlay sitting where its card landed, and a press aimed
  through it was silently swallowed.
- **An NPC's ability list drew no preview at all.** The list registered its drop
  resolver with the wrong drag context. `useAbilityListDnd` files that resolver
  with the *nearest* `AbilityDropHintContext` above it, and the hook was called in
  `NPCAbilitiesSection`'s own body — which sits *above* the
  `NpcAbilitiesDndContext` the section renders. The registration therefore landed
  in whatever wrapped the section: a player sheet's custom tab drag context when
  the NPC was embedded in one, and no store at all on the standalone NPC sheet,
  where dnd-kit's defaulted internal context makes `useDroppable` and the
  registration silently no-op rather than throw. The context that actually ran the
  drag resolved no hint on any move, so the list drew no insertion line, never
  slid the cards into the slots the drop would leave them in, and never framed
  itself while hovered — while the reorder still landed, because `onDragEnd`
  re-derives the destination from the hovered card when no hint was published.
  That fallback is what made the gap invisible: the drag *worked*, it just showed
  nothing. The list is now rendered by `NpcAbilityList`, a **child** of the
  context, so both NPC surfaces (standalone and embedded) draw exactly what the
  player sheet's sections draw — the same `AbilityBlockList`, the same
  `previewOffsets` / `dropLineTarget` maths, the same resolved index behind the
  line and the landing slot. The section also mounted its context twice in edit
  mode; there is one now.
- **Testing.** A unit test in `NPCAbilitiesSection.test.tsx` watches the hint
  store's registrations and pins that the resolver reaches the NPC's *own*
  context and never the one wrapping the section (it fails on the old wiring).
  `e2e/npc-abilities.spec.ts` asserts the live preview on both NPC surfaces —
  including the embedded one, nested inside its tab's context, where a
  registration in the wrong store was invisible to the reorder — and drags a
  player Ability Pool and an NPC list with the same gesture, comparing the two
  drawings card for card: same marked slot, the same cards moved onto the same
  slots, nothing scaled, and the card settling exactly where the line drew it.

## v0.10.0-alpha — 2026-09-15

The dice release. Eleven commits since `v0.9.0-alpha`, and the through-line is
that the sheet now does its own arithmetic. Notation grows from "a die plus
modifiers" into an **expression language** — parentheses, `*` and `/`, signed
factors and negation — so `(1d6+POW)*2/2d6+MAR` is one clickable pill that
rolls exactly what it reads; an ability can **roll its own dice the moment it is
activated** (accuracy, damage and any number of named custom rolls, together in
one window, resolved against whoever activated it); and a sheet can define
**attributes of its own** that are dice-notation tokens like any built-in one.
The rest of the cycle is table friction: `[Status]` references survive a
hand-written HTML block, a custom tab's sections reorder with ↑ / ↓ and its
ability cards drag between sections again, the Filter / Sort menus and the
status grid stay on a 360px phone, and a swatch's color picker opens fully
on-screen.

**No migration to run** — the IndexedDB schema stays at version 5, and
everything new is additive and backfilled by `normalizeCharacter` on read: an
ability stored by `v0.9.0-alpha` loads as "rolls nothing on activation", and a
sheet written before this release simply has no custom attributes until one is
added.

### Compound dice notation — parentheses, multiplication and division

- **Dice notation can now express a whole calculation.** Until now the parser
  read a die followed by any number of `+`/`-` terms, so an expression that
  halved, doubled or scaled anything had to be worked out at the table. It now
  parses an **expression tree**: `*` and `/` (which bind tighter than `+`/`-`),
  parentheses to override them, and signed factors, so
  `(1d6+POW)*2/2d6+MAR` is one clickable token that does exactly what it reads —
  double the d6 plus POW, divide that by a fresh 2d6, then add MAR. Division is
  integer division and **rounds down** (`1d6/2` on a 5 is 2), and dividing by
  zero contributes 0 instead of poisoning the total. A subtracted die now
  subtracts: `d20-2d6` was read as `d20+2d6` before, because dice "are always
  positive".
- **The matcher reads the same expression out of prose.** `findDiceNotation` no
  longer pattern-matches a dice term followed by modifiers; it runs the parser
  from each candidate start and keeps the longest expression that contains a die
  (`(1d6+POW)*2/2d6+MAR` in a description highlights as one pill, and
  `2*(1d6+2)` comes along whole). Two shape rules keep it out of prose's way:
  **`*` and `/` must be written tight** (`2d6*3`, `1d6/POW`) while `+`/`-` stay
  free-spaced, so Markdown emphasis is not multiplication (`*1d6+2* slashing`
  highlights `1d6+2`); and a slash between two bare names is still the
  `POW/MAR` alternative form, not division — division is what a number, a die or
  a group on either side means (`2d6/POW`, `1d6+POW/2`). A match must roll at
  least one die, so arithmetic and bullet dashes stay literal, and a dice-shaped
  token the parser refuses (`0d6`, or a count past 1 000) is skipped whole
  rather than matched as its `d6` tail.
- **The result window shows the working, not a flat sum.** Each term keeps the
  operator that joins it to the one before it (`+POW(4)`, `× 2`, `÷ 2d6`,
  `+MAR(3)`) and the breakdown line keeps the expression's shape —
  `(1d6+POW)*2/2d6+MAR → (3 + 4) × 2 ÷ (3 + 3) + 3 = 5` — so a compound roll is
  checkable at the table. A subtracted group wears its minus in the term list too
  (`1d6-2*3` lists `-2`, `× 3` — not `+2` beside a negative total). Simple
  notation renders exactly as before.
- **Pasted text cannot hang or crash a sheet.** The scanner now skips a whole
  token instead of stepping one character at a time (a pasted run of 50 000
  digits took seconds inside a render), and the parser refuses what it cannot
  walk safely rather than throwing mid-render: a die of more sides than
  `Number` can hold (`1d<400 nines>` used to parse as `Infinity`), an expression
  of more than 64 terms, and groups or signs nested more than 32 deep are simply
  not notation — nothing highlights, nothing rolls. A die hidden inside a word
  run (`...and d20+3`) is still found.
- **Compatibility.** `RollResult` keeps its shape (`notation`, `total`, `terms`,
  `breakdown`): `TermResult.op` is additive, so roll-log entries stored by an
  earlier version still render, and crit/fumble detection reads the same dice
  leaves wherever they sit in the expression (a d20 inside `(d20+POW)/2` still
  counts). `ParsedExpression.terms` — an internal flat list nothing but the
  emptiness check consumed — is replaced by the parsed `root`, and activation
  rolls skip an expression the parser cannot read exactly as before.
- **Testing.** `diceParser.test.ts` pins groups, precedence, the tight-operator
  and alt-vs-division rules, negation, backtracking and free-text matching
  (`*1d6+2*` emphasis, bullet dashes, `0d6`, `2000d6`, half-typed operators),
  plus the runaway-input guards (deep parens, term chains past the budget, long
  digit and letter runs) and that each stays fast;
  `diceRoller.test.ts` pins the evaluated totals, the floor division and
  divide-by-zero rules, the per-term operators, the negated-group terms and the
  shaped breakdown;
  `DiceTermBreakdown.test.tsx` pins the operators drawn for a compound working
  and the unchanged flat rendering; `DiceHighlighter.test.tsx` drives detection
  → click → evaluated result for a compound expression; and
  `e2e/dice-notation.spec.ts` writes `(1d6+POW)*2/2d6+AGI` into a real
  description in the production build, checks it highlights as one pill with the
  prose around it untouched, and reads the operators and the working back out of
  the result window.

### Automatic dice rolls on ability activation

- **An ability can roll its own dice the moment it is activated.** The Ability
  Block editor gains **Roll Dice on Activation**, which reveals three parts: an
  **accuracy** roll (`d20 + ` any of the five Attributes **or any of the
  sheet's own custom attributes**, listed side by side in the one picker, with
  an optional extra notation bonus like `+2` or `+1d4`; an NPC's picker offers
  the five Attributes alone, since custom attributes are a player-sheet
  feature), a **damage** roll (the ability's own Damage field — no second copy
  of the expression to keep in sync, and the box stays disabled until there is
  damage to roll), and **custom rolls** (`+ Add Custom Roll`, each with an
  optional name and an optional **Hide result**). Unticking the box stores
  nothing at all.
- **One Activate press, one window.** Every configured roll happens in a fixed
  order — **accuracy, then damage, then the custom rolls as authored** — and all
  of them appear together in the shared dice-result modal, headed by the
  ability's name and stacked as cards: which part of the activation it was, the
  notation, the big total, the individual dice, the working
  (`d20+MAR → 15 + 4 = 19`) and a nat 20 / nat 1 badge where it applies. Each
  card wears the colour of its part (violet for accuracy, red for damage, blush
  for a custom roll) as a thin border around the whole card. A roll marked
  *Hide result* keeps its total but folds its working behind **Show result**, so
  a long optional list still reads at the table. Each part is also written to
  the roll log as its own entry (`Activation: Cleave (accuracy)`), so the log
  stays a roll-by-roll history.
- **The notation resolves against whoever activated it.** `lib/activationRolls.ts`
  builds the plan at roll time from the acting entity, so the same authored
  `d20+MAR` uses each activator's own value — a player's sheet, a sub-ability's
  own button, a GM Screen **player panel**, and an NPC **instance** on the GM
  Screen (the base record plus that instance's own modifier switches, spending
  that instance's AP and taking its own Recharge cooldown). Attributes resolve
  through the *effective* values, so a switched-on `+3 MAR` is included exactly
  as it is for hand-clicked notation. Two deliberate degradations rather than
  errors: a custom attribute the sheet no longer defines rolls a plain `d20`
  (an unknown variable is `+0`), and an expression the parser cannot read is
  skipped instead of rolled as zero. A blocked activation — no uses left,
  unaffordable, on cooldown — rolls nothing.
- **NPCs activate only in the GM Screen, exactly as before.** The option is
  authored in the NPC ability editor (and in a sub-ability's), and a base NPC
  sheet still renders no Activate button — it is the static reference the GM
  Screen spawns instances from.
- **Storage.** `AbilityBlock.activationRolls` is sanitized by
  `normalizeCharacter` on read (unknown accuracy/damage/custom shapes dropped,
  the key omitted entirely when nothing usable survives), so older records,
  hand-edited exports and imported bundles load as "this ability rolls nothing
  on activation".
- **Testing.** `src/lib/activationRolls.test.ts` pins normalization, the built
  notation (attributes, custom attributes by shorthand or name, deleted
  attributes, bonuses), the fixed roll order and the grouping; a new
  `useAbilityActivation.test.tsx` drives the real Activate path for a player
  card, a sub-ability and a GM panel instance's resource adapter (and pins that
  a blocked activation rolls nothing);
  `ActivationRollFields.test.tsx` covers the editor's toggle, pickers, damage
  opt-in and custom-roll rows; `DiceResultModal.test.tsx` covers both modal
  shapes and the hidden-roll toggle; `diceRollStore.test.ts` pins one log entry
  per part plus the single grouped modal; the GM Screen panel spec adds
  activation-with-rolls on an instance; and `e2e/activation-rolls.spec.ts`
  authors the config in the real editor, activates on a player sheet and checks
  the grouped window and the hidden roll, then does the same on the GM Screen
  under an NPC instance (and pins that the base sheet never activates).

### Custom attributes — the player's own stats, usable in dice notation

- **A sheet can define its own attributes.** In edit mode **+ Add Attribute**
  sits beside **+ Add Resource Bar**; the dialog asks for a name, a value, an
  optional **shorthand** (the short form — Martial → MAR), and whether view mode
  should show steppers. The attributes render as a **horizontal, centered strip**
  of the same attribute boxes the five Divergence Attributes use — shorthand on
  top, value in the middle, full name underneath — inside the hero section,
  below the resource bars and, in view mode, below the **Recover / End Turn**
  row, with the Mortal Wounds block beneath it. Each box is click-to-roll
  (`d20 + value`) like a built-in attribute box and carries an edit pencil in
  edit mode (rename, re-value, shorthand, steppers, delete with confirmation).
  An attribute whose value changes a lot in play can opt into **− / + steppers**
  in view mode, so it is nudged without going back to edit mode.
- **They are dice-notation tokens — that is their purpose.** `1d6+SAN` or
  `2d6+Martial Arts` in any sheet prose (ability descriptions, innate text,
  custom sections, damage fields) highlights as one token and resolves to the
  attribute's **current** value, exactly as `POW` does. Resolution order stays
  canonical-first: the five Attributes, then Skills, then custom attributes — a
  custom "Sneak" can never take over Sneak rolls. `normalizeCharacter` backfills
  `customAttributes` on read (entries without a name are dropped), so existing
  sheets, exports and version snapshots load unchanged.
- **The notation matcher now knows the sheet's vocabulary.**
  `findDiceNotation(text, extraVariables)` takes the character's shorthands and
  names, tried longest-first and ahead of the built-in abbreviations and the
  permissive word fallback — so `2d6+FOO` stops before trailing prose
  ("2d6+FOO damage") and a multi-word name matches whole, while a character with
  no custom attributes keeps the historical behavior exactly. Every named branch
  (`MAR`, `POW`, …, custom names) now refuses to match the prefix of a longer
  word: the full attribute names `resolveVariable` has always accepted
  (`2d6+Power`, `2d6+Martial`) highlight as the one variable they are instead of
  being clipped to the abbreviation inside them, and the documented `X/Y`
  alternative form (`1d6+POW/MAR`) finally highlights as one term instead of
  stopping at `POW`.
- **Testing.** `src/lib/customAttributes.test.ts` pins normalization, lookup and
  the matcher's custom vocabulary (prefix, multi-word and trailing-prose cases);
  `CustomAttributeStrip.test.tsx` renders the real `StatsSection` for the strip's
  placement below the turn actions and above the wound block, the add/edit/delete flow, the
  steppers' store writes and their bounds; `DiceHighlighter.test.tsx` pins
  detection → click → evaluated result end to end; `e2e/custom-attributes.spec.ts`
  measures the centered row and its position below the Recover / End Turn row,
  the steppers, notation rolling, and a 360px viewport with no sideways scroll.

### Sheet prose — status references survive raw HTML blocks

- **A `[StatusName]` reference no longer goes literal just because the description
  around it is hand-written HTML.** Inline references and dice notation were
  highlighted by rendering `p`, `li`, `em`, … through a component that scanned
  their children, so only the text *Markdown* had wrapped was ever scanned. A raw
  HTML block breaks that assumption: an HTML block stays open until a blank line,
  so in the reported description the `<span>`/`<img>` coin markup and the prose
  under it are **one** block, and `rehype-raw` hands that prose to the tree as a
  bare child of the document root — never inside a `<p>`. `[Diseased]` there
  stayed literal text while the identical text on its own rendered as a pill.
  Text inside a raw `<div>`/`<span>` escaped the scan for the same reason: an
  unregistered element never entered it.
- **The scan moved from tags to text nodes.** A new rehype plugin
  (`src/lib/rehypeInlineAnnotations.ts`) walks the *rendered tree* after
  `rehype-raw` and wraps every text node that could hold an annotation in a marker
  element, which `MarkdownText` renders through the existing `StatusHighlighter`.
  Where the text sits no longer matters — paragraph, list item, table cell, raw
  HTML block, or bare child of the root — and the cheap `[`…`]` / dice-shape
  pre-check keeps plain prose unwrapped, so its DOM is unchanged. Text inside
  raw-text elements (`<style>`, `<script>`, …) is deliberately skipped: that is
  CSS/JS, and splicing markup into it would corrupt it. Edit mode still renders
  the raw source, and the scanning itself is unchanged — still the one
  `StatusHighlighter`, so unmatched brackets stay literal and matching stays
  case-insensitive.
- **Testing.** `src/components/ui/MarkdownText.test.tsx` renders the reported
  description verbatim and asserts the pill appears beside the author's own HTML,
  plus cases for a raw `<div>`, inline HTML inside a paragraph, dice notation, an
  unmatched `[Bracket]` staying literal, `<style>` being left alone, and edit mode
  showing the raw source. `src/lib/rehypeInlineAnnotations.test.ts` pins the tree
  walk itself (including "never wrap twice" and the raw-text skip). The three
  raw-HTML/dice cases fail against the unfixed source.

### Mobile — the list pages' menus and the status grid stay on-screen

- **The Filter and Sort menus no longer hang off the left edge of a phone
  screen.** Both panels are much wider than the button they hang from and were
  anchored to it with `right: 0`. At phone widths the list head right-aligns its
  action row, so the Filter button ends up a button's width from the LEFT
  gutter — at 360px a 16rem panel anchored to its right edge started **108px
  off-screen**, taking the panel's own header and its entire first column of
  options with it, with nothing to scroll (the panel is not inside a scroller).
  The panel is now measured on open and clamped into the viewport by the new
  `useViewportClampedPanel` hook, shared by `FilterDropdown`, `SortDropdown` and
  the in-sheet `SelectDropdown` (which opens rightwards and had the
  mirror-image problem). Right-aligned panels still hug their trigger exactly as
  before while there is room — desktop geometry is unchanged — and a viewport
  resize re-places an open panel. The `@media (max-width: 400px)` fallbacks now
  only keep each panel's `min-width` under its viewport-derived `max-width`.
- **The status compendium keeps two cards per row on a phone without cutting the
  second one off.** `.status-grid` used `repeat(2, 1fr)`; `1fr` is
  `minmax(auto, 1fr)`, whose auto floor is a grid item's **min-content** width,
  so one long unbroken status name widened its own track and pushed the second
  column past the right edge of the screen (measured at 430px: `301px 126px`
  tracks and a grid 37px wider than the page). The grid is now
  `minmax(0, 1fr)` at every breakpoint, with a `min-width: 0` card, and the
  phone layout shrinks the card itself — padding, gap, name / description / tag
  sizes — so a 2-up row still fits inside the gutter at 360px. The ✕ delete
  button is always visible on touch, so the heading row now reserves room for it
  instead of letting it sit on the truncated status name; a long unbreakable
  word in a description wraps instead of being sliced at the card edge; and
  below 340px (folded covers) the grid falls back to a single column.
- **Testing.** `e2e/mobile-layout.spec.ts` pins both in a real browser against
  the production build at 360px and 430px: it creates an NPC (the shortest route
  to the five-button head that triggers the panel overflow), opens the Filter and
  Sort menus and asserts both boxes and the panel header sit inside the viewport,
  then creates a 34-character status name and asserts two columns, no card past
  the viewport edge, no ✕-over-name overlap, and no sideways page scroll. Both
  assertions were confirmed to fail against the unfixed source.

### Custom tab sections — shift them with ↑ / ↓

- **A custom tab's sections can be reordered.** Until now a section sat wherever
  it was added; there was no way to move one. Every section heading now carries
  a compact **↑ / ↓ pair** at the right edge in edit mode — ahead of the
  grid/list toggle and the delete button — and one click shifts that section a
  single place up or down its tab.
- **One component for all three kinds.** `SectionReorderButtons` is shared by
  the ability, bundled-NPC and text heading rows, so the three cannot drift
  apart; it reuses the sheet's frameless `.btn--icon` treatment so the pair
  reads as chrome, not as two more actions competing with the delete button.
- **The ends are disabled, not hidden.** The first section's ↑ and the last
  section's ↓ render disabled, so the control keeps its place and the heading
  row never reflows as a section walks the tab. A disabled arrow is also the
  read-out of "nothing above/below to trade with": `reorderCustomSection`
  rejects a no-op or out-of-range move **before** it touches the record, so a
  dead arrow cannot stamp an `updatedAt` or schedule an autosave.
- **Positional only.** Whole section records move: per-section view modes are
  keyed by section id, so a moved section keeps its grid/list choice, and
  nothing else about the tab — its name, its other sections, other tabs — is
  touched.
- **Testing.** The store test pins the move down and up, the no-write identity
  of an out-of-range move (the store hands back the very same character
  reference), and that a move in one tab leaves another tab's sections alone.
  `SectionReorderButtons.test.tsx` pins which arrow is live at each position
  and that a click asks for a one-place move; the three section tests pin the
  wiring (edit mode only, this section's own index and count), including the
  detached-NPC placeholder, which keeps its pair so a broken section can still
  be shifted out of the way. `e2e/custom-sections.spec.ts` walks it in a real
  browser against the production build: one tab holding one section of each
  kind, the pair measured into the heading row's upper-right corner, boundary
  arrows asserted disabled, the ability section moved down and the NPC section
  moved up, and the resulting order — `text, npc, ability` — read back after a
  reload with no arrows in view mode.

### Custom tab abilities — drag a card within a section, or into another

- **Dragging an ability card inside a custom tab did nothing.** Every drag in a
  custom ability section was silently cancelled: `CustomTabDndContext` asked the
  drag payload for a `sectionKind` that no card ever wrote, and rejected the
  drag when it read back `undefined`. Both halves of the feature went with it —
  reordering a section's own cards, and moving a card into another ability
  section of the same tab. The kind now comes from the tab record itself (the
  only place it is guaranteed to exist), resolved for both ends of the drag, so
  a custom ability section's cards reorder and move again while an NPC section
  still refuses them.
- **What the drop does.** Dropping a card on a card or on the list body of
  another ability section moves it to that section, landing at the end of the
  list — the same cross-list rule the Slotted Abilities ↔ Ability Pool drag
  follows — while a drop inside its own section reorders it to the hovered
  position. An empty section works too: its "drag one in" drop zone is a
  droppable in its own right. The tab's own section order (the ↑ / ↓ arrows),
  per-section view modes and the NPC section's separate, reorder-only drag are
  untouched.
- **Testing.** `CustomTabDndContext.test.tsx` replays drag events built from
  what the real cards and sections register with dnd-kit (`useSortable` /
  `useDroppable` are captured), so a payload that stops naming its section fails
  the suite instead of quietly disabling the feature: it pins a move onto a card
  in another section, a move onto the section body, a reorder inside a section,
  a drop past the last card, and an NPC section refusing a card. Both drags —
  the reorder and the cross-section move — were confirmed to fail against the
  unfixed source. `e2e/custom-sections.spec.ts` then performs them with a real
  pointer against the production build: an ability dragged onto a sibling card
  reorders, one dragged onto the other section's card moves there (and onto an
  empty section's drop zone in its own test), and the resulting layout is read
  back after a reload with no grips in view mode.

### Customize drawer — a swatch's color picker opens fully on-screen

- **The picker no longer runs off the right edge of the drawer.** A swatch's
  popover hangs off the swatch's **left** edge (`left: 0`) and react-colorful's
  picker is a fixed 200px wide, while the drawer is 340px wide against the right
  edge of the screen — about 305px of grid content, in two columns. A
  right-column swatch therefore started ~176px in and pushed the picker 36.5px
  past the drawer, which is also the edge of the screen: the body's
  `overflow-y: auto` computes `overflow-x: auto`, so the picker's right side —
  hue slider included — was clipped with no way to scroll it back, and a swatch
  near that edge could not be given a color by eye at all. `ColorSwatch` now
  places its popover with the shared `useViewportClampedPanel` hook, which is
  the drawer's own right edge; the clamp only bites where there is no room, so
  every other swatch still opens directly under its own left edge.
- **Testing.** `e2e/customize-color-picker.spec.ts` opens all 26 swatches of the
  real drawer against the production build, at desktop width and at 360px, and
  asserts each picker's box sits inside the drawer's sides — plus that a picker
  below the fold is still reachable by the body's own scroll, that a swatch with
  room to spare still hugs its own left edge, and that the clamped picker still
  picks a color when the far right of its saturation field is clicked. All three
  fail against the unfixed source: every right-column picker hung 36.5px past
  the drawer at desktop width and 26px past it in the phone bottom sheet, and
  the clipped strip swallowed the click.

## v0.9.0-alpha — 2026-09-13

The table release. Ten commits since `v0.8.0-alpha`, and they all point the same
way: the GM Screen stops being a display and starts running the fight. An NPC
panel takes its own turn — Action Points, Recharge, limited-ability uses and
modifier switches owned by the *instance*, not the statblock — Mortal Wounds
arrive on both panel kinds and get a rebuilt block on the sheet, and the status
icon picker trades a 62-glyph UI palette for a search over all 1,914 Unicode
emoji and RPG-Awesome's 496 fantasy icons. **No migration to run:** the
IndexedDB schema stays at version 5 and every new live-play field on a panel is
additive, backfilled by `normalizeScreen` when a screen written by
`v0.8.0-alpha` loads — an instance with no `currentAP`/`cooldowns` reads as a
fresh turn, and one with no `mortalWounds`/`abilityUses` as an untouched track
and full uses.

### Status icons — search any emoji, and a fantasy icon pack worth searching

- **The emoji tab is a search box, not a paste box.** The old field took any
  text at all and stored it, so a typo became an invisible "icon" and finding a
  glyph meant scrolling a 30-item palette. It is now a search over the **full
  Unicode emoji set** — all 1,914 of them, names and groups from
  `unicode-emoji-json`, loaded lazily the first time the tab opens (a ~277 KB
  chunk, 30 KB gzipped, that a session which never opens the tab never
  downloads). Type "sword", "poisoned" or "sleep" and the matches appear best
  first; the old palette survives as the **Common** row, and the groups below it
  still make the whole set browsable.
- **Game words reach the right glyph.** Unicode names a skull-and-crossbones
  exactly that — never "poison" — so `lib/emojiCatalog.ts` carries a small table
  of tabletop terms (Poisoned → ☠️, Grappled/Immobilized → ⛓️, Blinded → 🙈,
  Regeneration → ♻️, Prone → 🧎, and so on) and ranks those hits ahead of name
  matches. Prefixes count, so typing the SRD condition's own name ("poisoned",
  "blinded", "cursed") lands on its glyph.
- **Pasting still works.** A query that is *itself* an emoji is not treated as a
  search word: it is offered as `Use “🦴” as the icon`, so nothing the old text
  field could do is gone.
- **The icon pack is RPG-Awesome now.** The pack tab used to offer 62 curated
  Lucide **UI** glyphs — the wrong vocabulary for conditions ("poison cloud" and
  "bleeding eye" do not exist in a UI set). It now offers all **496 RPG-Awesome
  fantasy icons**, drawn with the pack's own icon font (`rpg-awesome`, SIL
  OFL 1.1 font / MIT CSS) and searchable by name: "sword" finds broadsword, bat
  sword, crossed swords, dervish swords and lightning sword; "potion" finds the
  bubbling potion. Every word of the query has to match, and an empty query shows
  the whole pack.
- **Keys are the pack's own class names.** A selection stores
  `ra-crossed-swords` in `StatusCondition.icon` and renders as
  `<i className="ra ra-crossed-swords">`, so the stored value is exactly the
  class that carries the glyph. The 496 keys live in the generated
  `constants/rpgAwesomeIcons.ts` (`npm run icons:rpg-awesome` rebuilds it from
  the installed package, so bumping the pack cannot leave the list stale).
- **Statuses saved with the old pack keep their icon.** `StatusIcon` draws an
  RPG-Awesome key with the icon font, resolves anything else through the old
  Lucide map, and only falls back to the placeholder glyph for a key that
  resolves to nothing — the pack switch is not a data loss for existing records.
- **Both grids show their work.** The preview line names the current pack icon
  ("Icon pack · Crossed swords"), each grid marks the current selection rather
  than only previewing it, and an empty result says `No emoji match “xyz”.` /
  `No icons match “xyz”.` instead of rendering nothing.
- **The search bar is an ordinary app text field.** It is the same `.sheet-input`
  every other form uses — same height, border, radius and font — spanning the
  panel's full width with the magnifier *inside* it (an icon sitting outside had
  left the field 50px narrower than the fields above it, which read as a
  shrunken, out-of-place control), plus a ✕ that clears the query and returns to
  the browse view. The row stays pinned to the top of the scrolling grid.
- **Testing.** `lib/emojiCatalog.test.ts` runs the search against the real
  shipped catalog: name ranking, "poisoned" reaching ☠️, multi-word queries
  requiring every word, **every alias and quick pick verified to exist in the
  dataset**, the over-broad query cap, and the pasted-emoji candidate.
  `StatusIconPicker.test.tsx` searches and selects on both grids, marks the
  stored emoji/key as current, keeps the two panels' queries independent, clears
  a query back to the browse view, reports an empty result, and pins
  `StatusIcon`: `ra-crossed-swords` draws as
  `<i class="ra ra-crossed-swords">` at the requested size, an old `skull` key
  still draws the Lucide SVG, an unknown key still reaches the placeholder, and
  emoji/uploaded images render as before. `e2e/status-icons.spec.ts` walks the
  same path in a real browser against the production build — search both tabs,
  pick, save, reload — because jsdom loads no stylesheet: it is the test that
  would catch the pack's CSS import being dropped (asserting the cell's
  `font-family` and that `document.fonts.check('16px RPGAwesome')` resolves).
- **The deploy build installs the same tree as a local one.** The Pages workflow
  ran `npm ci` against an npm lockfile that predated the icon pack, so it
  resolved a tree without `rpg-awesome` or `unicode-emoji-json` and could not
  have built this release. The workflow now installs with pnpm from the
  `pnpm-lock.yaml` this repo actually locks with (`pnpm install
  --frozen-lockfile`, cached on the pnpm store), that stale `package-lock.json`
  is gone rather than left to drift again, and `package.json` pins the
  toolchain with `packageManager`.
- **The boot sequence prints the real version again.** Its `APP_VERSION` was
  hard-coded at `0.3.0` when the terminal animation landed and had been sitting
  there through five releases, so the home screen announced `grimoire v0.3.0`
  while the app shipped `v0.8.0-alpha`. It now reads `v0.9.0-alpha`.

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
