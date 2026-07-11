/**
 * DiceRollStore — a small Zustand store for managing the dice roll overlay
 * and result display.
 *
 * Components call `roll(notation, character)` to trigger a roll. The store
 * sets the overlay to "rolling" (showing the animation), then after a brief
 * delay sets the result for display. This keeps all dice-roll UI state in
 * one place rather than threading it through props.
 */

import { create } from 'zustand'

import { parseDiceNotation } from '@/lib/diceParser'
import { evaluateExpression, type RollResult } from '@/lib/diceRoller'
import type { Character } from '@/types'

/** Animation duration for the dice roll overlay (ms). */
const ROLL_ANIMATION_MS = 900

export interface DiceRollState {
  /** Whether the overlay is currently visible. */
  isVisible: boolean
  /** Whether the dice are currently "rolling" (animating). */
  isRolling: boolean
  /** The result of the last roll, shown after animation completes. */
  result: RollResult | null
  /** The notation that was rolled. */
  notation: string
}

export interface DiceRollActions {
  /**
   * Roll a dice notation string using the given character's stats.
   * Triggers the animation overlay, then shows the result.
   */
  roll: (notation: string, character: Character) => void
  /** Dismiss the overlay and clear the result. */
  dismiss: () => void
}

export type DiceRollStore = DiceRollState & DiceRollActions

export const useDiceRollStore = create<DiceRollStore>()((set) => ({
  isVisible: false,
  isRolling: false,
  result: null,
  notation: '',

  roll: (notation, character) => {
    // Parse + evaluate immediately (the result is computed in sync).
    const expr = parseDiceNotation(notation)
    const result = evaluateExpression(expr, character)

    // Show the rolling animation first.
    set({ isVisible: true, isRolling: true, result: null, notation })

    // After the animation duration, reveal the result.
    setTimeout(() => {
      set({ isRolling: false, result })
    }, ROLL_ANIMATION_MS)
  },

  dismiss: () => {
    set({ isVisible: false, isRolling: false, result: null, notation: '' })
  },
}))
