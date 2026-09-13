/**
 * Unit tests for lib/abilityUses.ts — the limited-use rules.
 *
 * Covers the user-facing contract: how an untrusted use entry is sanitized,
 * how a use is spent on activation (including the "don't expend on activate"
 * opt-out and the exhausted case), and that a full restore refills every
 * limited ability wherever it lives on the sheet.
 */

import { expect, test } from 'vitest'

import { createDefaultCharacter, generateId } from '@/constants/gameData'
import {
  MAX_ABILITY_USES,
  abilityUses,
  abilityUsesRemaining,
  buildAbilityUses,
  expendsUseOnActivate,
  hasUsesRemaining,
  instanceAbilityUsesRemaining,
  isLimitedAbility,
  normalizeAbilityUses,
  normalizeInstanceAbilityUses,
  restoreAllAbilityUses,
  setAbilityUsesRemaining,
  spendAbilityUse,
  withInstanceAbilityUses,
} from '@/lib/abilityUses'
import type { AbilityBlock, Character } from '@/types'

/** Minimal AbilityBlock fixture. */
function block(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return {
    id: generateId(),
    name: 'Test Ability',
    traits: [],
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
    ...overrides,
  }
}

/** A character whose slotted list holds the given abilities. */
function characterWith(...abilities: AbilityBlock[]): Character {
  return { ...createDefaultCharacter(), slottedAbilities: abilities }
}

/** A limited ability with `max` uses and `current` left. */
function limited(
  id: string,
  current: number,
  max = 3,
  expendOnActivate = true,
): AbilityBlock {
  return block({
    id,
    name: `Ability ${id}`,
    uses: { max, current, expendOnActivate },
  })
}

/** The ability with `id` on a character's slotted list. */
function slotted(character: Character, id: string): AbilityBlock {
  const found = character.slottedAbilities.find((a) => a.id === id)
  if (!found) throw new Error(`no slotted ability ${id}`)
  return found
}

// ---- normalizeAbilityUses --------------------------------------------------

test('normalizeAbilityUses: reads a well-formed entry', () => {
  expect(normalizeAbilityUses({ max: 3, current: 1, expendOnActivate: false })).toEqual({
    max: 3,
    current: 1,
    expendOnActivate: false,
  })
})

test('normalizeAbilityUses: defaults current to max and expendOnActivate to true', () => {
  expect(normalizeAbilityUses({ max: 4 })).toEqual({
    max: 4,
    current: 4,
    expendOnActivate: true,
  })
})

test('normalizeAbilityUses: clamps current into [0, max]', () => {
  expect(normalizeAbilityUses({ max: 3, current: 9 })?.current).toBe(3)
  expect(normalizeAbilityUses({ max: 3, current: -2 })?.current).toBe(0)
})

test('normalizeAbilityUses: clamps max to the ceiling and floors fractions', () => {
  expect(normalizeAbilityUses({ max: 5000 })?.max).toBe(MAX_ABILITY_USES)
  expect(normalizeAbilityUses({ max: 2.7 })?.max).toBe(2)
})

test('normalizeAbilityUses: rejects entries that cannot describe a limit', () => {
  expect(normalizeAbilityUses(undefined)).toBeUndefined()
  expect(normalizeAbilityUses(null)).toBeUndefined()
  expect(normalizeAbilityUses('3')).toBeUndefined()
  expect(normalizeAbilityUses({})).toBeUndefined()
  expect(normalizeAbilityUses({ max: 0 })).toBeUndefined()
  expect(normalizeAbilityUses({ max: -4 })).toBeUndefined()
  expect(normalizeAbilityUses({ max: 'many' })).toBeUndefined()
})

test('abilityUses: an ability without a limit reads as unlimited', () => {
  const plain = block()
  expect(isLimitedAbility(plain)).toBe(false)
  expect(abilityUses(plain)).toBeNull()
  expect(abilityUsesRemaining(plain)).toBe(0)
  expect(expendsUseOnActivate(plain)).toBe(false)
  expect(hasUsesRemaining(plain)).toBe(true)
})

test('abilityUses: a malformed limit reads as unlimited rather than broken', () => {
  const broken: AbilityBlock = { ...block(), uses: { max: 0, current: 0, expendOnActivate: true } }
  expect(isLimitedAbility(broken)).toBe(false)
})

// ---- buildAbilityUses ------------------------------------------------------

test('buildAbilityUses: fills current from max and clamps the maximum up to 1', () => {
  expect(buildAbilityUses({ max: 4 })).toEqual({
    max: 4,
    current: 4,
    expendOnActivate: true,
  })
  expect(buildAbilityUses({ max: 0 }).max).toBe(1)
  expect(buildAbilityUses({ max: -3 }).max).toBe(1)
})

test('buildAbilityUses: lowering the maximum pulls current down with it', () => {
  expect(buildAbilityUses({ max: 2, current: 5 }).current).toBe(2)
})

test('buildAbilityUses: raising the maximum leaves spent uses spent', () => {
  expect(buildAbilityUses({ max: 6, current: 2 }).current).toBe(2)
})

