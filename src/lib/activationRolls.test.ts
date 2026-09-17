/**
 * Tests for the automatic rolls an ability performs on activation.
 *
 * Covers the three things the feature has to agree on everywhere:
 *   - what a stored/imported config is allowed to say (normalization),
 *   - what notation the acting entity's stats produce (the plan), and
 *   - the order and grouping of the executed rolls.
 *
 * The player-sheet, sub-ability, NPC-instance and GM-panel paths all run
 * through these functions, so pinning them here pins the behaviour on every
 * surface.
 */

import { afterEach, expect, test, vi } from 'vitest'

import {
  MAX_ACTIVATION_CUSTOM_ROLLS,
  accuracyModifierValue,
  accuracyNotation,
  activationRollOutcomes,
  buildActivationRollPlan,
  hasActivationRollOutcomes,
  hasActivationRolls,
  normalizeActivationRolls,
  rollAbilityActivation,
  runActivationRollPlan,
} from '@/lib/activationRolls'
import {
  createDefaultBasicAttack,
  createDefaultCharacter,
  createDefaultNPC,
  generateId,
} from '@/constants/gameData'
import type { AbilityBlock, Character } from '@/types'

// The store modules read IndexedDB at import time; this test only exercises the
// pure roll planner, so the database layer is stubbed out.
vi.mock('@/lib/db', () => ({
  getAllCharacters: vi.fn(async () => []),
  getAllStatuses: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  getAllScreens: vi.fn(async () => []),
  getAllVersionSnapshots: vi.fn(async () => []),
  putRollLogEntry: vi.fn(async () => {}),
  replaceAllData: vi.fn(async () => {}),
}))

/** A blank ability, built here so this test does not import the editor UI. */
function blankAbility(): AbilityBlock {
  return {
    id: generateId(),
    name: '',
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
  }
}

/**
 * Deterministic dice. `rollDie` receives the die's side count and returns the
 * next queued value — so a test writes the results it wants in the order the
 * roll happens, and the assertion reads like the table would.
 */
const rollQueue: number[] = []
vi.mock('@/lib/dice', () => ({
  rollDie: () => rollQueue.shift() ?? 1,
}))

afterEach(() => {
  rollQueue.length = 0
  vi.restoreAllMocks()
})

/** A character with known attributes and one custom attribute. */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    ...createDefaultCharacter(),
    id: 'char-1',
    name: 'Vera',
    attributes: { MAR: 4, POW: 2, AGI: 1, VIT: 3, GRT: 0 },
    customAttributes: [
      {
        id: 'attr-san',
        name: 'Sanity',
        shorthand: 'SAN',
        value: 7,
        showSteppers: false,
      },
    ],
    ...overrides,
  }
}

/** An ability carrying whatever activation config a test needs. */
function makeAbility(
  activationRolls: AbilityBlock['activationRolls'],
  overrides: Partial<AbilityBlock> = {},
): AbilityBlock {
  return { ...blankAbility(), name: 'Cleave', ...overrides, activationRolls }
}

// ---- normalization ----------------------------------------------------------

test('normalization drops an empty config entirely', () => {
  expect(normalizeActivationRolls(undefined)).toBeUndefined()
  expect(normalizeActivationRolls(null)).toBeUndefined()
  expect(normalizeActivationRolls({})).toBeUndefined()
  expect(normalizeActivationRolls({ damage: false })).toBeUndefined()
  expect(normalizeActivationRolls({ custom: [] })).toBeUndefined()
  expect(normalizeActivationRolls('nonsense')).toBeUndefined()
})

test('normalization keeps a well-formed config', () => {
  expect(
    normalizeActivationRolls({
      accuracy: { modifier: { kind: 'attribute', key: 'POW' }, bonus: '+2' },
      damage: true,
      custom: [{ notation: '2d6+POW', label: 'Bleed', hidden: true }],
    }),
  ).toEqual({
    accuracy: { modifier: { kind: 'attribute', key: 'POW' }, bonus: '+2' },
    damage: true,
    custom: [{ notation: '2d6+POW', label: 'Bleed', hidden: true }],
  })
})

test('an accuracy roll with an unknown attribute reads as no accuracy roll', () => {
  expect(
    normalizeActivationRolls({ accuracy: { modifier: { kind: 'attribute', key: 'XYZ' } } }),
  ).toBeUndefined()
  expect(
    normalizeActivationRolls({ accuracy: { modifier: { kind: 'attribute' } } }),
  ).toBeUndefined()
})

test('a custom accuracy reference keeps its id and notation token', () => {
  expect(
    normalizeActivationRolls({
      accuracy: { modifier: { kind: 'custom', id: 'attr-san', token: ' SAN ' } },
    }),
  ).toEqual({
    accuracy: { modifier: { kind: 'custom', id: 'attr-san', token: 'SAN' } },
  })
  // A custom reference with no token cannot be rolled — drop it rather than
  // storing a reference nothing can resolve.
  expect(
    normalizeActivationRolls({
      accuracy: { modifier: { kind: 'custom', id: 'attr-san', token: '' } },
    }),
  ).toBeUndefined()
})

