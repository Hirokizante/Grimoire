# Features

Grimoire's complete behaviour reference: what each feature does, every option and default it
carries, and the limits and edge cases behind them. It is written for users who want the full detail
behind the summary in the [README](../README.md), and for contributors who need a feature's
intended behaviour before changing it.

---

## About Divergence

Divergence is a DIY tabletop RPG system — there is no compendium of spells or items. Players build
their characters' abilities and equipment from scratch, using the system as a creative framework.

Grimoire is built to support that freedom:

- **Structured text fields for abilities.**
- **Full creative control over look and feel.**
- **Live-play tools for tracking resources and rolling dice.**

---

## Character creation & editing

### The sheet

- **Guided character creation** — start with a named sheet and begin filling in attributes, skills,
  and abilities immediately.
- **Labels** — tag any character or NPC sheet with custom labels (each with an optional value) from
  the sheet page; labels also appear on the list pages for at-a-glance organization. Labels are
  local-only metadata — they are never included in exports. (Sheet filtering by label is coming
  soon.)
- **Five Attributes** (MAR, POW, AGI, VIT, GRT) allocated from the standard array (3, 2, 1, 0, -1),
  each with click-to-roll support.
- **Fifteen Skills** with selectable proficiencies and click-to-roll support.

### Abilities and slots