// ---- spending --------------------------------------------------------------

test('spendAbilityUse: consumes one use of a limited ability', () => {
  const char = characterWith(limited('a', 3))
  const { character, spent } = spendAbilityUse(char, 'a')
  expect(spent).toBe(true)
  expect(abilityUsesRemaining(slotted(character, 'a'))).toBe(2)
})

test('spendAbilityUse: an unlimited ability spends nothing and is untouched', () => {
  const char = characterWith({ ...block(), id: 'a' })
  const { character, spent } = spendAbilityUse(char, 'a')
  expect(spent).toBe(false)
  expect(character).toBe(char)
})

test('spendAbilityUse: expendOnActivate=false never spends a use', () => {
  const char = characterWith(limited('a', 3, 3, false))
  const { character, spent } = spendAbilityUse(char, 'a')
  expect(spent).toBe(false)
  expect(character).toBe(char)
  expect(abilityUsesRemaining(slotted(char, 'a'))).toBe(3)
})

test('spendAbilityUse: an exhausted ability reports no use spent', () => {
  const char = characterWith(limited('a', 0))
  const { character, spent } = spendAbilityUse(char, 'a')
  expect(spent).toBe(false)
  expect(character).toBe(char)
})

test('spendAbilityUse: an unknown id is a no-op', () => {
  const char = characterWith(limited('a', 3))
  expect(spendAbilityUse(char, 'nope').spent).toBe(false)
})

test('spendAbilityUse: reaches core, nested sub-abilities, and custom tabs', () => {
  const sub = limited('sub', 2)
  const parent: AbilityBlock = {
    ...block(),
    id: 'parent',
    subAbilitiesUnderDescription: [sub],
  }
  const custom: AbilityBlock = { ...limited('custom', 2), id: 'custom' }
  const char: Character = {
    ...createDefaultCharacter(),
    basicAttack: limited('basic', 2),
    fatebreaker: limited('fate', 2),
    slottedAbilities: [parent],
    customTabs: [
      {
        id: 'tab',
        name: 'Tab',
        sections: [{ kind: 'ability', id: 'sec', name: 'Sec', abilities: [custom] }],
      },
    ],
  }

  const afterSub = spendAbilityUse(char, 'sub').character
  expect(abilityUsesRemaining(afterSub.slottedAbilities[0].subAbilitiesUnderDescription[0])).toBe(1)

  const afterBasic = spendAbilityUse(char, 'basic').character
  expect(abilityUsesRemaining(afterBasic.basicAttack)).toBe(1)

  const afterFate = spendAbilityUse(char, 'fate').character
  expect(abilityUsesRemaining(afterFate.fatebreaker)).toBe(1)

  const afterCustom = spendAbilityUse(char, 'custom').character
  const section = afterCustom.customTabs[0].sections[0]
  const abilities = section.kind === 'ability' ? section.abilities : []
  expect(abilityUsesRemaining(abilities[0])).toBe(1)
})

// ---- restoring -------------------------------------------------------------

test('setAbilityUsesRemaining: clamps into [0, max]', () => {
  const char = characterWith(limited('a', 3))
  expect(abilityUsesRemaining(slotted(setAbilityUsesRemaining(char, 'a', 9), 'a'))).toBe(3)
  expect(abilityUsesRemaining(slotted(setAbilityUsesRemaining(char, 'a', -4), 'a'))).toBe(0)
})

test('setAbilityUsesRemaining: leaves unlimited and unknown abilities alone', () => {
  const char = characterWith({ ...block(), id: 'a' })
  expect(setAbilityUsesRemaining(char, 'a', 2)).toBe(char)
  expect(setAbilityUsesRemaining(char, 'nope', 2)).toBe(char)
})

test('restoreAllAbilityUses: refills every limited ability on the sheet', () => {
  const nestedParent: AbilityBlock = {
    ...block(),
    id: 'parent',
    subAbilitiesUnderOvercharge: [limited('sub', 0)],
  }
  const char: Character = {
    ...createDefaultCharacter(),
    innateAbilities: [limited('innate', 1)],
    basicAttack: limited('basic', 0),
    fatebreaker: limited('fate', 0),
    slottedAbilities: [limited('slotted', 0), nestedParent],
    abilityPool: [limited('pool', 2)],
  }

  const restored = restoreAllAbilityUses(char)

  expect(abilityUsesRemaining(restored.innateAbilities[0])).toBe(3)
  expect(abilityUsesRemaining(restored.basicAttack)).toBe(3)
  expect(abilityUsesRemaining(restored.fatebreaker)).toBe(3)
  expect(abilityUsesRemaining(restored.slottedAbilities[0])).toBe(3)
  expect(abilityUsesRemaining(restored.slottedAbilities[1].subAbilitiesUnderOvercharge[0])).toBe(3)
  expect(abilityUsesRemaining(restored.abilityPool[0])).toBe(3)
})

