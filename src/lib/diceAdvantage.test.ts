/**
 * Tests for Advantage/Disadvantage arithmetic (lib/diceAdvantage.ts).
 *
 * The rule under test: roll a d6 per point, take the highest, add it for
 * Advantage or subtract it for Disadvantage, and let the two cancel before any
 * dice are rolled. An adjustment always recomputes from the roll's base total,
 * so changing the value re-rolls it instead of stacking a second bonus.
 */

import { afterEach, expect, test, vi } from 'vitest'

/** Deterministic d6s, consumed in the order rolls happen. */
const rollQueue: number[] = []
vi.mock('@/lib/dice', () => ({
  rollDie: () => rollQueue.shift() ?? 1,
}))

import {
  MAX_ADVANTAGE_VALUE,
  advantageSummary,
  applyRollAdvantage,
  normalizeAdvantageValue,
} from '@/lib/diceAdvantage'
import type { RollResult } from '@/lib/diceRoller'

afterEach(() => {
  rollQueue.length = 0
})

/** A settled roll with no adjustment yet. */
function baseResult(total = 10): RollResult {
  return {
    notation: 'd20+MAR',
    total,
    terms: [
      { term: { type: 'dice', count: 1, sides: 20 }, value: 7, label: '1d20', rolls: [7] },
      { term: { type: 'variable', name: 'MAR', sign: 1 }, value: 3, label: '+MAR(3)' },
    ],
    breakdown: `d20+MAR → 7 + 3 = ${total}`,
  }
}

// ---- normalization -----------------------------------------------------------

test('normalizeAdvantageValue clamps to a whole number in range', () => {
  expect(normalizeAdvantageValue(3)).toBe(3)
  expect(normalizeAdvantageValue(2.9)).toBe(2)
  expect(normalizeAdvantageValue(-4)).toBe(0)
  expect(normalizeAdvantageValue(MAX_ADVANTAGE_VALUE + 50)).toBe(
    MAX_ADVANTAGE_VALUE,
  )
  expect(normalizeAdvantageValue('3')).toBe(0)
  expect(normalizeAdvantageValue(Number.NaN)).toBe(0)
  expect(normalizeAdvantageValue(Infinity)).toBe(0)
  expect(normalizeAdvantageValue(undefined)).toBe(0)
})

// ---- application -------------------------------------------------------------

test('advantage rolls one d6 per point and adds the highest', () => {
  rollQueue.push(1, 3, 6)
  const result = applyRollAdvantage(baseResult(10), 3, 0)

  expect(result.total).toBe(16)
  expect(result.advantage).toEqual({
    kind: 'advantage',
    dice: 3,
    rolls: [1, 3, 6],
    modifier: 6,
    baseTotal: 10,
    advantage: 3,
    disadvantage: 0,
  })
  // The expression's own terms and breakdown stay exactly as rolled.
  expect(result.breakdown).toBe('d20+MAR → 7 + 3 = 10')
})

test('disadvantage rolls one d6 per point and subtracts the highest', () => {
  rollQueue.push(2, 5)
  const result = applyRollAdvantage(baseResult(14), 0, 2)

  expect(result.total).toBe(9)
  expect(result.advantage).toMatchObject({
    kind: 'disadvantage',
    dice: 2,
    rolls: [2, 5],
    modifier: -5,
    baseTotal: 14,
  })
})

test('advantage and disadvantage cancel before any die is rolled', () => {
  rollQueue.push(4, 2)
  const result = applyRollAdvantage(baseResult(11), 3, 1)

  expect(result.advantage).toMatchObject({ kind: 'advantage', dice: 2, rolls: [4, 2], modifier: 4 })
  expect(result.total).toBe(15)
})

test('an equal Advantage and Disadvantage clears the adjustment', () => {
  rollQueue.push(6)
  const adjusted = applyRollAdvantage(baseResult(10), 1, 0)
  expect(adjusted.total).toBe(16)

  const cleared = applyRollAdvantage(adjusted, 2, 2)
  expect(cleared.total).toBe(10)
  expect(cleared.advantage).toBeUndefined()
})

test('a net of zero on an unadjusted roll is a no-op', () => {
  const result = baseResult()
  expect(applyRollAdvantage(result, 0, 0)).toBe(result)
})

test('re-rolling recomputes from the base total instead of stacking', () => {
  rollQueue.push(6)
  const first = applyRollAdvantage(baseResult(10), 1, 0)
  expect(first.total).toBe(16)

  rollQueue.push(2)
  const second = applyRollAdvantage(first, 1, 0)
  expect(second.total).toBe(12)
  expect(second.advantage).toMatchObject({ modifier: 2, baseTotal: 10 })
})

test('input values are recorded as entered, netted for the roll', () => {
  rollQueue.push(5)
  const result = applyRollAdvantage(baseResult(10), 3, 1)
  expect(result.advantage).toMatchObject({
    dice: 2,
    advantage: 3,
    disadvantage: 1,
  })
})

// ---- summary -----------------------------------------------------------------

test('advantageSummary reads the adjustment in one line', () => {
  rollQueue.push(1, 6, 3)
  const advantage = applyRollAdvantage(baseResult(10), 3, 0).advantage!
  expect(advantageSummary(advantage)).toBe('Advantage +3: 1, 6, 3 → +6')

  rollQueue.push(4)
  const disadvantage = applyRollAdvantage(baseResult(10), 0, 1).advantage!
  expect(advantageSummary(disadvantage)).toBe('Disadvantage +1: 4 → −4')
})
