/**
 * Custom attributes — the helper layer the sheet, the notation matcher, and the
 * roller all agree on.
 *
 * These tests pin the three contracts that make a homebrew stat usable:
 *   - a stored/imported entry is either usable or dropped (never a nameless
 *     block or a NaN value),
 *   - a name resolves by shorthand or full name, after the canonical stats,
 *   - the names a character owns are exactly what the notation matcher is
 *     taught, so `2d6+FOO` resolves and stops before trailing prose.
 */

import { expect, test } from 'vitest'

import {
  MAX_CUSTOM_ATTRIBUTE_VALUE,
  MIN_CUSTOM_ATTRIBUTE_VALUE,
  clampCustomAttributeValue,
  customAttributeVariableNames,
  findCustomAttribute,
  normalizeCustomAttributes,
} from '@/lib/customAttributes'
import { findDiceNotation } from '@/lib/diceParser'
import { evaluateExpression, resolveVariable } from '@/lib/diceRoller'
import { parseDiceNotation } from '@/lib/diceParser'
import { createDefaultCharacter } from '@/constants/gameData'
import type { Character, CustomAttribute } from '@/types'

function makeAttribute(overrides: Partial<CustomAttribute> = {}): CustomAttribute {
  return {
    id: 'ca-1',
    name: 'Martial',
    value: 3,
    shorthand: 'MAR',
    showSteppers: false,
    ...overrides,
  }
}

function makeCharacter(attributes: CustomAttribute[]): Character {
  return { ...createDefaultCharacter(), customAttributes: attributes }
}

// ---- Normalization ---------------------------------------------------------

test('normalizeCustomAttributes: drops entries that could never be referenced', () => {
  const normalized = normalizeCustomAttributes([
    makeAttribute(),
    { id: 'x', name: '   ', value: 2, shorthand: 'X', showSteppers: true },
    { id: 'y', value: 2 },
    null,
    'nope',
  ])

  expect(normalized).toHaveLength(1)
  expect(normalized[0].name).toBe('Martial')
})

test('normalizeCustomAttributes: backfills every field of a usable entry', () => {
  const [entry] = normalizeCustomAttributes([
    { name: '  Sanity  ', value: 'lots' },
  ])

  // A missing id is minted, the value falls back to 0 (never NaN), and the
  // optional fields get their empty shapes.
  expect(entry.id).toBeTruthy()
  expect(entry.name).toBe('Sanity')
  expect(entry.value).toBe(0)
  expect(entry.shorthand).toBe('')
  expect(entry.showSteppers).toBe(false)
})

test('normalizeCustomAttributes: non-array input is an empty list', () => {
  expect(normalizeCustomAttributes(undefined)).toEqual([])
  expect(normalizeCustomAttributes({})).toEqual([])
})

test('clampCustomAttributeValue: whole numbers inside the steppable range', () => {
  expect(clampCustomAttributeValue(2.6)).toBe(3)
  expect(clampCustomAttributeValue(-2.6)).toBe(-3)
  expect(clampCustomAttributeValue(MAX_CUSTOM_ATTRIBUTE_VALUE + 50)).toBe(
    MAX_CUSTOM_ATTRIBUTE_VALUE,
  )
  expect(clampCustomAttributeValue(MIN_CUSTOM_ATTRIBUTE_VALUE - 50)).toBe(
    MIN_CUSTOM_ATTRIBUTE_VALUE,
  )
})

// ---- Resolution ------------------------------------------------------------

test('findCustomAttribute: matches shorthand first, then full name, ignoring case', () => {
  const attributes = [
    makeAttribute(),
    makeAttribute({ id: 'ca-2', name: 'Sanity', shorthand: '' }),
  ]

  expect(findCustomAttribute(attributes, 'MAR')?.id).toBe('ca-1')
  expect(findCustomAttribute(attributes, 'mar')?.id).toBe('ca-1')
  expect(findCustomAttribute(attributes, 'Martial')?.id).toBe('ca-1')
  expect(findCustomAttribute(attributes, ' sanity ')?.id).toBe('ca-2')
  expect(findCustomAttribute(attributes, 'Unknown')).toBeNull()
  expect(findCustomAttribute(undefined, 'MAR')).toBeNull()
})

