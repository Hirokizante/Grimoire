/**
 * Critical-hit rules for attack rolls.
 *
 * An attack roll (the accuracy check of an activation, or any roll the table
 * treats as one) is a **critical hit when its result reaches
 * {@link CRITICAL_HIT_THRESHOLD}** — 20. A critical hit's damage is rolled
 * **twice, and the higher result is kept**, per the Divergence SRD.
 *
 * The two evaluations are stored on the {@link RollResult} that carries them,
 * so:
 *   - the result's own `total`/`terms`/`breakdown` always read as the kept
 *     (higher) roll, and
 *   - removing the critical restores the first roll exactly instead of
 *     re-rolling it.
 *
 * This module also owns the natural-20 / natural-1 detection the result modal
 * and the roll log use for their badges.
 */

import type { RollResult, TermResult } from '@/lib/diceRoller'

/** The attack-roll total at or above which a hit is critical. */
export const CRITICAL_HIT_THRESHOLD = 20

/** One complete evaluation of a damage expression. */
export interface RollEvaluation {
  total: number
  terms: TermResult[]
  breakdown: string
}

/** A critical hit's two damage evaluations, and the one the result keeps. */
export interface RollCritical {
  /** The two evaluations, in roll order. */
  rolls: [RollEvaluation, RollEvaluation]
  /** Index of the higher evaluation — the one the result's fields carry. */
  chosen: 0 | 1
}

/**
 * Whether a completed attack roll is a critical hit: its total reached 20.
 * Accepts a missing result so callers can ask about an activation that has no
 * accuracy roll of its own (no attack roll, no critical).
 */
export function isCriticalHit(result: RollResult | null | undefined): boolean {
  return result != null && result.total >= CRITICAL_HIT_THRESHOLD
}

/**
 * Turn a roll into a critical hit: evaluate the expression a second time and
 * keep the higher of the two results (a tie keeps the first). The kept
 * evaluation's fields replace the result's `total`/`terms`/`breakdown`, and
 * both are stored under `critical` so the critical can be removed later.
 *
 * Applying again to an already-critical roll is a no-op — removing is
 * {@link removeCriticalHit}.
 */
export function applyCriticalHit(
  result: RollResult,
  reroll: () => RollResult,
): RollResult {
  if (result.critical) return result

  const second = reroll()
  const rolls: [RollEvaluation, RollEvaluation] = [
    { total: result.total, terms: result.terms, breakdown: result.breakdown },
    { total: second.total, terms: second.terms, breakdown: second.breakdown },
  ]
  const chosen: 0 | 1 = rolls[1].total > rolls[0].total ? 1 : 0
  const kept = rolls[chosen]

  return {
    ...result,
    total: kept.total,
    terms: kept.terms,
    breakdown: kept.breakdown,
    critical: { rolls, chosen },
  }
}

/**
 * Remove a critical hit, restoring the first evaluation exactly as it rolled.
 * A result that is not critical is returned unchanged.
 */
export function removeCriticalHit(result: RollResult): RollResult {
  if (!result.critical) return result
  const first = result.critical.rolls[0]
  const { critical: _critical, ...rest } = result
  return {
    ...rest,
    total: first.total,
    terms: first.terms,
    breakdown: first.breakdown,
  }
}

/**
 * A one-line reading of a critical hit for the roll log and screen readers —
 * e.g. `Critical hit: 8 / 13 → keeps 13`.
 */
export function criticalSummary(critical: RollCritical): string {
  const [first, second] = critical.rolls
  return `Critical hit: ${first.total} / ${second.total} → keeps ${critical.rolls[critical.chosen].total}`
}

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
