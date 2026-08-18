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
  NPCStats,
  SheetColors,
  SheetConfig,
  SkillName,
  Skills,
} from '@/types'

/** Maximum Action Points, constant per DESIGN.md "Action Points". */
export const MAX_AP = 3
/** Maximum Endurance, constant per DESIGN.md "Endurance". */
export const MAX_END = 10
/** Maximum Mortal Wounds a character can sustain. */
export const MAX_MORTAL_WOUNDS = 2
/** Death Save DC (DESIGN.md "Death Saves"). */
export const DEATH_SAVE_DC = 10
/** Hard limit on the number of user-created custom tabs. */
export const MAX_CUSTOM_TABS = 6

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
  tokenMilestone: '#e0b054',
  tokenEvasion: '#e8a0bf',
  tokenMovement: '#5ec8d8',
  tokenSaveDC: '#9b7ed6',
  tokenArmor: '#7ba7d6',
  tokenEndRecovery: '#a9e6a0',
}

/**
 * Sheet palette for the Parchment app theme. Mirrored from the
 * `:root[data-app-theme='parchment']` block in `index.css` — keep in sync.
 * Used by NPC sheets, which have no per-sheet customization and follow the
 * app theme instead (see themeUtils.appThemeSheetColors).
 */
export const PARCHMENT_SHEET_COLORS: SheetColors = {
  bgBase: '#262626',
  bgSurface: '#2e2b26',
  bgSurfaceRaised: '#37332c',
  bgSurfaceHover: '#423c32',
  textPrimary: '#e8e1d3',
  textSecondary: '#b3a88f',
  textMuted: '#7f7768',
  border: '#464036',
  borderSoft: '#37332c',
  accent: '#b3a48a',
  accentSoft: '#c5b8a0',
  danger: '#d97070',
  hpBar: '#c98f74',
  fpBar: '#c5b8a0',
  apBar: '#b3a48a',
  endBar: '#b3a48a',
  minorAbility: '#b3a48a',
  success: '#a8cfa0',
  tokenMilestone: '#d9b26a',
  tokenEvasion: '#c98f74',
  tokenMovement: '#93b5ad',
  tokenSaveDC: '#b3a48a',
  tokenArmor: '#9aa8bd',
  tokenEndRecovery: '#a8cfa0',
}

/**
 * Sheet palette for the Mikami app theme — Nord on near-black. Mirrored
 * from the `:root[data-app-theme='mikami']` block in `index.css` — keep in
 * sync. Used by NPC sheets, which follow the app theme (see
 * themeUtils.appThemeSheetColors).
 */
export const MIKAMI_SHEET_COLORS: SheetColors = {
  bgBase: '#141414',
  bgSurface: '#1b1b1b',
  bgSurfaceRaised: '#222222',
  bgSurfaceHover: '#2a2a2a',
  textPrimary: '#ffffff',
  textSecondary: '#b3bcc7',
  textMuted: '#6a7380',
  border: '#323232',
  borderSoft: '#242424',
  accent: '#81a1c1',
  accentSoft: '#88c0d0',
  danger: '#bf616a',
  hpBar: '#bf616a',
  fpBar: '#b48ead',
  apBar: '#ebcb8b',
  endBar: '#a3be8c',
  minorAbility: '#88c0d0',
  success: '#a3be8c',
  tokenMilestone: '#ebcb8b',
  tokenEvasion: '#88c0d0',
  tokenMovement: '#a3be8c',
  tokenSaveDC: '#b48ead',
  tokenArmor: '#81a1c1',
  tokenEndRecovery: '#d8dee9',
}

/**
 * Sheet palette for the Pitch Black app theme — pure black with cream,
 * gold, and muted teal. Mirrored from the
 * `:root[data-app-theme='pitch-black']` block in `index.css` — keep in
 * sync. Used by NPC sheets, which follow the app theme (see
 * themeUtils.appThemeSheetColors).
 */
