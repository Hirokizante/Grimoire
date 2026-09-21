# GM Screen

The GM Screen is a saved, named surface that holds **panels** — one per sheet you want to
run. It lives behind the **GM Screen** entry in the title bar (and on the home page).

---

## Design: app chrome vs sheet palette

The screen is **deliberately app chrome**: it uses the active app theme, while each panel's
sheet content keeps its own customization (optionally switched off — see below). That split
is deliberate and precise.

- **Panel chrome** — the header, name, HP bar, the tracked status pills, the AP/END/FP and
  Evasion/Armor stat tokens, and the HP steppers follow the **app theme**, never the sheet's
  palette.
- **Why** — a screen shows several sheets side by side, so per-sheet token colors would make
  every panel read differently and destroy the at-a-glance consistency that is the whole
  point of the GM Screen; a player panel and an NPC panel therefore color their shared stats
  identically.
- **Where the sheet's palette is injected** — only inside the **expanded panel's sheet
  content**, where a player's customization belongs.
- **Settings → GM Screen → *Match app theme*** — turns even that off. With it on, a player
  panel's body is rendered through the same helper an NPC panel uses
  (`gmPanelSheetPresentation` in `themeUtils.ts`), so it carries the app theme's palette and
  no per-sheet background, fonts, or flat-section override — every panel on the screen,
  player or NPC, reads in one voice.
- **Off by default, and purely cosmetic** — the panel reads the character's config and never
  writes it, so the character's own sheet page, its Customization panel, its exported theme,
  and its version history are unaffected.
- **The Combat Stats row is app chrome in its own right**, whichever way that switch is set:
  both panel kinds color it from the app theme's shared stat palette (`STAT_TOKEN_COLORS`),
  so Evasion is one color on a player panel, on an NPC panel beside it, and in the chrome
  above them. A character's per-sheet token colors apply to their own sheet page, not to a
  panel — that is what stops two panels from disagreeing about what a stat looks like.
- **Shorthand stat labels** — an expanded panel also prints those stats in shorthand:
  `Miles / Eva / Arm / Move / Save / END Rec`, and `Wounds` on an NPC. That is because a
  panel's token column is ~7.5rem wide and the full names ellipsised there ("MILEST…",
  "SAVE …", "END RE…"), which tells a GM nothing mid-turn.
- **One shared vocabulary** — the shorthand is `SHORT_STAT_LABELS` in `statTokenLabels.ts`,
  the same vocabulary the panel chrome's own Eva/Arm/Move/DC tokens use, and every token
  keeps its full stat name as a tooltip. A sheet page has the width, so it keeps the full
  names.
- **One line and one height** — every stat token is **one line and one height**, on every
  sheet: the icon and value on the left, the label (plus a stat's own bonus number, if it has
  one) on the right. The Milestones bonus is printed inline — `Miles +2`, `Milestones +2` on
  a sheet page — rather than as a second line under the label, which is what keeps a token to
  a single line and its grid row free of reserved slack: nothing has to be paid for up front,
  so a player panel's tokens are exactly the size of an NPC panel's beside it, and the
  content is centred in the token. The bonus is its own element, so the label's ellipsis can
  never eat the number, and it is omitted entirely when a character's bonus is 0.

---

## Two kinds of panel

| Panel | What it is |
| --- | --- |
| **Character panel** | A live **reference** to a player `Character`. HP/AP/END/FP changed from the panel is the same state the player sees on their own sheet, and vice versa — one source of truth, no copies. |
| **NPC instance** | A spawned instance of an NPC sheet used as a **template**. |

NPC instances follow one rule: **instances are deltas, not clones.**

- **Spawning "Bandit" three times** creates three panels with independent HP, temp HP,
  condition, **Mortal Wounds, Action Points, Recharge cooldowns, limited-ability uses, and
  modifier switches**, while stats, abilities, portrait, and description are all read from
  the base record at render time.
- **Editing the base** updates every instance of it, and the NPC list keeps showing only
  bases — there is never a "which Bandit is the real one?" question.

---

## Using it

### View modes

- **Settings → GM Screen → Layout** — **Grid** (the default) or **Immersive
  List**. An app-level preference in localStorage, like the panel theming
  switch: it changes how a screen *displays* on this browser, never what the
  screen *contains*, so the screen record and backups are untouched.
- **Grid** — the classic surface: draggable panels flowing down two columns.
- **Immersive List** — a **character list drawer** slides out from the left,
  and the rest of the screen shows **one character at a time** as a compact,
  encounter-ready sheet.

### The immersive list view

- **The character drawer** — every panel on the screen (player characters and
  spawned NPC instances) appears in the drawer as a read-only quick-reference
  card: portrait, name, HP, the GM's tracked status pills, and the stat
  tokens. None of the panel controls are there — no steppers, no damage
  dialog, no menus — because the card's single interaction is **selecting the
  character**, which mounts their encounter sheet in the main area.
- **The drawer owns its column** — the immersive view is one screen of
  chrome over a drawer-and-sheet row: the encounter sheet scrolls *inside*
  the main area, so the page itself never scrolls. The drawer therefore stays
  wholly visible however long its list grows — the "Characters" header, the
  list (which scrolls itself) and the footer's Add Character / Add NPC
  buttons are all always on screen.
