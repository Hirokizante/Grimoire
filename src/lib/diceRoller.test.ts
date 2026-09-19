import { test, expect, vi } from 'vitest'
import { notationRange, resolveVariable } from '@/lib/diceRoller'
import { parseDiceNotation } from '@/lib/diceParser'
import type { Character } from '@/types'
import { createDefaultCharacter } from '@/constants/gameData'

// Note: evaluateExpression and rollNotation are imported dynamically inside
// async tests so we can spy on rollDie before the module is used.

/** A test character with known stats for deterministic assertions. */
function makeTestChar(overrides: Partial<Character> = {}): Character {
  const base = createDefaultCharacter()
  return {
    ...base,
    attributes: { MAR: 3, POW: 4, AGI: 1, VIT: 0, GRT: 5 },
    skills: {
      ...base.skills,
      Sneak: 4,
      Deceive: 2,
    },
    ...overrides,
  }
}

test('resolveVariable: finds attribute by key', () => {
  const char = makeTestChar()
  expect(resolveVariable('MAR', char)).toBe(3)
  expect(resolveVariable('POW', char)).toBe(4)
  expect(resolveVariable('AGI', char)).toBe(1)
  expect(resolveVariable('VIT', char)).toBe(0)
  expect(resolveVariable('GRT', char)).toBe(5)
})

test('resolveVariable: finds attribute by name (case-insensitive)', () => {
  const char = makeTestChar()
  expect(resolveVariable('Martial', char)).toBe(3)
  expect(resolveVariable('power', char)).toBe(4)
  expect(resolveVariable('agility', char)).toBe(1)
})

test('resolveVariable: finds skill by name (case-insensitive)', () => {
  const char = makeTestChar()
  expect(resolveVariable('Sneak', char)).toBe(4)
  expect(resolveVariable('sneak', char)).toBe(4)
  expect(resolveVariable('Deceive', char)).toBe(2)
})

test('resolveVariable: unknown variable returns null', () => {
  const char = makeTestChar()
  expect(resolveVariable('Unknown', char)).toBe(null)
})

test('evaluateExpression: dice only (mocked rolls)', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  const expr = parseDiceNotation('2d6')
  const result = evaluateExpression(expr, char)
  expect(result.total).toBe(6) // 3 + 3
  expect(result.terms).toHaveLength(1)
  expect(result.terms[0].rolls).toEqual([3, 3])

  spy.mockRestore()
})

test('evaluateExpression: dice + constant', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  const expr = parseDiceNotation('d20+5')
  const result = evaluateExpression(expr, char)
  expect(result.total).toBe(8) // 3 + 5
  expect(result.terms).toHaveLength(2)

  spy.mockRestore()
})

test('evaluateExpression: dice + variable substitution', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar() // POW = 4
  const expr = parseDiceNotation('2d6+POW')
  const result = evaluateExpression(expr, char)
  expect(result.total).toBe(10) // 3 + 3 + 4
  expect(result.terms).toHaveLength(2)
  expect(result.terms[1].label).toContain('POW(4)')

  spy.mockRestore()
})

test('evaluateExpression: variable with alt (POW/MAR)', async () => {
  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar() // POW = 4, MAR = 3
  const expr = parseDiceNotation('1d6+POW/MAR')
  const result = evaluateExpression(expr, char)
  // POW (4) should be used as the primary variable
  expect(result.terms[1].label).toContain('POW(4)')
  expect(result.total).toBeGreaterThanOrEqual(5) // 1-6 + 4
})

test('evaluateExpression: unknown variable treated as 0', async () => {
  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  const expr = parseDiceNotation('d6+Unknown')
  const result = evaluateExpression(expr, char)
  expect(result.terms[1].label).toContain('Unknown(?)')
  expect(result.terms[1].value).toBe(0)
})

test('evaluateExpression: breakdown string format', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar() // POW = 4
  const expr = parseDiceNotation('2d6+POW')
  const result = evaluateExpression(expr, char)
  expect(result.breakdown).toContain('2d6+POW')
  expect(result.breakdown).toContain('=')
  expect(result.breakdown).toContain('10')

  spy.mockRestore()
})

