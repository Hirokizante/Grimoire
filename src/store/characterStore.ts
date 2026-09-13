/**
 * Zustand store for Grimoire.
 *
 * Owns the in-memory list of characters plus the currently-selected sheet,
 * mirroring all mutations to the IndexedDB persistence layer (see db.ts).
 * Edits made through {@link CharacterStoreActions.updateCharacter} (or the
 * current-character wrapper {@link CharacterStoreActions.updateCurrentCharacter})
 * are debounced-autosaved per character id; an explicit
 * {@link CharacterStoreActions.saveCharacter} is also available for manual saves.
 *
 * Live-play actions are **id-targeted**: every mutation takes the id of the
 * entity it applies to, so the GM Screen can drive several sheets at once
 * without hijacking `currentCharacter` (which would navigate the app away and
 * corrupt `diceRollStore.themeEntity()`).
 */

import { create } from 'zustand'
import { createDefaultCharacter, createDefaultNPC, generateId, MAX_AP, MAX_END, MAX_MORTAL_WOUNDS, DEATH_SAVE_DC, MAX_CUSTOM_TABS } from '@/constants/gameData'
import { useStatusStore } from '@/store/statusStore'
import {
  deleteCharacter as dbDeleteCharacter,
  getAllCharacters,
  normalizeCharacter,
  putCharacter,
} from '@/lib/db'
import {
  effectiveCombatStats,
  setAbilityModifiersActive as applyAbilityModifiersActive,
} from '@/lib/abilityModifiers'
import {
  restoreAllAbilityUses,
  setAbilityUsesRemaining as applySetAbilityUsesRemaining,
  spendAbilityUse as applySpendAbilityUse,
} from '@/lib/abilityUses'
import { rollDie } from '@/lib/dice'
import { rollOnMortalWoundTable } from '@/lib/mortalWounds'
import {
  bumpSemver,
  deleteVersion,
  exportCharacter,
  listVersions,
  parseImportBundle,
  restoreFromSnapshot,
  updateExistingCharacterFromImport,
} from '@/lib/exportImport'
import type {
  AbilityBlock,
  AttributeKey,
  Character,
  CustomResourceBar,
  MortalWoundRoll,
  Semver,
  SheetConfig,
  SheetLabel,
  SkillName,
  VersionSnapshot,
} from '@/types'

/** Debounce window for autosave (ms). */
const AUTOSAVE_DEBOUNCE_MS = 500

/** Top-level navigation view (home screen sections). */
export type AppView =
  | 'home'
  | 'characters'
  | 'npcs'
  | 'gmscreen'
  | 'statuses'
  | 'settings'