test('resolveVariable: resolves a custom attribute by shorthand and by name', () => {
  const character = makeCharacter([
    makeAttribute({ value: 3 }),
    makeAttribute({ id: 'ca-2', name: 'Sanity', value: 7, shorthand: '' }),
  ])

  expect(resolveVariable('MAR', character)).toBe(3)
  expect(resolveVariable('martial', character)).toBe(3)
  expect(resolveVariable('Sanity', character)).toBe(7)
})

test('resolveVariable: canonical stats win a name collision with a custom attribute', () => {
  // A custom attribute cannot quietly take over every Sneak roll on the sheet.
  const character = {
    ...makeCharacter([makeAttribute({ name: 'Sneak', value: 99, shorthand: '' })]),
    skills: { ...createDefaultCharacter().skills, Sneak: 4 },
  }

  expect(resolveVariable('Sneak', character)).toBe(4)
})

test('resolveVariable: built-in attribute abbreviations still resolve', () => {
  const character = makeCharacter([makeAttribute()])
  expect(resolveVariable('POW', character)).toBe(character.attributes.POW)
})

test('a custom attribute substitutes into a full roll', () => {
  const character = makeCharacter([makeAttribute({ value: 3 })])
  const result = evaluateExpression(parseDiceNotation('2d6+Martial'), character)

  expect(result.terms[1].value).toBe(3)
  expect(result.terms[1].label).toBe('+Martial(3)')
})

// ---- Notation matching -----------------------------------------------------

test('customAttributeVariableNames: shorthand and name, shorthands first', () => {
  expect(
    customAttributeVariableNames([
      makeAttribute(),
      makeAttribute({ id: 'ca-2', name: 'Sanity', shorthand: '  ' }),
    ]),
  ).toEqual(['MAR', 'Martial', 'Sanity'])
})

test('findDiceNotation: a custom shorthand ends the match before trailing prose', () => {
  // Without the character's vocabulary the permissive word branch swallows
  // "damage" into the variable name — the roll would still resolve to 0.
  expect(findDiceNotation('2d6+FOO damage')).toEqual([
    expect.objectContaining({ match: '2d6+FOO damage' }),
  ])
  expect(findDiceNotation('2d6+FOO damage', ['FOO'])).toEqual([
    expect.objectContaining({ match: '2d6+FOO' }),
  ])
})

test('findDiceNotation: a multi-word custom name matches whole', () => {
  const matches = findDiceNotation('deal 1d8+Martial Arts damage', ['Martial Arts'])

  expect(matches).toHaveLength(1)
  expect(matches[0].match).toBe('1d8+Martial Arts')
})

test('findDiceNotation: a known custom name outranks the free-form word branch', () => {
  // "MARTIAL" is a custom name; the trailing " Arts damage" must stay prose.
  const matches = findDiceNotation('1d6+MARTIAL Arts damage', ['Martial'])

  expect(matches).toHaveLength(1)
  expect(matches[0].match).toBe('1d6+MARTIAL')
})

test('findDiceNotation: built-in abbreviations still win over a bare custom prefix', () => {
  // A custom "M" must not clip the built-in MAR.
  expect(findDiceNotation('2d6+MAR', ['M'])).toEqual([
    expect.objectContaining({ match: '2d6+MAR' }),
  ])
  expect(findDiceNotation('2d6+M', ['M'])).toEqual([
    expect.objectContaining({ match: '2d6+M' }),
  ])
})

test('findDiceNotation: the alternative form stays one term on both branches', () => {
  expect(findDiceNotation('1d6+POW/MAR')[0].match).toBe('1d6+POW/MAR')
  expect(findDiceNotation('1d6+FOO/BAR', ['FOO', 'BAR'])[0].match).toBe(
    '1d6+FOO/BAR',
  )
})

test('findDiceNotation: without extra variables the behavior is unchanged', () => {
  expect(findDiceNotation('Roll 1d6+POW for damage and d20+3 to hit')).toEqual([
    expect.objectContaining({ match: '1d6+POW' }),
    expect.objectContaining({ match: 'd20+3' }),
  ])
})