test('rollNotation: convenience function', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(2)

  const { rollNotation } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  const result = rollNotation('1d6+3', char)
  expect(result.total).toBe(5) // 2 + 3
  expect(result.notation).toBe('1d6+3')

  spy.mockRestore()
})

test('evaluateExpression: negative constant', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(5)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  const expr = parseDiceNotation('d20-2')
  const result = evaluateExpression(expr, char)
  expect(result.total).toBe(3) // 5 - 2
  expect(result.terms[1].value).toBe(-2)

  spy.mockRestore()
})

// ---- Compound notation -------------------------------------------------------

test('evaluateExpression: parentheses and precedence decide the order', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar() // POW = 4, MAR = 3
  const expr = parseDiceNotation('(1d6+POW)*2/2d6+MAR')
  const result = evaluateExpression(expr, char)

  // ((3 + 4) × 2) ÷ (3 + 3) + 3 = 14 ÷ 6 (rounded down) + 3
  expect(result.total).toBe(5)
  expect(result.breakdown).toBe(
    '(1d6+POW)*2/2d6+MAR → (3 + 4) × 2 ÷ (3 + 3) + 3 = 5',
  )

  spy.mockRestore()
})

test('evaluateExpression: multiplication is not addition', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  // 3 + 2 × 3 = 9, not (3 + 2) × 3 = 15.
  expect(evaluateExpression(parseDiceNotation('1d6+2*3'), char).total).toBe(9)
  // 3 × 2 = 6, and several dice keep their own sum: (3 + 3) × 2 = 12.
  expect(evaluateExpression(parseDiceNotation('1d6*2'), char).total).toBe(6)
  expect(evaluateExpression(parseDiceNotation('2d6*2'), char).total).toBe(12)

  spy.mockRestore()
})

test('evaluateExpression: every leaf carries the operator that joins it', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  const result = evaluateExpression(
    parseDiceNotation('(1d6+POW)*2/2d6+MAR'),
    char,
  )

  // The breakdown prints a constant's or a variable's own sign, so only the
  // multiplicative operators (and a subtracted die) need the op on the term —
  // and a term joined by one of those wears no leading `+` at all.
  expect(result.terms.map((t) => t.op ?? null)).toEqual([null, '+', '*', '/', '+'])
  expect(result.terms.map((t) => t.label)).toEqual([
    '1d6',
    '+POW(4)',
    '2',
    '2d6',
    '+MAR(3)',
  ])

  spy.mockRestore()
})

test('evaluateExpression: a subtracted product is negated in the terms too', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(5)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()

  // The term list must read like the working: 5 - 2 × 3 = -1, not 5 + 2 × 3.
  const product = evaluateExpression(parseDiceNotation('1d6-2*3'), char)
  expect(product.total).toBe(-1)
  expect(product.terms.map((t) => `${t.op ?? ''}${t.label}`)).toEqual([
    '1d6',
    '+-2',
    '*3',
  ])

  // Negation distributes over a group: -(2+3) is -2-3, and the dice rolled 5.
  const group = evaluateExpression(parseDiceNotation('d20-(2+3)'), char)
  expect(group.total).toBe(0)
  expect(group.terms.map((t) => `${t.op ?? ''}${t.label}`)).toEqual([
    '1d20',
    '+-2',
    '+-3',
  ])

  spy.mockRestore()
})

test('evaluateExpression: a multiplied or divided stat prints no sign', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(5)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar() // POW = 4

  const multiplied = evaluateExpression(parseDiceNotation('2d6*POW'), char)
  const divided = evaluateExpression(parseDiceNotation('2d6/POW'), char)

  expect(multiplied.terms[1].label).toBe('POW(4)')
  expect(multiplied.terms[1].op).toBe('*')
  expect(multiplied.total).toBe(40) // (5 + 5) × 4
  expect(divided.terms[1].label).toBe('POW(4)')
  expect(divided.terms[1].op).toBe('/')
  expect(divided.total).toBe(2) // (5 + 5) ÷ 4

  spy.mockRestore()
})

