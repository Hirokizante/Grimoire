/**
 * Migration tests for `normalizeCharacter` (lib/db.ts). Covers the
 * view-modes schema addition — both the "old record, no viewModes" path
 * and the partial-fill path where an existing viewModes is missing an entry
 * for a tab/section that the character has since gained.
 *
 * `normalizeCharacter` is a pure function — no IndexedDB mocking needed.
 * We feed it pre-normalized shapes cast through `unknown` to exercise the
 * legacy branches.
 */

import { test, expect } from 'vitest'
import { normalizeCharacter } from '@/lib/db'
import { createDefaultCharacter } from '@/constants/gameData'
import type { Character } from '@/types'

/** Cast an object to Character (bypassing TS for legacy-shape fixtures). */
function asCharacter(value: Record<string, unknown>): Character {
  return value as unknown as Character
}

/** Strip a key via spread+delete (shallow structural cast). */
function omit<K extends string>(
  value: Record<string, unknown>,
  key: K,
): Record<string, unknown> {
  const copy = { ...value }
  delete copy[key]
  return copy
}

test('normalizeCharacter: new-shape character is idempotent', () => {
  const char = createDefaultCharacter()
  const out = normalizeCharacter(char)
  // Shape identical; not the same ref (we shallow-copy) — values match.
  expect(out.viewModes.slottedAbilities).toBe('grid')
  expect(out.viewModes.abilityPool).toBe('grid')
  expect(out.viewModes.customTabs).toEqual({})
  expect(out.customTabs).toEqual([])
  // Idempotent when run again.
  expect(normalizeCharacter(out)).toEqual(out)
})

test('normalizeCharacter: fills missing viewModes for an old record', () => {
  const char = createDefaultCharacter()
  // Simulate a character serialized before viewModes existed.
  const oldShape = omit({ ...char, customTabs: [
    {
      id: 'tab-1',
      name: 'My Tab',
      sections: [
        { id: 'sec-1', name: 'Offense', abilities: [] },
        { id: 'sec-2', name: 'Defense', abilities: [] },
      ],
    },
  ] }, 'viewModes')

  const out = normalizeCharacter(asCharacter(oldShape))

  expect(out.viewModes.slottedAbilities).toBe('grid')
  expect(out.viewModes.abilityPool).toBe('grid')
  expect(out.viewModes.customTabs).toEqual({
    'tab-1': { 'sec-1': 'grid', 'sec-2': 'grid' },
  })
  // Original customTabs preserved.
  expect(out.customTabs).toHaveLength(1)
  expect(out.customTabs[0].sections).toHaveLength(2)
})

test('normalizeCharacter: fills missing sections in an existing partial viewModes', () => {
  const char = createDefaultCharacter()
  // Start with one section, then simulate a later add via a second section.
  const base: Character = {
    ...char,
    customTabs: [
      {
        id: 'tab-1',
        name: 'My Tab',
        sections: [
          { id: 'sec-1', name: 'Offense', abilities: [] },
          { id: 'sec-2', name: 'Defense', abilities: [] },
        ],
      },
    ],
    viewModes: {
      slottedAbilities: 'list',
      abilityPool: 'grid',
      // Only sec-1 is remembered.
      customTabs: { 'tab-1': { 'sec-1': 'list' } },
    },
  }

  const out = normalizeCharacter(base)

  // Preserves explicit choices.
  expect(out.viewModes.slottedAbilities).toBe('list')
  expect(out.viewModes.customTabs['tab-1']['sec-1']).toBe('list')
  // Adds the missing sec-2 with default 'grid'.
  expect(out.viewModes.customTabs['tab-1']['sec-2']).toBe('grid')
})

test('normalizeCharacter: respects built-in view-mode overrides', () => {
  const char = createDefaultCharacter()
  const base: Character = {
    ...char,
    viewModes: {
      slottedAbilities: 'list',
      abilityPool: 'list',
      customTabs: {},
    },
  }
  const out = normalizeCharacter(base)
  expect(out.viewModes.slottedAbilities).toBe('list')
  expect(out.viewModes.abilityPool).toBe('list')
})

test('normalizeCharacter: legacy innateAbility migration still works', () => {
  const char = createDefaultCharacter()
  // Inject the old single-ability field and strip the new array.
  const old = omit(
    {
      ...char,
      innateAbility: char.basicAttack,
    } as Record<string, unknown>,
    'innateAbilities',
  )
  const out = normalizeCharacter(asCharacter(old))
  expect(Array.isArray(out.innateAbilities)).toBe(true)
})

test('normalizeCharacter: missing customTabs defaults to []', () => {
  const char = createDefaultCharacter()
  const old = omit(char as unknown as Record<string, unknown>, 'customTabs')
  const out = normalizeCharacter(asCharacter(old))
  expect(Array.isArray(out.customTabs)).toBe(true)
})

test('normalizeCharacter: empty customTabs still seeds an empty customTabs viewModes map', () => {
  const char = createDefaultCharacter()
  const old = omit({ ...char, customTabs: [] } as Record<string, unknown>, 'viewModes')
  const out = normalizeCharacter(asCharacter(old))
  expect(out.viewModes.customTabs).toEqual({})
})
