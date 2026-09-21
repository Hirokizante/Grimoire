/**
 * Zustand store for the GM Screen's layout — the **view mode** the screen
 * renders in.
 *
 * - **Grid** — the classic surface: draggable panels flowing down two columns.
 * - **Immersive list** — a character-list drawer on the left for quick
 *   reference and selection, and one encounter-ready, read-only sheet at a
 *   time in the main area.
 *
 * Like the other app-level UI preferences (app theme, panel theming, UI
 * style), it lives in localStorage rather than IndexedDB — synchronously
 * available before first paint and never part of a backup, because it changes
 * how a screen *displays*, not what it *contains*. A screen record is
 * therefore untouched: switching view modes is per-browser, per-device.
 *
 * Default is **grid** — the historical behaviour, and the least intrusive
 * state for a new persistent switch.
 */

import { create } from 'zustand'

/** Every GM Screen layout. */
export const GM_SCREEN_VIEW_MODES = ['grid', 'immersive'] as const

/** How the GM Screen lays its panels out. */
export type GmScreenViewMode = (typeof GM_SCREEN_VIEW_MODES)[number]

export const GM_SCREEN_VIEW_STORAGE_KEY = 'grimoire:gm-screen-view'

/** Type guard: is `value` one of the supported view modes? */
export function isGmScreenViewMode(value: string | null): value is GmScreenViewMode {
  return (GM_SCREEN_VIEW_MODES as readonly string[]).includes(value ?? '')
}

/** Read the stored view mode, defaulting to 'grid' on anything unexpected. */
export function loadGmScreenViewMode(): GmScreenViewMode {
  try {
    const stored = window.localStorage.getItem(GM_SCREEN_VIEW_STORAGE_KEY)
    return isGmScreenViewMode(stored) ? stored : 'grid'
  } catch {
    // localStorage unavailable (private browsing, disabled) — use default.
    return 'grid'
  }
}

interface GmScreenViewStoreState {
  /** Which layout the GM Screen page renders in. */
  viewMode: GmScreenViewMode
  setViewMode: (mode: GmScreenViewMode) => void
}

export const useGmScreenViewStore = create<GmScreenViewStoreState>((set) => ({
  viewMode: loadGmScreenViewMode(),
  setViewMode: (viewMode) => {
    try {
      window.localStorage.setItem(GM_SCREEN_VIEW_STORAGE_KEY, viewMode)
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
    set({ viewMode })
  },
}))
