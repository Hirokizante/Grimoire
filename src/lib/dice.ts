/**
 * Simple dice rolling utility for live play.
 *
 * Phase 8 will add a full dice notation parser and 3D animation; for now we
 * just need raw D20 rolls for Death Saves and Mortal Wounds, and D6 rolls for
 * armor damage reduction. This module provides a small, testable API.
 */

/** Roll a single die with `sides` sides (1 to `sides`, inclusive). */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

/** Roll N dice of `sides` sides and return the individual results + total. */
export function rollDice(count: number, sides: number): {
  rolls: number[]
  total: number
} {
  const rolls = Array.from({ length: count }, () => rollDie(sides))
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) }
}