export const PITCH_BLACK_SHEET_COLORS: SheetColors = {
  bgBase: '#000000',
  bgSurface: '#0d0d0d',
  bgSurfaceRaised: '#171717',
  bgSurfaceHover: '#212121',
  textPrimary: '#c1c1c1',
  textSecondary: '#999999',
  textMuted: '#5e5e5e',
  border: '#2c2c2c',
  borderSoft: '#1c1c1c',
  accent: '#f3ecd4',
  accentSoft: '#f3ecd4',
  danger: '#9e5a5a',
  hpBar: '#eecc6c',
  fpBar: '#f3ecd4',
  apBar: '#5f8787',
  endBar: '#888888',
  minorAbility: '#aaaaaa',
  success: '#eecc6c',
  tokenMilestone: '#eecc6c',
  tokenEvasion: '#5f8787',
  tokenMovement: '#aaaaaa',
  tokenSaveDC: '#f3ecd4',
  tokenArmor: '#888888',
  tokenEndRecovery: '#c1c1c1',
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
  importedFonts: [],
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
    showActivate: true,
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
    showActivate: true,
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
    kind: 'character',
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
    innateAbilities: [],
    basicAttack: createDefaultBasicAttack(),
    fatebreaker: createDefaultFatebreaker(),
    slottedAbilities: [],
    abilityPool: [],
    portrait: null,
    physicalDescription: '',
    backstory: '',
    customTabs: [],
    config: { ...DEFAULT_SHEET_CONFIG },
    viewModes: {
      slottedAbilities: 'grid',
      abilityPool: 'grid',
      customTabs: {},
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customResourceBars: [],
  }
}

/**
 * Default NPC combat stats — all zeros, ready for manual entry.
 */
const DEFAULT_NPC_STATS: NPCStats = {
  evasion: 10,
  armor: 0,
  movement: 5,
  saveDC: 10,
  hp: 20,
}

/**
 * Construct a freshly-created default NPC.
 *
 * NPCs reuse the Character shape (so they share the store, DB, and dice-roll
 * infrastructure) but carry `npcStats` instead of derived combat stats and
 * omit live-play trackers. The `description` field holds the long-form NPC
 * description. All live-play fields (currentHP, currentEND, currentAP,
 * currentFP, mortalWounds, deathSaves) are zeroed/emptied — they are never
 * shown or tracked on an NPC sheet.
 *
 * NPCs start with all attributes at 0 (no standard array — the GM enters them
 * manually) and all skills at +0.
 */
export function createDefaultNPC(): Character {
  const attributes: Record<AttributeKey, number> = {
    MAR: 0,
    POW: 0,
    AGI: 0,
    VIT: 0,
    GRT: 0,
  }
  const skills = createDefaultSkills()
  const now = new Date().toISOString()

  return {
    id: generateId(),
    name: 'New NPC',
    playerName: '',
    version: '1.0.0',
    kind: 'npc',
    milestones: 0,
    attributes,
    skills,
    maxFP: 0,
    maxAbilitySlots: 0,
    currentHP: 0,
    tempHP: 0,
    currentEND: 0,
    currentAP: 0,
    currentFP: 0,
    mortalWounds: [null, null],
    deathSaves: { successes: 0, failures: 0 },
    innateDescription: '',
    innateAbilities: [],
    basicAttack: createDefaultBasicAttack(),
    fatebreaker: createDefaultFatebreaker(),
    slottedAbilities: [],
    abilityPool: [],
    portrait: null,
    physicalDescription: '',
    backstory: '',
    customTabs: [],
    config: { ...DEFAULT_SHEET_CONFIG },
    viewModes: {
      slottedAbilities: 'grid',
      abilityPool: 'grid',
      customTabs: {},
    },
    createdAt: now,
    updatedAt: now,
    customResourceBars: [],
    npcStats: { ...DEFAULT_NPC_STATS },
    description: '',
  }
}
