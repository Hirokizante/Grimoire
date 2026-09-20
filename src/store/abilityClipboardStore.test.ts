/**
 * Unit tests for store/abilityClipboardStore.ts — the one-slot clipboard.
 *
 * Pins the snapshot rule: copying detaches the block from the source, so the
 * clipboard keeps what was copied even after the original is edited. The
 * fresh-id / reset-state work belongs to lib/abilityClone.ts and is pinned
 * there.
 */

import { beforeEach, expect, test } from 'vitest'

import { useAbilityClipboardStore } from '@/store/abilityClipboardStore'
import type { AbilityBlock } from '@/types'

/** Minimal AbilityBlock fixture. */
function block(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return {
    id: 'ability-1',
    name: 'Cleave',
    traits: ['Action'],
    cost: { ap: 1 },
    damage: '1d6',
    description: 'A wide swing.',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
    ...overrides,
  }
}

beforeEach(() => {
  useAbilityClipboardStore.setState({ copied: null })
})

test('copyAbility: stores a snapshot of the block', () => {
  useAbilityClipboardStore.getState().copyAbility(block())
  expect(useAbilityClipboardStore.getState().copied?.name).toBe('Cleave')
})

test('copyAbility: later edits to the original do not change the clipboard', () => {
  const source = block()
  useAbilityClipboardStore.getState().copyAbility(source)

  source.name = 'Renamed'
  source.traits.push('New')
  source.cost.ap = 99
  source.subAbilitiesUnderDescription.push(block({ id: 'sub', name: 'Sub' }))

  const copied = useAbilityClipboardStore.getState().copied!
  expect(copied.name).toBe('Cleave')
  expect(copied.traits).toEqual(['Action'])
  expect(copied.cost.ap).toBe(1)
  expect(copied.subAbilitiesUnderDescription).toEqual([])
})

test('copyAbility: replaces whatever was on the clipboard', () => {
  useAbilityClipboardStore.getState().copyAbility(block({ name: 'First' }))
  useAbilityClipboardStore.getState().copyAbility(block({ name: 'Second' }))
  expect(useAbilityClipboardStore.getState().copied?.name).toBe('Second')
})

test('clearClipboard: empties the clipboard', () => {
  useAbilityClipboardStore.getState().copyAbility(block())
  useAbilityClipboardStore.getState().clearClipboard()
  expect(useAbilityClipboardStore.getState().copied).toBeNull()
})
