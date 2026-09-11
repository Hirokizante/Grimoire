/**
 * Zustand store for how a GM Screen panel themes the sheet body it holds.
 *
 * A player panel normally carries the character's own customization — palette,
 * card background, fonts — inside its expanded body, so several sheets on one
 * screen each read differently. With `matchAppTheme` on, that body drops all of
 * it and renders exactly like an NPC panel: the active app theme's palette and
 * nothing per-sheet. The panel chrome already follows the app theme; this
 * extends the same voice to the sheet content the GM is reading at the table.
 *
 * NOTE: purely cosmetic and read-only. It changes what a PANEL renders and
 * never the character record, so the character's own sheet page and its
 * Customization panel keep every custom color either way (and exports,
 * versions, and backups are unaffected).
 *
 * Like the app theme it is an app-level UI preference, so it lives in
 * localStorage (synchronously available before first paint) rather than
 * IndexedDB. Default is OFF — per-sheet customization on a panel is the
 * historical behaviour, and a new persistent UI switch starts in the least
 * intrusive state.
 */

import { create } from 'zustand'

export const GM_PANEL_MATCH_APP_THEME_STORAGE_KEY =
  'grimoire:gm-panel-match-app-theme'

/** Read the stored flag — anything but an explicit '1' means off. */
export function loadGmPanelMatchAppTheme(): boolean {
  try {
    return (
      window.localStorage.getItem(GM_PANEL_MATCH_APP_THEME_STORAGE_KEY) === '1'
    )
  } catch {
    // localStorage unavailable (private browsing, disabled) — use default.
    return false
  }
}

interface GmPanelThemeStoreState {
  /**
   * When true, an expanded GM panel's sheet body follows the app theme instead
   * of the sheet's own palette, background, and fonts. NPC panels do this
   * unconditionally; this is what lets a player panel match them.
   */
  matchAppTheme: boolean
  setMatchAppTheme: (enabled: boolean) => void
}

export const useGmPanelThemeStore = create<GmPanelThemeStoreState>((set) => ({
  matchAppTheme: loadGmPanelMatchAppTheme(),
  setMatchAppTheme: (matchAppTheme) => {
    try {
      window.localStorage.setItem(
        GM_PANEL_MATCH_APP_THEME_STORAGE_KEY,
        matchAppTheme ? '1' : '0',
      )
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
    set({ matchAppTheme })
  },
}))
