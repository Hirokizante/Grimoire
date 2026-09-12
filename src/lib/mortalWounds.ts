/**
 * Mortal Wound rolls — one implementation for every surface that rolls them.
 *
 * The SRD's rule is the same whoever is hit (Divergence SRD "Hit Points and
 * Mortal Wounds"): at 0 HP roll a D20 on the twenty-entry Mortal Wounds table,
 * and the HP is reset to its maximum with the excess damage spilling over. A
 * player rolls it from the sheet's Mortal Wound card (`MortalWoundRoller` →
 * `characterStore.rollMortalWound`); an NPC instance rolls it automatically
 * inside `gmScreenStore.damageInstance`. Both resolve the table through here so
 * a wound's name and description can never disagree between the two.
 */

import { MORTAL_WOUNDS } from '@/constants/gameData'
import { rollDie } from '@/lib/dice'
import type { MortalWound } from '@/types'

/** A Mortal Wound together with the D20 roll that produced it. */
export interface ResolvedMortalWound {
  /** The D20 roll (1–20). */
  roll: number
  /** Wound name from the table. */
  name: string
  /** Game-effect description of the wound. */
  description: string
}

/**
 * Roll a D20 on the Mortal Wounds table.
 *
 * A roll with no entry falls back to the table's first wound — the table covers
 * every face of a D20, so this only guards a table that was edited short.
 */
export function rollOnMortalWoundTable(): ResolvedMortalWound {
  const roll = rollDie(20)
  const wound = MORTAL_WOUNDS.find((w) => w.id === roll) ?? MORTAL_WOUNDS[0]
  return { roll, name: wound.name, description: wound.description }
}

/** The table entry for a wound name, or null when the table no longer has it. */
export function mortalWoundByName(name: string): MortalWound | null {
  return MORTAL_WOUNDS.find((w) => w.name === name) ?? null
}

/** The table entry a D20 roll produces, or null when the roll is off-table. */
export function mortalWoundByRoll(roll: number): MortalWound | null {
  return MORTAL_WOUNDS.find((w) => w.id === roll) ?? null
}