- **The rail** — collapsing the drawer (the chevron in its header) shrinks it
  rather than hiding it: a vertical portrait rail on the left edge. Each rail
  entry is still selectable, and each NPC instance carries a **number badge**
  — the instance's 1-based ordinal among the screen's instances of the same
  base, shown only when that base has more than one instance, which is exactly
  when three spawned Bandits need telling apart.
- **One glance vocabulary** — the drawer follows the panel chrome's dimming:
  downed/dead instances dim and strike through their name, and a character out
  of Action Points dims their card, so the drawer and the main area agree at a
  glance.
- **The main area** — the selected character's **encounter sheet**: the same
  chrome a grid panel carries (header with the ⋯ menu, HP bar with the live
  status strip and Damage dialog, the Mortal Wound track, the AP meter — all
  wired to the same store actions), over a read-only body: combat stats and
  attributes on top, then abilities owning the full width (list-view cards
  packed as masonry — two columns, a third while the drawer is collapsed, one
  on a phone — so more abilities show at once), with the skills table last as
  reference material.
- **No flavor, no editing** — the body omits the Innate narrative prose,
  description, and background; level up, import/export, and customize live on
  the sheet page (the menu's "Open sheet"). Everything renders in view mode;
  running the character happens through the chrome, exactly as on a grid
  panel.
- **Add actions live in the drawer** — Add Character / Add NPC sit in the
  drawer's footer (and a compact add button on the rail); the toolbar row
  above the layout carries only the round tracker.
- **Reordering** — drag a drawer card by its body itself (no dedicated grip;
  a 6px activation distance keeps a plain click selecting rather than
  dragging), or a rail portrait itself; the same `movePanel` action and array
  order the grid view uses.
- **Selection** — session state, not screen data: the first panel is mounted
  on entry, and the selection falls back to the first panel when the current
  one disappears. The drawer always starts expanded.
- **Phones** — the expanded drawer overlays the main area instead of
  squeezing it; the collapsed rail stays a slim column.

### Screens

- **Create and switch** — create as many screens as you like ("Session 4", "Dungeon Run")
  and switch between them with the pill row.
- **Rename and delete** — rename inline, and delete with a confirmation.
- **Persistence** — screens persist in IndexedDB and survive reloads; the screen you had
  open reopens automatically.
- **Add Character** — a searchable picker over your player sheets. A character can only
  appear once per screen (the row is disabled with "Already on this screen"); use NPC
  instances when you need multiples of one statblock.
- **Add NPC** — pick an NPC base to spawn an instance, with each row showing how many
  instances are already on the screen.
- **New NPC…** — creates a base record *and* spawns an instance in one step, without
  navigating away.

### Compact and expanded panels

- **Compact** — a glance-height card (portrait, name, HP bar, the **Action Point meter**,
  key stat tokens, condition badge).
- **Expanded** — renders the sheet content inline.
- **The same condensed body** — expanded player and NPC panels use the **same condensed
  body** (`PanelSheet`), so a panel reads identically whichever kind of sheet it holds:
  Combat Stats → Attributes → (Core Ability) → Abilities → Skills.
- **Deliberately not the full sheet** — it is deliberately *not* the full
  `CharacterSheet`/`NPCSheet`, which are page-scale views far too tall for a panel sharing
  its row with another.
- **Deliberately omitted from the body, because the panel chrome already shows them:**
  - the **player HP bar**, the **Action Points bar**, and the **Mortal Wounds track** — all
    live under the panel header, with their own steppers, chips and Damage dialog; printing
    them again inside the body would double every number the GM is watching.
  - the **NPC Core Ability** section — an NPC has no Innate narrative and no Fatebreaker
    (that field only ever holds the generated default). The Basic Attack it *does* have is the
    pinned first card of its ability list, where a GM looks for it — live, at 1 AP.
  - **Description / Character Background** on both — reference material, not at-the-table
    information.
- **The `saving…` indicator** — reserves its width permanently and toggles only
  `visibility`, so it can never resize the header — saves fire on every panel action, and an
  in-flow badge made the screen name and pills jump sideways on each one.
- **The expand animation** — expanding a panel **animates** (~190ms, ease-out) rather than
  snapping. The body mounts and unmounts, so height cannot be transitioned directly; it
  transitions `grid-template-rows: 0fr → 1fr` instead, which needs no measurement, and the
  body stays mounted only for the duration of the collapse so a collapsed screen is not
  carrying every sheet's DOM. `prefers-reduced-motion` disables it.
- **Panel stat tokens** — shaped like the sheet's cost badges (`.cost-badge` /
  `.dice-notation`): a 1px accent-tinted border on all four edges rather than a thick left
  stripe, keeping each token's own colour.
- **Every token leads with an icon** — Eva (wind), Arm (shield), Move (swords), DC (target)
  on an NPC panel, and Eva/Arm/END (heart)/FP (sparkles) on a player panel — because several
  pools share a hue (AP and END are both violet in the default theme), so the glyph is what
  separates them at a glance.
