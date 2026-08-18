/**
 * Zustand store for the app-level color theme — the app chrome around the
 * character sheet (header, list pages, modals, dice UI, …).
 *
 * NOTE: This is separate from per-sheet color themes (SheetColors +
 * CustomizationPanel), which live on each character and only affect the
 * sheet itself.
 *
 * Persistence: the theme is a pure UI preference, so it lives in
 * localStorage (synchronously available before first paint — no async
 * IndexedDB gap). It is applied as a `data-app-theme` attribute on <html>,
 * which the palette overrides in index.css key off.
 */

import { create } from 'zustand'

/** Every app chrome theme. Values double as the `data-app-theme` attribute
 *  values and the CSS selector keys in index.css. */
export const APP_THEMES = [
  'midnight',
  'parchment',
  'mikami',
  'pitch-black',
] as const

/** App chrome themes: Midnight (default), Parchment, Mikami (Nord), Pitch Black. */
export type AppTheme = (typeof APP_THEMES)[number]

export const THEME_STORAGE_KEY = 'grimoire:app-theme'

/** Type guard: is `value` one of the supported app theme ids? */
export function isAppTheme(value: string | null): value is AppTheme {
  return (APP_THEMES as readonly string[]).includes(value ?? '')
}

/** Read the stored theme, defaulting to 'midnight' on anything unexpected. */
export function loadAppTheme(): AppTheme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isAppTheme(stored) ? stored : 'midnight'
  } catch {
    // localStorage unavailable (private browsing, disabled) — use default.
    return 'midnight'
  }
}

/** Apply the theme to the document root for CSS palette selection. */
function applyAppTheme(theme: AppTheme): void {
  document.documentElement.dataset.appTheme = theme
}

interface AppThemeStoreState {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

export const useAppThemeStore = create<AppThemeStoreState>((set) => ({
  theme: loadAppTheme(),
  setTheme: (theme) => {
    applyAppTheme(theme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage unavailable — the theme still applies for this session.
    }
    set({ theme })
  },
}))

// Apply the stored theme at module load so the correct palette is active
// before the first paint (no flash of the default theme).
applyAppTheme(useAppThemeStore.getState().theme)