- **Core Ability** — Innate narrative, Innate Abilities, Basic Attack, and Fatebreaker ultimate.
- **The Basic Attack** — every sheet is born with one, and it is **fixed**: it can be renamed,
  re-flavoured, given sub-abilities and retuned like any other ability, but it has no Remove button,
  so a sheet can never be left without its fallback action. It arrives configured to **roll dice on
  activation** (`d20 + MAR` accuracy and its own `1d6 + MAR` damage — both editable, and either one
  can be switched off in the ability editor). An **NPC** carries the same block, pinned to the head
  of its ability list (see [NPC sections](#npc-sections)).
- **Slotted Abilities** — equip abilities for an encounter; drag-and-drop to reorder or move to/from
  the pool. In edit mode the whole card can be grabbed (its buttons still click), and the card is
  drawn in the slot it will take while a line across that slot's leading edge marks exactly where it
  will go. A drop that would overflow the slot budget is refused *while dragging*: the line turns
  red instead of accepting the card and discarding it.
- **Ability Pool** — unlimited inactive abilities available to swap in before an encounter. Nothing
  in the pool activates: pooled cards carry no Activate button, and neither do the sub-abilities
  nested under them (a sub-ability is bound to its parent and cannot be slotted on its own). Only
  the use steppers stay — a counter is not an activation.
- **Minor Abilities** — flagged abilities that occupy half a slot instead of a full one.
- **Ability templates** — pre-filled starting points for common ability types (melee, ranged, buff,
  debuff) that remain fully editable.
- **Duplicate, copy & paste ability blocks** — in edit mode every ability card carries
  **Duplicate** (a fresh copy of the block lands directly after it) and **Copy** (snapshots it on
  the app's one-slot ability clipboard). A **Paste** button then appears beside **+ Add Ability**
  in every ability section — Slotted Abilities, the Ability Pool, a custom tab's ability sections,
  Core Innate Abilities, and an NPC's list — and inserts a fresh copy there, so a block can travel
  between sections and tabs (and between characters) without retyping it. A copy is a **new
  block**: every block and sub-ability gets a fresh id, the uses budget starts full, and modifier
  switches start off, while everything authored — name, traits, costs, damage, text, modifiers,
  activation rolls, sub-abilities — is kept. A custom cost keeps pointing at the source sheet's
  bar ids, so a bar the pasting sheet does not define simply is not shown.
- **Copy an ability as an image** — every card, sub-ability blocks included, carries a small capture
  button in its corner that copies a clean, cropped PNG of the block to the device clipboard (or
  downloads it where the clipboard is unavailable). The shot is cropped to the card, hides the
  button itself, and never inherits a dim — a GM panel card at 0 AP copies at full strength. View
  mode only: an edit-mode card's grip and Edit / Remove buttons are not part of the ability.
  On pointer devices the button is **hover-reveal**: it fades in while the cursor is over the card
  (or when the button itself has keyboard focus) so the sheet stays uncluttered, and stays put
  through the capture (spinner / check) even if the pointer leaves. Touch devices, which have no
  hover, keep it visible at all times.

### Ability Block editor

- **Fields** — structured fields for name, traits, cost (AP/END/FP), damage, description,
  overcharge, and flavor text. Supports Markdown in description and overcharge.
- **Custom ability costs** — abilities can also spend any custom resource bar: "+ Add Cost" in the
  Ability Block editor picks a bar, and the cost renders as a color-matched badge next to AP/END/FP
  and auto-deducts on Activate (sub-abilities included).

### Roll dice on activation

- **Authoring** — ticking **Roll Dice on Activation** in the Ability Block editor reveals three
  parts, each optional and free to combine with the others:
  - **Roll accuracy** — `d20 + an attribute`, chosen from the five Divergence Attributes **or any of
    the sheet's own custom attributes** (both lists are in the same picker), with an optional extra
    bonus written as notation (`+2`, `+1d4`). The picker prints what the choice currently adds
    (`adds +4 from MAR`). An **NPC**'s picker offers the five Attributes alone: custom attributes
    are a player-sheet feature, so the option is not shown there at all. A player sheet with none
    says so, and points at the hero section where they are added.
  - **Roll damage** — rolls the ability's own **Damage** field. There is no second copy of the
    expression to keep in sync: edit Damage and this roll follows it. The box stays disabled until
    the ability has a damage expression to roll.
  - **Custom rolls** — **+ Add Custom Roll** appends any number of extra expressions, each with an
    optional name ("Bleed") and an optional **Hide result**, for rolls the table only occasionally
    needs to read.
  - **Advantage / Disadvantage** — accuracy and each custom roll carries an **Adv** / **Dis** pair.
    An authored value rolls with the activation: the net count is rolled as that many d6s after the
    part's own expression, the highest die is added for Advantage or subtracted for Disadvantage, and
    the result window opens with the adjusted total already in place (with the inputs pre-filled, so
    a situational correction can be re-rolled on the spot). The damage roll has no Adv/Dis — see the
    critical-hit rule below.
  - **Critical hits** — an accuracy result of **20 or more** is a critical hit: the damage is rolled
    **twice and the higher result is kept**, and the damage card arrives marked (`✦ CRIT`) with both
    totals shown. The control can remove the critical (restoring the first roll) or mark one by hand
    when the table rules a hit critical. A damage-only activation — no accuracy roll of its own — is
    never auto-crit; mark it by hand instead.
- **What Activate does** — every configured roll happens in a fixed order: **accuracy, then damage,
  then the custom rolls as authored**. All of them appear **together in one result window** headed by
  the ability's name, each card outlined in its part's colour and showing its notation, its dice, its
  working (`d20+MAR → 15 + 4 = 19`) and its total, plus a nat 20 / nat 1 badge where one applies. A
  roll marked **Hide result** shows its total with its working folded behind a **Show result**
  toggle.
- **Who rolls what** — the notation resolves against whoever activated the ability: a player's own
  attributes and custom attributes on their sheet, an NPC instance's own stats on the GM Screen. The
  values are the *effective* ones, so an active `+3 MAR` stance is included — exactly as it is when
  the same notation is clicked by hand.
- **Everything is logged** — each part of an activation is its own entry in the roll log
  ("Activation: Cleave (accuracy)"), so the log stays a roll-by-roll history even though the results
  are read as one action.
- **Sub-abilities** — a sub-ability carries the same option and rolls it through the same code, so a
  follow-up attack rolls its own accuracy and damage when its own Activate button is pressed.
- **Basic Attacks come configured** — a fresh Basic Attack (on a new player character and on every
  new NPC alike) ships with the box ticked: accuracy on MAR plus its own damage, so pressing
  Activate on the sheet's Basic Attack — or on an NPC instance's pinned card on the GM Screen —
  rolls the whole attack in one window. It is ordinary authored configuration from there on: retune
  the attribute, add custom rolls, or untick the box to switch the automatic rolls off (the editor
  stores nothing when it is off, so a switched-off Basic Attack stays switched off).
- **NPCs** — authored on the ability in the NPC editor like any other field, and rolled on the **GM
  Screen** under an NPC instance, where it spends that instance's own AP and takes that instance's
  own Recharge cooldown. A cost-free ability whose only job is to roll still gets an Activate button
  there, so the rolls can be triggered. An NPC's base sheet still activates nothing: it is a static
  reference, so no Activate button appears there.
- **Graceful edges** — a custom attribute the sheet no longer defines rolls as a plain `d20` (an
  unknown variable is `+0` in dice notation), and an expression the parser cannot read is skipped
  rather than rolled as zero.

### Ability stat & attribute modifiers

- **Targets** — an ability can modify the sheet's Attributes (MAR, POW, AGI, VIT, GRT) and combat
  stats (Evasion, Armor, Movement, Save DC, Max HP, END Recovery).
- **Authoring** — ticking "Modifies combat stats / attributes" in the Ability Block editor reveals
  one row per modifier, where you pick the target, choose **+** (add) or **−** (subtract), and enter
  the amount.
- **Applying and removing** — switching the card's modifier toggle on in view mode applies every
  modifier; switching it off removes them.
- **What counts** — every switched-on ability counts, wherever it sits (core, slotted, pool, or a
  custom tab) — the switch, not the slot, is what applies a modifier.
- **Never baked into the sheet** — modifiers are never baked into the stored sheet: attributes,
  derived stats, dice rolls, and live-play maths all read the *effective* values, and modified
  values are flagged with a small delta chip.
- **NPCs** — NPC abilities support the same feature, minus END Recovery, which NPCs don't have.
- **NPC base sheets** — the switch is visible but inert: a base record is the static reference the
  GM Screen spawns instances from, so its flags are template data.
- **GM Screen instances** — each instance owns its switches, and its choice moves its own
  Evasion/Armor/Movement/Save DC/Max HP and Attributes (plus the damage it takes) without touching
  the base or its siblings.

### Limited-use abilities

- **Authoring** — tick "Limited uses" in the Ability Block editor to cap how many times an ability
  may be used. Set the maximum (1–99, which also refills the budget: the authored number is the
  whole limit) and choose whether clicking Activate spends one of those uses (on by default; untick
  it to track a budget that something else consumes).
- **Reading the count** — the remaining count renders on the ability card: **one circle per use for
  5 or fewer** (filled = available, hollow = spent), and a plain `current / max` number above that.
- **Manual steppers** — every limited ability (and limited sub-ability) is flanked by compact **− /
  + steppers** so you can spend or hand back a use by hand (a reaction spent out of turn, a
  GM-granted refill, undoing a mis-click). The plus stops at the ability's maximum, the minus at
  zero, and stepping never costs resources or triggers the Activate logic.
- **Where the steppers show** — on every limited ability wherever it lives on a **player sheet**
  (core, slotted, pool, custom tabs, sub-abilities) and in both sheet modes, whether or not the
  ability has an Activate button; and on every limited ability of a **GM Screen NPC instance**,
  where they move that panel's own count.
- **The one place they do not appear** — an NPC base sheet. A base record is the static reference
  the GM Screen spawns instances from, so its ability budgets are template data: they read on the
  card, and the instances that copy them each track their own uses (see [GM Screen](gm-screen.md)).
- **Exhausted abilities** — a limited ability with no uses left cannot be activated; its button is
  disabled with an explanatory tooltip.
- **Where the state lives** — uses are per-ability live-play state on a player sheet: they follow
  the ability wherever it sits on the sheet (core, slotted, pool, custom tabs, and sub-abilities),
  are saved with the sheet (so they survive a reload), and are **always refilled to their maximum on
  a rest / full restore**.

### Custom tabs and sections

- **Tabs** — create up to 6 custom tabs, each with named sections, for organizing homebrew content.
- **Section types** — when adding a section, choose between an **Ability Block** group, an **NPC
  Sheet** (a blank, editable NPC bundled directly into the tab), or a **Text** section (a free-form
  Markdown body for unique mechanics, flavor text, or lore).
- **Ordering** — sections are ordered by the tab itself: in edit mode every section heading carries
  an **↑ / ↓ pair** at its right edge, and one click shifts that section one place up or down the
  tab. The first section's ↑ and the last section's ↓ render disabled rather than hidden (the
  control never moves or disappears as a section walks the tab), and the new order is saved with the
  sheet.
- **Moving ability cards** — in edit mode a card **is** the drag surface: grab it anywhere except
  its own buttons (the grip at the top is simply the easiest place, and the keyboard's). While the
  card is in the air it is drawn, faded, in the slot it is about to take, the cards it passes slide
  up to close the gap it left, and a line across that slot's leading edge marks where it will land
  — no card is ever squashed or stretched on the way, whatever the cards' heights. Release on the
  near half of a card to land before it, on the far half to land after; the same preview shows in
  the Slotted Abilities ↔ Ability Pool lists, so all four drag surfaces behave alike. Dropping on a
  card, the list body, or the "drag one in" drop zone of **another ability section in the same tab**
  moves the card there, at the position the line drew. Sections do not trade cards across tabs, and
  a card can never be dropped into an NPC or Text section (the bundled NPC's list is a separate,
  reorder-only drag).

### NPC sections

- **Attaching** — attach a full NPC to a custom tab. NPC sheets show portrait, combat stats,
  attributes, skills, abilities, and description in a compact inline layout, and are editable in
  place within the tab; NPC attributes and skills are click-to-roll, matching the main sheet.
- **The abilities block** — it **is** the NPC sheet's own Abilities section: same heading row with
  the grid/list toggle, same "+ Add Ability" button, same card grid, and the same drag-to-reorder
  grips in edit mode (only the section shell and the `h3` heading give way to the bundled NPC's `h5`
  block label). A drag reorders the attached NPC's own record, so the order matches the NPC's sheet
  page. The NPC's **Basic Attack is pinned to the head of that list** — the same fixed block a
  player sheet keeps in its Core Ability, in the one ability surface an NPC has. It renders with the
  rest of the grid, but it carries an **Edit** button and no **Remove**, and it is not sortable, so
  no drag can move it or delete it.
- **Export and removal** — attached NPCs are exported and re-imported alongside their parent
  character, and removing an NPC section only detaches the reference — the NPC record stays in the
  NPC list.

### Custom resource bars

- **Custom resource bars** — define named point pools (current/max) rendered below Endurance, with
  optional refill on Recover.

### Custom attributes

- **What they are** — your own stats beside the five Attributes (MAR, POW, AGI, VIT, GRT): a name,
  a value, and an optional **shorthand** (the short form, the way Martial is abbreviated MAR).
  Homebrew a "Sanity", a "Doom", a "Martial Arts" — whatever the character needs.
- **Where they live** — a **horizontal strip** of attribute boxes inside the hero section: below the
  resource bars (and, in view mode, below the **Recover / End Turn** row) and above the Mortal Wounds
  block, centered so a strip of two or three reads as deliberately placed rather than left-hanging.
  Shorthand on top, value in the middle, full name underneath (with no shorthand, the name is the
  box's own label).
- **Building them** — in edit mode **+ Add Attribute** sits next to **+ Add Resource Bar**; the
  dialog asks for the name, the value, the optional shorthand, and whether view mode should offer
  steppers. Each box also carries an edit pencil (rename, re-value, shorthand, steppers) and a
  Delete that asks for confirmation like every other destructive action.
- **Rolling them** — the point of them: write the shorthand or the full name in **any dice
  notation** (`1d6+SAN`, `2d6+Martial Arts`) and it resolves to the attribute's current value,
  exactly as `POW` does. They are also click-to-roll like the built-in attribute boxes (a box click
  rolls `d20 + value`), and the roll reads the live value — nudge it and the next roll uses the new
  number.
- **Steppers (opt-in per attribute)** — an attribute that changes a lot during play can show **− / +**
  buttons beside its value in **view** mode, so it is adjusted without switching back to edit mode.
  The built-in stats and skills still win a name collision: a custom "Sneak" never takes over Sneak
  rolls.

### Portraits and bio

- **Portrait upload** — square-crop your portrait first (rule-of-thirds grid overlay with a zoom
  slider), then it is compressed and stored as a base64 dataURL (max 512px, JPEG 0.85 quality); "Use
  Original" skips the crop.
- **Physical description & backstory** — Markdown-supported bio fields.

---

## Live play (view mode)

### Mode and resources

- **Edit / View mode toggle** — Edit mode for building the sheet; View mode locks fields and enables
  live-play interactions.
- **Resource tracking** — FP, AP, and END bars with inline +/− controls; costs auto-deducted when
  abilities are activated.
- **Recover action** — spend 3 AP to regain all END.
- **End Turn** — converts unspent AP to END (1:1) and applies END Recovery.
- **Exhaustion support** — the Exhaustion mortal wound adds +1 to all END costs automatically.

### Hit points and damage

- **Automatic HP tracking** — input damage and the system applies Armor reduction (1d6 per point),
  Resistance (halve), and Temp HP absorption, then handles Mortal Wound overflow and knock-out.
- **Temporary HP** — tracked separately; reduced before regular HP; highest value takes precedence.

### Mortal Wounds

- **Rolling a wound** — D20 roll on the 20-entry Mortal Wounds table when HP reaches 0; up to 2
  wounds tracked.
- **Recording a named wound by hand** — a wound that is *named* rather than rolled (an ability in
  play, an NPC's authored effect, a GM ruling) can also be **recorded by hand**: **Add Mortal
  Wound…** opens the same table as a searchable picker and applies the chosen entry with its own D20
  — on the sheet and from either panel's ⋯ menu (see [GM Screen](gm-screen.md)).
- **How the block reads** — top to bottom: a `[skull] Mortal Wounds n / max` header (no empty slot
  boxes), one card per wound with its D20, name and rules text, a warning once the track is full,
  and **one row** carrying every action the track has — *Roll Mortal Wound (d20)*, *Add Mortal
  Wound…* and *Rest (Full Restore)*, each a peer-sized button with an icon.
- **Edit mode** — renders the same block read-only.

### Death saves

- **Death Save tracking** — success/failure pips, auto-roll with nat 20/nat 1 doubling, revive at 3
  successes or die at 3 failures.
- **Shared button** — its **Roll Death Save (d20)** button is the sheet's shared compact action
  button, the same one the wound block's roll uses.
- **Knocked Out** — a character is **Knocked Out** on the rules' own terms — 0 HP with no Mortal
  Wound left to take — never merely because the track is full: filling it raises the *Critical
  Condition* warning instead, and the sheet announces each at the moment it actually happens
  (`isKnockedOut`, `lib/mortalWounds.ts`).

### Ability switches and limited uses in play

- **Ability modifier switches** — each ability that declares modifiers (see above) carries an on/off
  switch on its card. Switching it on instantly applies the ability's stat/attribute changes to the
  sheet; switching it off removes them. It is independent from the Activate button, costs no
  resources, and does not require the ability to be activated — so passive stances, forms, and auras
  work without spending AP. A GM Screen NPC instance has these switches per instance (see [GM
  Screen](gm-screen.md)); an NPC base sheet shows them read-only.
- **Limited-use tracking** — an ability flagged as limited (see above) shows its remaining uses on
  its card and spends one per Activate when configured to. At zero uses the Activate button is
  disabled until a rest refills the budget, and unlimited abilities are completely unaffected. NPC
  base sheets show the budget read-only; a GM Screen instance owns and spends its own.
- **Activation rolls** — an ability authored to roll on activation (see
  [Roll dice on activation](#roll-dice-on-activation)) performs its rolls on the same click that
  spends the resources, and shows them together in one result window. A blocked activation — no
  uses left, unaffordable, or on cooldown — rolls nothing at all.

---

## Dice roller

- **Inline dice notation** — `d20`, `2d6+4`, `1d6+POW`, `2d6+POW/MAR` are auto-detected in any text
  field and become clickable in view mode. A badge can read as the notation itself or, with
  **Settings → Dice → *Display dice notation as min-max values*** on, as the range it can roll
  (`1d6+3` → `4-9`); the click is unchanged either way.
- **Compound notation** — `+`, `-`, `*`, `/` and parentheses all work with the usual precedence, so
  `(1d6+POW)*2/2d6+MAR` is one clickable token that does exactly what it reads: double the d6 plus
  POW, divide by a fresh 2d6, add MAR. Division rounds down, and an unknown name counts 0 wherever it
  sits (see [Dice notation](data-model.md#dice-notation) for the two shape rules that keep `*` and
  `/` out of prose's way).
- **Variable substitution** — attribute abbreviations (MAR, POW, AGI, VIT, GRT), full attribute
  names, skill names, and the sheet's own **custom attributes** (by shorthand or name — see
  [Custom attributes](#custom-attributes)) resolve to the character's actual values. Canonical
  stats win a name collision.
- **Roll breakdown** — full per-term breakdown showing each die, each substituted variable, and the
  total (e.g. `2d6+POW → 4 + 3 + 4 = 11`). A compound roll keeps its shape too, operators and
  parentheses included (`(1d6+POW)*2/2d6+MAR → (3 + 4) × 2 ÷ (3 + 3) + 3 = 5`).
- **Advantage & Disadvantage** — the result window carries an **Advantage** / **Disadvantage** pair
  on a roll. Enter the dice of each and press the button: the net count (the two cancel) is rolled as
  that many d6s *after* the initial roll, the highest die is added for Advantage or subtracted for
  Disadvantage, and the new total is shown with the dice. Entering 0/0 clears an applied adjustment,
  and changing a value re-rolls it from the roll's base total. Applying one updates the roll's
  existing entry in the roll log in place — no duplicate entry.
- **Critical hits** — a damage roll (an Ability Block's Damage field, or the damage part of an
  activation) carries a **Critical Hit** control instead of Advantage/Disadvantage. An attack roll
  totaling **20 or more** makes the damage critical automatically during an activation: the damage
  expression is rolled twice and the higher result is kept, shown as `7 vs 11 → keeps 11` with a
  `✦ CRIT` badge. The same control marks a manual damage roll critical (or removes the critical,
  restoring the first roll), and the roll log's existing entry is updated in place with a
  `Critical hit: 7 / 11 → keeps 11` line.
- **Activation rolls** — one Activate press can perform several rolls at once (accuracy, damage, and
  hand-authored extras — see [Roll dice on activation](#roll-dice-on-activation)). They are shown
  stacked in one result window in the order they were rolled, each with its own breakdown; accuracy
  and custom rolls keep their Advantage/Disadvantage controls, damage carries the critical control,
  and each roll is logged separately.
- **Critical / fumble detection** — nat 20 and nat 1 badges on d20 rolls.
- **Copy a result as an image** — the result window's header carries the same capture button as an
  ability card: it copies a clean, cropped PNG of the whole window (header, totals, breakdown and
  every stacked activation roll, including any part the window had to scroll to) to the device
  clipboard, or downloads it where the clipboard is unavailable.
- **Roll log** — persistent, per-character roll history in a slide-out drawer; entries are saved to
  IndexedDB and survive reloads. Expanding an entry shows its breakdown and, when one was applied,
  its Advantage/Disadvantage reading (`Advantage +2: 6, 3 → +6`).

---

## Status compendium

- **Status conditions** — reference records for game effects like "Poisoned" or "Hidden", each with
  an icon, rules text, and categorization tags. The compendium ships seeded with the built-in
  Divergence conditions and supports player-created custom ones.
- **Inline references** — write `[StatusName]` in any sheet markdown (ability descriptions,
  overcharge, flavor text, innate description, custom text sections); it renders as a highlighted,
  clickable reference with a tooltip showing the condition's details. Matching is case-insensitive.
- **Compendium page** — browse, sort, create, edit, and delete conditions; pick an icon from emoji,
  the bundled icon pack, or an uploaded image.
- **Searchable icon picker** — all three icon sources are searched, not scrolled: any of the 1,900+
  Unicode emoji by name (with a quick-pick row, and tabletop aliases so "poisoned" reaches ☠️ and
  "grappled" reaches ⛓️), any of RPG-Awesome's 496 fantasy icons, or an uploaded SVG/PNG. Pasting an
  emoji into the search box still works, and statuses saved with the older Lucide pack keep
  rendering their icon.
- **Referencing sheets** — each compendium card previews the characters that reference a condition
  in a single row; opening the card's status modal lists the full set, and character exports bundle
  every status the sheet references.
- **Export a single status** — the status modal's Export button downloads the condition as
  `Status - {Name}.json`, ready to hand to another table.
- **Copy a status as an image** — the status modal's header carries the capture button: it copies a
  clean, cropped PNG of the view-mode modal — icon, name, tags, referencing sheets, and description
  — to the device clipboard, or downloads it where the clipboard is unavailable. View mode only, so
  the edit form stays out of the image.
- **Export the compendium** — the compendium page's Export downloads every condition (built-in +
  custom) as `Grimoire Status Compendium YYYY-MM-DD.json`.
- **Import** — the compendium page's Import accepts either file (or a hand-written status object /
  array). A single status merges: a same-named condition is updated in place — its id is kept, so
  GM-screen pills keep resolving — a new name is added. A compendium file **replaces the entire
  compendium** after a confirmation that spells out the overwrite. Character-sheet and full-backup
  files are recognized and pointed at their own importers; a compendium with a malformed entry is
  rejected as a whole rather than partially imported.

---

## Customization

- **Full color palette** — every sheet element (surfaces, text, borders, accents, resource bars,
  stat tokens, etc.) exposed as color swatches — no custom CSS required.
- **Theme presets** — one-click themes that replace the palette in a single click, including presets
  that match each app theme (Parchment, Mikami, Pitch Black) for a cohesive app + sheet look. Full
  list: Default, Midnight, Parchment, Mikami, Pitch Black, Solar, Ocean, Sakura, Dracula, Nord,
  Gruvbox, Solarized Dark, Tokyo Night, Catppuccin.
- **Per-element font selection** — independent font families for headings, labels, body text, and
  helper text.
- **Google Fonts import** — type any Google Fonts family name to add it to the font pickers.
- **Background image** — upload an image, with darken and blur overlays.
- **Custom CSS** — advanced users can append raw CSS that overrides the sheet. See the [player's
  guide](custom-css-guide.md) and its [recipes](custom-css-recipes.md).
- **Section background toggle** — hide section backgrounds for a flatter layout.
- **View modes per section** — grid or list layout for Slotted Abilities, Ability Pool, each custom
  section, and an NPC's Abilities (on the NPC's own sheet page *and* in every bundled-NPC section of
  a character sheet, which keeps the parent tab's choice), persisted per sheet.
- **Match app theme** — *Settings → Character Sheets → Match app theme* disables the appearance
  customization above at once: every character sheet renders with the active app theme's palette,
  the app chrome's fonts and the default card background, and no background image or custom CSS —
  exactly like an NPC sheet. The Customize button is hidden with it, while per-section view modes
  keep working.
  Display-only and reversible: nothing about the character record changes (see
  [App settings](#character-sheets-can-match-the-app-theme)).

### Writing custom CSS

The Custom CSS box is aimed at players with no HTML/CSS background, so the documentation is written
for them:

- **[custom-css-guide.md](custom-css-guide.md)** — how the box works, the sheet's variable and class
  reference, and the pitfalls worth knowing.
- **[custom-css-recipes.md](custom-css-recipes.md)** — paste-ready themed looks and one-thing
  tweaks.

---

## App settings

### App themes

- **App themes** — switch the app's own color scheme (header, list pages, modals, dice UI —
  everything *around* the sheets) in Settings.
- **Ships with** — **Midnight** (the default violet-dark palette), **Parchment** (warm charcoal
  `#262626` with parchment `#c5b8a0` highlights, plus a matching alternate title-bar glyph),
  **Mikami** (Nord on near-black, from Ghostty), and **Pitch Black** (pure black with cream, gold,
  and muted teal, from Ghostty).
- **Persistence** — the choice persists in `localStorage` and applies before first paint.
- **Sheet color themes are unaffected by default** — those stay per-character in the Customization
  panel. *Settings → Character Sheets → Match app theme* can make character sheets follow the app
  theme instead.

### UI style

- **Settings → Interface** switches the app between two shape-and-motion languages, independent of
  the color theme (every theme pairs with every style):
  - **Default** — the original look: soft corners, system sans, gentle easing.
  - **Terminal** — a retrofuturistic terminal reskin: square corners everywhere, monospace chrome
    (sheets that follow the app theme inherit it; a sheet with custom fonts keeps them), the
    **Pixelarticons** icon pack in place of
    Lucide, phosphor glow on headings and active controls (player sheet tabs stay flat so no halo
    bleeds onto the section below), a CRT scanline/sweep overlay on the home page, and stepped
    "frame-by-frame" motion. Page switches and pop-ups open instantly — no fade — matching the
    default style's snappiness. Built to pair with the **Terminal Boot** home page animation, but
    works with either.
- **A display-only reskin** — no character, NPC, screen, or status data changes; switching back to
  Default restores the original UI exactly.
- **Persistence** — the choice persists in `localStorage` and applies before first paint.

### Dice notation display

- **Settings → Dice → *Display dice notation as min-max values*** makes every highlighted badge read
  as the range it can roll with the character's current stats — `1d6+3` reads `4-9`, `1d6+POW` reads
  `3-8` while POW is 2 — instead of the notation as written.
- **Off by default**, so badges keep the notation as written until asked otherwise.
- **Display only** — clicking a badge still rolls the original notation, and the roll breakdown
  shows it exactly as before. A badge with no sheet to resolve its stats against keeps the notation
  as written, since a range over an unresolved name would be wrong.
- **Persistence** — the choice persists in `localStorage`.

### Home page animation

Pick the ambient effect behind the home page title in Settings:

- **Arcane Glow** — the default: a volumetric shaft of light falling through a dark room, air haze
  where it lands, and a slow field of out-of-focus dust motes at three depths, the ones caught in
  the beam glowing warm.
- **Terminal Boot** — a startup log that types itself out, as if Grimoire were launched from a
  shell, then settles to a dim static trace.
- **Off** — animations can also be switched off entirely for a plain, motion-free home page.
- **Persistence** — the choice persists in `localStorage`.

### GM panel sheets can match the app theme

- **Settings → GM Screen → Match app theme** makes a player panel's expanded sheet body drop its
  custom colors, card background, and fonts and use the app theme instead, exactly as an NPC panel
  always renders.
- **Off by default**, so each panel keeps the character's own customization unless the GM asks
  otherwise.
- **Display only** — the character's own sheet page, its Customization panel, and its exports are
  never changed.

### Character sheets can match the app theme

- **Settings → Character Sheets → Match app theme** drops a character sheet's whole customization —
  palette, fonts, card and page backgrounds, background image, and custom CSS — and renders it with
  the active app theme, exactly as an NPC sheet always renders. The Customize button is hidden with
  it, since there is nothing left to customize against.
- **Follows the sheet everywhere** — the page canvas, title bar, character selector, dice result
  modal, and roll-log drawer all stay on the app theme too, so nothing around the sheet disagrees
  with it.
- **Off by default**, so each sheet keeps the character's own customization unless asked otherwise.
- **Display only and reversible** — the character record is never changed; turning the switch back
  off restores every custom value, and exports, versions, and backups are unaffected.

### One Combat Stats palette for every sheet

`STAT_TOKEN_COLORS` in `themeUtils.ts` gives each app theme a tuned accent per stat, covering both
rows a sheet can show:

| Row | Stats |
| --- | --- |
| Player | Milestones, Evasion, Armor, Movement, Save DC, END Recovery |
| NPC | Evasion, Armor, Movement, Save DC, HP, Mortal Wounds |

- **Shared hues** — the four stats the two rows share hold the **same** hue in both, so a stat is
  never two colors.
- **Distinctness floor** — every stripe stays clearly distinct from its row-mates and from the card
  behind it in every theme. A unit test enforces a floor of ΔE(CIE76) ≥ 16 within a row and ≥ 3.5:1
  contrast; the shipped palettes sit at ≥ 18 and ≥ 3.7:1.
- **Who reads it** — a standalone NPC sheet reads this palette because it has no customization of
  its own; a player's own sheet page uses the character's per-sheet token colors from the
  Customization panel (or this palette when *Match app theme* is on), while a **GM panel's Combat
  Stats row — either kind — always reads this palette** (see [GM Screen](gm-screen.md)).
- **Embedded NPC sections** — NPC sections embedded in a player character sheet never apply colors
  of their own, so the player sheet's theme takes precedence there.

---

## Import / export

- **Export as JSON** — downloads a versioned file (`Character Name v1.2.3.json`).
- **Automatic versioning** — each export bumps the patch version (or a manual override).
- **Version history** — every export creates a snapshot stored in IndexedDB; browse, re-download,
  restore, or delete past versions.
- **Import from JSON** — load a previously exported sheet back in.
- **Update existing** — importing a sheet whose name matches an existing character offers to update
  in place (preserving live-play state: HP, END, AP, FP, mortal wounds, death saves) or import as a
  new copy.
- **Version resolution** — when updating, the imported version is used if strictly newer; otherwise
  the existing version is bumped forward.
- **Attached NPCs** — when a character has NPC sections, the export includes those NPCs as a bundle
  (`attachedNpcs`). On import, each NPC is persisted as its own record and the parent's section
  references are rewritten to the fresh IDs, so the parent↔NPC link round-trips intact.
- **Full backup & restore** — Settings → Backup & Restore downloads *everything* (all characters and
  NPCs, the status compendium, GM screens, version history, and the roll log) as a single JSON file
  (`Grimoire Backup YYYY-MM-DD.json`).
- **Restoring** — restoring from a backup **replaces** all current data in one atomic IndexedDB
  transaction, after an explicit confirmation.
- **Backup versions** — backups carry a `backupVersion` (currently **2**); newer-version backups are
  refused with a clear message, and **v1 backups still restore** — they simply carry no screens.
  Single-character exports are *not* backups — restore points you at the Characters page import
  instead.
- **Attached statuses** — statuses referenced by a sheet are bundled into the export
  (`attachedStatuses`). On import they are restored by id and name conflicts are resolved —
  references match by name, so they keep working even after a condition is renamed.

---

## GM Screen

The GM Screen runs several sheets at once on one surface, and its panels carry live-play state of
their own:

- **Each NPC instance's own turn** — 3 AP, working Activate buttons, its own limited-ability uses
  (spent on Activate and steppable by hand), its own stat/attribute modifier switches, and Recharge
  cooldowns resolved by a Recharge Die roll. An ability authored to roll on activation rolls against
  the **instance's** stats and shows its results in the same window the player sheets use.
- **Rounds** — a **New Round** button on the toolbar starts every panel's turn at once and advances
  the round counter, which can also be typed over by hand. Each instance still rolls its own Recharge
  Die, logged like a turn's.
- **Mortal Wounds on both panel kinds** — the same wound track sits under the HP bar and the panel
  resolves the D20 for the GM: an NPC instance uses the base's own **Mortal Wounds** stat as its
  allowance, and a player character's two slots are rolled as the panel deals the damage instead of
  being left on "Pending Roll". A base with `Mortal Wounds: 0` is untouched and still just goes
  Downed at 0 HP. Either panel's ⋯ menu can also **Add mortal wound…** — pick a specific table entry
  and it lands with no D20.
- **Per-panel status tracking** — the same status records back the screen's per-panel status pills,
  and that tracking state lives on the panel, not on any character sheet.

See [gm-screen.md](gm-screen.md) for the full detail.

---

## Related

- [GM Screen](gm-screen.md) — the full GM Screen reference.
- [Custom CSS guide](custom-css-guide.md) — how the Custom CSS box works, plus the variable and
  class reference.
- [Custom CSS recipes](custom-css-recipes.md) — paste-ready themed looks and one-thing tweaks.
- [README](../README.md) — installation, quick start, and the user-facing basics.
