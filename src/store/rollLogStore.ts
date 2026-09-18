/**
 * RollLogStore — Zustand store for the persistent dice roll log.
 *
 * Holds every roll the player has made (across all characters) in memory,
 * persists each new entry to IndexedDB, and exposes a filtered view keyed
 * to the active character.
 *
 * The roll log is:
 *   - Permanent: never auto-deleted with character data
 *   - Separate from the character sheet export/import flow
 *   - Filterable by character, deletable per-entry or per-character
 */

import { create } from 'zustand'

import {
  deleteRollLogEntry as dbDeleteRollLogEntry,
  clearRollLogForCharacter as dbClearRollLogForCharacter,
  getAllRollLogEntries,
  putRollLogEntry,
} from '@/lib/db'
import { generateId } from '@/constants/gameData'
import type { RollResult } from '@/lib/diceRoller'
import type { RollLogEntry, NewRollLogEntry } from '@/types'

/** How many entries to keep in the rolling "recent" window in the drawer. */
const DRAWER_RECENT_LIMIT = 50

export interface RollLogState {
  /** All roll-log entries loaded from IndexedDB, newest first. */
  entries: RollLogEntry[]
  /** Whether the roll-log drawer is currently visible. */
  drawerOpen: boolean
  /** Character-id filter; null means "all characters". */
  filterCharacterId: string | null
  /** Whether entries have been loaded from IndexedDB at startup. */
  isLoaded: boolean
}

export interface RollLogActions {
  /** Load all roll-log entries from IndexedDB (call once at startup). */
  loadRollLog: () => Promise<void>
  /**
   * Create and persist a new roll-log entry. Returns the created entry.
   * Automatically tags the entry with our own rolled timestamps/crit flags.
   */
  logRoll: (input: NewRollLogEntry) => RollLogEntry
  /**
   * Replace one entry's result in place and persist it — used when
   * Advantage/Disadvantage is applied to a roll after it was logged (the base
   * roll happens first, so the entry already exists).
   */
  updateEntryResult: (id: string, result: RollResult) => void
  /** Toggle the roll-log drawer visibility. */
  toggleDrawer: () => void
  /** Open the roll-log drawer. */
  openDrawer: () => void
  /** Close the roll-log drawer. */
  closeDrawer: () => void
  /** Set the character filter (null = all characters). */
  setFilter: (characterId: string | null) => void
  /** Delete a single roll-log entry by id. */
  deleteEntry: (id: string) => Promise<void>
  /** Delete all roll-log entries for a specific character. */
  clearForCharacter: (characterId: string) => Promise<void>
  /** Delete every roll-log entry (global clear). */
  clearAll: () => Promise<void>
  /** Entries filtered to the current filter. */
  filteredEntries: () => RollLogEntry[]
  /** Recent entries for the drawer (respecting the filter). */
  recentEntries: () => RollLogEntry[]
}

export type RollLogStore = RollLogState & RollLogActions

/**
 * The natural-20 / natural-1 tags for a result: the primary (first) dice term's
 * sides decide what "natural" means, matching how the modal badges it.
 */
function critFlags(result: RollResult): {
  isNaturalTwenty: boolean
  isNaturalOne: boolean
} {
  const diceTerms = result.terms.filter((t) => t.term.type === 'dice')
  const allDiceRolls = diceTerms.flatMap((t) => t.rolls ?? [])
  const sides =
    diceTerms.length > 0 && diceTerms[0].term.type === 'dice'
      ? diceTerms[0].term.sides
      : 20
  return {
    isNaturalTwenty: sides === 20 && allDiceRolls.some((r) => r === 20),
    isNaturalOne: sides === 20 && allDiceRolls.some((r) => r === 1),
  }
}

export const useRollLogStore = create<RollLogStore>()((set, get) => ({
  entries: [],
  drawerOpen: false,
  filterCharacterId: null,
  isLoaded: false,

  loadRollLog: async () => {
    try {
      const entries = await getAllRollLogEntries()
      set({ entries, isLoaded: true })
    } catch {
      // If IndexedDB is unavailable (e.g. SSR/test), fall back to empty.
      set({ entries: [], isLoaded: true })
    }
  },

  logRoll: (input) => {
    const entry: RollLogEntry = {
      id: generateId(),
      notation: input.notation,
      characterId: input.characterId,
      characterName: input.characterName,
      source: input.source,
      result: input.result,
      rolledAt: new Date().toISOString(),
      ...critFlags(input.result),
    }

    set((state) => ({
      entries: [entry, ...state.entries],
    }))

    void putRollLogEntry(entry)

    return entry
  },

  updateEntryResult: (id, result) => {
    const entry = get().entries.find((e) => e.id === id)
    if (!entry) return
    const updated: RollLogEntry = { ...entry, result }
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? updated : e)),
    }))
    void putRollLogEntry(updated)
  },

  toggleDrawer: () => {
    set((state) => ({ drawerOpen: !state.drawerOpen }))
  },

  openDrawer: () => {
    set({ drawerOpen: true })
  },

  closeDrawer: () => {
    set({ drawerOpen: false })
  },

  setFilter: (characterId) => {
    set({ filterCharacterId: characterId })
  },

  deleteEntry: async (id) => {
    await dbDeleteRollLogEntry(id)
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }))
  },

  clearForCharacter: async (characterId) => {
    await dbClearRollLogForCharacter(characterId)
    set((state) => ({
      entries: state.entries.filter((e) => e.characterId !== characterId),
    }))
  },

  clearAll: async () => {
    const entries = get().entries
    for (const e of entries) {
      await dbDeleteRollLogEntry(e.id)
    }
    set({ entries: [] })
  },

  filteredEntries: () => {
    const { entries, filterCharacterId } = get()
    if (!filterCharacterId) return entries
    return entries.filter((e) => e.characterId === filterCharacterId)
  },

  recentEntries: () => {
    return get().filteredEntries().slice(0, DRAWER_RECENT_LIMIT)
  },
}))
