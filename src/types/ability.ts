/**
 * Ability-related domain types for the Divergence TTRPG character sheet.
 *
 * An AbilityBlock is the core building block used to model Core Abilities
 * (Innate, Basic Attack, Fatebreaker) and Slotted Abilities. See the
 * "Ability Block" section of DESIGN.md for the field-by-field rationale.
 */

/**
 * Categories under which Ability Traits can be organized. Traits are free-form
 * text tags, but the system groups them into categories for UI presentation
 * and validation. See DESIGN.md "Traits" for the non-exhaustive list.
 */
export type TraitCategory =
  | 'Activation'
  | 'Range'
  | 'AreaOfEffect'
  | 'Type'
  | 'Status'
  | 'SpecialProperty'
  | 'Other'

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
}