test('custom rolls without an expression are dropped, labels are trimmed', () => {
  const normalized = normalizeActivationRolls({
    custom: [
      { notation: '  ' },
      { notation: '1d6', label: '  Burn  ' },
      { notation: '1d4', hidden: 'yes' },
      null,
      '1d8',
    ],
  })
  expect(normalized).toEqual({
    custom: [{ notation: '1d6', label: 'Burn' }, { notation: '1d4' }],
  })
})

test('the custom roll count is capped', () => {
  const custom = Array.from({ length: MAX_ACTIVATION_CUSTOM_ROLLS + 5 }, () => ({
    notation: '1d6',
  }))
  expect(normalizeActivationRolls({ custom })?.custom).toHaveLength(
    MAX_ACTIVATION_CUSTOM_ROLLS,
  )
})

test('hasActivationRolls reports whether an ability rolls anything', () => {
  expect(hasActivationRolls(blankAbility())).toBe(false)
  expect(hasActivationRolls(makeAbility({ damage: true }))).toBe(true)
  expect(
    hasActivationRolls(
      makeAbility({ accuracy: { modifier: { kind: 'attribute', key: 'MAR' } } }),
    ),
  ).toBe(true)
})

// ---- notation ---------------------------------------------------------------

test('accuracy rolls d20 plus the chosen attribute', () => {
  const character = makeCharacter()
  expect(
    accuracyNotation({ modifier: { kind: 'attribute', key: 'MAR' } }, character),
  ).toBe('d20+MAR')
})

test('accuracy rolls the attribute effective value, not the stored one', () => {
  // A switched-on ability modifier moves MAR; the accuracy roll follows it,
  // exactly as hand-clicked dice notation does.
  const buffed = makeCharacter({
    attributes: { MAR: 0, POW: 0, AGI: 0, VIT: 0, GRT: 0 },
    slottedAbilities: [
      {
        ...blankAbility(),
        name: 'Rage',
        modifiers: [{ target: 'MAR', value: 3 }],
        modifiersActive: true,
      },
    ],
  })
  const accuracy = { modifier: { kind: 'attribute' as const, key: 'MAR' as const } }
  expect(accuracyModifierValue(accuracy, buffed)).toBe(3)
})

test('accuracy can add a custom attribute by shorthand or full name', () => {
  const character = makeCharacter()
  expect(
    accuracyNotation(
      { modifier: { kind: 'custom', id: 'attr-san', token: 'Sanity' } },
      character,
    ),
  ).toBe('d20+SAN')

  const noShorthand = makeCharacter({
    customAttributes: [
      { id: 'attr-x', name: 'Doom', shorthand: '', value: 2, showSteppers: false },
    ],
  })
  expect(
    accuracyNotation(
      { modifier: { kind: 'custom', id: 'attr-x', token: 'Doom' } },
      noShorthand,
    ),
  ).toBe('d20+Doom')
})

test('a deleted custom attribute degrades to a plain d20', () => {
  const character = makeCharacter({ customAttributes: [] })
  expect(
    accuracyNotation(
      { modifier: { kind: 'custom', id: 'gone', token: 'SAN' } },
      character,
    ),
  ).toBe('d20')
  expect(
    accuracyModifierValue(
      { modifier: { kind: 'custom', id: 'gone', token: 'SAN' } },
      character,
    ),
  ).toBeNull()
})

test('the extra accuracy bonus is appended with a sign', () => {
  const character = makeCharacter()
  const modifier = { kind: 'attribute' as const, key: 'POW' as const }
  expect(accuracyNotation({ modifier, bonus: '+2' }, character)).toBe('d20+POW+2')
  expect(accuracyNotation({ modifier, bonus: '-1' }, character)).toBe('d20+POW-1')
  expect(accuracyNotation({ modifier, bonus: '+1d4' }, character)).toBe('d20+POW+1d4')
  // A bare number is an addition, never a second die count.
  expect(accuracyNotation({ modifier, bonus: '3' }, character)).toBe('d20+POW+3')
})

// ---- plan ------------------------------------------------------------------

test('the plan orders accuracy, damage, then the custom rolls as authored', () => {
  const plan = buildActivationRollPlan(
    makeAbility(
      {
        accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
        damage: true,
        custom: [
          { notation: '1d6' },
          { notation: '2d6+POW', label: 'Burn', hidden: true },
        ],
      },
      { damage: '2d6+POW' },
    ),
    makeCharacter(),
  )

  expect(plan.map((s) => s.kind)).toEqual([
    'accuracy',
    'damage',
    'custom',
    'custom',
  ])
  expect(plan.map((s) => s.notation)).toEqual([
    'd20+MAR',
    '2d6+POW',
    '1d6',
    '2d6+POW',
  ])
  expect(plan[1].groupLabel).toBe('Damage')
  expect(plan[3]).toMatchObject({ label: 'Burn', hidden: true })
})

test('damage switched on with an empty damage field rolls nothing', () => {
  const plan = buildActivationRollPlan(
    makeAbility({ damage: true }, { damage: '   ' }),
    makeCharacter(),
  )
  expect(plan).toEqual([])
})