export interface CharacterStoreState {
  /** All characters loaded from IndexedDB. */
  characters: Character[]
  /** The character currently being viewed / edited, or null. */
  currentCharacter: Character | null
  /** Whether the initial load from IndexedDB has completed. */
  isLoaded: boolean
  /**
   * Human-readable reason the last character load failed, or null. When set,
   * the list pages show the error plus a Retry action instead of a permanent
   * loading state.
   */
  loadError: string | null
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
  /** Number of Mortal Wounds incurred (0, 1, or 2 — an NPC instance can burn through more in one hit). */
  mortalWoundsIncurred: number
  /**
   * The wounds rolled by this application, when the target resolves them
   * itself — an NPC instance (`gmScreenStore.damageInstance`) and a player
   * character damaged from a GM panel (`takePanelDamage`) both roll at 0 HP, so
   * their panels can name what was rolled. Absent from the sheet's own
   * `takeDamage`, whose slots go to `Pending Roll` until the player rolls from
   * the Mortal Wound card.
   */
  mortalWoundRolls?: MortalWoundRoll[]
  /** Whether the character is now knocked out. */
  knockedOut: boolean
  /**
   * Whether the target was driven to 0 HP. Meaningful for NPC instances,
   * which have no mortal wounds or death saves and simply go `downed`;
   * characters express the same situation through `knockedOut`.
   */
  downed?: boolean
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
  /**
   * Load all characters from IndexedDB into the store. Never rejects: a
   * failure sets `loadError` and still marks `isLoaded`.
   */
  loadCharacters: () => Promise<void>
  /** Create a fresh default character, persist it, and select it. */
  createCharacter: (name: string) => Promise<void>
  /** Create a fresh default NPC, persist it, and select it. */
  createNPC: (name: string) => Promise<void>
  /**
   * Create a fresh default NPC and persist it WITHOUT selecting it or
   * navigating. Returns the new record (or null if the name is empty).
   *
   * Used by the GM Screen's "New NPC…" quick-create, which wants the base
   * record to attach an instance to — not a page navigation.
   */
  createNpcBase: (name: string) => Promise<Character | null>
  /** Select a loaded character as current by id. */
  selectCharacter: (id: string) => void
  /** Clear current character and return to list view. */
  closeCharacter: () => void
  /** Clear current NPC and return to NPC list view. */
  closeNPC: () => void
  /** Navigate to a top-level view (home, characters, npcs, settings). */
  setView: (view: AppView) => void
  /**
   * Apply an updater to the character with the given id, autosave it (per-id
   * debounce), and sync both the list and `currentCharacter` if it is the one
   * being edited. No-op when no such character exists.
   */
  updateCharacter: (id: string, updater: (char: Character) => Character) => void
  /** Apply an updater to the current character, autosave, and sync the list. */
  updateCurrentCharacter: (updater: (char: Character) => Character) => void
  /** Delete a character from DB and the store, clearing current if needed. */
  deleteCharacter: (id: string) => Promise<void>
  /** Explicitly persist the current character to IndexedDB. */
  saveCurrentCharacter: () => Promise<void>
  /** Explicitly persist one character to IndexedDB (cancels its pending autosave). */
  saveCharacter: (id: string) => Promise<void>
  /** Import a character from JSON text, persist it, and select it as current. */
  importCharacterFile: (text: string) => Promise<void>
  /** Import an NPC from JSON text, persist it, and select it as current. */
  importNPCFile: (text: string) => Promise<void>
  /** Update an existing character from imported JSON, preserving id and live-play state. */
  updateExistingCharacterFromImportFile: (existing: Character, text: string) => Promise<void>
  /** Update an existing NPC from imported JSON, preserving id. */
  updateExistingNPCFromImportFile: (existing: Character, text: string) => Promise<void>
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
  /**
   * Switch one ability's stat/attribute modifiers on or off, wherever the
   * ability lives on the sheet (core, slotted, pool, custom tabs, or nested
   * Sub-Abilities). Independent from activation and costs nothing.
   */
  setAbilityModifiersActive: (abilityId: string, active: boolean) => void
  /**
   * Consume one use of a limited ability for the character with `id`, wherever
   * the ability lives on that sheet. Returns whether a use was actually spent —
   * false for an unlimited ability, one whose editor toggle left it out of the
   * use economy, or one already at 0 uses.
   */
  spendAbilityUse: (id: string, abilityId: string) => boolean
  /**
   * Set the remaining uses on a limited ability for the character with `id`,
   * clamped into `[0, max]`. No-op for an unknown or unlimited ability.
   */
  setAbilityUsesRemaining: (
    id: string,
    abilityId: string,
    remaining: number,
  ) => void
  /** Apply damage to the character with `id` (temp HP, armor, resistance, mortal wound overflow). */
  takeDamage: (id: string, amount: number, opts?: {
    /** Whether to apply armor reduction (1d6 per armor point). */
    applyArmor?: boolean
    /** Whether the character has Resistance (halves damage after armor). */
    resistant?: boolean
    /** Whether to bypass temp HP. */
    ignoreTempHP?: boolean
  }) => DamageResult
  /**
   * Apply damage to the character with `id` **and roll any Mortal Wound it
   * causes** — the GM Screen's player-panel pipeline.
   *
   * A player rolling from their own sheet uses {@link takeDamage}, which
   * deliberately leaves the slot on `'Pending Roll'` until they press the
   * Mortal Wound card's button. A GM panel has no such card, and a GM running a
   * fight should not have to ask the table to resolve a wound mid-turn, so this
   * entry point resolves the D20 immediately through the same
   * {@link rollMortalWound} the sheet uses and reports the names in
   * `mortalWoundRolls` — exactly what `gmScreenStore.damageInstance` does for
   * an NPC instance, so both panel kinds read the same.
   */
  takePanelDamage: (id: string, amount: number, opts?: {
    /** Whether to apply armor reduction (1d6 per armor point). */
    applyArmor?: boolean
    /** Whether the character has Resistance (halves damage after armor). */
    resistant?: boolean
    /** Whether to bypass temp HP. */
    ignoreTempHP?: boolean
  }) => DamageResult
  /** Heal the character with `id` (respecting Circulatory Dysfunction if present). */
  heal: (id: string, amount: number) => void
  /** Add or replace Temporary HP on the character with `id` (higher value wins). */
  setTempHP: (id: string, amount: number) => void
  /** Spend AP from the character with `id`; returns false if insufficient. */
  spendAP: (id: string, amount: number) => boolean
  /** Restore AP to the character with `id` (e.g. at the start of a turn). */
  restoreAP: (id: string, amount: number) => void
  /** Reset AP to max (3) for the character with `id`. */
  resetAP: (id: string) => void
  /** Spend END from the character with `id`; returns false if insufficient. */
  spendEND: (id: string, amount: number) => boolean
  /** Restore END to the character with `id` (e.g. at end of turn). */
  restoreEND: (id: string, amount: number) => void
  /** Reset END to max (10) for the character with `id`. */
  resetEND: (id: string) => void
  /** Spend FP from the character with `id`; returns false if insufficient. */
  spendFP: (id: string, amount: number) => boolean
  /** Restore FP to the character with `id`. */
  restoreFP: (id: string, amount: number) => void
  /** Recover action: spend 3 AP, regain all END. Returns false if insufficient AP. */
  recover: (id: string) => boolean
  /** Regenerate END at end of turn (END Recovery from GRT) for the character with `id`. */
  regenerateEND: (id: string) => void
  /** Convert unspent AP to END at end of turn (1:1, capped at max END). */
  convertAPtoEND: (id: string) => void
  /**
   * End the turn of the character with `id`: convert unspent AP to END (1:1),
   * apply END Recovery, and reset AP to max. Returns the total END gained.
   */
  endTurn: (id: string) => number
  /** Roll a Death Save (d20, DC 10). Returns the roll and updated tracker. */
  rollDeathSave: (id: string) => DeathSaveResult
  /** Roll on the Mortal Wounds table (d20). Returns the wound and applies it. */
  rollMortalWound: (id: string) => MortalWoundResult
  /** Clear a Mortal Wound at the given index. */
  clearMortalWound: (id: string, index: number) => void
  /**
   * Clear every Mortal Wound on the character with `id` — the GM panel menu's
   * "Clear mortal wounds", the track-only counterpart of `fullRestore` (which
   * is the sheet's Rest and resets every resource as well).
   */
  clearMortalWounds: (id: string) => void
  /** Reset to full HP, clear mortal wounds, clear death saves (end of encounter / Rest). */
  fullRestore: (id: string) => void
  /** Reset only HP to max (end of encounter). */
  resetHP: (id: string) => void
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
  /**
   * Add a new NPC section to a custom tab. Creates a blank NPC record in the
   * shared characters store and attaches it to the tab via reference. Returns
   * the new section id.
   */
  addCustomNPCSection: (tabId: string, name?: string) => string
  /** Add a new free-text (Markdown) section to a custom tab. Returns its id. */
  addCustomTextSection: (tabId: string, name?: string) => string
  /** Update the Markdown content of a custom text section. */
  updateCustomTextSectionContent: (tabId: string, sectionId: string, content: string) => void
  /**
   * Attach an existing saved NPC (found in the shared characters store by id)
   * to a custom tab as a new npc-kind section. Returns the new section id.
   */
  addCustomNPCReference: (tabId: string, npcId: string) => string
  /**
   * Create a brand-new blank NPC (named `name`) and attach it to a custom tab
   * as a new npc-kind section, without changing the current character. Returns
   * the new section id.
   */
  createAttachedNPC: (tabId: string, name: string) => string
  /** Rename a custom section (any kind). */
  renameCustomSection: (tabId: string, sectionId: string, name: string) => void
  /**
   * Remove a custom section. Only the section itself is removed — for an NPC
   * section, the referenced NPC record is left intact and can only be deleted
   * from the NPC list page.
   */
  removeCustomSection: (tabId: string, sectionId: string) => Promise<void>
  /** Add an ability block to a custom section (ability sections only). */
  addCustomAbility: (tabId: string, sectionId: string, ability: AbilityBlock) => void
  /** Update an ability block within a custom section (ability sections only). */
  updateCustomAbility: (tabId: string, sectionId: string, abilityId: string, updated: AbilityBlock) => void
  /** Remove an ability block from a custom section (ability sections only). */
  removeCustomAbility: (tabId: string, sectionId: string, abilityId: string) => void
  /** Reorder an ability within a custom section (ability sections only). */
  reorderCustomAbility: (tabId: string, sectionId: string, fromIndex: number, toIndex: number) => void
  /** Move an ability between custom sections (within the same tab). */
  moveCustomAbility: (tabId: string, fromSectionId: string, toSectionId: string, abilityId: string) => void
  /** Add a new custom resource bar. */
  addCustomResourceBar: (bar: CustomResourceBar) => void
  /** Update an existing custom resource bar by id. */
  updateCustomResourceBar: (id: string, updater: (bar: CustomResourceBar) => CustomResourceBar) => void
  /** Remove a custom resource bar by id. */
  removeCustomResourceBar: (id: string) => void
  /** Spend from a custom resource bar; returns false if insufficient. */
  spendCustomResourceBar: (id: string, barId: string, amount?: number) => boolean
  /** Restore to a custom resource bar (capped at max). */
  restoreCustomResourceBar: (id: string, barId: string, amount?: number) => void
  /**
   * Replace the current character's labels (the Edit Labels modal saves the
   * whole list). Local-only metadata — never exported.
   */
  setLabels: (labels: SheetLabel[]) => void
  /** Replace one character's labels by id (same as {@link setLabels}, targeted). */
  setCharacterLabels: (id: string, labels: SheetLabel[]) => void
  /** Update the view mode of a single ability section (builtin or custom). */
  updateSectionViewMode: (key: 'slottedAbilities' | 'abilityPool', mode: 'grid' | 'list') => void
  /** Update the view mode of a custom-tab section. */
  updateCustomSectionViewMode: (tabId: string, sectionId: string, mode: 'grid' | 'list') => void
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

/**
 * Pending autosave timeouts, keyed by character id.
 *
 * Per-id (not a single module-level timer) so rapid edits to several entities
 * in one tick — the whole point of the GM Screen — each persist their own
 * record instead of the last write cancelling the others' saves.
 */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Cancel a character's pending autosave, if any. */
function clearSaveTimer(id: string) {
  const timer = saveTimers.get(id)
  if (timer) {
    clearTimeout(timer)
    saveTimers.delete(id)
  }
}

/**
 * Flush every pending debounced character write immediately.
 *
 * The GM Screen can drive several sheets in one tick; without this a page
 * unload inside the 500ms debounce window would drop the last edits to every
 * one of them. {@link installCharacterAutosaveFlush} wires it to the unload
 * events, and App calls that once at startup.
 */
export function flushPendingCharacterSaves() {
  const ids = [...saveTimers.keys()]
  saveTimers.clear()
  for (const id of ids) {
    const character = useCharacterStore
      .getState()
      .characters.find((c) => c.id === id)
    if (!character) continue
    try {
      void putCharacter(character)
    } catch {
      // Best-effort during unload; in-memory state is already correct.
    }
  }
}

/** Wire the unload-time flush exactly once. */
let flushInstalled = false
export function installCharacterAutosaveFlush() {
  if (flushInstalled || typeof window === 'undefined') return
  flushInstalled = true
  // `pagehide` also covers bfcache navigations on iOS, where `beforeunload`
  // and even `visibilitychange` can be skipped.
  window.addEventListener('pagehide', flushPendingCharacterSaves)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingCharacterSaves()
  })
}

