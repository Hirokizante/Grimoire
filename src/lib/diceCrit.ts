/**
 * Natural-20 / natural-1 detection for a single evaluated roll.
 *
 * The dice result modal reads these for both of its shapes — one roll, or an
 * activation's stack of rolls — and the roll log computes the same flags when
 * it stores an entry, so the two can never disagree about what a "nat 20" is:
 * a **d20 term** that came up 20 (or 1). A d6 that rolled its maximum is not a
 * critical hit, which is why the die's side count is checked and not just the
 * face.
 */

import type { RollResult } from '@/lib/diceRoller'

/** True when the expression rolled a natural 20 on any d20 term. */
export function isNaturalTwenty(result: RollResult): boolean {
  return result.terms.some(
    (t) =>
      t.term.type === 'dice' &&
      t.term.sides === 20 &&
      (t.rolls ?? []).some((r) => r === 20),
  )
}

/** True when the expression rolled a natural 1 on any d20 term. */
export function isNaturalOne(result: RollResult): boolean {
  return result.terms.some(
    (t) =>
      t.term.type === 'dice' &&
      t.term.sides === 20 &&
      (t.rolls ?? []).some((r) => r === 1),
  )
}
