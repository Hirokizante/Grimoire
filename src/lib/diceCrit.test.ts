/**
 * Tests for critical-hit rules (lib/diceCrit.ts).
 *
 * The rule under test: an attack roll whose total reaches 20 is a critical hit;
 * its damage is evaluated a second time and the higher result is kept. Removing
 * the critical restores the first evaluation exactly, and the natural-20 /
 * natural-1 detection the modal and log already used still reads a d20 term's
 * face, not a total.
 */

import { expect, test } from 'vitest'

import {
  CRITICAL_HIT_THRESHOLD,
  applyCriticalHit,
  criticalSummary,
  isCriticalHit,
  isNaturalOne,
  isNaturalTwenty,
  removeCriticalHit,
} from '@/lib/diceCrit'
import type { RollResult } from '@/lib/diceRoller'

/** A settled damage roll. */
function damageRoll(total: number, rolls: number[] = [total]): RollResult {
  return {
    notation: '2d6',
    total,
    terms: [
      { term: { type: 'dice', count: 1, sides: 6 }, value: rolls[0], label: '1d6', rolls },
    ],
    breakdown: `2d6 → ${rolls.join(' + ')} = ${total}`,
  }
}

// ---- threshold ---------------------------------------------------------------

test('a total at or above 20 is a critical hit', () => {
  expect(CRITICAL_HIT_THRESHOLD).toBe(20)
  expect(isCriticalHit(damageRoll(19))).toBe(false)
  expect(isCriticalHit(damageRoll(20))).toBe(true)
  expect(isCriticalHit(damageRoll(31))).toBe(true)
  // No attack roll at all (an activation without accuracy) is never a crit.
  expect(isCriticalHit(null)).toBe(false)
  expect(isCriticalHit(undefined)).toBe(false)
})

// ---- applying ----------------------------------------------------------------

test('a critical rolls the expression again and keeps the higher result', () => {
  const first = damageRoll(7, [3, 4])
  const second = damageRoll(11, [5, 6])
  const crit = applyCriticalHit(first, () => second)

  expect(crit.total).toBe(11)
  expect(crit.terms).toEqual(second.terms)
  expect(crit.breakdown).toBe(second.breakdown)
  expect(crit.critical).toEqual({
    chosen: 1,
    rolls: [
      { total: 7, terms: first.terms, breakdown: first.breakdown },
      { total: 11, terms: second.terms, breakdown: second.breakdown },
    ],
  })
})

test('the first evaluation is kept when it is higher', () => {
  const first = damageRoll(12, [6, 6])
  const second = damageRoll(4, [1, 3])
  const crit = applyCriticalHit(first, () => second)

  expect(crit.total).toBe(12)
  expect(crit.critical).toMatchObject({ chosen: 0 })
})

test('a tie keeps the first evaluation', () => {
  const crit = applyCriticalHit(damageRoll(7), () => damageRoll(7))
  expect(crit.critical).toMatchObject({ chosen: 0 })
  expect(crit.total).toBe(7)
})

test('applying a critical twice is a no-op', () => {
  const crit = applyCriticalHit(damageRoll(7), () => damageRoll(11))
  const again = applyCriticalHit(crit, () => damageRoll(99))
  expect(again).toBe(crit)
})

// ---- removing ----------------------------------------------------------------

test('removing a critical restores the first evaluation exactly', () => {
  const first = damageRoll(7, [3, 4])
  const crit = applyCriticalHit(first, () => damageRoll(11, [5, 6]))

  const restored = removeCriticalHit(crit)
  expect(restored.total).toBe(7)
  expect(restored.terms).toEqual(first.terms)
  expect(restored.breakdown).toBe(first.breakdown)
  expect(restored.critical).toBeUndefined()
})

test('removing a critical from a non-critical roll is a no-op', () => {
  const plain = damageRoll(7)
  expect(removeCriticalHit(plain)).toBe(plain)
})

// ---- summary -----------------------------------------------------------------

test('criticalSummary reads both rolls and the kept total', () => {
  const crit = applyCriticalHit(damageRoll(7), () => damageRoll(11))
  expect(criticalSummary(crit.critical!)).toBe('Critical hit: 7 / 11 → keeps 11')
})

// ---- natural 20 / 1 ----------------------------------------------------------

test('natural 20/1 still reads a d20 term’s face, not the total', () => {
  const natural: RollResult = {
    notation: 'd20+MAR',
    total: 23,
    terms: [
      { term: { type: 'dice', count: 1, sides: 20 }, value: 20, label: '1d20', rolls: [20] },
      { term: { type: 'variable', name: 'MAR', sign: 1 }, value: 3, label: '+MAR(3)' },
    ],
    breakdown: 'd20+MAR → 20 + 3 = 23',
  }
  expect(isNaturalTwenty(natural)).toBe(true)
  expect(isNaturalOne(natural)).toBe(false)

  // A 19 that reaches 20 with modifiers is a critical hit but NOT a natural 20.
  const modified: RollResult = {
    ...natural,
    total: 22,
    terms: [
      { term: { type: 'dice', count: 1, sides: 20 }, value: 19, label: '1d20', rolls: [19] },
      natural.terms[1],
    ],
    breakdown: 'd20+MAR → 19 + 3 = 22',
  }
  expect(isCriticalHit(modified)).toBe(true)
  expect(isNaturalTwenty(modified)).toBe(false)
})
