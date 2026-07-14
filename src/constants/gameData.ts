/**
 * Static game data and factory helpers for the Divergence TTRPG.
 *
 * All values here are derived from DESIGN.md so they stay in sync with the
 * system document. Nothing in this module should encode app presentation
 * state — it's purely ruleset-level constants and constructors.
 */

import type {
  AbilityBlock,
  AttributeKey,
  Character,
  MortalWound,
  SheetColors,
  SheetConfig,
  SkillName,
  Skills,
} from '@/types'

/** All fifteen Skills, in display order per DESIGN.md. */
export const SKILL_LIST: SkillName[] = [
  'Move Quickly',
  'Use Force',
  'Spot Something',
  'Sneak',
  'Handle Precisely',
  'Build Rapport',
  'Read Someone',
  'Pull Favors',
  'Deceive',
  'Provoke',
  'Analyze or Recall',
  'Make or Fix',
  'Operate a Vehicle',
  'Sabotage',
  'Heal',
]

/** Display metadata for each of the five Attributes. */
export interface AttributeMeta {
  key: AttributeKey
  name: string
  abbreviation: string
  description: string
}

/** Metadata for every Attribute, in the canonical MAR/POW/AGI/VIT/GRT order. */
export const ATTRIBUTE_LIST: AttributeMeta[] = [
  {
    key: 'MAR',
    name: 'Martial',
    abbreviation: 'MAR',
    description:
      'Physical combat capabilities, primarily fighting prowess and knowledge of martial arts.',
  },
  {
    key: 'POW',
    name: 'Power',
    abbreviation: 'POW',
    description:
      'Non-physical combat capabilities, including but not limited to magic or some kind of sci-fi technology.',
  },
  {
    key: 'AGI',
    name: 'Agility',
    abbreviation: 'AGI',
    description: 'Reaction and movement speed.',
  },
  {
    key: 'VIT',
    name: 'Vitality',
    abbreviation: 'VIT',
    description: 'Health and resilience.',
  },
  {
    key: 'GRT',
    name: 'Grit',
    abbreviation: 'GRT',
    description: 'Mental fortitude.',
  },
]

/**
 * The Mortal Wounds table (DESIGN.md "Mortal Wounds"). Indexed 1–20 and rolled
 * with a D20 when a character's HP reaches 0.
 */
export const MORTAL_WOUNDS: MortalWound[] = [
  {
    id: 1,
    name: 'Grave Danger',
    description: 'Character is knocked out, immediately starting off with 1 failure.',
  },
  {
    id: 2,
    name: 'Muscle Rupture',
    description: 'Automatically take 1d6 physical damage for performing MAR related actions.',
  },
  {
    id: 3,
    name: 'Entropic Discharge',
    description: 'Automatically take 1d6 magic damage for performing POW related actions.',
  },
  {
    id: 4,
    name: 'Anterior Cruciate Ligament',
    description: 'Automatically take 1d6 physical damage for performing AGI related actions.',
  },
  {
    id: 5,
    name: 'Lymphedema',
    description: 'Automatically take 1d6 physical damage for performing VIT related actions.',
  },
  {
    id: 6,
    name: 'Severe Headache',
    description: 'Automatically take 1d6 physical damage for performing GRT related actions.',
  },
  {
    id: 7,
    name: 'Hemorrhage',
    description: 'Take 1d6 physical damage at the end of your turn.',
  },
  {
    id: 8,
    name: 'Damaged Throat',
    description: 'Unable to regain END passively. Recovery only restores half your END.',
  },
  {
    id: 9,
    name: 'Exhaustion',
    description: 'All actions that cost END costs 1 more than usual.',
  },
  {
    id: 10,
    name: 'Asthenia',
    description: '-1 Max AP.',
  },
  {
    id: 11,
    name: 'Major Memory Loss',
    description: 'Maximum Ability Slots are halved, rounded up.',
  },
  {
    id: 12,
    name: 'Sprain',
    description: 'MAR is halved, rounded down.',
  },
  {
    id: 13,
    name: 'Negentropy',
    description: 'POW is halved, rounded down.',
  },
  {
    id: 14,
    name: 'Fracture',
    description: 'AGI stat is halved, rounded down.',
  },
  {
    id: 15,
    name: 'Damaged Liver',
    description: 'VIT is halved, rounded down.',
  },
  {
    id: 16,
    name: 'Concussion',
    description: 'GRT is halved, rounded down.',
  },
  {
    id: 17,
    name: 'Black Eye',
    description: 'Range of all attacks are halved, rounded up.',
  },
  {
    id: 18,
    name: 'Circulatory Dysfunction',
    description: 'Healing received is halved, rounded down.',
  },
  {
    id: 19,
    name: 'Damaged Lung',
    description: '-3 Max END.',
  },
  {
    id: 20,
    name: 'Worn Out',
    description: '-1 AP for the first round of the conflict, no further effects.',
  },
]

/**
 * Default color palette for {@link SheetConfig}. Mirrored from `index.css` so
 * the default dark theme looks indistinguishable unless the player customizes.
 */
