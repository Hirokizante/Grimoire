import { test, expect } from 'vitest'
import {
  collectCharacterStatusNames,
  collectReferencedStatuses,
  findStatusReferences,
  hasStatusCandidate,
  referencingCharacters,
  statusByName,
} from '@/lib/statusReference'
import { createDefaultCharacter } from '@/constants/gameData'
import { createDefaultStatuses } from '@/constants/statuses'
import type { StatusCondition } from '@/types'

function makeStatus(name: string): StatusCondition {
  return {
    id: `id-${name}`,
    name,
    icon: '💀',
    iconType: 'emoji',
    description: `${name} description`,
    tags: [],
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
  }
}

// ---- findStatusReferences -------------------------------------------------

test('findStatusReferences: finds bracketed names with offsets', () => {
  const refs = findStatusReferences('Inflicts [Poisoned] on hit, then [Dazed].')
  expect(refs).toHaveLength(2)
  expect(refs[0].name).toBe('Poisoned')
  // 'Inflicts ' is 9 chars; opening bracket at index 9.
  expect(refs[0].start).toBe(9)
  expect(refs[1].name).toBe('Dazed')
})

test('findStatusReferences: trims inner whitespace and skips empty brackets', () => {
  const refs = findStatusReferences('[  Poisoned  ] and [] and [x]')
  expect(refs.map((r) => r.name)).toEqual(['Poisoned', 'x'])
})

test('findStatusReferences: returns empty for no brackets', () => {
  expect(findStatusReferences('no brackets here')).toEqual([])
  expect(findStatusReferences('')).toEqual([])
})

test('hasStatusCandidate: detects brackets', () => {
  expect(hasStatusCandidate('[Poisoned]')).toBe(true)
  expect(hasStatusCandidate('no brackets')).toBe(false)
  expect(hasStatusCandidate('')).toBe(false)
})

// ---- statusByName ---------------------------------------------------------

test('statusByName: matches case-insensitively and trims', () => {
  const statuses = [makeStatus('Poisoned')]
  expect(statusByName(statuses, 'poisoned')?.id).toBe('id-Poisoned')
  expect(statusByName(statuses, '  Poisoned  ')?.id).toBe('id-Poisoned')
  expect(statusByName(statuses, 'Cursed')).toBeNull()
})

// ---- collectCharacterStatusNames ------------------------------------------

test('collectCharacterStatusNames: scans innate description and ability blocks', () => {
  const char = createDefaultCharacter()
  char.innateDescription = 'Master of [Poisoned] arts.'
  char.basicAttack = {
    ...char.basicAttack,
    description: 'Strikes and applies [Bleeding].',
  }
  char.fatebreaker = { ...char.fatebreaker, overcharge: 'Also causes [Cursed].' }
  char.slottedAbilities = [
    {
      ...char.basicAttack,
      id: 'slot-1',
      flavorText: 'A [Poisoned] touch.',
    },
  ]

  const names = collectCharacterStatusNames(char)
  expect(names).toContain('poisoned')
  expect(names).toContain('bleeding')
  expect(names).toContain('cursed')
  // Deduplicated.
  expect(names.filter((n) => n === 'poisoned')).toHaveLength(1)
})

test('collectCharacterStatusNames: scans custom ability and text sections', () => {
  const char = createDefaultCharacter()
  char.customTabs = [
    {
      id: 'tab-1',
      name: 'Moves',
      sections: [
        {
          kind: 'ability',
          id: 'sec-1',
          name: 'Offense',
          abilities: [
            { ...char.basicAttack, id: 'a1', description: 'Applies [Stunned].' },
          ],
        },
        {
          kind: 'text',
          id: 'sec-2',
          name: 'Lore',
          content: 'She is [Hidden] in shadow.',
        },
      ],
    },
  ]

  const names = collectCharacterStatusNames(char)
  expect(names).toContain('stunned')
  expect(names).toContain('hidden')
})

// ---- collectReferencedStatuses --------------------------------------------

test('collectReferencedStatuses: returns matching status records', () => {
  const char = createDefaultCharacter()
  char.innateDescription = 'Causes [Poisoned] and [Cursed].'
  const statuses = [makeStatus('Poisoned'), makeStatus('Cursed'), makeStatus('Hidden')]

  const referenced = collectReferencedStatuses(char, statuses)
  expect(referenced.map((s) => s.name)).toEqual(['Poisoned', 'Cursed'])
})

// ---- referencingCharacters -------------------------------------------------

test('referencingCharacters: returns sheets that reference a status', () => {
  const a = createDefaultCharacter()
  a.name = 'Alice'
  a.innateDescription = 'Uses [Poisoned].'

  const b = createDefaultCharacter()
  b.name = 'Bob'
  b.basicAttack = { ...b.basicAttack, description: 'A plain strike.' }

  const c = createDefaultCharacter()
  c.name = 'Carol'
  c.innateDescription = 'Also uses [poisoned].'

  const refs = referencingCharacters('Poisoned', [a, b, c])
  expect(refs.map((x) => x.name)).toEqual(['Alice', 'Carol'])
})

// Sanity: the built-in default set exposes the ten Divergence conditions.
test('createDefaultStatuses: seeds ten default conditions with the Default tag', () => {
  const defaults = createDefaultStatuses()
  expect(defaults).toHaveLength(10)
  expect(defaults.every((s) => s.tags.includes('Default'))).toBe(true)
  expect(defaults.map((s) => s.name)).toContain('Blinded')
})
