/**
 * Zustand store for Grimoire.
 *
 * Owns the in-memory list of characters plus the currently-selected sheet,
 * mirroring all mutations to the IndexedDB persistence layer (see db.ts).
 * Edits made through {@link updateCurrentCharacter} are debounced-autosaved;
 * an explicit {@link saveCurrentCharacter} is also available for manual saves.
 */

import { create } from 'zustand'

import { createDefaultCharacter, generateId } from '@/constants/gameData'
import {
  deleteCharacter as dbDeleteCharacter,
  getAllCharacters,
  putCharacter,
} from '@/lib/db'
import type { Character } from '@/types'

/** Debounce window for autosave (ms). */
const AUTOSAVE_DEBOUNCE_MS = 500

export interface CharacterStoreState {
  /** All characters loaded from IndexedDB. */
  characters: Character[]
  /** The character currently being viewed / edited, or null. */
  currentCharacter: Character | null
  /** Whether the initial load from IndexedDB has completed. */
  isLoaded: boolean
  /** True while a save to IndexedDB is pending / in flight. */
  isSaving: boolean
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
  /** Apply an updater to the current character, autosave, and sync the list. */
  updateCurrentCharacter: (updater: (char: Character) => Character) => void
  /** Delete a character from DB and the store, clearing current if needed. */
  deleteCharacter: (id: string) => Promise<void>
  /** Explicitly persist the current character to IndexedDB. */
  saveCurrentCharacter: () => Promise<void>
}

export type CharacterStore = CharacterStoreState & CharacterStoreActions

/** Handle for the pending autosave timeout, if any. */
let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useCharacterStore = create<CharacterStore>()((set, get) => ({
  characters: [],
  currentCharacter: null,
  isLoaded: false,
  isSaving: false,

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
    set({ currentCharacter: null })
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
}))

void useCharacterStore.getState().loadCharacters()