test('evaluateExpression: division rounds down and never divides by zero', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(5)

  const { rollNotation } = await import('@/lib/diceRoller')
  const char = makeTestChar() // VIT = 0

  expect(rollNotation('1d6/2', char).total).toBe(2) // 5 ÷ 2 = 2.5 → 2
  expect(rollNotation('1d6/4', char).total).toBe(1)
  const byZero = rollNotation('d20/VIT', char)
  expect(byZero.total).toBe(0)
  expect(byZero.breakdown).toBe('d20/VIT → 5 ÷ 0 = 0')

  spy.mockRestore()
})

test('evaluateExpression: a subtracted die is negated', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  const result = evaluateExpression(parseDiceNotation('d20-2d6'), char)

  expect(result.total).toBe(-3) // 3 - (3 + 3)
  expect(result.breakdown).toBe('d20-2d6 → 3 - (3 + 3) = -3')
  expect(result.terms[1].op).toBe('-')
  // Both dice are still recorded individually, exactly as an added term's are.
  expect(result.terms[1].rolls).toEqual([3, 3])

  spy.mockRestore()
})

test('evaluateExpression: an unknown name inside a group counts 0', async () => {
  const dice = await import('@/lib/dice')
  const spy = vi.spyOn(dice, 'rollDie').mockReturnValue(3)

  const { evaluateExpression } = await import('@/lib/diceRoller')
  const char = makeTestChar()
  const result = evaluateExpression(parseDiceNotation('(1d6+FOO)*2'), char)

  expect(result.total).toBe(6)
  expect(result.terms[1].label).toBe('FOO(?)')
  expect(result.breakdown).toBe('(1d6+FOO)*2 → (3 + 0) × 2 = 6')

  spy.mockRestore()
})

test('evaluateExpression: an unreadable expression totals zero', async () => {
  const { evaluateExpression } = await import('@/lib/diceRoller')
  const result = evaluateExpression(parseDiceNotation('+++'), makeTestChar())

  expect(result.total).toBe(0)
  expect(result.terms).toHaveLength(0)
  expect(result.breakdown).toBe('+++ → 0')
})

// ---- Roll ranges -------------------------------------------------------------

test('notationRange: dice and constants span their own ends', () => {
  const char = makeTestChar()
  expect(notationRange('1d6+3', char)).toEqual({ min: 4, max: 9 })
  expect(notationRange('2d6', char)).toEqual({ min: 2, max: 12 })
  expect(notationRange('d20-2', char)).toEqual({ min: -1, max: 18 })
  expect(notationRange('1d6*1d6', char)).toEqual({ min: 1, max: 36 })
})

test('notationRange: variables resolve exactly as they roll', () => {
  const char = makeTestChar() // POW = 4, MAR = 3, VIT = 0
  expect(notationRange('1d6+POW', char)).toEqual({ min: 5, max: 10 })
  // `POW/MAR` rolls its primary name, so its range is POW's too.
  expect(notationRange('1d6+POW/MAR', char)).toEqual({ min: 5, max: 10 })
  expect(notationRange('1d6+VIT', char)).toEqual({ min: 1, max: 6 })
  // An unknown name counts 0, exactly as it does in a roll.
  expect(notationRange('d6+Unknown', char)).toEqual({ min: 1, max: 6 })
})

test('notationRange: groups, precedence, and negation follow the tree', () => {
  const char = makeTestChar() // POW = 4
  expect(notationRange('(1d6+POW)*2', char)).toEqual({ min: 10, max: 20 })
  expect(notationRange('1d6-2*3', char)).toEqual({ min: -5, max: 0 })
  expect(notationRange('-(1d6+2)', char)).toEqual({ min: -8, max: -3 })
})

test('notationRange: division floors at the denominator extremes', () => {
  const char = makeTestChar() // POW = 4, MAR = 3, VIT = 0
  expect(notationRange('1d6/2', char)).toEqual({ min: 0, max: 3 })
  expect(notationRange('(1d6+POW)*2/2d6+MAR', char)).toEqual({
    min: 3,
    max: 13,
  })
  // Dividing by a stat that is 0 contributes 0, the roller's own rule.
  expect(notationRange('d20/VIT', char)).toEqual({ min: 0, max: 0 })
})

test('notationRange: an unreadable expression spans zero', () => {
  expect(notationRange('+++', makeTestChar())).toEqual({ min: 0, max: 0 })
})
