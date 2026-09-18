/**
 * Advantage & Disadvantage for dice rolls.
 *
 * A roll can carry **+X Advantage** or **+X Disadvantage**. Once the initial
 * roll is done, the adjustment rolls that many d6s `X`; the highest d6 is then
 * **added** for Advantage or **subtracted** for Disadvantage. The two cancel
 * each other out, so only the net value matters: `+3 Advantage` against
 * `+1 Disadvantage` rolls two d6s and adds the highest.
 *
 * The adjustment is stored on the {@link RollResult} it changed rather than
 * folded into the expression, so:
 *   - the base terms and breakdown stay exactly as rolled, and
 *   - a re-roll (the player changes the value in the result modal) recomputes
 *     from `baseTotal` instead of stacking a second adjustment on top.
 *
 * This module owns the arithmetic; `lib/activationRolls.ts` applies authored
 * values during an activation, and the result modal calls
 * {@link applyRollAdvantage} for values entered at the table.
 */

import { rollDie } from '@/lib/dice'
import type { RollResult } from '@/lib/diceRoller'

/** The most d6s one roll may add for an Advantage/Disadvantage value. */
export const MAX_ADVANTAGE_VALUE = 20

/** A completed Advantage/Disadvantage adjustment on a roll. */
export interface RollAdvantage {
  /** Whether the highest d6 was added or subtracted. */
  kind: 'advantage' | 'disadvantage'
  /** Number of d6s rolled — the net value after cancellation. */
  dice: number
  /** Every d6 rolled, in roll order. */
  rolls: number[]
  /** The highest d6, signed: `+N` for Advantage, `−N` for Disadvantage. */
  modifier: number
  /** The roll's total before the adjustment, the base a re-roll recomputes from. */
  baseTotal: number
  /** Advantage dice entered when this adjustment was made. */
  advantage: number
  /** Disadvantage dice entered when this adjustment was made. */
  disadvantage: number
}

/**
 * A non-negative, whole Advantage/Disadvantage value, clamped to
 * {@link MAX_ADVANTAGE_VALUE}. Anything not a finite number reads as 0, so an
 * imported or hand-typed value can never make the roller ask for NaN dice.
 */
export function normalizeAdvantageValue(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(MAX_ADVANTAGE_VALUE, Math.floor(raw)))
}

/**
 * Apply Advantage/Disadvantage to a result.
 *
 * `advantage` and `disadvantage` are dice counts; they cancel, and the net
 * count is rolled. A net of zero removes an adjustment that was already applied
 * (restoring `baseTotal`), so setting both fields back to 0 and re-rolling
 * undoes the adjustment rather than leaving a stale modifier. Passing the same
 * base result again re-rolls the dice and replaces the adjustment.
 *
 * Returns the same `result` reference when nothing changes, so callers can use
 * identity to skip a state write.
 */
export function applyRollAdvantage(
  result: RollResult,
  advantage: number,
  disadvantage: number,
): RollResult {
  const adv = normalizeAdvantageValue(advantage)
  const dis = normalizeAdvantageValue(disadvantage)
  const baseTotal = result.advantage?.baseTotal ?? result.total
  const net = adv - dis

  if (net === 0) {
    if (!result.advantage) return result
    const { advantage: _applied, ...rest } = result
    return { ...rest, total: baseTotal }
  }

  const kind = net > 0 ? 'advantage' : 'disadvantage'
  const dice = Math.abs(net)
  const rolls = Array.from({ length: dice }, () => rollDie(6))
  const highest = Math.max(...rolls)
  const modifier = kind === 'advantage' ? highest : -highest

  return {
    ...result,
    total: baseTotal + modifier,
    advantage: { kind, dice, rolls, modifier, baseTotal, advantage: adv, disadvantage: dis },
  }
}

/**
 * A one-line reading of an adjustment for the roll log and screen readers —
 * e.g. `Advantage +2: 6, 3 → +6` or `Disadvantage +1: 4 → −4`.
 */
export function advantageSummary(applied: RollAdvantage): string {
  const label = applied.kind === 'advantage' ? 'Advantage' : 'Disadvantage'
  const modifier =
    applied.modifier >= 0 ? `+${applied.modifier}` : `−${Math.abs(applied.modifier)}`
  return `${label} +${applied.dice}: ${applied.rolls.join(', ')} → ${modifier}`
}
