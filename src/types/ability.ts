/**
 * Ability-related domain types for the Divergence TTRPG character sheet.
 *
 * An AbilityBlock is the core building block used to model Core Abilities
 * (Innate, Basic Attack, Fatebreaker) and Slotted Abilities. See the
 * "Ability Block" section of DESIGN.md for the field-by-field rationale.
 */

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