test('restoreAllAbilityUses: respects each ability’s own maximum', () => {
  const char = characterWith(limited('a', 0, 5), limited('b', 1, 2))
  const restored = restoreAllAbilityUses(char)
  expect(abilityUsesRemaining(slotted(restored, 'a'))).toBe(5)
  expect(abilityUsesRemaining(slotted(restored, 'b'))).toBe(2)
})

test('restoreAllAbilityUses: an already-full sheet keeps every reference', () => {
  const char = characterWith(limited('a', 3), { ...block(), id: 'b' })
  const restored = restoreAllAbilityUses(char)
  expect(restored).toBe(char)
  expect(restored.slottedAbilities[0]).toBe(char.slottedAbilities[0])
})

test('restoreAllAbilityUses: keeps untouched sibling references stable', () => {
  const full = limited('full', 3)
  const spent = limited('spent', 0)
  const char = characterWith(full, spent)
  const restored = restoreAllAbilityUses(char)
  expect(restored).not.toBe(char)
  expect(restored.slottedAbilities[0]).toBe(full)
  expect(restored.slottedAbilities[1]).not.toBe(spent)
})

// ---- NPC instances (GM Screen) ---------------------------------------------

test('normalizeInstanceAbilityUses: repairs an untrusted map', () => {
  expect(normalizeInstanceAbilityUses({ a: 2, b: '1', c: -3, d: 1.9, e: 'x' })).toEqual({
    a: 2,
    b: 1,
    c: 0,
    d: 1,
  })
  // A blank id, a non-numeric count and a count above the ceiling are dropped
  // or clamped; a non-object reads as an untouched map.
  expect(normalizeInstanceAbilityUses({ '': 2, a: MAX_ABILITY_USES + 50 })).toEqual({
    a: MAX_ABILITY_USES,
  })
  expect(normalizeInstanceAbilityUses(null)).toEqual({})
  expect(normalizeInstanceAbilityUses(['a'])).toEqual({})
})

test('instanceAbilityUsesRemaining: an untouched ability reads as its maximum', () => {
  // The base's own `current` is deliberately ignored: 1 of 3 spent on the base
  // sheet must not reach an instance spawned from it.
  const ability = limited('a', 1)
  expect(instanceAbilityUsesRemaining(ability, undefined)).toBe(3)
  expect(instanceAbilityUsesRemaining(ability, null)).toBe(3)
  expect(instanceAbilityUsesRemaining(ability, 0)).toBe(0)
  expect(instanceAbilityUsesRemaining(ability, 2)).toBe(2)
  // A stale count is tightened by the ability's current maximum.
  expect(instanceAbilityUsesRemaining(ability, 9)).toBe(3)
  expect(instanceAbilityUsesRemaining(ability, -2)).toBe(0)
  // Unlimited abilities have no budget to read.
  expect(instanceAbilityUsesRemaining(block({ id: 'plain' }), 2)).toBe(0)
})

test('withInstanceAbilityUses: an untouched instance renders the base itself', () => {
  // Every authored ability is at its maximum, so there is nothing to project:
  // the base reference survives and no card below is asked to re-render.
  const char = characterWith(limited('a', 3), { ...block(), id: 'plain' })
  expect(withInstanceAbilityUses(char, {})).toBe(char)
  expect(withInstanceAbilityUses(char, undefined)).toBe(char)
})

test('withInstanceAbilityUses: applies the instance’s count, not the base’s', () => {
  const char = characterWith(limited('a', 3), limited('b', 3))

  const projected = withInstanceAbilityUses(char, { a: 1 })

  expect(abilityUsesRemaining(slotted(projected, 'a'))).toBe(1)
  // The ability the instance has not spent into keeps its authored maximum.
  expect(abilityUsesRemaining(slotted(projected, 'b'))).toBe(3)
  // Sibling references are preserved so an untouched card cannot re-render.
  expect(slotted(projected, 'b')).toBe(slotted(char, 'b'))
  // The base record itself is untouched.
  expect(abilityUsesRemaining(slotted(char, 'a'))).toBe(3)
})

test('withInstanceAbilityUses: a depleted base ability starts full on the instance', () => {
  const char = characterWith(limited('a', 0))
  const projected = withInstanceAbilityUses(char, {})
  expect(abilityUsesRemaining(slotted(projected, 'a'))).toBe(3)
  expect(projected).not.toBe(char)
})

test('withInstanceAbilityUses: clamps a stale count and reaches sub-abilities', () => {
  const parent: AbilityBlock = {
    ...block(),
    id: 'parent',
    subAbilitiesUnderDescription: [limited('sub', 3)],
  }
  const char = characterWith(parent, limited('a', 3))

  const projected = withInstanceAbilityUses(char, { a: 9, sub: 0 })

  expect(abilityUsesRemaining(slotted(projected, 'a'))).toBe(3)
  expect(
    abilityUsesRemaining(slotted(projected, 'parent').subAbilitiesUnderDescription[0]),
  ).toBe(0)
})

test('withInstanceAbilityUses: leaves unlimited abilities and unknown ids alone', () => {
  const char = characterWith({ ...block(), id: 'plain' })
  const projected = withInstanceAbilityUses(char, { plain: 1, nope: 2 })
  expect(projected).toBe(char)
})
