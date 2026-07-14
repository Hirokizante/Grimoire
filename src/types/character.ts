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
 * A configurable color palette covering every sheet element.
 *
 * Colors are stored as resolved hex strings (e.g. "#1a1a2e") so CSS
 * `color-mix()` can derive borders, subtle fills, and hover states directly
 * from the picked values without requiring the player to write custom CSS.
 */
export interface SheetColors {
  /** Page-level background (behind the sheet card). */
  bgBase: string
  /** Card/section surface background. */
  bgSurface: string
  /** Raised surfaces — tokens, pills, bar segments. */
  bgSurfaceRaised: string
  /** Hover state surface background. */
  bgSurfaceHover: string
  /** Primary body text — high emphasis. */
  textPrimary: string
  /** Secondary text — labels, lower-emphasis. */
  textSecondary: string
  /** Muted / hint text. */
  textMuted: string
  /** Hard border lines. */
  border: string
  /** Soft, low-contrast separator borders. */
  borderSoft: string
  /** Main primary accent — brand color for major elements. */
  accent: string
  /** Soft variant of the primary accent — headings, glow, low-emphasis. */
  accentSoft: string
  /** Danger / error color. */
  danger: string
  /** HP bar color. */
  hpBar: string
  /** Fate Points bar color. */
  fpBar: string
  /** Action Points bar color. */
  apBar: string
  /** Endurance bar color. */
  endBar: string
  /** Minor ability card tint. */
  minorAbility: string
  /** Success / good color. */
  success: string
  /** Milestone token accent. */
  tokenMilestone: string
  /** Movement token accent. */
  tokenMovement: string
  /** Evasion token accent. */
  tokenEvasion: string
  /** Save DC token accent. */
  tokenSaveDC: string
  /** Armor token accent. */
  tokenArmor: string
  /** END Recovery token accent. */
  tokenEndRecovery: string
}

/**
 * User-driven aesthetic configuration for the sheet. There are no prebuilt
 * themes — players fully control the look (see DESIGN.md "Sheet Customization").
 */
export interface SheetConfig {
  /** Page background color — the canvas behind the entire sheet. */
  pageBackgroundColor: string
  /** Sheet card background color (overrides colors.bgSurface when set). */
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
  /** Every configurable color for the sheet. */
  colors: SheetColors
  /** Background image as a base64 data URL (null = no background image). */
  backgroundImage: string | null
  /** Darken overlay opacity over the background image (0–1, 0 = none). */
  backgroundImageDarken: number
  /** Blur applied to the background image in px (0–20, 0 = none). */
  backgroundImageBlur: number
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

export interface DeathSaves {
  /** Count of successful death saves (max 3). */
  successes: number
  /** Count of failed death saves (max 3). */
  failures: number
}

/**
 * A point-in-time snapshot of a Character for version history.
 *
 * Created each time the user exports the sheet (DESIGN.md "Automatic Sheet
 * Versioning"). Stored alongside the character so previous versions can be
 * browsed and re-imported.
 */
/**
 * A semantic version string (MAJOR.MINOR.PATCH, e.g. "1.0.0").
 * See {@link bumpSemver} for incrementing logic.
 */
export type Semver = string

export interface VersionSnapshot {
  /** Unique identifier for this snapshot. */
  id: string
  /** The character id this snapshot belongs to. */
  characterId: string
  /** Semantic version string at snapshot time (e.g. "9.1.2"). */
  version: Semver
  /** ISO timestamp of when the snapshot was taken. */
  createdAt: string
  /** Character data at snapshot time. */
  data: Character
}

/**
 * The full persisted state of a single Divergence character sheet.
 */
export interface Character {
  /** Stable unique identifier. */
  id: string
  /** Character's display name. */
  name: string
  /** Player name (the person playing this character). */
  playerName: string
  /** Auto-incremented semantic version for export/versioning (DESIGN.md). */
  version: Semver
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