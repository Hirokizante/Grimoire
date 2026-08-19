/**
 * Zustand store for the home page background animation — which ambient
 * effect plays behind the GRIMOIRE title and nav buttons.
 *
 * NOTE: This is an app-level UI preference, like the app theme — it lives in
 * localStorage (synchronously available before first paint) rather than
 * IndexedDB. Unlike the theme it needs no document attribute: HomePage reads
 * the store directly when choosing what to render.
 */

import { create } from 'zustand'

/** Every home page background animation. 'arcane' is the original glow +
 *  floating dust particles; 'terminal' is the scrolling boot-sequence text. */
export const HOME_ANIMATIONS = ['arcane', 'terminal'] as const

/** Home page animations: Arcane Glow (default), Terminal Boot. */
export type HomeAnimation = (typeof HOME_ANIMATIONS)[number]

export const HOME_ANIMATION_STORAGE_KEY = 'grimoire:home-animation'
export const HOME_ANIMATION_ENABLED_STORAGE_KEY =
  'grimoire:home-animation-enabled'

/** Type guard: is `value` one of the supported home animation ids? */
export function isHomeAnimation(value: string | null): value is HomeAnimation {
  return (HOME_ANIMATIONS as readonly string[]).includes(value ?? '')
}

/** Read the stored animation, defaulting to 'arcane' on anything unexpected. */
export function loadHomeAnimation(): HomeAnimation {
  try {
    const stored = window.localStorage.getItem(HOME_ANIMATION_STORAGE_KEY)
    return isHomeAnimation(stored) ? stored : 'arcane'
  } catch {
    // localStorage unavailable (private browsing, disabled) — use default.
    return 'arcane'
  }
}

/** Read the stored enabled flag — anything but an explicit '0' means on. */
export function loadHomeAnimationEnabled(): boolean {
  try {
    return (
      window.localStorage.getItem(HOME_ANIMATION_ENABLED_STORAGE_KEY) !== '0'
    )
  } catch {
    return true
  }
}

interface HomeAnimationStoreState {
  animation: HomeAnimation
  /** Master switch — when false the home page renders no background effect. */
  enabled: boolean
  setAnimation: (animation: HomeAnimation) => void
  setEnabled: (enabled: boolean) => void
}

export const useHomeAnimationStore = create<HomeAnimationStoreState>(
  (set) => ({
    animation: loadHomeAnimation(),
    enabled: loadHomeAnimationEnabled(),
    setAnimation: (animation) => {
      try {
        window.localStorage.setItem(HOME_ANIMATION_STORAGE_KEY, animation)
      } catch {
        // Storage unavailable — the choice still applies for this session.
      }
      set({ animation })
    },
    setEnabled: (enabled) => {
      try {
        window.localStorage.setItem(
          HOME_ANIMATION_ENABLED_STORAGE_KEY,
          enabled ? '1' : '0',
        )
      } catch {
        // Storage unavailable — the choice still applies for this session.
      }
      set({ enabled })
    },
  }),
)
