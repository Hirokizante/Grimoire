# Data model

The domain types Grimoire stores and derives: character sheets, the abilities on
them, custom sections, GM screens, and the compendium records they reference.
This page is for contributors and agents changing sheets, abilities, exports or
persistence; storage internals — IndexedDB object stores, `db.ts`,
normalization on read and autosave — live in [architecture.md](architecture.md).

---

## Character

The central domain object is a **`Character`**, which holds everything about a
single Divergence character sheet:

| Field | Purpose |
| --- | --- |
| `kind` | Discriminator: `'character'` (player sheet) or `'npc'` (static NPC reference) |
| `id`, `name`, `playerName` | Identity |
| `version` | Semantic version (MAJOR.MINOR.PATCH) for export tracking |
| `milestones` | Character progression level |
| `attributes` | The five Attributes (MAR, POW, AGI, VIT, GRT) |
| `skills` | The fifteen Skills |
| `maxFP`, `maxAbilitySlots` | Caps that grow with milestones |
| `currentHP`, `tempHP`, `currentEND`, `currentAP`, `currentFP` | Live-play resource pools |
| `mortalWounds` | Up to 2 active wounds (by name; `Pending Roll` while a slot awaits its D20 — a hand-picked wound is stored by its table name, so its entry's D20 comes back with it) |
| `deathSaves` | Success/failure tracker |
| `innateDescription`, `innateAbilities` | Core Ability narrative + mechanical innates |
| `basicAttack`, `fatebreaker` | Fixed-shape core abilities. `basicAttack` is generated on every sheet and is **not removable** (a player sheet edits it in the Core Ability section; an NPC's is pinned to the head of its ability list). It is born with its activation rolls configured — accuracy `d20+MAR` plus its own damage. `normalizeCharacter` restores the default into a record that arrives **without** one; a stored one is never overwritten, so switching those rolls off sticks |
| `slottedAbilities`, `abilityPool` | Active vs. inactive slotted abilities |
| `portrait` | Base64 data URL |
| `physicalDescription`, `backstory` | Bio fields |
| `customTabs` | User-created tabs with sections (`CustomAbilitySection`, `CustomNPCSection`, or `CustomTextSection`) |
| `config` | Full aesthetic configuration (colors, fonts, CSS, background image) |
| `viewModes` | Per-section grid/list preference |
| `customResourceBars` | User-defined resource pools |
| `customAttributes` | User-defined attributes (`CustomAttribute[]`) — the player's own stats, rolled from dice notation |
| `npcStats` | Manually-entered combat stats (NPCs only: evasion, armor, movement, save DC, HP, mortal wounds) |
| `description` | Long-form NPC description (NPCs only) |
| `createdAt`, `updatedAt` | Timestamps |

---

## AbilityBlock

**AbilityBlock** is the structured representation of any ability (Core, Slotted,
or Pool):

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity |
| `traits` | Free-form tags (Action, Range, Type, Status, etc.) |
| `cost` | AP / END / FP costs (all optional) |
| `damage` | Dice notation string (e.g. `2d6+POW`) |
| `description`, `overcharge`, `flavorText` | Prose fields (Markdown-supported) |
| `isMinor` | Half-slot flag |
| `showActivate` | Whether to show the Activate button in view mode. Offered in the player ability editors only — an NPC's ability editor (and every sub-ability editor on an NPC sheet) hides it, because an NPC outside a GM Screen never activates |
| `modifiers` | Stat/attribute modifiers applied while the card's modifier toggle is on (`[{ target, value }]`; signed — positive adds, negative subtracts) |
| `modifiersActive` | Whether those modifiers are currently applied to the sheet (view-mode switch; defaults to `false`). On an NPC base record it is template data — the base sheet shows it read-only, and a GM Screen instance records its own switch state instead (`NpcInstanceState.abilityModifiers`) |
| `uses` | Limited-use budget, present only on abilities flagged as limited: `{ max, current, expendOnActivate }`. `current` moves when the ability is activated and is refilled to `max` on a full restore; omitted entirely for unlimited abilities. On an NPC base record it is template data — the base sheet shows it read-only, and a GM Screen instance tracks its own counts instead (`NpcInstanceState.abilityUses`) |
| `activationRolls` | Automatic rolls performed the moment the ability is activated — `{ accuracy?, damage?, custom? }`, omitted entirely when the ability rolls nothing. `accuracy` is `{ modifier: { kind: 'attribute', key } \| { kind: 'custom', id, token }, bonus? }`; `damage` is a plain `true`, because the ability's own `damage` field *is* the notation; `custom` is `[{ notation, label?, hidden? }]`. Roll order is fixed — accuracy, then damage, then the custom rolls as authored |

On an NPC base record, `modifiersActive` and `uses` are **template data**: the
base sheet renders both read-only, and a GM Screen instance records its own
switch state (`NpcInstanceState.abilityModifiers`) and its own counts
(`NpcInstanceState.abilityUses`) instead — see [gm-screen.md](gm-screen.md).
`activationRolls` is configuration rather than live state, so a GM Screen
instance reads it from the base record and resolves it against the instance's
own stats — see [Automatic rolls on activation](#automatic-rolls-on-activation).

---

## Custom attributes

**CustomAttribute** is a player-defined stat living beside the five Attributes:

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity; the name is also a dice-notation token |
| `value` | The number substituted into dice notation in this attribute's place |
| `shorthand` | Optional short token (`"MAR"` for Martial). Empty = none; the full name stands in |
| `showSteppers` | Whether view mode offers −/+ steppers to nudge the value in play |

Unlike the five Attributes they drive nothing derived — no HP, no Evasion — and
ability modifiers cannot target them. Their purpose is dice notation: `2d6+SAN`
(or `2d6+Sanity`) resolves through the attribute's current value. Resolution
order is the five Attributes, then Skills, then custom attributes, so a custom
attribute can never shadow a canonical stat. Names and shorthands must be unique
per sheet to be unambiguous, and both are matched case-insensitively.

---

## Custom sections

**CustomSection** is a discriminated union describing one section inside a
custom tab:

| Variant | Shape |
| --- | --- |
| `CustomAbilitySection` (`kind: 'ability'`) | `{ kind, id, name, abilities: AbilityBlock[] }` — a free-form group of abilities |
| `CustomNPCSection` (`kind: 'npc'`) | `{ kind, id, name, npcId }` — a reference to a bundled NPC `Character` (with `kind: 'npc'`) |
| `CustomTextSection` (`kind: 'text'`) | `{ kind, id, name, content }` — a free-form Markdown body (mechanics, flavor text, lore) |

---

## GM screens

**GMScreen** is a saved, named list of panels:

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity; the name is shown in the screen switcher |
| `panels` | Ordered `ScreenPanel[]` — array order is display order |
| `createdAt`, `updatedAt` | Timestamps |

### ScreenPanel

`ScreenPanel` is a discriminated union on `kind`:

| Variant | Shape |
| --- | --- |
| `'character'` | `{ id, characterId, density }` — a reference to a player sheet |
| `'npc-instance'` | `{ id, baseNpcId, label, density, state }`, where `state` is the instance's own live play: `{ currentHP, tempHP, condition, currentAP, cooldowns, mortalWounds, abilityUses, abilityModifiers }` |

See [gm-screen.md](gm-screen.md) for the full GM Screen data model and store API.

---

## Status conditions

**StatusCondition** is a compendium record referenced from any sheet text:

| Field | Purpose |
| --- | --- |
| `id`, `name` | Identity; `[name]` references match case-insensitively |
| `icon`, `iconType` | Icon payload (`'emoji'`, `'pack'` RPG-Awesome class key such as `'ra-crossed-swords'`, or `'image'` data URL). Lucide keys saved by older releases still render |
| `description` | Full rules text for the condition |
| `tags` | Categorization tags; built-ins carry `'Default'` |
| `createdAt`, `updatedAt` | Timestamps |

---

## Derived values

The following are derived from Attributes and Milestones and are always
read-only:

| Field | Formula |
| --- | --- |
| HP | `max(20, 20 + VIT × 5)` |
| Evasion | `10 + AGI` |
| Armor | `floor(VIT / 2)` |
| Movement | `5 + floor(AGI / 2)` |
| Milestone Bonus | `floor(Milestones / 2)` |
| Save DC | `10 + Milestone Bonus` |
| END Recovery | `max(1, 1 + floor(GRT / 2))` |

### Modifier layering

Ability modifiers layer on top of these formulas without ever changing them:

- Attribute modifiers change the Attributes first, so `+1 VIT` also raises Max
  HP and Armor.
- Direct stat modifiers are then added to the derived values.
- Everything that reads an attribute or a combat stat — display, dice rolls,
  damage/armor resolution, heal caps, END Recovery — uses the *effective* value,
  and switching the modifier off restores the base instantly.

---

## Slots

- A regular Slotted Ability occupies **1 slot**.
- A Minor Slotted Ability occupies **0.5 slots**.
- Characters start with **3 slots** and gain an additional slot every 2
  Milestones (or choose +1 Max FP instead).

---

## View modes

- **Edit Mode** — all fields editable; live-play trackers hidden.
- **View Mode** — all fields read-only; live-play interactions enabled
  (resource bars, dice rolling, ability activation, ability modifier switches,
  damage, death saves, mortal wounds — rolled *or* picked by hand from the
  table).

---

## Dice notation

The dice parser supports:

- Standard dice: `d20`, `2d6`, `3d8`
- Constants: `+4`, `-1`
- Variables: `POW`, `MAR`, `Sneak` (resolved to the character's actual value),
  plus the character's own **custom attributes** by shorthand or full name
  (`2d6+SAN`, `2d6+Sanity`)
- Variable alternatives: `POW/MAR` means "use either stat" — the roll uses the
  first name, so writing the one that applies is how the player picks
- Operators: `+`, `-`, `*`, `/`, and parentheses for grouping
- Combined: `2d6+POW`, `d20+3`, `1d6+POW/MAR`,
  `(1d6+POW)*2/2d6+MAR`

**Precedence** is the usual one: `*` and `/` bind tighter than `+` and `-`, and
parentheses override both. `(1d6+POW)*2/2d6+MAR` therefore doubles the d6 plus
POW, divides that by a fresh `2d6`, then adds MAR. Multiplication and division
are integer arithmetic and **division rounds down** (`1d6/2` with a 5 is 2);
dividing by zero contributes 0 rather than an unusable total.

Two shape rules keep notation out of prose's way, and both matter when the
matcher scans a description for something clickable:

- `*` and `/` must be written **tight** — `2d6*3`, `1d6/POW` — while `+` and `-`
  may be spaced as before. A spaced asterisk is Markdown emphasis
  (`*1d6+2* slashing`), and reading it as multiplication would swallow the
  sentence after it.
- A slash between two bare names is the `POW/MAR` alternative form rather than
  division; division is what a number, a die or a group on either side means
  (`2d6/POW`, `1d6+POW/2`).

The roller evaluates the parsed tree, so a compound roll reports every die it
rolled *and* the working it followed
(`(1d6+POW)*2/2d6+MAR → (3 + 4) × 2 ÷ (3 + 3) + 3 = 5`). A typo stays visible
the way it always has: an unknown name resolves to 0 inside whatever expression
it sits in.

Notation is bounded so that pasted text can never hang or crash a sheet: a term
rolls at most 1 000 dice of at most 1 000 000 sides, one expression holds at
most 64 terms, and groups nest at most 32 deep. Past any of those the text is
simply not notation — nothing is highlighted and nothing is rolled.

---

## Automatic rolls on activation

An ability can roll its own dice the moment its **Activate** button is pressed.
The authored config lives on the ability (`activationRolls`, above) but the
notation is built at **roll time**, against the entity that is activating — so
one authored `d20+MAR` rolls with the GM's Bandit's MAR when the Bandit
activates it and with the player's MAR when the player does. `lib/activationRolls.ts`
owns every step; nothing else builds a roll by hand.

The order is fixed, and it is the whole point of the feature:

1. **Accuracy** — `d20 + <attribute>`, where the attribute is one of the five
   Divergence Attributes or one of the sheet's own
   [custom attributes](#custom-attributes). Attributes resolve through
   `effectiveAttributes`, so a switched-on `+3 MAR` is included. An optional
   extra bonus (`+2`, `+1d4`) is appended to the d20.
2. **Damage** — the ability's own `damage` field, parsed and rolled. There is no
   second copy of the expression to keep in sync; if the field is empty, this
   part simply rolls nothing.
3. **Custom rolls** — the author's own expressions, in the order they were
   authored.

Each part is evaluated with the same `lib/diceRoller.ts` code a hand-clicked
piece of notation uses, so the two can never disagree. All parts are shown
together in one result modal (accuracy first, then damage, then the custom
rolls), and each part is also written to the roll log as its own entry with an
`ability-activation` source — the log stays a roll-by-roll history.

Two deliberate degradations, rather than errors:

- A **custom attribute the sheet no longer defines** resolves to `+0`, exactly
  as an unknown variable does anywhere else in dice notation: the accuracy roll
  becomes a plain `d20` instead of the ability breaking.
- A custom expression the parser can make no sense of is **skipped** rather
  than rolled as zero — a typo should cost a line in the result, not a wrong
  number.

`normalizeCharacter` sanitizes the stored config on read (an unknown
`accuracy`/`damage`/`custom` shape is dropped, and the key is omitted entirely
when nothing usable survives), so older records, hand-edited exports and
imported bundles load as "this ability rolls nothing on activation".

---

## Related

- [architecture.md](architecture.md) — stores, persistence and IndexedDB
  invariants, theming, drag and drop.
- [gm-screen.md](gm-screen.md) — GM Screen panels, turns, damage, Mortal
  Wounds, statuses, and the store API.
- [features.md](features.md) — the complete feature reference.