- **Attributes** — show the shorthand only (MAR/POW/…) in five strictly equal columns; the
  full names were what forced uneven column widths, since `repeat(5, 1fr)` is
  `minmax(auto, 1fr)` and that `auto` floor is the column's own content size.
- **Skills** — render in even columns with uniform rows: the sheet's `nth-child(odd)`
  striping is neutralised inside panels, where a two-column grid would otherwise put every
  striped row in the left column and read as "the left column is highlighted".
- **The ability section** — is player *Slotted Abilities* (the Ability Pool is a build-time
  concept with no place on a live panel) or the NPC's *Abilities*, and is **always list view
  with no grid/list toggle** — a grid at panel width is unreadable, so grid is not offered
  at all.
- **The NPC's Basic Attack rides with its ability list** — pinned as the first card, exactly as
  on the NPC's own sheet. Its 1 AP cost makes it activatable on a panel like any other costed
  ability, so a spawned instance always has a live fallback attack; and because every Basic Attack
  arrives configured to roll on activation, pressing it rolls the accuracy check and the damage
  together, against that instance's own stats and AP.
- **Ability cards render against the panel's own entity** — on both kinds, so dice notation
  like `1d6+MAR` resolves against *that* sheet's stats and Activate deducts from *that*
  record (previously the cards fell back to `currentCharacter`, which is null on the GM
  Screen).

### Rounds

- **New Round** — sits on the toolbar row beside Add Character / Add NPC, and is the
  encounter-level action: one click advances the round counter and starts **every**
  panel's turn — each NPC instance refills its AP and rolls its own Recharge Die, each
  player character runs the sheet's own End Turn (unspent AP → END, END Recovery
  applied, AP refilled). Panels whose referenced record was deleted are skipped.