test('an ability with no config builds an empty plan', () => {
  expect(buildActivationRollPlan(blankAbility(), makeCharacter())).toEqual([])
})

test('a fresh Basic Attack is born rolling its whole attack', () => {
  // Every Basic Attack — a player's core ability and an NPC's pinned card alike
  // — is generated by `createDefaultBasicAttack`, and it comes configured to
  // roll itself: the accuracy check first, then its own damage. The config is
  // ordinary authored data from there on, so the editor can retune or untick it.
  const ability = createDefaultBasicAttack()
  expect(ability.activationRolls).toEqual({
    accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
    damage: true,
  })

  const plan = buildActivationRollPlan(ability, makeCharacter())
  expect(plan.map((s) => [s.kind, s.notation])).toEqual([
    ['accuracy', 'd20+MAR'],
    // The Damage field IS the notation, so editing Damage retunes the roll.
    ['damage', '1d6 + MAR'],
  ])
})

test('a fresh Basic Attack rolls against whoever activates it', () => {
  // The default is resolved at roll time, like any other activation roll: an
  // NPC's Basic Attack uses the NPC's own MAR (0 on a fresh statblock), a
  // player's uses theirs — one authored default, every activator.
  const npc = createDefaultNPC()
  rollQueue.push(12, 5)
  const group = rollAbilityActivation(npc.basicAttack, npc)

  expect(group.accuracy?.notation).toBe('d20+MAR')
  expect(group.accuracy?.result.breakdown).toBe('d20+MAR → 12 + 0 = 12')
  expect(group.damage?.notation).toBe('1d6 + MAR')
  expect(group.damage?.result.breakdown).toBe('1d6 + MAR → 5 + 0 = 5')
})

// ---- execution --------------------------------------------------------------

test('execution groups the rolls the way the modal renders them', () => {
  rollQueue.push(17, 3, 4, 6)
  const character = makeCharacter()
  const group = rollAbilityActivation(
    makeAbility(
      {
        accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
        damage: true,
        custom: [{ notation: '1d6', label: 'Burn' }],
      },
      { damage: '2d6' },
    ),
    character,
  )

  // d20 (17) + MAR (4); 2d6 (3, 4); 1d6 (6) — rolled in that order.
  expect(group.accuracy?.result.total).toBe(21)
  expect(group.accuracy?.notation).toBe('d20+MAR')
  expect(group.damage?.result.total).toBe(7)
  expect(group.custom).toHaveLength(1)
  expect(group.custom[0].result.total).toBe(6)
  expect(group.custom[0].label).toBe('Burn')

  expect(hasActivationRollOutcomes(group)).toBe(true)
  expect(activationRollOutcomes(group).map((o) => o.kind)).toEqual([
    'accuracy',
    'damage',
    'custom',
  ])
})

test('notation resolves against the acting entity, not the authored one', () => {
  rollQueue.push(10)
  const npc = makeCharacter({
    id: 'npc-9',
    kind: 'npc',
    name: 'Bandit',
    attributes: { MAR: 2, POW: 0, AGI: 0, VIT: 0, GRT: 0 },
  })
  const group = rollAbilityActivation(
    makeAbility({ accuracy: { modifier: { kind: 'attribute', key: 'MAR' } } }),
    npc,
  )
  expect(group.accuracy?.character.id).toBe('npc-9')
  expect(group.accuracy?.result.total).toBe(12)
})

test('an unparseable custom expression is skipped, not rolled as zero', () => {
  rollQueue.push(5)
  const group = runActivationRollPlan(
    [
      { kind: 'custom', groupLabel: 'Custom', notation: '+++', hidden: false },
      { kind: 'custom', groupLabel: 'Custom', notation: '1d6', hidden: false },
    ],
    makeCharacter(),
  )
  expect(group.custom).toHaveLength(1)
  expect(group.custom[0].result.total).toBe(5)
})

test('an NPC with no custom attributes still rolls accuracy and damage', () => {
  rollQueue.push(12, 5)
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-2',
    attributes: { MAR: 3, POW: 1, AGI: 0, VIT: 0, GRT: 0 },
    customAttributes: [],
  }
  const group = rollAbilityActivation(
    makeAbility(
      { accuracy: { modifier: { kind: 'attribute', key: 'MAR' } }, damage: true },
      { damage: '1d6+1' },
    ),
    npc,
  )
  expect(group.accuracy?.result.total).toBe(15)
  expect(group.damage?.result.total).toBe(6)
})

test('a group with nothing rolled reports itself empty', () => {
  expect(
    hasActivationRollOutcomes(runActivationRollPlan([], makeCharacter())),
  ).toBe(false)
})

test('custom attributes list is optional on imported characters', () => {
  const legacy = {
    ...makeCharacter(),
    customAttributes: undefined,
  } as unknown as Character
  expect(
    accuracyNotation(
      { modifier: { kind: 'custom', id: 'x', token: 'SAN' } },
      legacy,
    ),
  ).toBe('d20')
})
