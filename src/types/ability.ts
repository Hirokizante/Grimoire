/**
 * Ability-related domain types for the Divergence TTRPG character sheet.
 *
 * An AbilityBlock is the core building block used to model Core Abilities
 * (Innate, Basic Attack, Fatebreaker) and Slotted Abilities. See the
 * "Ability Block" section of DESIGN.md for the field-by-field rationale.
 */

import type { AttributeKey } from './character'

/**
 * The resource costs an Ability may require to activate. All fields are
 * optional — an AbilityBlock need only list the resources it actually
 * consumes (e.g. a Basic Attack only costs AP).
 */
export interface AbilityCost {
  /** Action Points spent. */
  ap?: number
  /** Endurance spent. */
  end?: number
  /** Fate Points spent. */
  fp?: number
  /**
   * Custom resource costs, keyed by CustomResourceBar id (e.g.
   * `{ 'bar-123': 2 }` spends 2 from the bar with id `bar-123`). Entries with
   * a value of 0 are pruned on save; the field is omitted entirely when empty.
   * Bar ids are resolved against the character's own customResourceBars at
   * render/activation time — see lib/abilityCosts.ts.
   */
  custom?: Record<string, number>
}

/**
 * Everything an Ability modifier can target: the five Attributes plus the
 * derived combat stats shown on the sheet (and, for NPCs, the manually-entered
 * combat stats — see lib/abilityModifiers.ts for the per-kind availability).
 *
 * Attribute targets use the raw {@link AttributeKey} strings so a modifier's
 * target can be fed straight into an Attributes lookup.
 */
export type ModifierTarget =
  | 'MAR'
  | 'POW'
  | 'AGI'
  | 'VIT'
  | 'GRT'
  | 'evasion'
  | 'armor'
  | 'movement'
  | 'saveDC'
  | 'endRecovery'
  | 'maxHP'

/**
 * A single stat/attribute modification granted by an Ability while its
 * modifier toggle is switched on. Modifiers are signed: a positive `value`
 * adds to the target, a negative `value` subtracts from it.
 */
export interface AbilityStatModifier {
  /** Which Attribute or combat stat this modifier changes. */
  target: ModifierTarget
  /**
   * Signed amount applied to the target (e.g. `2` = +2 Evasion, `-1` = −1 AGI).
   * Zero-valued modifiers are pruned on save.
   */
  value: number
}

/**
 * One resolved custom-resource cost line: the ability's cost paired with the
 * CustomResourceBar it drains. Produced by {@link resolveCustomAbilityCosts}
 * (lib/abilityCosts.ts); entries whose bar no longer exists are dropped.
 */
export interface ResolvedCustomAbilityCost {
  /** Id of the target CustomResourceBar. */
  barId: string
  /** Display name of the bar. */
  name: string
  /** Hex color of the bar's fill (used for the cost badge tint). */
  color: string
  /** Amount the ability costs. */
  amount: number
}

/**
 * Which value an automatic **accuracy roll** adds to its d20.
 *
 * - `attribute` — one of the five Divergence Attributes, stored by
 *   {@link AttributeKey} (which is also the dice-notation token, so the roll is
 *   `d20+MAR`).
 * - `custom` — one of the sheet's own {@link CustomAttribute}s, stored by id
 *   (the stable handle) together with the notation token to roll with (the
 *   attribute's shorthand, or its full name when it has none). A custom
 *   attribute the sheet no longer defines resolves to +0, exactly as an unknown
 *   variable does anywhere else in dice notation — so a deleted attribute
 *   degrades to a plain d20 instead of breaking the ability.
 */
export type ActivationAccuracySource =
  | { kind: 'attribute'; key: AttributeKey }
  | { kind: 'custom'; id: string; token: string }

/**
 * One automatically-rolled dice expression on activation: what to roll, what to
 * call it in the result modal, and whether its result starts hidden.
 */
export interface ActivationRoll {
  /** Dice notation (e.g. `2d6+POW`, `1d8+2`). */
  notation: string
  /** Short description shown on the result ("Fire damage", "Bleed"). */
  label?: string
  /**
   * Render the roll's result collapsed in the activation modal, with a
   * "Show result" toggle. Used to keep a long list of optional rolls readable;
   * the roll still happens and still lands in the roll log.
   */
  hidden?: boolean
}

/**
 * The automatic dice rolls an Ability performs when it is activated, authored
 * in the ability editor's "Roll Dice on Activation" section.
 *
 * The order the rolls happen in is fixed: **accuracy first, then damage, then
 * the custom rolls in the order they were authored** — see
 * lib/activationRolls.ts, which is also where the notation is built and where
 * the plan is executed.
 *
 * Every part is optional and the whole field is omitted when the feature is
 * off, so an ability that rolls nothing keeps its stored shape untouched.
 * Sub-Abilities carry the same field and roll it through the same code path.
 */
export interface ActivationRolls {
  /** Roll `d20 + <attribute>` as the attack/accuracy check. */
  accuracy?: {
    /** The d20's flat modifier — an Attribute or a custom attribute. */
    modifier: ActivationAccuracySource
    /** Optional extra notation appended to the d20 (e.g. `+2`, `+1d4`). */
    bonus?: string
  }
  /**
   * Roll the Ability's own `damage` field. The field itself is the notation, so
   * editing the damage updates the activation roll with it.
   */
  damage?: boolean
  /** Extra rolls the author wants on activation, in order. */
  custom?: ActivationRoll[]
}

