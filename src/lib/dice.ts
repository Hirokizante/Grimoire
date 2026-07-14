/**
 * Simple dice rolling utility for live play.
 *
 * Provides raw die rolls for the dice notation parser/roller, Death Saves,
 * Mortal Wounds, and armor damage reduction.
 */

/** Roll a single die with `sides` sides (1 to `sides`, inclusive). */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}
