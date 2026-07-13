import { test, expect } from 'vitest'
import {
  parseDiceNotation,
  findDiceNotation,
  DICE_NOTATION_REGEX,
} from '@/lib/diceParser'

test('parseDiceNotation: simple dice (NdS)', () => {
  const expr = parseDiceNotation('2d6')
  expect(expr.terms).toHaveLength(1)
  expect(expr.terms[0]).toEqual({ type: 'dice', count: 2, sides: 6 })
})

test('parseDiceNotation: single die (dS, count defaults to 1)', () => {
  const expr = parseDiceNotation('d20')
  expect(expr.terms).toHaveLength(1)
  expect(expr.terms[0]).toEqual({ type: 'dice', count: 1, sides: 20 })
})

test('parseDiceNotation: dice + constant', () => {
  const expr = parseDiceNotation('d20+3')
  expect(expr.terms).toHaveLength(2)
  expect(expr.terms[0]).toEqual({ type: 'dice', count: 1, sides: 20 })
  expect(expr.terms[1]).toEqual({ type: 'constant', value: 3, sign: 1 })
})

test('parseDiceNotation: dice + variable (POW)', () => {
  const expr = parseDiceNotation('2d6+POW')
  expect(expr.terms).toHaveLength(2)
  expect(expr.terms[0]).toEqual({ type: 'dice', count: 2, sides: 6 })
  expect(expr.terms[1]).toEqual({ type: 'variable', name: 'POW', sign: 1 })
})

test('parseDiceNotation: variable with alt (POW/MAR)', () => {
  const expr = parseDiceNotation('1d6+POW/MAR')
  expect(expr.terms).toHaveLength(2)
  expect(expr.terms[0]).toEqual({ type: 'dice', count: 1, sides: 6 })
  expect(expr.terms[1]).toEqual({
    type: 'variable',
    name: 'POW',
    alt: 'MAR',
    sign: 1,
  })
})

test('parseDiceNotation: subtraction', () => {
  const expr = parseDiceNotation('d20-1')
  expect(expr.terms).toHaveLength(2)
  expect(expr.terms[1]).toEqual({ type: 'constant', value: 1, sign: -1 })
})

test('parseDiceNotation: dice minus variable', () => {
  const expr = parseDiceNotation('2d6-Sneak')
  expect(expr.terms).toHaveLength(2)
  expect(expr.terms[1]).toEqual({
    type: 'variable',
    name: 'Sneak',
    sign: -1,
  })
})

test('parseDiceNotation: multi-term expression', () => {
  const expr = parseDiceNotation('2d6+POW+3')
  expect(expr.terms).toHaveLength(3)
  expect(expr.terms[0].type).toBe('dice')
  expect(expr.terms[1].type).toBe('variable')
  expect(expr.terms[2].type).toBe('constant')
})

test('parseDiceNotation: empty string returns no terms', () => {
  const expr = parseDiceNotation('')
  expect(expr.terms).toHaveLength(0)
})

test('parseDiceNotation: whitespace is trimmed', () => {
  const expr = parseDiceNotation('  2d6 + POW  ')
  expect(expr.terms).toHaveLength(2)
  expect(expr.terms[1].type).toBe('variable')
  expect((expr.terms[1] as { name: string }).name).toBe('POW')
})

test('parseDiceNotation: preserves original notation string', () => {
  const notation = '2d6+POW/MAR'
  const expr = parseDiceNotation(notation)
  expect(expr.notation).toBe(notation)
})

test('findDiceNotation: finds single match', () => {
  const matches = findDiceNotation('2d6+POW')
  expect(matches).toHaveLength(1)
  expect(matches[0].match).toBe('2d6+POW')
  expect(matches[0].start).toBe(0)
  expect(matches[0].end).toBe(7)
})

test('findDiceNotation: finds multiple matches in text', () => {
  const matches = findDiceNotation('Roll 1d6+POW for damage and d20+3 to hit')
  expect(matches.length).toBeGreaterThanOrEqual(2)
  expect(matches.some((m) => m.match === '1d6+POW')).toBe(true)
  expect(matches.some((m) => m.match === 'd20+3')).toBe(true)
})

test('findDiceNotation: no matches in plain text', () => {
  const matches = findDiceNotation('No dice here')
  expect(matches).toHaveLength(0)
})

test('findDiceNotation: handles d20 alone', () => {
  const matches = findDiceNotation('d20')
  expect(matches).toHaveLength(1)
  expect(matches[0].match).toBe('d20')
})

test('DICE_NOTATION_REGEX: global flag can be reset', () => {
  DICE_NOTATION_REGEX.lastIndex = 0
  expect(DICE_NOTATION_REGEX.test('2d6')).toBe(true)
  // Verify it's global (has lastIndex behavior)
  expect(DICE_NOTATION_REGEX.global).toBe(true)
})