/**
 * A limited-use budget on an Ability: how many times it may be used, how many
 * uses are left, and whether activating it consumes one. See
 * lib/abilityUses.ts for the rules and the sheet-tree helpers.
 */
export interface AbilityUses {
  /**
   * Total uses the Ability has (and is restored to on a rest / full restore).
   * Always at least 1 and at most {@link MAX_ABILITY_USES}.
   */
  max: number
  /**
   * Uses left, clamped to `[0, max]`. Live-play state: it moves when the
   * Ability is activated and is always refilled on a full restore — never
   * edited directly in the Ability editor (lowering `max` clamps it down,
   * raising `max` leaves the spent uses spent).
   */
  current: number
  /**
   * Whether clicking Activate consumes a use. Defaults to true — the point of
   * the limit — and false lets an Ability display a budget it does not spend
   * on activation (e.g. a resource tracked by another rule).
   */
  expendOnActivate: boolean
}

/**
 * A structured description of a single Ability, as defined in DESIGN.md's
 * "Ability Block" section. Used for the Innate, Basic Attack, Fatebreaker,
 * Slotted Abilities, and Ability Pool entries on a character sheet.
 */
export interface AbilityBlock {
  /** Stable unique identifier for this block. */
  id: string
  /** Display name of the Ability. */
  name: string
  /**
   * Free-form trait tags (e.g. "Action", "Range (20)", "Status (Quick)").
   * Stored as plain strings rather than structured objects so players retain
   * full creative freedom per the DIY philosophy described in DESIGN.md.
   */
  traits: string[]
  /** Resource costs required to use the Ability. */
  cost: AbilityCost
  /**
   * Damage expression in dice notation, e.g. "2d6+POW". Kept as a string to
   * preserve the manual creative intent of the system.
   */
  damage: string
  /** Detailed prose description of what the Ability does. */
  description: string
  /** Additional effects unlocked by spending one or more FP. */
  overcharge: string
  /** Optional in-universe lore text for the Ability. */
  flavorText: string
  /**
   * Whether this Ability is a Minor Ability. Minor Abilities occupy half an
   * Ability Slot each and are visually distinguished from regular abilities
   * (see DESIGN.md "Minor Abilities").
   */
  isMinor: boolean
  /**
   * Whether the "Activate" button is shown for this Ability on the sheet.
   * When false, the block renders as a static card (useful for narrative-only
   * abilities). Defaults to true; the toggle is in AbilityBlockEditor.
   */
  showActivate: boolean
  /**
   * Stat/Attribute modifiers this Ability applies while {@link modifiersActive}
   * is switched on (e.g. `+2 Evasion`, `-1 AGI`). Configured in
   * AbilityBlockEditor; empty/omitted means the Ability modifies nothing and
   * renders no toggle on its card. Values are pruned to non-zero entries on
   * save and validated on read (normalizeCharacter).
   */
  modifiers?: AbilityStatModifier[]
  /**
   * Whether this Ability's {@link modifiers} are currently applied to the
   * sheet. Switched from the ability card in view mode — independent of the
   * Activate button and never costs resources. Defaults to false, and is
   * meaningless (forced false) when there are no modifiers.
   */
  modifiersActive?: boolean
  /**
   * Limited-use budget (added with the Limited Uses feature): present only on
   * Abilities the author flagged as limited in the editor. Unlimited Abilities
   * omit the key entirely. Uses display on the card (tokens for ≤5, a number
   * above that), are spent by the Activate button when
   * {@link AbilityUses.expendOnActivate} is on, and are always restored on a
   * rest / full restore. See lib/abilityUses.ts.
   */
  uses?: AbilityUses
  /**
   * Automatic dice rolls this Ability performs the moment it is activated
   * (added with the Roll Dice on Activation feature): an accuracy check, its
   * own damage, and any number of extra rolls the author wants. Authored in the
   * ability editor and shown together in one result modal; omitted entirely
   * when the ability rolls nothing. See lib/activationRolls.ts.
   */
  activationRolls?: ActivationRolls
  /**
   * Sub-Abilities nested under the Description field. Bound to their parent
   * — they always move with it and cannot be independently slotted/unslotted.
   * Only one layer of nesting is allowed (sub-abilities cannot have their own
   * sub-abilities). Sub-abilities do not consume Ability Slots and cannot be
   * Minor. Defaults to an empty array (normalize-on-read back-fills it).
   */
  subAbilitiesUnderDescription: AbilityBlock[]
  /**
   * Sub-Abilities nested under the Overcharge field. Same rules as
   * {@link subAbilitiesUnderDescription}. Defaults to an empty array.
   */
  subAbilitiesUnderOvercharge: AbilityBlock[]
  /**
   * Optional accent color override for Sub-Ability blocks. Stores a
   * {@link SheetColors} key (e.g. 'accent', 'danger', 'hpBar') whose
   * corresponding CSS variable tints the block's border and background.
   * Only meaningful on sub-abilities; ignored on regular ability blocks.
   * Undefined / empty means "use default styling".
   */
  colorOverride?: string
}