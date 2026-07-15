/**
 * Zustand store for Grimoire.
 *
 * Owns the in-memory list of characters plus the currently-selected sheet,
 * mirroring all mutations to the IndexedDB persistence layer (see db.ts).
 * Edits made through {@link updateCurrentCharacter} are debounced-autosaved;
 * an explicit {@link saveCurrentCharacter} is also available for manual saves.
 */

import { create } from 'zustand'
import { createDefaultCharacter, generateId, MORTAL_WOUNDS, MAX_AP, MAX_END, MAX_MORTAL_WOUNDS, DEATH_SAVE_DC, MAX_CUSTOM_TABS } from '@/constants/gameData'
import {
  deleteCharacter as dbDeleteCharacter,
  getAllCharacters,
  putCharacter,
} from '@/lib/db'
import { calcHP, calcENDRecovery } from '@/lib/calculations'
import { rollDie } from '@/lib/dice'
import {
  bumpSemver,
  deleteVersion,
  exportCharacter,
  importCharacter as parseImportCharacter,
  listVersions,
  restoreFromSnapshot,
} from '@/lib/exportImport'
import type {
  AbilityBlock,
  AttributeKey,
  Character,
  Semver,
  SheetConfig,
  SkillName,
  VersionSnapshot,
} from '@/types'

/** Debounce window for autosave (ms). */
const AUTOSAVE_DEBOUNCE_MS = 500

/** Top-level navigation view (home screen sections). */
export type AppView = 'home' | 'characters' | 'npcs' | 'settings'

export interface CharacterStoreState {
  /** All characters loaded from IndexedDB. */
  characters: Character[]
  /** The character currently being viewed / edited, or null. */
  currentCharacter: Character | null
  /** Whether the initial load from IndexedDB has completed. */
  isLoaded: boolean
  /** True while a save to IndexedDB is pending / in flight. */
  isSaving: boolean
  /** Version history for the current character (null until loaded). */
  versionHistory: VersionSnapshot[] | null
  /** True while a restore-from-version is in flight. */
  isRestoring: boolean
  /** Current top-level view (home, characters, npcs, settings). */
  view: AppView
}

/** Sections that hold a list of AbilityBlocks on a character. */
type AbilitySection = 'slottedAbilities' | 'abilityPool' | 'innateAbilities'

/** Core ability fields editable via {@link CharacterStoreActions.updateCoreAbility}. */
type CoreAbilityField =
  | 'innateDescription'
  | 'innateAbilities'
  | 'basicAttack'
  | 'fatebreaker'

/** Result of a damage application, for UI feedback. */
export interface DamageResult {
  /** Raw damage input. */
  rawDamage: number
  /** Damage after armor reduction. */
  afterArmor: number
  /** Damage after resistance. */
  afterResistance: number
  /** How much temp HP was consumed. */
  tempHPConsumed: number
  /** How much regular HP was lost. */
  hpLost: number
  /** Final HP after damage. */
  finalHP: number
  /** Whether a Mortal Wound was incurred. */
  causedMortalWound: boolean
  /** Number of Mortal Wounds incurred (0, 1, or 2). */
  mortalWoundsIncurred: number
  /** Whether the character is now knocked out. */
  knockedOut: boolean
}

/** Result of a Death Save roll, for UI feedback. */
export interface DeathSaveResult {
  roll: number
  successes: number
  failures: number
  /** Whether this roll counted as 2 (nat 20 or nat 1). */
  doubled: boolean
  /** Whether the character regained consciousness (3 successes). */
  revived: boolean
  /** Whether the character died (3 failures). */
  died: boolean
}

/** Result of a Mortal Wound roll, for UI feedback. */
export interface MortalWoundResult {
  roll: number
  woundName: string
  woundDescription: string
  /** Which mortal wound slot was filled (0 or 1). */
  slotIndex: number
  /** Whether the character is now knocked out (both slots filled). */
  knockedOut: boolean
}

