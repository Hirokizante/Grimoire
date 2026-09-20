/**
 * Zustand store for the app-level UI style — the shape and motion language of
 * the whole interface, independent of its colors.
 *
 * NOTE: This is separate from the app color themes (appThemeStore) and from
 * per-sheet customization (SheetColors + CustomizationPanel): a style changes
 * corners, typography, and animations, not palettes. The two combine freely —
 * "Terminal" on top of Parchment is a valid look.
 *
 * Persistence: a pure UI preference, so it lives in localStorage
 * (synchronously available before first paint — no async IndexedDB gap). It is
 * applied as a `data-ui-style` attribute on <html>, which the override
 * stylesheet (terminal-ui.css) keys off.
 */

import { create } from 'zustand'

/** Every UI style. 'default' is the original look; 'terminal' is the
 *  retrofuturistic reskin (hard edges, monospace chrome, CRT motion). Values
 *  double as the `data-ui-style` attribute values and the CSS selector keys
 *  in terminal-ui.css. */
export const UI_STYLES = ['default', 'terminal'] as const

/** UI styles: Default (the original look) and Terminal. */
export type UiStyle = (typeof UI_STYLES)[number]

export const UI_STYLE_STORAGE_KEY = 'grimoire:ui-style'

/** Type guard: is `value` one of the supported UI style ids? */
export function isUiStyle(value: string | null): value is UiStyle {
  return (UI_STYLES as readonly string[]).includes(value ?? '')
}

/** Read the stored style, defaulting to 'default' on anything unexpected. */
export function loadUiStyle(): UiStyle {
  try {
    const stored = window.localStorage.getItem(UI_STYLE_STORAGE_KEY)
    return isUiStyle(stored) ? stored : 'default'
  } catch {
    // localStorage unavailable (private browsing, disabled) — use default.
    return 'default'
  }
}

/** Apply the style to the document root for CSS override selection. */
function applyUiStyle(style: UiStyle): void {
  document.documentElement.dataset.uiStyle = style
}

interface UiStyleStoreState {
  style: UiStyle
  setStyle: (style: UiStyle) => void
}

export const useUiStyleStore = create<UiStyleStoreState>((set) => ({
  style: loadUiStyle(),
  setStyle: (style) => {
    applyUiStyle(style)
    try {
      window.localStorage.setItem(UI_STYLE_STORAGE_KEY, style)
    } catch {
      // Storage unavailable — the style still applies for this session.
    }
    set({ style })
  },
}))

// Apply the stored style at module load so the correct look is active before
// the first paint (no flash of the default style).
applyUiStyle(useUiStyleStore.getState().style)
