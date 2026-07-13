import { test, expect } from 'vitest'
import {
  slotCost,
  slotsUsed,
  canSlot,
  formatSlots,
  isOverflowed,
} from '@/lib/slotLogic'
import type { AbilityBlock } from '@/types'

/** Factory: create a minimal AbilityBlock for testing. */
function makeAbility(id: string, isMinor = false): AbilityBlock {
  return {
    id,
    name: `Ability ${id}`,
    traits: [],
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor,
  }
}

test('slotCost: regular ability = 1', () => {
  expect(slotCost(makeAbility('1'))).toBe(1)
})

test('slotCost: minor ability = 0.5', () => {
  expect(slotCost(makeAbility('1', true))).toBe(0.5)
})

test('slotsUsed: empty array = 0', () => {
  expect(slotsUsed([])).toBe(0)
})

test('slotsUsed: all regular abilities', () => {
  expect(slotsUsed([makeAbility('a'), makeAbility('b'), makeAbility('c')])).toBe(3)
})

test('slotsUsed: all minor abilities', () => {
  expect(slotsUsed([makeAbility('a', true), makeAbility('b', true)])).toBe(1)
})

test('slotsUsed: mixed regular and minor', () => {
  const abilities = [
    makeAbility('a'),       // 1
    makeAbility('b', true), // 0.5
    makeAbility('c'),       // 1
    makeAbility('d', true), // 0.5
  ]
  expect(slotsUsed(abilities)).toBe(3)
})

test('canSlot: room for regular ability', () => {
  const current = [makeAbility('a')] // 1 slot used
  expect(canSlot(current, 3, makeAbility('b'))).toBe(true)
})

test('canSlot: no room for regular ability', () => {
  const current = [makeAbility('a'), makeAbility('b'), makeAbility('c')] // 3 slots
  expect(canSlot(current, 3, makeAbility('d'))).toBe(false)
})

test('canSlot: room for minor ability (half slot)', () => {
  const current = [makeAbility('a'), makeAbility('b')] // 2 slots used
  expect(canSlot(current, 3, makeAbility('c', true))).toBe(true) // 2 + 0.5 = 2.5 <= 3
})

test('canSlot: exactly fills with minors', () => {
  const current = [makeAbility('a')] // 1 slot
  // 4 minors = 2 slots, total = 3 exactly
  const ability = makeAbility('b', true)
  // After adding, slots would be 1.5 — fits in 3
  expect(canSlot(current, 3, ability)).toBe(true)
})

test('canSlot: 2.5 + 0.5 = 3 fits exactly', () => {
  const current = [
    makeAbility('a'),       // 1
    makeAbility('b', true), // 0.5
    makeAbility('c', true), // 0.5
    makeAbility('d', true), // 0.5
  ] // total 2.5
  expect(canSlot(current, 3, makeAbility('e', true))).toBe(true)
})

test('canSlot: 3 + 0.5 exceeds 3', () => {
  const current = [makeAbility('a'), makeAbility('b'), makeAbility('c')] // 3
  expect(canSlot(current, 3, makeAbility('d', true))).toBe(false) // 3 + 0.5 > 3
})

test('formatSlots: integer', () => {
  expect(formatSlots(3)).toBe('3')
  expect(formatSlots(0)).toBe('0')
})

test('formatSlots: half', () => {
  expect(formatSlots(0.5)).toBe('0.5')
  expect(formatSlots(2.5)).toBe('2.5')
})

test('isOverflowed: under max', () => {
  expect(isOverflowed([makeAbility('a')], 3)).toBe(false)
})

test('isOverflowed: at max (not overflowed)', () => {
  expect(isOverflowed([makeAbility('a'), makeAbility('b'), makeAbility('c')], 3)).toBe(false)
})

test('isOverflowed: over max', () => {
  expect(isOverflowed([makeAbility('a'), makeAbility('b'), makeAbility('c'), makeAbility('d')], 3)).toBe(true)
})

test('isOverflowed: minors can overflow', () => {
  // 3 regular + 1 minor = 3.5 > 3
  const abilities = [
    makeAbility('a'),
    makeAbility('b'),
    makeAbility('c'),
    makeAbility('d', true),
  ]
  expect(isOverflowed(abilities, 3)).toBe(true)
})