export interface CharacterStoreActions {
  /** Load all characters from IndexedDB into the store. */
  loadCharacters: () => Promise<void>
  /** Create a fresh default character, persist it, and select it. */
  createCharacter: (name: string) => Promise<void>
  /** Select a loaded character as current by id. */
  selectCharacter: (id: string) => void
  /** Clear current character and return to list view. */
  closeCharacter: () => void
  /** Navigate to a top-level view (home, characters, npcs, settings). */
  setView: (view: AppView) => void
  /** Apply an updater to the current character, autosave, and sync the list. */
  updateCurrentCharacter: (updater: (char: Character) => Character) => void
  /** Delete a character from DB and the store, clearing current if needed. */
  deleteCharacter: (id: string) => Promise<void>
  /** Explicitly persist the current character to IndexedDB. */
  saveCurrentCharacter: () => Promise<void>
  /** Import a character from JSON text, persist it, and select it as current. */
  importCharacterFile: (text: string) => Promise<void>
  /** Update a single AbilityBlock within a slotted/pool list. */
  updateAbilityBlock: (
    section: AbilitySection,
    id: string,
    updated: AbilityBlock,
  ) => void
  /** Append an AbilityBlock to a slotted/pool list. */
  addAbilityBlock: (section: AbilitySection, ability: AbilityBlock) => void
  /** Remove an AbilityBlock by id from a slotted/pool list. */
  removeAbilityBlock: (section: AbilitySection, id: string) => void
  /** Move an AbilityBlock from one slotted/pool list to the other. */
  moveAbility: (
    id: string,
    from: AbilitySection,
    to: AbilitySection,
  ) => void
  /** Reorder an AbilityBlock within a single slotted/pool list. */
  reorderAbility: (
    section: AbilitySection,
    fromIndex: number,
    toIndex: number,
  ) => void
  /** Update a core ability field (innateDescription, innateAbilities, basicAttack, fatebreaker). */
  updateCoreAbility: (
    field: CoreAbilityField,
    value: string | AbilityBlock | AbilityBlock[] | null,
  ) => void
  /** Apply damage to the character (handles temp HP, armor, resistance, mortal wound overflow). */
  takeDamage: (amount: number, opts?: {
    /** Whether to apply armor reduction (1d6 per armor point). */
    applyArmor?: boolean
    /** Whether the character has Resistance (halves damage after armor). */
    resistant?: boolean
    /** Whether to bypass temp HP. */
    ignoreTempHP?: boolean
  }) => DamageResult
  /** Heal the character (respecting Circulatory Dysfunction mortal wound if present). */
  heal: (amount: number) => void
  /** Add or replace Temporary HP (higher value takes precedence). */
  setTempHP: (amount: number) => void
  /** Spend AP; returns false if insufficient. */
  spendAP: (amount: number) => boolean
  /** Restore AP (e.g. at the start of a turn). */
  restoreAP: (amount: number) => void
  /** Reset AP to max (3). */
  resetAP: () => void
  /** Spend END; returns false if insufficient. */
  spendEND: (amount: number) => boolean
  /** Restore END (e.g. at end of turn via END Recovery). */
  restoreEND: (amount: number) => void
  /** Reset END to max (10). */
  resetEND: () => void
  /** Spend FP; returns false if insufficient. */
  spendFP: (amount: number) => boolean
  /** Restore FP. */
  restoreFP: (amount: number) => void
  /** Recover action: spend 3 AP, regain all END. Returns false if insufficient AP. */
  recover: () => boolean
  /** Regenerate END at end of turn (END Recovery from GRT). */
  regenerateEND: () => void
  /** Convert unspent AP to END at end of turn (1:1, capped at max END). */
  convertAPtoEND: () => void
  /**
   * End the character's turn: convert unspent AP to END (1:1), apply END
   * Recovery, and reset AP to max. Returns the total END gained.
   */
  endTurn: () => number
  /** Roll a Death Save (d20, DC 10). Returns the roll and updated tracker. */
  rollDeathSave: () => DeathSaveResult
  /** Roll on the Mortal Wounds table (d20). Returns the wound and applies it. */
  rollMortalWound: () => MortalWoundResult
  /** Clear a Mortal Wound at the given index. */
  clearMortalWound: (index: number) => void
  /** Reset to full HP, clear mortal wounds, clear death saves (end of encounter / Rest). */
  fullRestore: () => void
  /** Reset only HP to max (end of encounter). */
  resetHP: () => void
  /** Apply a milestone increase with attribute/skill/choice selections. */
  addMilestone: (opts: {
    attribute: AttributeKey
    skill: SkillName
    choice?: 'slot' | 'fp'
  }) => void
  /** Skip milestone bonuses (milestone still increases by 1). */
  skipMilestone: () => void
  /** Update the sheet configuration (colors, fonts, custom CSS). */
  updateConfig: (updater: (config: SheetConfig) => SheetConfig) => void
  /** Add a new custom tab with a default name. Returns the new tab id. */
  addCustomTab: (name?: string) => string
  /** Rename a custom tab by id. */
  renameCustomTab: (tabId: string, name: string) => void
  /** Remove a custom tab by id. */
  removeCustomTab: (tabId: string) => void
  /** Reorder a custom tab to a new position. */
  reorderCustomTab: (fromIndex: number, toIndex: number) => void
  /** Add a new ability section to a custom tab. Returns the new section id. */
  addCustomSection: (tabId: string, name?: string) => string
  /** Rename a custom ability section. */
  renameCustomSection: (tabId: string, sectionId: string, name: string) => void
  /** Remove a custom ability section. */
  removeCustomSection: (tabId: string, sectionId: string) => void
  /** Add an ability block to a custom section. */
  addCustomAbility: (tabId: string, sectionId: string, ability: AbilityBlock) => void
  /** Update an ability block within a custom section. */
  updateCustomAbility: (tabId: string, sectionId: string, abilityId: string, updated: AbilityBlock) => void
  /** Remove an ability block from a custom section. */
  removeCustomAbility: (tabId: string, sectionId: string, abilityId: string) => void
  /** Reorder an ability within a custom section. */
  reorderCustomAbility: (tabId: string, sectionId: string, fromIndex: number, toIndex: number) => void
  /** Move an ability between custom sections (within the same tab). */
  moveCustomAbility: (tabId: string, fromSectionId: string, toSectionId: string, abilityId: string) => void
  /**
   * Create and store a version snapshot of the current character.
   * Returns the snapshot, or null if there is no current character.
   * An optional `versionOverride` lets the user pick a semantic version
   * (e.g. "9.1.2") instead of bumping the auto-incremented default.
   */
  saveVersion: (versionOverride?: Semver) => Promise<VersionSnapshot | null>
  /**
   * Load the version history for the current character into the store.
   * Resets to null if there is no current character.
   */
  loadVersions: () => Promise<void>
  /**
   * Restore the current character to the data captured in a given snapshot.
   * Bumps the version counter so history is preserved forward.
   */
  restoreVersion: (snapshotId: string) => Promise<void>
  /**
   * Delete a version snapshot from history. Reloads the history afterwards.
   */
  deleteVersion: (snapshotId: string) => Promise<void>
}

