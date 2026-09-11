/**
 * Tests for the shared ability-trait parser.
 *
 * The parser is deliberately name-agnostic: Recharge is the first consumer, but
 * the contract pinned here is "any `Name` / `Name (Value)` tag parses into a
 * structured trait", so future mechanics (Cooldown, Multi-Hit, …) can rely on
 * it without touching a regex.
 */

import { describe, expect, it } from 'vitest'

import {
  ABILITY_TRAITS,
  abilityTraitValue,
  findAbilityTrait,
  findAbilityTraitDefinition,
  findAbilityTraits,
  hasAbilityTrait,
  parseAbilityTrait,
  parseAbilityTraits,
} from '@/lib/abilityTraits'

describe('parseAbilityTrait', () => {
  it('reads a spaced value', () => {
    expect(parseAbilityTrait('Recharge (5)')).toMatchObject({
      key: 'recharge',
      name: 'Recharge',
      text: '5',
      value: 5,
      raw: 'Recharge (5)',
    })
  })

  it('reads a value that hugs the name, as the SRD writes Multi-Hit(2)', () => {
    expect(parseAbilityTrait('Multi-Hit(2)')).toMatchObject({
      key: 'multi-hit',
      name: 'Multi-Hit',
      text: '2',
      value: 2,
    })
  })

  it('is case-insensitive about the name and keeps the canonical spelling', () => {
    expect(parseAbilityTrait('recharge(4)')).toMatchObject({
      key: 'recharge',
      name: 'Recharge',
      value: 4,
    })
  })

  it('parses a valueless trait', () => {
    expect(parseAbilityTrait('Action')).toMatchObject({
      key: null,
      name: 'Action',
      text: null,
      value: null,
    })
  })

  it('keeps non-numeric parenthetical text without inventing a value', () => {
    expect(parseAbilityTrait('Status (Quick)')).toMatchObject({
      key: null,
      name: 'Status',
      text: 'Quick',
      value: null,
    })
  })

  it('reads a numeric value for an unregistered trait too', () => {
    expect(parseAbilityTrait('Range (20)')).toMatchObject({
      key: null,
      name: 'Range',
      text: '20',
      value: 20,
    })
  })

  it('tolerates surrounding whitespace and inner padding', () => {
    expect(parseAbilityTrait('  Recharge ( 3 )  ')).toMatchObject({
      name: 'Recharge',
      text: '3',
      value: 3,
    })
  })

  it('returns null for blank input', () => {
    expect(parseAbilityTrait('')).toBeNull()
    expect(parseAbilityTrait('   ')).toBeNull()
  })

  it('degrades gracefully on malformed input instead of throwing', () => {
    expect(parseAbilityTrait('Recharge (4')).toMatchObject({
      key: null,
      name: 'Recharge (4',
      value: null,
    })
  })
})

describe('parseAbilityTraits', () => {
  it('parses a whole list and drops blanks', () => {
    expect(
      parseAbilityTraits(['Action', 'Recharge (4)', '', '  ']).map((t) => t.name),
    ).toEqual(['Action', 'Recharge'])
  })

  it('handles missing lists', () => {
    expect(parseAbilityTraits(undefined)).toEqual([])
    expect(parseAbilityTraits(null)).toEqual([])
  })
})

describe('trait lookups', () => {
  const traits = ['Action', 'Recharge (4)', 'Range (20)']

  it('finds by canonical name or by registry key', () => {
    expect(findAbilityTrait(traits, 'Recharge')?.value).toBe(4)
    expect(findAbilityTrait(traits, ABILITY_TRAITS.recharge.key)?.value).toBe(4)
    expect(findAbilityTrait(traits, 'recharge')?.value).toBe(4)
  })

  it('exposes the value directly', () => {
    expect(abilityTraitValue(traits, 'Recharge')).toBe(4)
    expect(abilityTraitValue(traits, 'Multi-Hit')).toBeNull()
    expect(abilityTraitValue(traits, 'Action')).toBeNull()
  })

  it('reports presence, including for valueless traits', () => {
    expect(hasAbilityTrait(traits, 'Action')).toBe(true)
    expect(hasAbilityTrait(traits, 'Explosive')).toBe(false)
  })

  it('returns every match in authored order', () => {
    expect(
      findAbilityTraits(['Recharge (2)', 'Recharge (5)'], 'Recharge').map(
        (t) => t.value,
      ),
    ).toEqual([2, 5])
  })

  it('ignores a blank query', () => {
    expect(findAbilityTrait(traits, '')).toBeNull()
  })
})

describe('ABILITY_TRAITS registry', () => {
  it('resolves both keys and names to a definition', () => {
    expect(findAbilityTraitDefinition('recharge')).toBe(ABILITY_TRAITS.recharge)
    expect(findAbilityTraitDefinition('RECHARGE')).toBe(ABILITY_TRAITS.recharge)
    expect(findAbilityTraitDefinition('nonsense')).toBeNull()
  })

  it('marks which traits carry a value', () => {
    expect(ABILITY_TRAITS.recharge.valued).toBe(true)
    expect(ABILITY_TRAITS.explosive.valued).toBe(false)
  })
})
