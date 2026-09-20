/**
 * Unit tests for lib/abilityClone.ts — the duplicate / paste copy rules.
 *
 * The contract worth pinning: a clone is a *new* block (fresh ids at every
 * level, so two cards can never share a dnd-kit id), live-play state starts
 * clean (a full uses budget, switches off), and everything authored travels
 * untouched while the original is left alone.
 */

import { expect, test } from 'vitest'

import { cloneAbilityBlock } from '@/lib/abilityClone'
import type { AbilityBlock } from '@/types'

/** A fully-authored ability, with one sub-ability under each nesting point. */
function parentAbility(): AbilityBlock {
  return {
    id: 'parent',
    name: 'Cleave',
    traits: ['Action', 'Recharge (5)'],
    cost: { ap: 2, end: 1, fp: 1, custom: { bar1: 2 } },
    damage: '2d6+MAR',
    description: 'A wide swing.',
    overcharge: 'Spend 1 FP to hit again.',
    flavorText: 'The blade remembers.',
    isMinor: false,
    showActivate: true,
    modifiers: [{ target: 'evasion', value: 1 }],
    modifiersActive: true,
    uses: { max: 3, current: 1, expendOnActivate: false },
    activationRolls: {
      accuracy: { modifier: { kind: 'attribute', key: 'MAR' }, bonus: '+1d4' },
      damage: true,
      custom: [{ notation: '1d4', label: 'Bleed' }],
    },
    subAbilitiesUnderDescription: [
      {
        id: 'sub-desc',
        name: 'Follow-through',
        traits: [],
        cost: {},
        damage: '1d6',
        description: '',
        overcharge: '',
        flavorText: '',
        isMinor: false,
        showActivate: true,
        subAbilitiesUnderDescription: [],
        subAbilitiesUnderOvercharge: [],
      },
    ],
    subAbilitiesUnderOvercharge: [
      {
        id: 'sub-over',
        name: 'Deep Cut',
        traits: [],
        cost: {},
        damage: '',
        description: '',
        overcharge: '',
        flavorText: '',
        isMinor: false,
        showActivate: true,
        colorOverride: 'danger',
        subAbilitiesUnderDescription: [],
        subAbilitiesUnderOvercharge: [],
      },
    ],
  }
}

test('cloneAbilityBlock: regenerates every id in the tree', () => {
  const source = parentAbility()
  const clone = cloneAbilityBlock(source)

  expect(clone.id).not.toBe(source.id)
  expect(clone.subAbilitiesUnderDescription[0].id).not.toBe(
    source.subAbilitiesUnderDescription[0].id,
  )
  expect(clone.subAbilitiesUnderOvercharge[0].id).not.toBe(
    source.subAbilitiesUnderOvercharge[0].id,
  )
  // A sibling id is never reused for a different block.
  expect(clone.subAbilitiesUnderDescription[0].id).not.toBe(
    clone.subAbilitiesUnderOvercharge[0].id,
  )
})

test('cloneAbilityBlock: keeps every authored field', () => {
  const source = parentAbility()
  const clone = cloneAbilityBlock(source)

  expect(clone.name).toBe('Cleave')
  expect(clone.traits).toEqual(['Action', 'Recharge (5)'])
  expect(clone.cost).toEqual(source.cost)
  expect(clone.damage).toBe('2d6+MAR')
  expect(clone.description).toBe('A wide swing.')
  expect(clone.overcharge).toBe('Spend 1 FP to hit again.')
  expect(clone.flavorText).toBe('The blade remembers.')
  expect(clone.isMinor).toBe(false)
  expect(clone.showActivate).toBe(true)
  expect(clone.modifiers).toEqual(source.modifiers)
  expect(clone.activationRolls).toEqual(source.activationRolls)
  expect(clone.subAbilitiesUnderOvercharge[0].colorOverride).toBe('danger')
  // The authored use *limit* travels; only the spent count is re-seeded.
  expect(clone.uses).toEqual({ max: 3, current: 3, expendOnActivate: false })
})

test('cloneAbilityBlock: starts live-play state clean', () => {
  const source = parentAbility()
  const clone = cloneAbilityBlock(source)

  expect(clone.uses?.current).toBe(3)
  expect(clone.modifiersActive).toBe(false)
  // The original is untouched.
  expect(source.uses?.current).toBe(1)
  expect(source.modifiersActive).toBe(true)
})

test('cloneAbilityBlock: the copy is detached from the original', () => {
  const source = parentAbility()
  const clone = cloneAbilityBlock(source)

  clone.name = 'Renamed'
  clone.traits.push('New')
  clone.cost.ap = 99
  clone.subAbilitiesUnderDescription[0].name = 'Changed'

  expect(source.name).toBe('Cleave')
  expect(source.traits).toEqual(['Action', 'Recharge (5)'])
  expect(source.cost.ap).toBe(2)
  expect(source.subAbilitiesUnderDescription[0].name).toBe('Follow-through')
})

test('cloneAbilityBlock: an unlimited ability stays unlimited', () => {
  const source = parentAbility()
  delete source.uses
  const clone = cloneAbilityBlock(source)
  expect(clone.uses).toBeUndefined()
  expect('uses' in clone).toBe(false)
})

test('cloneAbilityBlock: a malformed uses entry is dropped', () => {
  const source = parentAbility()
  source.uses = { max: 0, current: 0, expendOnActivate: true }
  const clone = cloneAbilityBlock(source)
  expect(clone.uses).toBeUndefined()
})