export type CharacterStore = CharacterStoreState & CharacterStoreActions

/** Handle for the pending autosave timeout, if any. */
let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useCharacterStore = create<CharacterStore>()((set, get) => ({
  characters: [],
  currentCharacter: null,
  isLoaded: false,
  isSaving: false,
  versionHistory: null,
  isRestoring: false,
  view: 'home',

  loadCharacters: async () => {
    const characters = await getAllCharacters()
    set({ characters, isLoaded: true })
  },

  createCharacter: async (name: string) => {
    const base = createDefaultCharacter()
    const character: Character = { ...base, name, id: generateId() }
    set({ isSaving: true })
    await putCharacter(character)
    set((state) => ({
      characters: [...state.characters, character],
      currentCharacter: character,
      isSaving: false,
    }))
  },

  selectCharacter: (id: string) => {
    const found = get().characters.find((c) => c.id === id) ?? null
    set({ currentCharacter: found })
  },

  closeCharacter: () => {
    set({ currentCharacter: null, view: 'characters' })
  },

  setView: (view) => {
    set({ view })
  },

  updateCurrentCharacter: (updater) => {
    const current = get().currentCharacter
    if (!current) return

    const updated = { ...updater(current), updatedAt: new Date().toISOString() }

    set((state) => ({
      currentCharacter: updated,
      characters: state.characters.map((c) => (c.id === updated.id ? updated : c)),
    }))

    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get().saveCurrentCharacter()
    }, AUTOSAVE_DEBOUNCE_MS)
  },

  deleteCharacter: async (id: string) => {
    await dbDeleteCharacter(id)
    set((state) => {
      const characters = state.characters.filter((c) => c.id !== id)
      const currentCharacter =
        state.currentCharacter?.id === id ? null : state.currentCharacter
      return { characters, currentCharacter }
    })
  },

  saveCurrentCharacter: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const current = get().currentCharacter
    if (!current) return
    set({ isSaving: true })
    await putCharacter(current)
    set({ isSaving: false })
  },

  importCharacterFile: async (text: string) => {
    const imported = parseImportCharacter(text)
    set({ isSaving: true })
    await putCharacter(imported)
    set((state) => ({
      characters: [...state.characters, imported],
      currentCharacter: imported,
      isSaving: false,
    }))
  },

  updateAbilityBlock: (section, id, updated) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      [section]: char[section].map((a) => (a.id === id ? updated : a)),
    }))
  },

  addAbilityBlock: (section, ability) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      [section]: [...char[section], ability],
    }))
  },

  removeAbilityBlock: (section, id) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      [section]: char[section].filter((a) => a.id !== id),
    }))
  },

  moveAbility: (id, from, to) => {
    if (from === to) return
    get().updateCurrentCharacter((char) => {
      const moved = char[from].find((a) => a.id === id)
      if (!moved) return char
      return {
        ...char,
        [from]: char[from].filter((a) => a.id !== id),
        [to]: [...char[to], moved],
      }
    })
  },

  reorderAbility: (section, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    get().updateCurrentCharacter((char) => {
      const list = [...char[section]]
      if (fromIndex < 0 || fromIndex >= list.length) return char
      if (toIndex < 0 || toIndex >= list.length) return char
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, moved)
      return { ...char, [section]: list }
    })
  },

  updateCoreAbility: (field, value) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      [field]: value,
    }))
  },

  // ---- Live play: damage & healing -------------------------------------------

  takeDamage: (amount, opts = {}) => {
    const current = get().currentCharacter
    if (!current) {
      return {
        rawDamage: amount, afterArmor: amount, afterResistance: amount,
        tempHPConsumed: 0, hpLost: 0, finalHP: 0,
        causedMortalWound: false, mortalWoundsIncurred: 0, knockedOut: false,
      }
    }

    const { applyArmor = false, resistant = false, ignoreTempHP = false } = opts
    const maxHP = calcHP(current.attributes.VIT)
    const armor = Math.floor(current.attributes.VIT / 2)

    // Step 1: Armor reduction — 1d6 per armor point.
    let dmg = amount
    let afterArmor = dmg
    if (applyArmor && armor > 0) {
      const reduction = Array.from({ length: armor }, () => rollDie(6))
        .reduce((a, b) => a + b, 0)
      dmg = Math.max(0, dmg - reduction)
      afterArmor = dmg
    }

    // Step 2: Resistance — halves damage.
    let afterResistance = dmg
    if (resistant) {
      dmg = Math.floor(dmg / 2)
      afterResistance = dmg
    }

    // Step 3: Temp HP absorbs first.
    let tempHPConsumed = 0
    let remainingDamage = dmg
    let newTempHP = current.tempHP
    if (!ignoreTempHP && current.tempHP > 0) {
      tempHPConsumed = Math.min(current.tempHP, remainingDamage)
      newTempHP = current.tempHP - tempHPConsumed
      remainingDamage -= tempHPConsumed
    }

    // Step 4: Apply remaining to HP, handle mortal wound overflow.
    let newHP = current.currentHP - remainingDamage
    let mortalWoundsIncurred = 0
    let knockedOut = false

    while (newHP <= 0 && mortalWoundsIncurred < MAX_MORTAL_WOUNDS) {
      const filledSlots = current.mortalWounds.filter((w) => w != null).length + mortalWoundsIncurred
      if (filledSlots >= MAX_MORTAL_WOUNDS) {
        knockedOut = true
        break
      }
      mortalWoundsIncurred++
      // HP resets to max after a mortal wound, excess spills over.
      const overflow = Math.abs(newHP)
      newHP = maxHP - overflow
    }

    if (newHP <= 0 && mortalWoundsIncurred >= MAX_MORTAL_WOUNDS) {
      knockedOut = true
      newHP = 0
    }

    // Apply mortal wound slots (names filled by rollMortalWound in UI flow).
    const newMortalWounds = [...current.mortalWounds]
    let slotIdx = 0
    for (let i = 0; i < mortalWoundsIncurred; i++) {
      while (slotIdx < newMortalWounds.length && newMortalWounds[slotIdx] != null) slotIdx++
      if (slotIdx < newMortalWounds.length) {
        newMortalWounds[slotIdx] = 'Pending Roll'
      }
    }

    get().updateCurrentCharacter((char) => ({
      ...char,
      currentHP: newHP,
      tempHP: newTempHP,
      mortalWounds: newMortalWounds,
    }))

    return {
      rawDamage: amount,
      afterArmor,
      afterResistance,
      tempHPConsumed,
      hpLost: current.currentHP - newHP,
      finalHP: newHP,
      causedMortalWound: mortalWoundsIncurred > 0,
      mortalWoundsIncurred,
      knockedOut,
    } satisfies DamageResult
  },

  heal: (amount) => {
    const current = get().currentCharacter
    if (!current) return
    const maxHP = calcHP(current.attributes.VIT)
    // Check for Circulatory Dysfunction (halves healing, rounded down).
    const hasCirculatory = current.mortalWounds.includes('Circulatory Dysfunction')
    const effective = hasCirculatory ? Math.floor(amount / 2) : amount
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentHP: Math.min(maxHP, char.currentHP + effective),
    }))
  },

  setTempHP: (amount) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      tempHP: Math.max(char.tempHP, amount),
    }))
  },

  // ---- Live play: resource spend/restore ------------------------------------

  spendAP: (amount) => {
    const current = get().currentCharacter
    if (!current || current.currentAP < amount) return false
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentAP: char.currentAP - amount,
    }))
    return true
  },

  restoreAP: (amount) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentAP: Math.min(MAX_AP, char.currentAP + amount),
    }))
  },

  resetAP: () => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentAP: MAX_AP,
    }))
  },

  spendEND: (amount) => {
    const current = get().currentCharacter
    if (!current || current.currentEND < amount) return false
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentEND: char.currentEND - amount,
    }))
    return true
  },

  restoreEND: (amount) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentEND: Math.min(MAX_END, char.currentEND + amount),
    }))
  },

  resetEND: () => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentEND: MAX_END,
    }))
  },

  spendFP: (amount) => {
    const current = get().currentCharacter
    if (!current || current.currentFP < amount) return false
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentFP: char.currentFP - amount,
    }))
    return true
  },

  restoreFP: (amount) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentFP: Math.min(char.maxFP, char.currentFP + amount),
    }))
  },

  // ---- Live play: recover & end-of-turn -------------------------------------

  recover: () => {
    const current = get().currentCharacter
    if (!current) return false
    // Check for Damaged Throat (Recover only restores half END).
    const hasDamagedThroat = current.mortalWounds.includes('Damaged Throat')
    const restoredEND = hasDamagedThroat ? Math.floor(MAX_END / 2) : MAX_END
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentEND: restoredEND,
    }))
    return true
  },

  regenerateEND: () => {
    const current = get().currentCharacter
    if (!current) return
    // Damaged Throat: unable to regain END passively.
    if (current.mortalWounds.includes('Damaged Throat')) return
    const recovery = calcENDRecovery(current.attributes.GRT)
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentEND: Math.min(MAX_END, char.currentEND + recovery),
    }))
  },

  convertAPtoEND: () => {
    get().updateCurrentCharacter((char) => {
      const converted = Math.min(char.currentAP, MAX_END - char.currentEND)
      return {
        ...char,
        currentAP: 0,
        currentEND: char.currentEND + converted,
      }
    })
  },

  endTurn: () => {
    let totalGained = 0
    get().updateCurrentCharacter((char) => {
      // 1. Convert unspent AP to END (1:1, capped at max END).
      const apToEND = Math.min(char.currentAP, MAX_END - char.currentEND)
      let newEND = char.currentEND + apToEND
      // 2. Apply END Recovery (unless Damaged Throat prevents it).
      let recovery = 0
      if (!char.mortalWounds.includes('Damaged Throat')) {
        recovery = calcENDRecovery(char.attributes.GRT)
        newEND = Math.min(MAX_END, newEND + recovery)
      }
      totalGained = apToEND + recovery
      return {
        ...char,
        currentAP: MAX_AP,
        currentEND: newEND,
      }
    })
    return totalGained
  },

  // ---- Live play: death saves & mortal wounds --------------------------------

  rollDeathSave: () => {
    const current = get().currentCharacter
    if (!current) {
      return { roll: 0, successes: 0, failures: 0, doubled: false, revived: false, died: false }
    }

    const roll = rollDie(20)
    let successGain = 0
    let failureGain = 0
    let doubled = false

    if (roll >= 20) {
      successGain = 2
      doubled = true
    } else if (roll <= 1) {
      failureGain = 2
      doubled = true
    } else if (roll >= DEATH_SAVE_DC) {
      successGain = 1
    } else {
      failureGain = 1
    }

    const successes = Math.min(3, current.deathSaves.successes + successGain)
    const failures = Math.min(3, current.deathSaves.failures + failureGain)

    let revived = false
    let died = false
    let hpUpdate: Partial<Character> = {}
    if (successes >= 3) {
      revived = true
      hpUpdate = { currentHP: 1 }
    }
    if (failures >= 3) {
      died = true
    }

    get().updateCurrentCharacter((char) => ({
      ...char,
      deathSaves: { successes, failures },
      ...hpUpdate,
    }))

    return { roll, successes, failures, doubled, revived, died } satisfies DeathSaveResult
  },

  rollMortalWound: () => {
    const current = get().currentCharacter
    if (!current) {
      return { roll: 0, woundName: '', woundDescription: '', slotIndex: -1, knockedOut: false }
    }

    const roll = rollDie(20)
    const wound = MORTAL_WOUNDS.find((w) => w.id === roll) ?? MORTAL_WOUNDS[0]

    // Find first empty slot.
    const newMortalWounds = [...current.mortalWounds]
    let slotIndex = -1
    for (let i = 0; i < newMortalWounds.length; i++) {
      if (newMortalWounds[i] === 'Pending Roll' || newMortalWounds[i] == null) {
        slotIndex = i
        newMortalWounds[i] = wound.name
        break
      }
    }

    if (slotIndex === -1) {
      // No empty slot — shouldn't normally happen, but handle gracefully.
      newMortalWounds.push(wound.name)
      slotIndex = newMortalWounds.length - 1
    }

    const knockedOut = newMortalWounds.filter((w) => w != null).length >= MAX_MORTAL_WOUNDS

    get().updateCurrentCharacter((char) => ({
      ...char,
      mortalWounds: newMortalWounds,
    }))

    return {
      roll,
      woundName: wound.name,
      woundDescription: wound.description,
      slotIndex,
      knockedOut,
    } satisfies MortalWoundResult
  },

  clearMortalWound: (index) => {
    get().updateCurrentCharacter((char) => {
      const wounds = [...char.mortalWounds]
      if (index >= 0 && index < wounds.length) {
        wounds[index] = null
      }
      return { ...char, mortalWounds: wounds }
    })
  },

  // ---- Live play: full restore & reset ---------------------------------------

  fullRestore: () => {
    get().updateCurrentCharacter((char) => {
      const maxHP = calcHP(char.attributes.VIT)
      return {
        ...char,
        currentHP: maxHP,
        tempHP: 0,
        currentEND: MAX_END,
        currentAP: MAX_AP,
        currentFP: char.maxFP,
        mortalWounds: [null, null],
        deathSaves: { successes: 0, failures: 0 },
      }
    })
  },

  resetHP: () => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      currentHP: calcHP(char.attributes.VIT),
    }))
  },

  addMilestone: (opts) => {
    const { attribute, skill, choice } = opts
    get().updateCurrentCharacter((char) => {
      const newAttrs = { ...char.attributes, [attribute]: char.attributes[attribute] + 1 }
      const newSkills = { ...char.skills, [skill]: char.skills[skill] + 2 }
      const newMilestones = char.milestones + 1

      // Every 2 milestones: apply choice.
      let maxAbilitySlots = char.maxAbilitySlots
      let maxFP = char.maxFP
      if (newMilestones % 2 === 0 && choice) {
        if (choice === 'slot') maxAbilitySlots++
        else maxFP++
      }

      return {
        ...char,
        attributes: newAttrs,
        skills: newSkills,
        milestones: newMilestones,
        maxAbilitySlots,
        maxFP,
      }
    })
  },

  skipMilestone: () => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      milestones: char.milestones + 1,
    }))
  },

  updateConfig: (updater) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      config: updater(char.config),
    }))
  },

  // ---- Custom tabs & sections ------------------------------------------------

  addCustomTab: (name) => {
    const current = get().currentCharacter?.customTabs ?? []
    if (current.length >= MAX_CUSTOM_TABS) return ''
    const id = generateId()
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: [
        ...char.customTabs,
        { id, name: name ?? 'New Tab', sections: [] },
      ],
    }))
    return id
  },

  renameCustomTab: (tabId, name) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId ? { ...t, name } : t,
      ),
    }))
  },

  removeCustomTab: (tabId) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.filter((t) => t.id !== tabId),
    }))
  },

  reorderCustomTab: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    get().updateCurrentCharacter((char) => {
      const tabs = [...char.customTabs]
      if (fromIndex < 0 || fromIndex >= tabs.length) return char
      if (toIndex < 0 || toIndex >= tabs.length) return char
      const [moved] = tabs.splice(fromIndex, 1)
      tabs.splice(toIndex, 0, moved)
      return { ...char, customTabs: tabs }
    })
  },

  addCustomSection: (tabId, name) => {
    const id = generateId()
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: [
                ...t.sections,
                { id, name: name ?? 'New Section', abilities: [] },
              ],
            }
          : t,
      ),
    }))
    return id
  },

  renameCustomSection: (tabId, sectionId, name) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: t.sections.map((s) =>
                s.id === sectionId ? { ...s, name } : s,
              ),
            }
          : t,
      ),
    }))
  },

  removeCustomSection: (tabId, sectionId) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? { ...t, sections: t.sections.filter((s) => s.id !== sectionId) }
          : t,
      ),
    }))
  },

  addCustomAbility: (tabId, sectionId, ability) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: t.sections.map((s) =>
                s.id === sectionId
                  ? { ...s, abilities: [...s.abilities, ability] }
                  : s,
              ),
            }
          : t,
      ),
    }))
  },

  updateCustomAbility: (tabId, sectionId, abilityId, updated) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: t.sections.map((s) =>
                s.id === sectionId
                  ? {
                      ...s,
                      abilities: s.abilities.map((a) =>
                        a.id === abilityId ? updated : a,
                      ),
                    }
                  : s,
              ),
            }
          : t,
      ),
    }))
  },

  removeCustomAbility: (tabId, sectionId, abilityId) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: t.sections.map((s) =>
                s.id === sectionId
                  ? {
                      ...s,
                      abilities: s.abilities.filter((a) => a.id !== abilityId),
                    }
                  : s,
              ),
            }
          : t,
      ),
    }))
  },

  reorderCustomAbility: (tabId, sectionId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    get().updateCurrentCharacter((char) => {
      const tabs = char.customTabs.map((t) => {
        if (t.id !== tabId) return t
        return {
          ...t,
          sections: t.sections.map((s) => {
            if (s.id !== sectionId) return s
            const list = [...s.abilities]
            if (fromIndex < 0 || fromIndex >= list.length) return s
            if (toIndex < 0 || toIndex >= list.length) return s
            const [moved] = list.splice(fromIndex, 1)
            list.splice(toIndex, 0, moved)
            return { ...s, abilities: list }
          })
        }
      })
      return { ...char, customTabs: tabs }
    })
  },

  moveCustomAbility: (tabId, fromSectionId, toSectionId, abilityId) => {
    if (fromSectionId === toSectionId) return
    get().updateCurrentCharacter((char) => {
      const tabs = char.customTabs.map((t) => {
        if (t.id !== tabId) return t
        return {
          ...t,
          sections: t.sections.map((s) => {
            if (s.id === fromSectionId) {
              return { ...s, abilities: s.abilities.filter((a) => a.id !== abilityId) }
            }
            if (s.id === toSectionId) {
              const moved = t.sections
                .find((sec) => sec.id === fromSectionId)
                ?.abilities.find((a) => a.id === abilityId)
              if (!moved) return s
              return { ...s, abilities: [...s.abilities, moved] }
            }
            return s
          })
        }
      })
      return { ...char, customTabs: tabs }
    })
  },

  saveVersion: async (versionOverride?: Semver) => {
    const current = get().currentCharacter
    if (!current) return null
    // Use the override or auto-bump by patch level.
    const targetVersion = versionOverride ?? bumpSemver(current.version)
    // Set the character's version counter so the next export continues from there.
    get().updateCurrentCharacter((char) => ({
      ...char,
      version: targetVersion,
    }))
    // Snapshot uses the chosen version.
    const result = await exportCharacter({
      ...current,
      version: targetVersion,
    }, targetVersion)
    await get().loadVersions()
    return result.snapshot
  },

  loadVersions: async () => {
    const current = get().currentCharacter
    if (!current) {
      set({ versionHistory: null })
      return
    }
    const versions = await listVersions(current.id)
    set({ versionHistory: versions })
  },

  restoreVersion: async (snapshotId) => {
    const current = get().currentCharacter
    const history = get().versionHistory
    if (!current || !history) return
    const snap = history.find((s) => s.id === snapshotId)
    if (!snap) return
    set({ isRestoring: true })
    const restored = restoreFromSnapshot(snap)
    await putCharacter(restored)
    set((state) => ({
      currentCharacter: restored,
      characters: state.characters.map((c) =>
        c.id === restored.id ? restored : c,
      ),
      isRestoring: false,
    }))
    await get().loadVersions()
  },

  deleteVersion: async (snapshotId) => {
    await deleteVersion(snapshotId)
    await get().loadVersions()
  },
}))

void useCharacterStore.getState().loadCharacters()