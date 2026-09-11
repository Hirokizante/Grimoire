/**
 * Tests for the Recharge rules helper.
 *
 * Reads the trait through the shared trait parser, resolves a Recharge Die roll
 * against a cooldown list, and builds the loggable roll result.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  RECHARGE_DIE_SIDES,
  RECHARGE_ROLL_NOTATION,
  abilityIndex,
  abilityRechargeValue,
  hasRechargeTrait,
  isRechargeAbility,
  rechargeRollResult,
  resolveRecharge,
  rollRechargeDie,
} from '@/lib/abilityRecharge'
import { createDefaultNPC } from '@/constants/gameData'
import type { AbilityBlock, Character } from '@/types'

/** A minimal ability with the given traits. */
function ability(id: string, name: string, traits: string[]): AbilityBlock {
  return {
    id,
    name,
    traits,
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
  }
}

/** An NPC carrying the given slotted abilities. */
function npc(abilities: AbilityBlock[]): Character {
  return { ...createDefaultNPC(), id: 'npc-1', name: 'Bandit', slottedAbilities: abilities }
}

const fireBreath = ability('a1', 'Fire Breath', ['Action', 'Recharge (5)'])
const bite = ability('a2', 'Bite', ['Recharge (3)'])
const slash = ability('a3', 'Slash', ['Action'])

describe('abilityRechargeValue', () => {
  it('reads the value from the Recharge trait', () => {
    expect(abilityRechargeValue(fireBreath)).toBe(5)
    expect(abilityRechargeValue(bite)).toBe(3)
  })

  it('is null without the trait or without a number', () => {
    expect(abilityRechargeValue(slash)).toBeNull()
    expect(abilityRechargeValue(ability('a4', 'Odd', ['Recharge (many)']))).toBeNull()
  })

  it('distinguishes "has the trait" from "has a usable value"', () => {
    const odd = ability('a4', 'Odd', ['Recharge (many)'])
    expect(hasRechargeTrait(odd)).toBe(true)
    expect(isRechargeAbility(odd)).toBe(false)
    expect(isRechargeAbility(fireBreath)).toBe(true)
    expect(hasRechargeTrait(slash)).toBe(false)
  })
})

describe('abilityIndex', () => {
  it('indexes top-level and nested sub-abilities', () => {
    const sub = ability('sub-1', 'Spark', ['Recharge (2)'])
    const parent = {
      ...fireBreath,
      subAbilitiesUnderDescription: [sub],
    }
    const index = abilityIndex(npc([parent, bite]))
    // (The default NPC also carries its generated Basic Attack; only the
    // slotted abilities and their nested sub-abilities matter here.)
    expect(['a1', 'a2', 'sub-1'].every((id) => index.has(id))).toBe(true)
    expect(index.get('sub-1')).toBe(sub)
  })
})

describe('resolveRecharge', () => {
  const entity = npc([fireBreath, bite, slash])

  it('recharges everything at or below the roll', () => {
    const outcome = resolveRecharge(entity, ['a1', 'a2'], 5)
    expect(outcome.roll).toBe(5)
    expect(outcome.recharged.map((r) => r.name)).toEqual(['Fire Breath', 'Bite'])
    expect(outcome.recharged.map((r) => r.value)).toEqual([5, 3])
    expect(outcome.stillCooling).toEqual([])
  })

  it('keeps abilities above the roll cooling, with their values', () => {
    const outcome = resolveRecharge(entity, ['a1', 'a2'], 4)
    expect(outcome.recharged.map((r) => r.name)).toEqual(['Bite'])
    expect(outcome.stillCooling).toEqual([
      { id: 'a1', name: 'Fire Breath', value: 5 },
    ])
  })

  it('recharges nothing on a roll below every value', () => {
    const outcome = resolveRecharge(entity, ['a1'], 1)
    expect(outcome.recharged).toEqual([])
    expect(outcome.stillCooling.map((r) => r.name)).toEqual(['Fire Breath'])
  })

  it('drops ids that no longer resolve to a Recharge ability', () => {
    // 'a3' has no trait; 'gone' was deleted. Neither may stay cooling forever.
    const outcome = resolveRecharge(entity, ['a3', 'gone', 'a2'], 1)
    expect(outcome.recharged).toEqual([])
    expect(outcome.stillCooling.map((r) => r.id)).toEqual(['a2'])
  })

  it('falls back to a readable name for an untitled ability', () => {
    const unnamed = ability('a9', '', ['Recharge (2)'])
    const outcome = resolveRecharge(npc([unnamed]), ['a9'], 2)
    expect(outcome.recharged[0].name).toBe('Untitled Ability')
  })
})

describe('rollRechargeDie', () => {
  it('rolls a d6', () => {
    const spy = vi.spyOn(Math, 'random')
    spy.mockReturnValue(0)
    expect(RECHARGE_DIE_SIDES).toBe(6)
    expect(rollRechargeDie()).toBe(1)
    spy.mockReturnValue(0.999999)
    expect(rollRechargeDie()).toBe(6)
    spy.mockRestore()
  })
})

describe('rechargeRollResult', () => {
  it('wraps an already-rolled die in the dice roller shape', () => {
    const result = rechargeRollResult(5)
    expect(result.notation).toBe(RECHARGE_ROLL_NOTATION)
    expect(result.total).toBe(5)
    expect(result.terms[0].rolls).toEqual([5])
    expect(result.breakdown).toBe('1d6 → 5 = 5')
  })
})
