/**
 * DiceTermBreakdown — the per-term reading of a roll.
 *
 * Simple notation prints exactly as it always has (dice chips, then each
 * constant and variable with its own sign). Compound notation adds the operator
 * that joins each term to the one before it, so `(1d6+POW)*2/2d6+MAR` reads as
 * a working rather than a flat list of numbers.
 */

import { expect, test } from 'vitest'
import { render } from '@testing-library/react'

import DiceTermBreakdown from '@/components/dice/DiceTermBreakdown'
import type { RollResult, TermResult } from '@/lib/diceRoller'

/** One evaluated term, as the roller hands it to the breakdown. */
function evaluated(
  term: TermResult['term'],
  value: number,
  label: string,
  extra: Partial<TermResult> = {},
): TermResult {
  return { term, value, label, ...extra }
}

/** The operators the breakdown drew, in the order it drew them. */
function operators(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.dice-modal__term-op')).map(
    (node) => node.textContent ?? '',
  )
}

test('a flat expression keeps printing its own signs and no operators', () => {
  const result: RollResult = {
    notation: '2d6+POW',
    total: 10,
    terms: [
      evaluated({ type: 'dice', count: 2, sides: 6 }, 6, '2d6', {
        rolls: [3, 3],
      }),
      evaluated({ type: 'variable', name: 'POW', sign: 1 }, 4, '+POW(4)'),
    ],
    breakdown: '2d6+POW → 3 + 3 + 4 = 10',
  }

  const { container, getByText } = render(<DiceTermBreakdown result={result} />)

  expect(getByText('2d6:')).toBeInTheDocument()
  expect(getByText('+POW(4)')).toBeInTheDocument()
  expect(getByText('= 6')).toBeInTheDocument()
  expect(operators(container)).toEqual([])
})

test('a compound expression draws the operator joining each term', () => {
  const result: RollResult = {
    notation: '(1d6+POW)*2/2d6+MAR',
    total: 5,
    terms: [
      evaluated({ type: 'dice', count: 1, sides: 6 }, 3, '1d6', {
        rolls: [3],
      }),
      evaluated({ type: 'variable', name: 'POW', sign: 1 }, 4, '+POW(4)', {
        op: '+',
      }),
      evaluated({ type: 'constant', value: 2, sign: 1 }, 2, '2', { op: '*' }),
      evaluated({ type: 'dice', count: 2, sides: 6 }, 6, '2d6', {
        rolls: [3, 3],
        op: '/',
      }),
      evaluated({ type: 'variable', name: 'MAR', sign: 1 }, 3, '+MAR(3)', {
        op: '+',
      }),
    ],
    breakdown: '(1d6+POW)*2/2d6+MAR → (3 + 4) × 2 ÷ (3 + 3) + 3 = 5',
  }

  const { container, getByText } = render(<DiceTermBreakdown result={result} />)

  // The added terms print their own sign; the multiplied and divided ones take
  // a glyph of their own.
  expect(operators(container)).toEqual(['×', '÷'])
  expect(getByText('+POW(4)')).toBeInTheDocument()
  expect(getByText('= 6')).toBeInTheDocument()
})

test('a subtracted die is marked as one', () => {
  const result: RollResult = {
    notation: 'd20-2d6',
    total: -3,
    terms: [
      evaluated({ type: 'dice', count: 1, sides: 20 }, 3, '1d20', {
        rolls: [3],
      }),
      evaluated({ type: 'dice', count: 2, sides: 6 }, -6, '2d6', {
        rolls: [3, 3],
        op: '-',
      }),
    ],
    breakdown: 'd20-2d6 → 3 - (3 + 3) = -3',
  }

  const { container, getByText } = render(<DiceTermBreakdown result={result} />)

  expect(operators(container)).toEqual(['−'])
  expect(getByText('= -6')).toBeInTheDocument()
})
