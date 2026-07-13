/**
 * Roll log types — each record captures a single dice roll with its context.
 *
 * A roll is permanent (won't be deleted with character data), auto-saved
 * after the animation completes, and accessible via the bottom-right drawer.
 *
 * The context (ability name, description, stat modifiers) travels with the
 * roll so a session's history reads like a mini journal of what mattered.
 */

import type { RollResult } from '@/lib/diceRoller'

/** Where this roll originated. Used to group/filter and show context. */
export type RollSource =
  | { type: 'ability-damage'; abilityName: string; abilityId?: string }
  | { type: 'saving-throw'; stat?: string }
  | { type: 'skill-check'; skillName: string }
  | { type: 'attribute-check'; attributeKey: string; attributeName: string }
  | { type: 'attack'; abilityName?: string }
  | { type: 'manual'; note?: string }

/**
 * A fully-resolved dice roll, captured once the animation finishes.
 */
export interface RollLogEntry {
  /** Stable id, generated at creation time. */
  id: string
  /** The raw notation that was rolled (e.g. "2d6+POW"). */
  notation: string
  /** The character id whose stats were used for variable substitution. */
  characterId: string
  /** The character's name at roll time — survives character deletion. */
  characterName: string
  /** The source / context of the roll. */
  source: RollSource
  /** The computed result (terms, total, breakdown, die rolls). */
  result: RollResult
  /** ISO timestamp of when the roll was made. */
  rolledAt: string
  /** Whether the roll was a natural 20 on its primary dice term. */
  isNaturalTwenty: boolean
  /** Whether the roll was a natural 1 on its primary dice term. */
  isNaturalOne: boolean
}

/** Input for creating a RollLogEntry. `id`, `rolledAt`, crit flags computed. */
export interface NewRollLogEntry {
  notation: string
  characterId: string
  characterName: string
  source: RollSource
  result: RollResult
}
