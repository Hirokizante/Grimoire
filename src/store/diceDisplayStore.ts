/**
 * Zustand store for how inline dice notation is labelled — the notation as
 * written, or the minimum–maximum range it can roll (`1d6+3` → `4-9`).
 *
 * NOTE: purely a display preference, like the app theme: it lives in
 * localStorage (synchronously available before first paint) rather than
 * IndexedDB, and it changes only the text a badge shows. What a click rolls is
 * always the original notation — see `DiceHighlighter`.
 *
 * Default is OFF — the notation as written is the historical behaviour, and a
 * new persistent UI switch starts in the least intrusive state.
 */

import { create } from 'zustand'

export const DICE_RANGES_STORAGE_KEY = 'grimoire:dice-ranges'

/** Read the stored flag — anything but an explicit '1' means off. */
export function loadDiceRanges(): boolean {
  try {
    return window.localStorage.getItem(DICE_RANGES_STORAGE_KEY) === '1'
  } catch {
    // localStorage unavailable (private browsing, disabled) — use default.
    return false
  }
}

interface DiceDisplayStoreState {
  /**
   * When true, every highlighted notation badge shows the range it can roll
   * (with the character's current stats substituted) instead of the notation.
   */
  showRanges: boolean
  setShowRanges: (enabled: boolean) => void
}

export const useDiceDisplayStore = create<DiceDisplayStoreState>((set) => ({
  showRanges: loadDiceRanges(),
  setShowRanges: (showRanges) => {
    try {
      window.localStorage.setItem(DICE_RANGES_STORAGE_KEY, showRanges ? '1' : '0')
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
    set({ showRanges })
  },
}))