- **One click, one toast** — the action is confirmed with a summary ("Round 2 — new
  turns for 3 panels · 1 recharged"). Each instance's Recharge Die is still written to
  the persistent roll log through the same helper the panel's own Start new turn uses,
  so a round's turns read back like a journal.
- **The counter is a label, not a timer** — nothing advances it on its own, and the
  number can be typed over directly in the toolbar (the field keeps a local draft, so a
  mid-edit value is never clamped per keystroke). A manual edit moves the label only:
  only **New Round** starts turns. Values are floored at 1.
- **Persistence** — the round lives on the screen record (`GMScreen.round`), so it
  survives a reload with the panels, and a screen written before the tracker existed
  loads on Round 1.

### Turns: Action Points and Recharge

- **`PanelApBar` on every panel** — every panel shows AP under its HP bar, player and NPC
  alike, from one component (`PanelApBar`): the sheet's own segmented meter plus the panel's
  shared bar chrome, so HP and AP read as one control family.
- **The label row and the bar row** — a label row (`HP 20/20`, `ACTION POINTS 3/3`) and a
  `[−] bar [+]` row with that row's action button (Damage… / Start new turn) at the end.
- **The same stepper** — both bars render the same `PanelStepper` — lucide `−`/`+` glyphs in
  identical 1.75rem boxes — and disable each end exactly when its action would be a no-op
  (full HP, 0 AP), the rule the player sheet's bars use.
- **An NPC instance is initialised with 3 AP per turn.**
- **A player panel spends and restores the character's real AP** — shared with their own
  sheet, and its AP token was dropped from the stat strip so the panel never prints the same
  number twice.
- **Spending AP by hand** is always available; activating an ability spends it automatically.
- **A panel whose entity is out of AP dims itself** — header, HP bar, tokens and the expanded
  sheet body — so a glance down the screen shows who has already acted. The AP block stays at
  full strength (it holds both ways back: the manual `+` and Start new turn), nothing is
  disabled or made un-clickable, and the panel returns to normal the instant AP does. The ⋯
  panel menu is exempt too: it portals to `document.body` (like the pickers), because an
  ancestor's `opacity` multiplies into every descendant and a menu left in the header faded
  with the panel — so it stays full-strength at 0 AP, on a dead panel, and mid-drag alike.
  An ability card's **capture button** is exempt by construction: it snapshots the card from
  an off-screen copy, so a faded panel still copies a full-strength image.
- **Every NPC ability with a cost, a Recharge value or activation rolls gets an Activate
  button** — the same button, plan, and cost deduction the player sheets use
  (`useAbilityActivation` with the panel's own resource adapter), not a second implementation.
  The ability's own *Show Activate* flag does not gate it: NPC abilities are authored in a mode
  that never offers the flag, and the panel's rule is "a cost means a button". Ability cards
  with no cost, no **Recharge** and no **activation rolls** stay static reference cards: a
  cost-free ability that carries Recharge still gets one, because the cooldown is the thing
  being tracked, and a cost-free ability authored to roll on activation gets one because
  pressing it is what produces the rolls. An ability whose roll configuration is half-finished
  — damage switched on with an empty Damage field — rolls nothing, so it stays a reference card
  rather than growing a button that would open no result window.
- **Limited uses are the instance's own** — an ability flagged as limited shows its remaining
  uses on the panel and spends one per Activate when the ability is set to (an instance never
  spends a use for an ability whose *Expend on activate* is off, and a limited ability at 0
  uses has its button disabled with the usual "No uses" tooltip).
- **Activation rolls resolve against the instance** — an ability authored to roll on
  activation (accuracy / damage / custom — see
  [features.md](features.md#roll-dice-on-activation)) rolls against the panel's own entity:
  the base record with *this* instance's modifier switches applied, so an active `+2 MAR`
  moves the accuracy total on this panel only. Every roll opens together in the shared result
  window, and the activation's own side effects — the instance's AP, its uses, its Recharge
  cooldown — happen exactly as they do without the rolls.
- **The − / + steppers work here too** — they move *that panel's* count without touching AP,
  resources, or the base record.
- **Three spawned Bandits** therefore each begin at the ability's authored maximum and drain
  their own budget; the base sheet's own count is template data no instance reads, which is
  also why the base sheet's meter renders without steppers. Each instance's counts are saved
  with the screen and survive a reload.
- **Stat/attribute modifier switches are per instance** — an ability that declares modifiers
  carries its usual on/off switch on the panel, and flipping it applies the modifiers to
  *that instance*: its Evasion / Armor / Movement / Save DC / Max HP tokens, the expanded
  body's Combat Stats and Attributes rows, the dice that resolve against them, and the damage
  pipeline (an active Armor modifier really does reduce the next hit, a Max HP one really
  does move the HP bar's cap and clamp current HP when switched off).
- **Three spawned Bandits can therefore rage independently** — the switch never reaches the
  base record, and the base sheet renders the same control disabled with a tooltip saying
  where it can be flipped.
- **Recharge is fully implemented for NPC abilities on the GM Screen** — using an ability
  with the `Recharge (X)` trait marks it **on cooldown** and disables its button (tooltip:
  "On cooldown — Recharge X").
- **The trait chip is the live read-out** — the chip under the ability name renders
  `⧗ Recharge X` in place of the authored `Recharge (X)` text and switches to
  `⧗ On cooldown — Recharge X` with a tinted chip while cooling, so the state is never printed
  twice.
- **The GM can override the die** — a cooling badge carries a small `↻` beside "On cooldown"
  that takes **that** ability off cooldown immediately, without rolling the Recharge Die: a
  table ruling, a turn that never happened, or an ability the GM wants back early. It clears
  one ability on one instance (`gmScreenStore.clearAbilityCooldown`) — everything else keeps
  cooling — and the button exists only while cooling, so an idle badge stays a pure read-out.
- **`2 on cooldown`** — a collapsed panel shows that count next to the AP meter so the state
  is visible without expanding.
- **Start new turn appears as a button the moment AP hits 0** — on both panel kinds, and
  always available in the ⋯ panel menu for a turn that ends early.
- **On an NPC instance** — it refills AP to 3 and rolls one **Recharge Die (1d6)**: every
  cooling ability whose Recharge value is **≤ the roll** comes back, everything above it
  stays cooling.
- **The roll is announced in a toast** ("Bandit's turn — Recharge Die: 5 · recharged: Fire
  Breath") and written to the roll log as a `1d6` entry tagged `Recharge Die: Bandit`, so a
  session's turns read back like a journal.
- **On a player panel** — it runs the character sheet's own **End Turn** — unspent AP
  becomes END 1:1, END Recovery is applied, AP refills — and reports the gain the same way
  the sheet does ("Vex's turn — AP restored · +2 END").
- **Nothing about a turn reaches the base NPC record** — the standalone NPC sheet has **no
  Activate button, no AP meter, no cooldowns, and no use steppers** — it stays the static
  reference it has always been, and the panel never spends another instance's uses.
- **NPC abilities cost AP only** — the NPC ability editor offers no END/FP costs, so the
  panel deducts AP and leaves untracked pools out of the tooltip rather than blocking on
  resources it cannot show.
- **Trait parsing** — traits are parsed by one reusable helper, `lib/abilityTraits.ts`: it
  turns any `Name` / `Name (Value)` tag ("Recharge (4)", "Multi-Hit(2)", "Status (Quick)")
  into a structured trait with a name, text, and numeric value, matched case-insensitively by
  registry key or display name.
- **Recharge rules** — Recharge's *rules* live in `lib/abilityRecharge.ts` (die size,
  cooldown resolution against the base's traits at roll time), so a future trait — Cooldown,
  Multi-Hit, Reliable — only needs a registry entry plus its own rules module, never a new
  regex.

### Damage

- **Same dialog** — the same `DamageDialog` used on character sheets, targeting whichever
  panel opened it.
- **NPC instances** — Armor comes from the base's `npcStats.armor` and max HP from
  `npcStats.hp`, temp HP is the instance's own.
- **Player panels** — a player panel damages the character's real pool, through the same
  id-targeted action their sheet uses.
- **Reaching 0 HP** follows the Mortal Wound rule on both, and either panel resolves the D20
  as it deals the damage (see below).
- **Downed and dead** — healing a downed instance revives it, and the panel menu can flag it
  `dead` (which healing never clears).

### Mortal wounds

- **One shared track** — the track is one component on **both** panel kinds
  (`PanelMortalWounds`), drawn in the panel chrome right under the HP bar:
  `[skull Wounds n/max | chips | ⚠ Next 0 HP: …]`.
- **What a chip carries** — each chip carries the **D20 result** and the wound's name, with
  the full rules text in its tooltip — the same table data the player sheet's wound cards
  show.
- **Persistence** — wounds persist until cleared (the chip's own ✕, or the panel menu's
  **Clear mortal wounds**) or a Rest; **healing never clears them**.
- **One scrolling line** — like the status strip it is one line that scrolls sideways instead
  of wrapping — with a trackpad swipe *or* a mouse wheel (`useHorizontalWheelScroll`) — so a
  wounded boss never makes its panel taller than the mook beside it.
- **The roll is made for the GM on both kinds** — damage that drives the target to 0 HP rolls
  the D20 in the store, refills HP to max with the spill-over, and records the wound. There
  is no "Pending Roll" step and no second card to click — a GM running four bandits (or
  watching a player drop) gets the wound result without leaving the damage dialog.
- **The toast** — the outcome announces itself in a toast ("Bandit takes a Mortal Wound:
  Fracture (d20 14) — HP reset to 15."), because an HP bar that refills to max would
  otherwise look like nothing happened; the panel's own `−` stepper runs the same pipeline
  and raises the same toast.
- **A player character keeps their own sheet flow** — the panel writes to the character's
  real slots, but only *its* damage auto-rolls: a hit the player takes on their own sheet
  still parks the slot on "Pending Roll" for them to roll from the sheet's Mortal Wound card,
  which is the sheet's design.
- **The dashed `?` chip** — such a slot shows up on the panel as a dashed `?` chip, and the
  ⋯ menu offers **Roll Mortal Wound (d20)** for it (the same wording as the sheet's own
  button), so the track is always resolvable from the screen; a panel-applied hit resolves
  the oldest pending slot, so it never adds one.
- **Why the roll lives in the menu** — the row is deliberately the same shape on both panel
  kinds — and the same one line at 360px.
- **A full track** — a full track (both slots) warns `⚠ Next 0 HP: Knocked Out` — the
  character's own word for it, and the next 0 HP really does start Death Saves.
- **A wound can also be applied by hand, with no D20** — an ability in play, an NPC's
  authored effect, or a GM ruling can *name* the wound, and then rolling a die to discover it
  would be theatre.
- **Add mortal wound…** — either panel's ⋯ menu offers **Add mortal wound…**, which opens
  `MortalWoundPicker`: the same twenty entries as a searchable list (D20, name, rules text),
  applied by picking one.
- **On a player panel** — it writes the character's real slots
  (`characterStore.addMortalWound`), exactly like the menu's roll — naming a slot the player
  left on "Pending Roll" resolves it.
- **On an NPC instance** — it appends to the instance's own track through
  `gmScreenStore.addInstanceMortalWound`, storing the entry's D20 beside the name, so a
  hand-added chip reads exactly like an auto-rolled one ("Damaged Throat · 8").
- **The picker is shared** — one component shared with the player sheet's wound block, and it
  stays open across picks (an NPC whose base allows several wounds takes them in one visit) —
  re-reading the track as it writes, marking what is already on it, and locking itself with
  the reason once there is no slot left.
- **Room** — room is the same rule the roll uses: `MAX_MORTAL_WOUNDS` for a character, the
  base's allowance for an instance, so a `mortalWounds: 0` mook offers no add at all and a
  full track offers nothing to click. The entry point lives in the ⋯ menu, never in the wound
  row, for the reason the roll does — the row must stay one line at 360px on both panel
  kinds.
- **An NPC instance's allowance is the base's `npcStats.mortalWounds`** — the editable stat
  on the NPC sheet (evasion/armor/movement/save DC/HP/Mortal Wounds), read at damage time
  like every other base stat, so editing the base updates every instance of it. The stat's
  tooltip says so on the sheet. A player character simply always allows two, so a player
  panel shows its (possibly empty) track from the start, exactly as an NPC whose base allows
  wounds does.
- **`mortalWounds: 0` is the mook case and changes nothing** — no roll, no row on the panel,
  and 0 HP simply sets the instance `downed` — exactly the behaviour panels had before. Once
  the allowance is used up (or the base allows none), reaching 0 HP also downs the instance
  instead of rolling, and the panel shows the ⚠ warning while the track is full.
- **One hit can burn through several wounds** — damage past 0 refills HP to max each time and
  costs a wound per refill, so a huge hit on a three-wound boss that still ends below 0 downs
  it — and a hit that fills a character's last slot knocks them out, which the panel reports
  as such.

### Statuses

- **Add Status** — every panel (player *and* NPC instance) has an **Add Status** icon button
  at the end of its HP row that opens the compendium picker: search it, then pick one of the
  five SRD durations (Quick, Persistent, Countdown, Permanent, Conditional).
- **Pills inline with the HP number** — tracked statuses render as two-segment pills **inline
  with the HP number** — the **filled left segment** carries the status's icon and its full
  name, the quiet right segment the duration and the stack stepper — in a single line that
  scrolls sideways rather than wrapping (with a trackpad swipe or a mouse wheel; the wheel
  moves on to the page once the strip ends), so a panel never grows taller because the GM
  stacked conditions on it.
- **That filled segment is also the condition's reference** — behaving exactly like a
  `[StatusName]` reference on a sheet: **clicking it opens the status's description** in
  the global status modal, and **hovering (or focusing) it shows the shared
  icon/name/description card**.
- **The duration is shown as an icon only** — label and rules reminder in its tooltip, which
  is what buys the room for the rest of the pill.
- **It is a label, not a timer** — nothing expires on its own, and a Countdown is ticked down
  by hand with the stepper.
- **Status names are never truncated** — a pill keeps its natural width and the strip scrolls
  instead, so "Regeneration" always reads in full.
- **The hover card is portalled to `document.body`** (`StatusTooltip`) rather than positioned
  inside the pill: a pill clips its own contents (that is what keeps its filled cap inside
  the rounded border) and the strip scrolls sideways, so an in-place card would be a
  sliced-off sliver.
- **How it is anchored** — it is anchored to the pill's measured rect, flips below the pill
  when there is no room above, follows page/strip scrolling, and never changes the pill's or
  the row's geometry.
- **The picker is a viewport-level dialog** — portalled to `document.body` for the same
  reason (`AddStatusModal`): the panel it is opened from can be dimmed — a **dead** instance
  sits at `opacity: 0.75` — and an `opacity` ancestor both fades every descendant and becomes
  the containing block for `position: fixed`, which painted the picker translucent inside the
  panel's own box instead of centring it over a full-viewport backdrop.
- **No panel state can reach it** — portalled, it stays on the documented modal layer (below
  the title bar, above every sheet surface) — while the title bar recedes behind it exactly
  as it does behind every other modal (the chrome-recede rules are scoped to
  `body:has(.modal-overlay)`, so they see an overlay wherever it is mounted).
- **Stack steppers** — each pill's `−`/`+` adjusts stacks; at one stack the `−` becomes an
  explicit `✕` remove, so a status can never vanish from a mis-click on a decrement. Stacks
  are clamped to `[1, 99]`.
- **Changing duration in place** — picking a duration chip on a status already on the panel
  **changes its duration in place** (the chips double as the duration editor and the applied
  one is filled in), and the modal stays open so several conditions can be applied in one
  pass.
- **GM Screen state only** — statuses live on the `ScreenPanel`, never on the character or
  NPC record, so nothing about them reaches a player's own sheet.
- **Referenced by id** — they reference the compendium record by id (name/icon are read at
  render time), so a rename propagates and a deleted status leaves a clearly-marked "Missing
  status" pill that is still removable — and, having no description left to open, it stays a
  plain label instead of a clickable reference.
- **Duration colours** — each duration carries its own accent per app theme
  (`STATUS_DURATION_COLORS`), like the panel stat tokens: those tones sit shoulder to
  shoulder in one hairline pill (and as the picker's chips), so `themeUtils.test.ts` enforces
  ΔE ≥ 16 between every pair and ≥ 4.5:1 contrast on every theme's surface.

### Rolls

- **Resolve against the panel's entity** — attribute, skill, and ability rolls from a panel
  resolve against that panel's entity and land in the roll log.
- **Activation rolls** — an ability's automatic activation rolls (see
  [features.md](features.md#roll-dice-on-activation)) resolve against the panel's entity too,
  so a player panel rolls that player's real stats and an NPC instance rolls the base record
  plus that instance's own modifier switches. Each part of the activation is logged
  separately with an `ability-activation` source.
- **Instance labels** — rolls from an instance are noted with the instance label
  ("Bandit 2"), so they stay distinguishable.
- **Roll log** — the roll-log drawer is available on the screen in "all characters" mode.

### Reordering and layout

- **Reordering** — drag a panel by its grip handle (a 6px activation distance keeps it from
  fighting page scrolling) to reorder it; panels flow in array order down each column.
- **Layout** — 2 columns above 700px, 1 column at ≤700px. Two wide columns beat three narrow
  ones: at three, panels were ~320px and every sheet name truncated.
- **Mobile** — on phones the Add buttons collapse into a sticky bottom-right group, and
  panels never overflow horizontally.

### Deleted records and placeholders

- **Deletes stay legal** — deleting an NPC base or a character that a screen references is
  still allowed; the delete confirmation lists the affected screens ("Referenced on GM
  screen: Session 4").
- **Placeholders** — those panels become a **Missing NPC / Missing character** placeholder
  with a Remove button. Nothing cascades, and the placeholder state is derived at render time
  rather than stored.

---

## Data model

A `GMScreen` is `{ id, name, round, panels, createdAt, updatedAt }`, where `ScreenPanel`
is a discriminated union:

| Variant | Shape |
| --- | --- |
| `kind: 'character'` | `{ id, characterId, density, statuses }` — a reference to a player `Character` |
| `kind: 'npc-instance'` | `{ id, baseNpcId, label, density, statuses, state }` — a spawned instance of an NPC base record |

- **`round`** — the encounter's current round, 1-based. **New Round** advances it and
  starts every panel's turn in the same write; the toolbar's field edits it directly.
  Untouched by anything else, and normalized to a whole number of at least 1 on read.

- **`state`** — the instance's state object:
  `{ currentHP, tempHP, condition, currentAP, cooldowns, mortalWounds, abilityUses,
  abilityModifiers }`.
- **`condition`** — `'active' | 'downed' | 'dead'`.
- **`currentAP`** — the instance's own turn budget (spawned at 3).
- **`cooldowns`** — lists the ids of the base's abilities currently waiting on a Recharge
  Die.
- **`mortalWounds`** — the instance's own track of `{ roll, name }` wounds.
- **`abilityUses`** — maps an ability id to the uses this instance has left of it.
- **`abilityModifiers`** — maps an ability id to whether this instance has its
  stat/attribute modifiers switched on.
- **`statuses`** — the GM's own tracking list — `{ statusId, duration, stacks }[]`, where
  `duration` is `'quick' | 'persistent' | 'countdown' | 'permanent' | 'conditional'` and
  `statusId` references a compendium `StatusCondition`. It never leaves the panel: the
  referenced character/NPC record is untouched, and duplicating an NPC instance deliberately
  spawns a *fresh* instance with no inherited statuses.
- **Instance-only state** — `currentAP`, `cooldowns`, `abilityUses` and `abilityModifiers`
  are the same kind of state: **the instance's, never the base's.** Three Bandits each spend
  their own AP and cool their own abilities down, and nothing a GM does at the table reaches
  the standalone NPC sheet.
- **`cooldowns` stores bare ability ids** — rather than Recharge values, so the value is
  always read from the base's traits at roll time — editing a trait, or deleting the ability,
  can never leave a cooldown pinned to a stale number (an id that no longer resolves to a
  Recharge ability is dropped on the next roll). See `lib/abilityRecharge.ts`.
- **`abilityUses` is deliberately sparse** — it records only a budget the instance has
  actually spent into, and an absent key reads as the ability's authored `max`, so a fresh
  instance starts full, an ability added to the base later arrives full, and raising a base
  ability's maximum lifts every instance that had not spent into it. A write that lands back
  on the maximum removes the key again. The base record's own `uses.current` is never read —
  a base sheet is a static reference — and nothing here is ever written back to it.
  `lib/abilityUses.ts` owns the whole story (`withInstanceAbilityUses` projects the map onto
  the base at render time, `instanceAbilityUsesRemaining` reads one entry,
  `normalizeInstanceAbilityUses` repairs the map on load), and
  `gmScreenStore.spendInstanceAbilityUse` mirrors `characterStore.spendAbilityUse` for the
  Activate path.
- **`abilityModifiers` follows the identical shape** — for the modifier switches: an absent
  key means "untouched — still on the ability's own `modifiersActive` flag", so a fresh
  instance matches its base sheet (whose flags are template data) and records only the
  switches the GM flipped here. A flip back to the ability's own value removes the key.
  `lib/abilityModifiers.ts` owns the projection (`withInstanceAbilityModifiers`,
  `instanceAbilityModifiersActive`, `normalizeInstanceAbilityModifiers`), and
  `gmScreenStore.setInstanceAbilityModifiersActive` writes it — clamping current HP when a
  Max HP modifier goes off.
- **`withInstanceState`** — `lib/gmScreenUtils.ts`'s `withInstanceState(base, state)`
  composes both projections, and is **the** definition of an instance's entity: the expanded
  panel renders it, the chrome's stat tokens and HP cap read it, and the damage pipeline
  takes its Armor and Max HP from it, so no two surfaces can disagree about what an
  instance's switches do.
- **`mortalWounds` is the instance's too, and stores the wounds themselves** —
  `{ roll, name }`, the D20 and the table entry, rather than a count — so the panel can
  print "Damaged Throat · d20 8" and the table's current rules text. A wound the GM **picked
  by hand** is stored in exactly that shape — the entry's own id is its `roll` — which is why
  a hand-added chip is indistinguishable from an auto-rolled one.
- **The allowance is deliberately not stored on the instance** — it is
  `base.npcStats.mortalWounds`, read at damage and render time like max HP, so raising a
  base's allowance applies to every instance already on the screen (and to the next
  hand-added wound: `addInstanceMortalWound` compares the track against it live).
- **A player panel stores nothing extra at all** — its track is the character's own
  `mortalWounds` slots (two names, one per slot, `'Pending Roll'` while one is unresolved),
  which is why clearing a chip on the panel is visible on the player's sheet and survives a
  reload.
- **`lib/mortalWounds.ts`** — owns the table lookup, the D20 roll and the slot rules for
  every surface — the player's `MortalWoundRoller`, an NPC instance's automatic roll, a
  player panel's (`characterStore.takePanelDamage`), the manual add on all three, and the
  `characterMortalWounds` projection the panel chips and the picker both read — so a wound's
  name and description can never disagree.
- **Storage** — screens live in their own IndexedDB object store (`screens`, DB version 5)
  with no indexes — the panel lists are stored inline and the whole set is read at once.
- **Normalized on read** — like characters, screens are **normalized on read**
  (`normalizeScreen`), which backfills `panels: []`, guarantees every panel's
  `id`/`density`/`statuses`, completes instance state (including a full turn — `currentAP: 3`
  and no cooldowns — for screens written before AP tracking existed, and an empty Mortal
  Wound track for screens written before instance wounds existed), and stamps timestamps — so
  hand-edited or older records load cleanly with no bulk migration (unusable status entries
  are dropped, stacks are repaired into `[1, 99]`, cooldown ids are de-duplicated and
  filtered to non-empty strings, and a wound entry with no name is dropped).
- **Backups** — screens travel **only** in full backups; there is no per-screen JSON export
  (yet).

---

## Store API

`gmScreenStore` mirrors `characterStore` conventions, autosaving the affected screen with a
500 ms debounce:

| Action | Notes |
| --- | --- |
| `loadScreens`, `createScreen`, `renameScreen`, `deleteScreen`, `selectScreen`, `saveScreen` | Screen CRUD; the open screen id is mirrored to `localStorage` |
| `setScreenRound` | Manual edit of the round counter (whole number, floored at 1); writes the label only — it never starts a turn |
| `startNewRound` | Advances the round and starts **every** panel's turn: each instance refills AP and rolls its own Recharge Die, each character runs the sheet's End Turn. Returns `{ round, instanceTurns, characterTurns }` for the caller's toast and roll-log writes; skips panels whose record is gone |
| `addCharacterPanel` | Returns `false` (no state change) for a character already on the screen |
| `addNpcInstancePanel` | Spawns at full HP, a full turn (3 AP, nothing cooling), full ability budgets and the base's own switch state, with an auto-numbered label ("Bandit", "Bandit 2", …) |
| `duplicatePanel` | NPC instances only — spawns a *fresh* instance, never a copy of its HP, AP, cooldowns, ability uses or modifier switches |
| `createNpcBaseAndInstance` | Quick-create: writes a base NPC record without navigating, then spawns |
| `removePanel`, `movePanel`, `setPanelDensity`, `renameInstance` | Panel management (reorder is wired to @dnd-kit sortable) |
| `setPanelStatus`, `adjustPanelStatusStacks`, `removePanelStatus` | GM-screen-only status tracking on a panel (add/change duration, ±stacks clamped to `[1, 99]`, remove) |
| `updateInstanceState`, `setInstanceCondition` | Replace an instance's live state / condition |
| `damageInstance`, `healInstance`, `setInstanceTempHP`, `adjustInstanceHP` | Instance live play (armor → resistance → temp HP → HP, with a Mortal Wound rolled automatically at 0 HP while the base allows one; `adjustInstanceHP` returns the same `DamageResult` for a downward step so the panel can announce it) |
| `clearInstanceMortalWound`, `clearInstanceMortalWounds` | Remove one wound from an instance's track, or all of them (the panel's Rest equivalent) |
| `addInstanceMortalWound` | Applies a **specific** Mortal Wounds table entry to the instance's own track, with no D20 (the manual counterpart of the automatic roll). Stores the entry's id as the wound's `roll`, so the chip reads like a rolled one; refuses — writing nothing and returning `false` — for a name off the table or a track already at the base's live allowance |
| `spendInstanceAP`, `restoreInstanceAP` | The instance's own Action Points (`spend` reports whether it could afford it; `restore` clamps to 3) |
| `markAbilityCooldown` | Flags one of the base's abilities as cooling on this instance (idempotent) |
| `setInstanceAbilityUses` | Sets how many uses the instance has left of one limited ability, clamped to the base's authored `max`; a count back at the maximum clears the entry |
| `spendInstanceAbilityUse` | Spends one of the instance's uses (the Activate path) and reports whether one was really spent — unlimited, `expendOnActivate: false` and 0-left all refuse |
| `setInstanceAbilityModifiersActive` | Flips one ability's stat/attribute modifiers on this instance (clamping current HP when a Max HP modifier goes off); a flip back to the ability's own flag clears the entry |
| `startInstanceTurn` | Refills AP and rolls one Recharge Die, returning `{ roll, recharged, stillCooling }` so the caller can toast it and log it — the store itself never notifies |
| `baseFor`, `screensReferencing` | Reference lookups used for placeholders and delete warnings |

Every live-play character mutation was refactored to be **id-targeted** (`takeDamage(id, …)`,
`spendAP(id, …)`, …) so the GM Screen can drive several sheets in one tick.
`updateCurrentCharacter(updater)` remains as a thin wrapper over
`updateCharacter(id, updater)` for the sheet pages, and autosave now uses per-character
debounce timers so edits to several panels each persist their own record.

---

## Related

- [features.md](features.md) — the complete feature reference, and where the GM
  Screen sits among the rest of the app.
- [data-model.md](data-model.md) — the `Character`, `AbilityBlock` and
  `StatusCondition` shapes the panels reference.
- [architecture.md](architecture.md) — the stores and persistence layer the
  screen is built on.
