/**
 * Character-level domain types for the Divergence TTRPG character sheet.
 *
 * The shape of the persisted `Character` object mirrors the character-sheet
 * components described in DESIGN.md's "The Character Sheet" section.
 */

import type { AbilityBlock } from './ability'

/** The five Attributes available to a Divergence character. */
export type AttributeKey = 'MAR' | 'POW' | 'AGI' | 'VIT' | 'GRT'

/**
 * The complete list of Divergence Skills, as enumerated in DESIGN.md.
 * A Skill's value is its rolled bonus (a +2 skill is stored as the number 2).
 */
export type SkillName =
  | 'Move Quickly'
  | 'Use Force'
  | 'Spot Something'
  | 'Sneak'
  | 'Handle Precisely'
  | 'Build Rapport'
  | 'Read Someone'
  | 'Pull Favors'
  | 'Deceive'
  | 'Provoke'
  | 'Analyze or Recall'
  | 'Make or Fix'
  | 'Operate a Vehicle'
  | 'Sabotage'
  | 'Heal'

/** Map of every Attribute key to its integer value. */
export type Attributes = Record<AttributeKey, number>

/** Map of every Skill name to its integer bonus. */
export type Skills = Record<SkillName, number>

/**
 * User-driven aesthetic configuration for the sheet. There are no prebuilt
 * themes — players fully control the look (see DESIGN.md "Sheet Customization").
 */
export interface SheetConfig {
  /** Sheet background color. */
  backgroundColor: string
  /** Font family for section headings. */
  sectionHeadingFontFamily: string
  /** Font weight for section headings (e.g. "600", "bold"). */
  sectionHeadingFontWeight: string
  /** Font family for field labels. */
  labelFontFamily: string
  /** Font family for body / field text. */
  textFontFamily: string
  /** Font family for helper / instructional text. */
  helperTextFontFamily: string
  /** Whether to hide section backgrounds for a flatter layout. */
  hideSectionBackground: boolean
  /** Raw custom CSS the player can append to fully override the sheet. */
  customCss: string
}

/**
 * A result on the Mortal Wounds table (DESIGN.md "Mortal Wounds"). Rolled
 * with a D20 when a character's HP reaches 0.
 */
export interface MortalWound {
  /** The roll (1–20) that triggers this wound. */
  id: number
  /** Short name of the wound. */
  name: string
  /** Game-effect description of the wound. */
  description: string
}

/** Death Save progress tracker for a knocked-out character. */
export interface DeathSaves {
  /** Count of successful death saves (max 3). */
  successes: number
  /** Count of failed death saves (max 3). */
  failures: number
}

/**
 * The full persisted state of a single Divergence character sheet.
 */
export interface Character {
  /** Stable unique identifier. */
  id: string
  /** Character's display name. */
  name: string
  /** Auto-incremented version number for export/versioning (DESIGN.md). */
  version: number
  /** Milestone count — analogous to level; drives milestone bonus & growth. */
  milestones: number
  /** The five Attributes. */
  attributes: Attributes
  /** The fifteen Skills. */
  skills: Skills
  /** Maximum Fate Points the character can hold. */
  maxFP: number
  /** Number of Slotted Ability slots available. */
  maxAbilitySlots: number
  /** Current Hit Points. */
  currentHP: number
  /** Temporary Hit Points (reduced before regular HP; tracked separately). */
  tempHP: number
  /** Current Endurance. */
  currentEND: number
  /** Current Action Points (reset to max each turn). */
  currentAP: number
  /** Current Fate Points. */
  currentFP: number
  /** Active Mortal Wounds (max 2), as wound names or null when cleared. */
  mortalWounds: (string | null)[]
  /** Death-save tracker (used when knocked out). */
  deathSaves: DeathSaves
  /** Prose description of the character's powers / Innate narrative. */
  innateDescription: string
  /** Mechanical core Ability (optional). Always accessible, unlike slotted. */
  innateAbility: AbilityBlock | null
  /** The character's Basic Attack (fixed-shape AbilityBlock). */
  basicAttack: AbilityBlock
  /** The character's Fatebreaker ultimate (costs FP). */
  fatebreaker: AbilityBlock
  /** Currently active Slotted Abilities for an encounter. */
  slottedAbilities: AbilityBlock[]
  /** Inactive Slotted Abilities available to swap in. */
  abilityPool: AbilityBlock[]
  /** Portrait image as a base64 data URL (uploaded locally, offline). */
  portrait: string | null
  /** Short description of the character's physical appearance. */
  physicalDescription: string
  /** The character's backstory / origins. */
  backstory: string
  /** Aesthetic configuration for the sheet. */
  config: SheetConfig
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of last update. */
  updatedAt: string
}