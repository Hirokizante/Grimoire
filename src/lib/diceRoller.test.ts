import { test, expect, vi } from 'vitest'
import { resolveVariable } from '@/lib/diceRoller'
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