export const DEFAULT_SHEET_COLORS: SheetColors = {
  bgBase: '#1a1a2e',
  bgSurface: '#21213a',
  bgSurfaceRaised: '#2a2a47',
  bgSurfaceHover: '#323257',
  textPrimary: '#e6e2ee',
  textSecondary: '#a9a4c0',
  textMuted: '#7a7693',
  border: '#34344f',
  borderSoft: '#2a2a47',
  accent: '#9b7ed6',
  accentSoft: '#c4b1eb',
  danger: '#e57373',
  hpBar: '#e8a0bf',
  fpBar: '#c4b1eb',
  apBar: '#9b7ed6',
  endBar: '#9b7ed6',
  minorAbility: '#9b7ed6',
  success: '#a9e6a0',
  tokenMilestone: '#9b7ed6',
  tokenEvasion: '#e8a0bf',
  tokenMovement: '#e8a0bf',
  tokenSaveDC: '#9b7ed6',
  tokenArmor: '#7bc4d6',
  tokenEndRecovery: '#7bc4d6',
}

/**
 * Sensible dark-themed default for {@link SheetConfig}. Per DESIGN.md the
 * default surface is dark because users spend a lot of time workshopping
 * Abilities and lore, where bright white UI would fight the scene.
 */
export const DEFAULT_SHEET_CONFIG: SheetConfig = {
  pageBackgroundColor: '#0f0d1a',
  backgroundColor: '#14121b',
  sectionHeadingFontFamily: '"Georgia", "Times New Roman", serif',
  sectionHeadingFontWeight: '600',
  labelFontFamily: 'system-ui, -apple-system, sans-serif',
  textFontFamily: 'system-ui, -apple-system, sans-serif',
  helperTextFontFamily: 'system-ui, -apple-system, sans-serif',
  hideSectionBackground: false,
  customCss: '',
  colors: { ...DEFAULT_SHEET_COLORS },
  backgroundImage: null,
  backgroundImageDarken: 0.5,
  backgroundImageBlur: 0,
}

/**
 * The starting attribute standard array (DESIGN.md "Attributes"): 3, 2, 1, 0,
 * and -1, assigned by the player to their five attributes. We choose a neutral
 * starting spread; the player re-assigns it during character creation. The
 * values are placed in the canonical MAR/POW/AGI/VIT/GRT order.
 */
const DEFAULT_ATTRIBUTES: Record<AttributeKey, number> = {
  MAR: 3,
  POW: 2,
  AGI: 1,
  VIT: 0,
  GRT: -1,
}

/** All Skills initialized to +0. */
function createDefaultSkills(): Skills {
  return SKILL_LIST.reduce(
    (acc, skill) => {
      acc[skill] = 0
      return acc
    },
    {} as Skills,
  )
}

/**
 * Generate a reasonably unique identifier. Uses `crypto.randomUUID` when
 * available (modern browsers) and falls back to a timestamp + random string.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Build a fresh Basic Attack AbilityBlock.
 *
 * Per DESIGN.md, a Basic Attack is an AbilityBlock with certain fixed
 * properties: it costs 1 AP, deals 1d6 + POW/MAR, and carries the Action,
 * Melee/Range (8), Physical/Magic/Psychic, and Basic traits. We default to a
 * melee, Martial-based physical attack; the player re-flavors it freely.
 */
export function createDefaultBasicAttack(): AbilityBlock {
  return {
    id: generateId(),
    name: 'Basic Attack',
    traits: ['Action', 'Melee', 'Physical', 'Basic'],
    cost: { ap: 1 },
    damage: '1d6 + MAR',
    description:
      'Any subsequent Basic Attacks made after the first one on your turn cost 2 AP and do not benefit from modifiers.',
    overcharge: '',
    flavorText: '',
    isMinor: false,
  }
}

/**
 * Build a blank Fatebreaker AbilityBlock. A Fatebreaker always costs 2 FP,
 * 4 END, and ~1 AP (DESIGN.md "Fatebreaker").
 */
function createDefaultFatebreaker(): AbilityBlock {
  return {
    id: generateId(),
    name: 'Fatebreaker',
    traits: ['Action', 'Melee', 'Magic'],
    cost: { ap: 1, end: 4, fp: 2 },
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
  }
}

/**
 * Construct a freshly-created default Character.
 *
 * Defaults per DESIGN.md character-creation rules:
 * - Standard array 3/2/1/0/-1 assigned to attributes.
 * - All skills at +0 except three at +2 (no stacking at creation). The three
 *   chosen skills here are an arbitrary sensible default the player can edit.
 * - Milestones 0, max FP 3, max Ability Slots 3.
 * - Derived combat trackers (HP/EVA/etc.) initialized from calculations;
 *   current HP uses the calculated max, END/AP reset to encounter maxima.
 * - Empty ability lists and blank narrative fields.
 * - Dark-theme sheet config.
 */
export function createDefaultCharacter(): Character {
  const attributes = { ...DEFAULT_ATTRIBUTES }
  const skills = createDefaultSkills()
  // Default three creation skills at +2 (player may re-choose).
  skills['Handle Precisely'] = 2
  skills['Read Someone'] = 2
  skills['Provoke'] = 2

  const maxHP = 20 + attributes.VIT * 5

  return {
    id: generateId(),
    name: 'New Character',
    playerName: '',
    version: '1.0.0',
    milestones: 0,
    attributes,
    skills,
    maxFP: 3,
    maxAbilitySlots: 3,
    currentHP: maxHP,
    tempHP: 0,
    currentEND: 10,
    currentAP: 3,
    currentFP: 3,
    mortalWounds: [null, null],
    deathSaves: { successes: 0, failures: 0 },
    innateDescription: '',
    innateAbility: null,
    basicAttack: createDefaultBasicAttack(),
    fatebreaker: createDefaultFatebreaker(),
    slottedAbilities: [],
    abilityPool: [],
    portrait: null,
    physicalDescription: '',
    backstory: '',
    config: { ...DEFAULT_SHEET_CONFIG },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