export const useCharacterStore = create<CharacterStore>()((set, get) => ({
  characters: [],
  currentCharacter: null,
  isLoaded: false,
  loadError: null,
  isSaving: false,
  versionHistory: null,
  isRestoring: false,
  view: 'home',

  loadCharacters: async () => {
    try {
      const characters = await getAllCharacters()
      set({ characters, isLoaded: true, loadError: null })
    } catch (err) {
      // NEVER leave the list pages spinning forever on a storage failure.
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not read your saved sheets from this browser’s storage.'
      console.error('[grimoire] loadCharacters failed:', err)
      set({ characters: [], isLoaded: true, loadError: message })
    }
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

  createNPC: async (name: string) => {
    const base = createDefaultNPC()
    const npc: Character = { ...base, name, id: generateId() }
    set({ isSaving: true })
    await putCharacter(npc)
    set((state) => ({
      characters: [...state.characters, npc],
      currentCharacter: npc,
      isSaving: false,
    }))
  },

  createNpcBase: async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const base = createDefaultNPC()
    const npc: Character = { ...base, name: trimmed, id: generateId() }
    set({ isSaving: true })
    await putCharacter(npc)
    // Deliberately does NOT touch currentCharacter / view: the caller (GM
    // Screen quick-create) stays where it is and attaches an instance.
    set((state) => ({
      characters: [...state.characters, npc],
      isSaving: false,
    }))
    return npc
  },

  selectCharacter: (id: string) => {
    const found = get().characters.find((c) => c.id === id) ?? null
    set({ currentCharacter: found })
  },

  closeCharacter: () => {
    set({ currentCharacter: null, view: 'characters' })
  },

  closeNPC: () => {
    set({ currentCharacter: null, view: 'npcs' })
  },

  setView: (view) => {
    set({ view })
  },

  updateCharacter: (id, updater) => {
    const target = get().characters.find((c) => c.id === id)
    if (!target) return

    const updated = { ...updater(target), updatedAt: new Date().toISOString() }

    set((state) => ({
      currentCharacter:
        state.currentCharacter?.id === id ? updated : state.currentCharacter,
      characters: state.characters.map((c) => (c.id === id ? updated : c)),
    }))

    clearSaveTimer(id)
    saveTimers.set(
      id,
      setTimeout(() => {
        saveTimers.delete(id)
        void get().saveCharacter(id)
      }, AUTOSAVE_DEBOUNCE_MS),
    )
  },

  updateCurrentCharacter: (updater) => {
    const current = get().currentCharacter
    if (!current) return
    get().updateCharacter(current.id, updater)
  },

  deleteCharacter: async (id: string) => {
    clearSaveTimer(id)
    await dbDeleteCharacter(id)
    set((state) => {
      const characters = state.characters.filter((c) => c.id !== id)
      const currentCharacter =
        state.currentCharacter?.id === id ? null : state.currentCharacter
      return { characters, currentCharacter }
    })
  },

  saveCurrentCharacter: async () => {
    const current = get().currentCharacter
    if (!current) return
    await get().saveCharacter(current.id)
  },

  saveCharacter: async (id: string) => {
    clearSaveTimer(id)
    const target = get().characters.find((c) => c.id === id)
    if (!target) return
    set({ isSaving: true })
    await putCharacter(target)
    set({ isSaving: false })
  },

  importCharacterFile: async (text: string) => {
    const bundle = parseImportBundle(text)
    // Fresh id so the imported copy is a distinct character.
    const imported: Character = {
      ...normalizeCharacter(bundle.character),
      id: generateId(),
    }
    set({ isSaving: true })
    await putCharacter(imported)
    // Persist any attached NPCs as their own records so the bundle
    // round-trips through the IndexedDB store.
    for (const npc of bundle.attachedNpcs) {
      await putCharacter(npc)
    }
    // Merge any statuses referenced by the sheet into the compendium.
    await useStatusStore.getState().importStatuses(bundle.attachedStatuses)
    set((state) => ({
      characters: [...state.characters, imported, ...bundle.attachedNpcs],
      currentCharacter: imported,
      isSaving: false,
    }))
  },

  importNPCFile: async (text: string) => {
    const bundle = parseImportBundle(text)
    const imported: Character = {
      ...normalizeCharacter(bundle.character),
      id: generateId(),
    }
    set({ isSaving: true })
    await putCharacter(imported)
    await useStatusStore.getState().importStatuses(bundle.attachedStatuses)
    set((state) => ({
      characters: [...state.characters, imported],
      currentCharacter: imported,
      isSaving: false,
    }))
  },

  updateExistingCharacterFromImportFile: async (
    existing: Character,
    text: string,
  ) => {
    const bundle = parseImportBundle(text)
    const updated = updateExistingCharacterFromImport(existing, bundle.character)
    set({ isSaving: true })
    await putCharacter(updated)
    for (const npc of bundle.attachedNpcs) {
      await putCharacter(npc)
    }
    await useStatusStore.getState().importStatuses(bundle.attachedStatuses)
    set((state) => ({
      currentCharacter:
        state.currentCharacter?.id === existing.id ? updated : state.currentCharacter,
      characters: [
        ...state.characters.map((c) => (c.id === existing.id ? updated : c)),
        ...bundle.attachedNpcs.filter(
          (npc) => !state.characters.some((c) => c.id === npc.id),
        ),
      ],
      isSaving: false,
    }))
  },

  updateExistingNPCFromImportFile: async (
    existing: Character,
    text: string,
  ) => {
    const bundle = parseImportBundle(text)
    const updated = updateExistingCharacterFromImport(existing, bundle.character)
    set({ isSaving: true })
    await putCharacter(updated)
    await useStatusStore.getState().importStatuses(bundle.attachedStatuses)
    set((state) => ({
      currentCharacter:
        state.currentCharacter?.id === existing.id ? updated : state.currentCharacter,
      characters: state.characters.map((c) => (c.id === existing.id ? updated : c)),
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

  setAbilityModifiersActive: (abilityId, active) => {
    const current = get().currentCharacter
    if (!current) return
    get().updateCharacter(current.id, (char) => {
      const next = applyAbilityModifiersActive(char, abilityId, active)
      if (next === char || next.kind === 'npc') return next
      // Switching a Max HP modifier off (or a penalty on) can leave current HP
      // above the new maximum — clamp so the HP bar never exceeds its cap.
      // (NPC HP is a static stat, not a tracked pool, so it is left alone.)
      const maxHP = effectiveCombatStats(next).maxHP
      return next.currentHP > maxHP ? { ...next, currentHP: maxHP } : next
    })
  },

  spendAbilityUse: (id, abilityId) => {
    let spent = false
    get().updateCharacter(id, (char) => {
      const result = applySpendAbilityUse(char, abilityId)
      spent = result.spent
      return result.character
    })
    return spent
  },

  setAbilityUsesRemaining: (id, abilityId, remaining) => {
    get().updateCharacter(id, (char) =>
      applySetAbilityUsesRemaining(char, abilityId, remaining),
    )
  },

  // ---- Live play: damage & healing -------------------------------------------

  takeDamage: (id, amount, opts = {}) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current) {
      return {
        rawDamage: amount, afterArmor: amount, afterResistance: amount,
        tempHPConsumed: 0, hpLost: 0, finalHP: 0,
        causedMortalWound: false, mortalWoundsIncurred: 0, knockedOut: false,
      }
    }

    const { applyArmor = false, resistant = false, ignoreTempHP = false } = opts
    // Effective stats include any switched-on ability modifiers (e.g. +1 VIT
    // raises both Max HP and Armor; a flat Armor modifier stacks on top).
    const stats = effectiveCombatStats(current)
    const maxHP = stats.maxHP
    const armor = stats.armor

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

    get().updateCharacter(id, (char) => ({
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

  takePanelDamage: (id, amount, opts = {}) => {
    const result = get().takeDamage(id, amount, opts)
    if (result.mortalWoundsIncurred <= 0) return result

    // `takeDamage` parked each incurred wound on 'Pending Roll'; roll exactly
    // that many so the track never gains an unresolved slot from this call.
    // `rollMortalWound` fills the oldest pending (or empty) slot first, so a
    // slot the player left pending on their own sheet may be the one named
    // here — which is harmless: slots carry no identity, only a wound name.
    const rolls: MortalWoundRoll[] = []
    for (let i = 0; i < result.mortalWoundsIncurred; i++) {
      const wound = get().rollMortalWound(id)
      if (wound.slotIndex < 0) break
      rolls.push({ roll: wound.roll, name: wound.woundName })
    }
    return rolls.length > 0 ? { ...result, mortalWoundRolls: rolls } : result
  },

  heal: (id, amount) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current) return
    const maxHP = effectiveCombatStats(current).maxHP
    // Check for Circulatory Dysfunction (halves healing, rounded down).
    const hasCirculatory = current.mortalWounds.includes('Circulatory Dysfunction')
    const effective = hasCirculatory ? Math.floor(amount / 2) : amount
    get().updateCharacter(id, (char) => ({
      ...char,
      currentHP: Math.min(maxHP, char.currentHP + effective),
    }))
  },

  setTempHP: (id, amount) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      tempHP: Math.max(char.tempHP, amount),
    }))
  },

  // ---- Live play: resource spend/restore ------------------------------------

  spendAP: (id, amount) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current || current.currentAP < amount) return false
    get().updateCharacter(id, (char) => ({
      ...char,
      currentAP: char.currentAP - amount,
    }))
    return true
  },

  restoreAP: (id, amount) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      currentAP: Math.min(MAX_AP, char.currentAP + amount),
    }))
  },

  resetAP: (id) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      currentAP: MAX_AP,
    }))
  },

  spendEND: (id, amount) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current || current.currentEND < amount) return false
    get().updateCharacter(id, (char) => ({
      ...char,
      currentEND: char.currentEND - amount,
    }))
    return true
  },

  restoreEND: (id, amount) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      currentEND: Math.min(MAX_END, char.currentEND + amount),
    }))
  },

  resetEND: (id) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      currentEND: MAX_END,
    }))
  },

  spendFP: (id, amount) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current || current.currentFP < amount) return false
    get().updateCharacter(id, (char) => ({
      ...char,
      currentFP: char.currentFP - amount,
    }))
    return true
  },

  restoreFP: (id, amount) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      currentFP: Math.min(char.maxFP, char.currentFP + amount),
    }))
  },

  // ---- Live play: recover & end-of-turn -------------------------------------

  recover: (id) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current) return false
    // Check for Damaged Throat (Recover only restores half END).
    const hasDamagedThroat = current.mortalWounds.includes('Damaged Throat')
    const restoredEND = hasDamagedThroat ? Math.floor(MAX_END / 2) : MAX_END
    get().updateCharacter(id, (char) => ({
      ...char,
      currentEND: restoredEND,
      // Refill any custom bars that opt in to refill on Recover.
      customResourceBars: char.customResourceBars.map((bar) =>
        bar.refillsOnRecover ? { ...bar, current: bar.max } : bar,
      ),
    }))
    return true
  },

  regenerateEND: (id) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current) return
    // Damaged Throat: unable to regain END passively.
    if (current.mortalWounds.includes('Damaged Throat')) return
    const recovery = effectiveCombatStats(current).endRecovery
    get().updateCharacter(id, (char) => ({
      ...char,
      currentEND: Math.min(MAX_END, char.currentEND + recovery),
    }))
  },

  convertAPtoEND: (id) => {
    get().updateCharacter(id, (char) => {
      const converted = Math.min(char.currentAP, MAX_END - char.currentEND)
      return {
        ...char,
        currentAP: 0,
        currentEND: char.currentEND + converted,
      }
    })
  },

  endTurn: (id) => {
    let totalGained = 0
    get().updateCharacter(id, (char) => {
      // 1. Convert unspent AP to END (1:1, capped at max END).
      const apToEND = Math.min(char.currentAP, MAX_END - char.currentEND)
      let newEND = char.currentEND + apToEND
      // 2. Apply END Recovery (unless Damaged Throat prevents it).
      let recovery = 0
      if (!char.mortalWounds.includes('Damaged Throat')) {
        recovery = effectiveCombatStats(char).endRecovery
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

  rollDeathSave: (id) => {
    const current = get().characters.find((c) => c.id === id)
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

    get().updateCharacter(id, (char) => ({
      ...char,
      deathSaves: { successes, failures },
      ...hpUpdate,
    }))

    return { roll, successes, failures, doubled, revived, died } satisfies DeathSaveResult
  },

  rollMortalWound: (id) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current) {
      return { roll: 0, woundName: '', woundDescription: '', slotIndex: -1, knockedOut: false }
    }

    // Table resolution is shared with the GM Screen's instance rolls — see
    // lib/mortalWounds.ts.
    const wound = rollOnMortalWoundTable()

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

    get().updateCharacter(id, (char) => ({
      ...char,
      mortalWounds: newMortalWounds,
    }))

    return {
      roll: wound.roll,
      woundName: wound.name,
      woundDescription: wound.description,
      slotIndex,
      knockedOut,
    } satisfies MortalWoundResult
  },

  clearMortalWound: (id, index) => {
    get().updateCharacter(id, (char) => {
      const wounds = [...char.mortalWounds]
      if (index >= 0 && index < wounds.length) {
        wounds[index] = null
      }
      return { ...char, mortalWounds: wounds }
    })
  },

  clearMortalWounds: (id) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      // Mapped rather than replaced with a literal two-slot array: the slot
      // count is the sheet's business, and clearing must not change it.
      mortalWounds: char.mortalWounds.map(() => null),
    }))
  },

  // ---- Live play: full restore & reset ---------------------------------------

  fullRestore: (id) => {
    get().updateCharacter(id, (char) => {
      const maxHP = effectiveCombatStats(char).maxHP
      return restoreAllAbilityUses({
        ...char,
        currentHP: maxHP,
        tempHP: 0,
        currentEND: MAX_END,
        currentAP: MAX_AP,
        currentFP: char.maxFP,
        mortalWounds: [null, null],
        deathSaves: { successes: 0, failures: 0 },
        customResourceBars: char.customResourceBars.map((bar) => ({ ...bar, current: bar.max })),
      })
    })
  },

  resetHP: (id) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      currentHP: effectiveCombatStats(char).maxHP,
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
    get().updateCurrentCharacter((char) => {
      const customTabs = { ...char.viewModes.customTabs }
      delete customTabs[tabId]
      return {
        ...char,
        customTabs: char.customTabs.filter((t) => t.id !== tabId),
        viewModes: { ...char.viewModes, customTabs },
      }
    })
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
                {
                  kind: 'ability' as const,
                  id,
                  name: name ?? 'New Section',
                  abilities: [],
                },
              ],
            }
          : t,
      ),
      viewModes: {
        ...char.viewModes,
        customTabs: {
          ...char.viewModes.customTabs,
          [tabId]: {
            ...(char.viewModes.customTabs[tabId] ?? {}),
            [id]: 'grid',
          },
        },
      },
    }))
    return id
  },

  addCustomNPCSection: (tabId, name) => {
    const sectionId = generateId()
    const npcBase = createDefaultNPC()
    const npc: Character = { ...npcBase, id: generateId() }
    const sectionName = name ?? npc.name
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: [
                ...t.sections,
                {
                  kind: 'npc' as const,
                  id: sectionId,
                  name: sectionName,
                  npcId: npc.id,
                },
              ],
            }
          : t,
      ),
    }))
    // Persist the blank NPC as its own record so it can be edited and exported.
    set({ isSaving: true })
    void putCharacter(npc)
      .then(() => {
        set((state) => ({
          characters: [...state.characters, npc],
          isSaving: false,
        }))
      })
      .catch(() => {
        set({ isSaving: false })
      })
    return sectionId
  },

  addCustomTextSection: (tabId, name) => {
    const id = generateId()
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: [
                ...t.sections,
                {
                  kind: 'text' as const,
                  id,
                  name: name ?? 'New Section',
                  content: '',
                },
              ],
            }
          : t,
      ),
    }))
    return id
  },

  updateCustomTextSectionContent: (tabId, sectionId, content) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: t.sections.map((s) => {
                if (s.id !== sectionId) return s
                if (s.kind !== 'text') return s
                return { ...s, content }
              }),
            }
          : t,
      ),
    }))
  },

  addCustomNPCReference: (tabId, npcId) => {
    const npc = get().characters.find((c) => c.id === npcId)
    // Fail soft — an empty id signals "not attached" to the caller.
    if (!npc) return ''
    const sectionId = generateId()
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: [
                ...t.sections,
                {
                  kind: 'npc' as const,
                  id: sectionId,
                  name: npc.name,
                  npcId,
                },
              ],
            }
          : t,
      ),
    }))
    return sectionId
  },

  createAttachedNPC: (tabId, name) => {
    const sectionId = generateId()
    const npcBase = createDefaultNPC()
    const npc: Character = {
      ...npcBase,
      id: generateId(),
      name: name.trim() || npcBase.name,
    }
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: [
                ...t.sections,
                {
                  kind: 'npc' as const,
                  id: sectionId,
                  name: npc.name,
                  npcId: npc.id,
                },
              ],
            }
          : t,
      ),
    }))
    set({ isSaving: true })
    void putCharacter(npc)
      .then(() => {
        set((state) => ({
          characters: [...state.characters, npc],
          isSaving: false,
        }))
      })
      .catch(() => {
        set({ isSaving: false })
      })
    return sectionId
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

  removeCustomSection: async (tabId, sectionId) => {
    get().updateCurrentCharacter((char) => {
      const tabSections = { ...(char.viewModes.customTabs[tabId] ?? {}) }
      delete tabSections[sectionId]
      return {
        ...char,
        customTabs: char.customTabs.map((t) =>
          t.id === tabId
            ? { ...t, sections: t.sections.filter((s) => s.id !== sectionId) }
            : t,
        ),
        viewModes: {
          ...char.viewModes,
          customTabs: { ...char.viewModes.customTabs, [tabId]: tabSections },
        },
      }
    })
  },

  addCustomAbility: (tabId, sectionId, ability) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customTabs: char.customTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              sections: t.sections.map((s) => {
                if (s.id !== sectionId) return s
                if (s.kind !== 'ability') return s
                return { ...s, abilities: [...s.abilities, ability] }
              }),
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
              sections: t.sections.map((s) => {
                if (s.id !== sectionId) return s
                if (s.kind !== 'ability') return s
                return {
                  ...s,
                  abilities: s.abilities.map((a) =>
                    a.id === abilityId ? updated : a,
                  ),
                }
              }),
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
              sections: t.sections.map((s) => {
                if (s.id !== sectionId) return s
                if (s.kind !== 'ability') return s
                return {
                  ...s,
                  abilities: s.abilities.filter((a) => a.id !== abilityId),
                }
              }),
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
            if (s.kind !== 'ability') return s
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
              if (s.kind !== 'ability') return s
              return { ...s, abilities: s.abilities.filter((a) => a.id !== abilityId) }
            }
            if (s.id === toSectionId) {
              if (s.kind !== 'ability') return s
              const fromSection = t.sections.find(
                (sec) => sec.id === fromSectionId,
              )
              if (!fromSection || fromSection.kind !== 'ability') return s
              const moved = fromSection.abilities.find((a) => a.id === abilityId)
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

  updateSectionViewMode: (key, mode) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      viewModes: {
        ...char.viewModes,
        [key]: mode,
      },
    }))
  },

  updateCustomSectionViewMode: (tabId, sectionId, mode) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      viewModes: {
        ...char.viewModes,
        customTabs: {
          ...char.viewModes.customTabs,
          [tabId]: {
            ...(char.viewModes.customTabs[tabId] ?? {}),
            [sectionId]: mode,
          },
        },
      },
    }))
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
    // Snapshot uses the chosen version. Pass the full character list so any
    // NPCs attached via custom-tab NPC sections are exported alongside the
    // parent character.
    const result = await exportCharacter(
      {
        ...current,
        version: targetVersion,
      },
      targetVersion,
      get().characters,
      useStatusStore.getState().statuses,
    )
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

  // ---- Custom resource bars ----------------------------------------------------

  addCustomResourceBar: (bar) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customResourceBars: [...char.customResourceBars, bar],
    }))
  },

  updateCustomResourceBar: (id, updater) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customResourceBars: char.customResourceBars.map((bar) =>
        bar.id === id ? updater(bar) : bar,
      ),
    }))
  },

  removeCustomResourceBar: (id) => {
    get().updateCurrentCharacter((char) => ({
      ...char,
      customResourceBars: char.customResourceBars.filter((bar) => bar.id !== id),
    }))
  },

  spendCustomResourceBar: (id, barId, amount = 1) => {
    const current = get().characters.find((c) => c.id === id)
    if (!current) return false
    const bar = current.customResourceBars.find((b) => b.id === barId)
    if (!bar || bar.current < amount) return false
    get().updateCharacter(id, (char) => ({
      ...char,
      customResourceBars: char.customResourceBars.map((b) =>
        b.id === barId ? { ...b, current: b.current - amount } : b,
      ),
    }))
    return true
  },

  restoreCustomResourceBar: (id, barId, amount = 1) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      customResourceBars: char.customResourceBars.map((bar) =>
        bar.id === barId ? { ...bar, current: Math.min(bar.max, bar.current + amount) } : bar,
      ),
    }))
  },

  // ---- Labels ------------------------------------------------------------------

  setLabels: (labels) => {
    const current = get().currentCharacter
    if (!current) return
    get().setCharacterLabels(current.id, labels)
  },

  setCharacterLabels: (id, labels) => {
    get().updateCharacter(id, (char) => ({
      ...char,
      labels,
    }))
  },
}))

void useCharacterStore.getState().loadCharacters()