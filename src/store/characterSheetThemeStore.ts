/**
 * Zustand store for whether a player character sheet hides its own
 * customization and follows the app theme.
 *
 * A character sheet normally carries whatever the player built in the
 * Customization panel — palette, card and page backgrounds, fonts, background
 * image, custom CSS. With `matchAppTheme` on, the sheet drops all of it and
 * renders exactly like an NPC sheet: the active app theme's palette, the app
 * chrome's fonts, and no page background image. The Customize button is
 * hidden with it, since there is nothing left to customize against.
 *
 * NOTE: purely cosmetic and read-only. It changes what the SHEET PAGE renders
 * and never the character record, so turning it back off restores every custom
 * color and font exactly as it was (and exports, versions, and backups are
 * unaffected either way).
 *
 * Like the app theme it is an app-level UI preference, so it lives in
 * localStorage (synchronously available before first paint) rather than
 * IndexedDB. Default is OFF — per-sheet customization is the historical
 * behaviour, and a new persistent UI switch starts in the least intrusive
 * state.
 */

import { create } from 'zustand'

export const CHARACTER_SHEET_MATCH_APP_THEME_STORAGE_KEY =
  'grimoire:character-sheet-match-app-theme'

/** Read the stored flag — anything but an explicit '1' means off. */
export function loadCharacterSheetMatchAppTheme(): boolean {
  try {
    return (
      window.localStorage.getItem(
        CHARACTER_SHEET_MATCH_APP_THEME_STORAGE_KEY,
      ) === '1'
    )
  } catch {
    // localStorage unavailable (private browsing, disabled) — use default.
    return false
  }
}

interface CharacterSheetThemeStoreState {
  /**
   * When true, a player character sheet follows the app theme instead of the
   * sheet's own palette, backgrounds, fonts, and custom CSS. NPC sheets do
   * this unconditionally; this is what lets a character sheet match them.
   */
  matchAppTheme: boolean
  setMatchAppTheme: (enabled: boolean) => void
}

export const useCharacterSheetThemeStore =
  create<CharacterSheetThemeStoreState>((set) => ({
    matchAppTheme: loadCharacterSheetMatchAppTheme(),
    setMatchAppTheme: (matchAppTheme) => {
      try {
        window.localStorage.setItem(
          CHARACTER_SHEET_MATCH_APP_THEME_STORAGE_KEY,
          matchAppTheme ? '1' : '0',
        )
      } catch {
        // Storage unavailable — the choice still applies for this session.
      }
      set({ matchAppTheme })
    },
  }))
