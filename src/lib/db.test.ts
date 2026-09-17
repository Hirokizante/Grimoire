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
import { normalizeCharacter, normalizeScreen } from '@/lib/db'
import { DEFAULT_SHEET_COLORS, MAX_AP, createDefaultCharacter } from '@/constants/gameData'
import type { Character, GMScreen, ScreenPanel } from '@/types'

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
          { kind: 'ability', id: 'sec-1', name: 'Offense', abilities: [] },
          { kind: 'ability', id: 'sec-2', name: 'Defense', abilities: [] },
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

test('normalizeCharacter: stamps kind=ability on legacy sections without a discriminator', () => {
  const char = createDefaultCharacter()
  // Legacy section shape predates the kind discriminator.
  const legacyTab = {
    id: 'tab-1',
    name: 'My Tab',
    sections: [
      { id: 'sec-1', name: 'Offense', abilities: [] },
    ],
  }
  const old = {
    ...char,
    customTabs: [legacyTab],
  }
  const out = normalizeCharacter(asCharacter(old as Record<string, unknown>))
  expect(out.customTabs[0].sections[0].kind).toBe('ability')
  expect(
    (out.customTabs[0].sections[0] as { abilities?: unknown[] }).abilities,
  ).toEqual([])
})

test('normalizeCharacter: preserves kind=npc sections', () => {
  const char = createDefaultCharacter()
  const npcSection = {
    kind: 'npc' as const,
    id: 'sec-npc',
    name: 'Goblin',
    npcId: 'npc-1',
  }
  const abilitySection = {
    kind: 'ability' as const,
    id: 'sec-ability',
    name: 'Offense',
    abilities: [{ id: 'a1', name: 'Slash', traits: [], cost: {}, damage: '', description: '', overcharge: '', flavorText: '', isMinor: false }],
  }
  const old = {
    ...char,
    customTabs: [
      { id: 'tab-1', name: 'My Tab', sections: [npcSection, abilitySection] },
    ],
  }
  const out = normalizeCharacter(asCharacter(old as Record<string, unknown>))
  expect(out.customTabs[0].sections[0].kind).toBe('npc')
  expect(out.customTabs[0].sections[1].kind).toBe('ability')
})

test('normalizeCharacter: preserves kind=text sections with their content', () => {
  const char = createDefaultCharacter()
  const textSection = {
    kind: 'text' as const,
    id: 'sec-text',
    name: 'Backstory',
    content: 'Born under a blood moon.',
  }
  const old = {
    ...char,
    customTabs: [
      { id: 'tab-1', name: 'Lore', sections: [textSection] },
    ],
  }
  const out = normalizeCharacter(asCharacter(old as Record<string, unknown>))
  expect(out.customTabs[0].sections[0].kind).toBe('text')
  expect((out.customTabs[0].sections[0] as { content: string }).content).toBe(
    'Born under a blood moon.',
  )
})

test('normalizeCharacter: fills an empty content string on a text section missing it', () => {
  const char = createDefaultCharacter()
  // A text section that somehow lacks the content field (partial write).
  const old = {
    ...char,
    customTabs: [
      {
        id: 'tab-1',
        name: 'Lore',
        sections: [{ kind: 'text', id: 'sec-text', name: 'Backstory' }],
      },
    ],
  }
  const out = normalizeCharacter(asCharacter(old as Record<string, unknown>))
  expect((out.customTabs[0].sections[0] as { content: string }).content).toBe('')
})

// ---- labels -----------------------------------------------------------------

test('normalizeCharacter: missing labels defaults to []', () => {
  const char = createDefaultCharacter()
  const old = omit(char as unknown as Record<string, unknown>, 'labels')
  const out = normalizeCharacter(asCharacter(old))
  expect(out.labels).toEqual([])
})

test('normalizeCharacter: preserves existing labels', () => {
  const char = createDefaultCharacter()
  const base: Character = {
    ...char,
    labels: [
      { id: 'l1', name: 'Party', value: '' },
      { id: 'l2', name: 'Boss', value: 'Act 2' },
    ],
  }
  const out = normalizeCharacter(base)
  expect(out.labels).toEqual([
    { id: 'l1', name: 'Party', value: '' },
    { id: 'l2', name: 'Boss', value: 'Act 2' },
  ])
})

test('normalizeCharacter: backfills missing value on label entries', () => {
  const char = createDefaultCharacter()
  const old = asCharacter({
    ...char,
    labels: [{ id: 'l1', name: 'Party' }, { id: 'l2' }],
  })
  const out = normalizeCharacter(old)
  expect(out.labels).toEqual([
    { id: 'l1', name: 'Party', value: '' },
    { id: 'l2', name: '', value: '' },
  ])
})

test('normalizeCharacter: drops non-object label entries and assigns ids when missing', () => {
  const char = createDefaultCharacter()
  const old = asCharacter({
    ...char,
    labels: [
      'junk',
      null,
      { name: 'NoId', value: 'x' },
    ] as unknown[],
  })
  const out = normalizeCharacter(old)
  expect(out.labels).toHaveLength(1)
  expect(out.labels[0].name).toBe('NoId')
  expect(typeof out.labels[0].id).toBe('string')
  expect(out.labels[0].id.length).toBeGreaterThan(0)
})

test('normalizeCharacter: labels normalization is idempotent', () => {
  const char = createDefaultCharacter()
  const base = asCharacter({
    ...char,
    labels: [{ id: 'l1', name: 'Party', value: 'Alpha' }],
  })
  const once = normalizeCharacter(base)
  expect(normalizeCharacter(once)).toEqual(once)
})

// ---- ability stat/attribute modifiers ---------------------------------------

/** A character with one slotted ability carrying the given modifier payload. */
function withModifierAbility(
  ability: Record<string, unknown>,
): Character {
  const char = createDefaultCharacter()
  return asCharacter({
    ...char,
    slottedAbilities: [
      {
        id: 'a1',
        name: 'Buff',
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
        ...ability,
      },
    ],
  })
}

test('normalizeCharacter: sanitizes ability modifiers and keeps the switch', () => {
  const char = withModifierAbility({
    modifiers: [
      { target: 'evasion', value: 2 },
      { target: 'not-a-target', value: 3 },
      { target: 'armor', value: 0 },
      { target: 'VIT', value: 1 },
    ],
    modifiersActive: true,
  })
  const out = normalizeCharacter(char)
  expect(out.slottedAbilities[0].modifiers).toEqual([
    { target: 'evasion', value: 2 },
    { target: 'VIT', value: 1 },
  ])
  expect(out.slottedAbilities[0].modifiersActive).toBe(true)
})

test('normalizeCharacter: drops modifier keys entirely when nothing survives', () => {
  const char = withModifierAbility({
    modifiers: [{ target: 'bogus', value: 1 }],
    modifiersActive: true,
  })
  const out = normalizeCharacter(char)
  const ability = out.slottedAbilities[0] as unknown as Record<string, unknown>
  expect('modifiers' in ability).toBe(false)
  expect('modifiersActive' in ability).toBe(false)
})

test('normalizeCharacter: modifier normalization is idempotent', () => {
  const char = withModifierAbility({
    modifiers: [{ target: 'saveDC', value: -2 }],
    modifiersActive: true,
  })
  const once = normalizeCharacter(char)
  expect(normalizeCharacter(once)).toEqual(once)
})

// ---- automatic rolls on activation ------------------------------------------

test('normalizeCharacter: sanitizes an ability activation-roll config', () => {
  const char = withModifierAbility({
    activationRolls: {
      accuracy: { modifier: { kind: 'attribute', key: 'POW' }, bonus: '+2' },
      damage: true,
      custom: [
        { notation: '2d6', label: 'Burn', hidden: true },
        { notation: '   ' },
        'nonsense',
      ],
    },
  })
  const out = normalizeCharacter(char)

  expect(out.slottedAbilities[0].activationRolls).toEqual({
    accuracy: { modifier: { kind: 'attribute', key: 'POW' }, bonus: '+2' },
    damage: true,
    custom: [{ notation: '2d6', label: 'Burn', hidden: true }],
  })
})

test('normalizeCharacter: an unusable activation-roll config drops the key', () => {
  const char = withModifierAbility({
    activationRolls: {
      accuracy: { modifier: { kind: 'attribute', key: 'NOT_A_STAT' } },
      custom: [{ notation: '' }],
    },
  })
  const out = normalizeCharacter(char)
  const ability = out.slottedAbilities[0] as unknown as Record<string, unknown>
  expect('activationRolls' in ability).toBe(false)
})

test('normalizeCharacter: sub-ability activation rolls are normalized too', () => {
  const char = withModifierAbility({
    subAbilitiesUnderDescription: [
      {
        id: 'sub-1',
        name: 'Riposte',
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
        activationRolls: {
          accuracy: { modifier: { kind: 'custom', id: 'attr-1', token: 'SAN' } },
          custom: [{ notation: '1d4' }, { notation: '' }],
        },
      },
    ],
  })
  const out = normalizeCharacter(char)

  expect(out.slottedAbilities[0].subAbilitiesUnderDescription[0].activationRolls)
    .toEqual({
      accuracy: { modifier: { kind: 'custom', id: 'attr-1', token: 'SAN' } },
      custom: [{ notation: '1d4' }],
    })
})

test('normalizeCharacter: activation-roll normalization is idempotent', () => {
  const char = withModifierAbility({
    activationRolls: {
      accuracy: { modifier: { kind: 'custom', id: 'attr-1', token: 'SAN' } },
      custom: [{ notation: '1d4', hidden: true }],
    },
  })
  const once = normalizeCharacter(char)
  expect(normalizeCharacter(once)).toEqual(once)
})

test('normalizeCharacter: switches in custom-tab abilities are normalized too', () => {
  const char = createDefaultCharacter()
  const base = asCharacter({
    ...char,
    customTabs: [
      {
        id: 'tab-1',
        name: 'Tab',
        sections: [
          {
            kind: 'ability',
            id: 'sec-1',
            name: 'Offense',
            abilities: [
              {
                id: 'a1',
                name: 'Stance',
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
                modifiers: [{ target: 'movement', value: 2 }],
                modifiersActive: 'yes',
              },
            ],
          },
        ],
      },
    ],
  })
  const out = normalizeCharacter(base)
  const section = out.customTabs[0].sections[0]
  expect(section.kind).toBe('ability')
  if (section.kind !== 'ability') return
  expect(section.abilities[0].modifiers).toEqual([{ target: 'movement', value: 2 }])
  // Anything other than an explicit `true` reads as switched off.
  expect(section.abilities[0].modifiersActive).toBe(false)
})

test('normalizeCharacter: backfills palette colors missing from old records', () => {
  const char = createDefaultCharacter()
  // Simulate a record saved before the Mortal Wounds color key existed, with
  // both a customized color and an untouched one.
  const colors = { ...char.config.colors } as Record<string, string>
  delete colors.tokenMortalWounds
  colors.accent = '#123456'
  const oldShape = { ...char, config: { ...char.config, colors } }

  const out = normalizeCharacter(asCharacter(oldShape))

  // The missing key is restored from the defaults...
  expect(out.config.colors.tokenMortalWounds).toBe(
    DEFAULT_SHEET_COLORS.tokenMortalWounds,
  )
  // ...every other key survives, and the user's own colors are never replaced.
  expect(Object.keys(out.config.colors).sort()).toEqual(
    Object.keys(DEFAULT_SHEET_COLORS).sort(),
  )
  expect(out.config.colors.accent).toBe('#123456')
  // Idempotent.
  expect(normalizeCharacter(out).config.colors).toEqual(out.config.colors)
})

// ---- The Basic Attack (a block no record may be without) ---------------------

test('normalizeCharacter: restores a missing Basic Attack with the default block', () => {
  const char = createDefaultCharacter()
  const out = normalizeCharacter(
    asCharacter(omit(char as unknown as Record<string, unknown>, 'basicAttack')),
  )

  // The block is back — a Basic Attack is not removable on any surface, so a
  // record that arrives without one (a hand-edited or truncated export) gets
  // the same generated default a fresh sheet does.
  expect(out.basicAttack).toBeDefined()
  expect(out.basicAttack.name).toBe('Basic Attack')
  expect(out.basicAttack.cost).toEqual({ ap: 1 })
  expect(out.basicAttack.damage).toBe('1d6 + MAR')
  // …configured to roll on activation, like every Basic Attack it creates.
  expect(out.basicAttack.activationRolls).toEqual({
    accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
    damage: true,
  })
  // And the restored block carries the current schema's shape (normalizeBlock).
  expect(out.basicAttack.showActivate).toBe(true)
  expect(out.basicAttack.subAbilitiesUnderDescription).toEqual([])
  expect(normalizeCharacter(out)).toEqual(out)
})

test('normalizeCharacter: a stored Basic Attack is kept exactly as authored', () => {
  const char = createDefaultCharacter()
  // What the editor stores when the author unticks "Roll Dice on Activation":
  // nothing at all. That must survive a reload — a read-time default would make
  // switching the rolls off impossible.
  const stored = omit(
    char.basicAttack as unknown as Record<string, unknown>,
    'activationRolls',
  )
  const out = normalizeCharacter(
    asCharacter({ ...char, basicAttack: { ...stored, name: 'Ol’ Reliable' } }),
  )

  expect(out.basicAttack.name).toBe('Ol’ Reliable')
  expect('activationRolls' in out.basicAttack).toBe(false)
})

// ---- normalizeScreen (GM Screens) -------------------------------------------

/** Cast an object to GMScreen (bypassing TS for legacy-shape fixtures). */
function asScreen(value: Record<string, unknown>): GMScreen {
  return value as unknown as GMScreen
}

test('normalizeScreen: a well-formed screen is unchanged and idempotent', () => {
  const screen: GMScreen = {
    id: 's1',
    name: 'Session 4',
    panels: [
      {
        kind: 'character',
        id: 'p1',
        characterId: 'c1',
        density: 'compact',
        statuses: [],
      },
      {
        kind: 'npc-instance',
        id: 'p2',
        baseNpcId: 'n1',
        label: 'Bandit',
        density: 'expanded',
        statuses: [],
        state: {
          currentHP: 12,
          tempHP: 3,
          condition: 'active',
          currentAP: 2,
          cooldowns: ['a1'],
          mortalWounds: [{ roll: 14, name: 'Damaged Throat' }],
          abilityUses: { a1: 1 },
          abilityModifiers: { a1: true },
        },
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }
  const out = normalizeScreen(screen)
  expect(out).toEqual(screen)
  expect(normalizeScreen(out)).toEqual(out)
})

test('normalizeScreen: backfills an empty panel list and timestamps', () => {
  const out = normalizeScreen(asScreen({ id: 's1', name: 'Fresh' }))
  expect(out.panels).toEqual([])
  expect(out.name).toBe('Fresh')
  expect(typeof out.createdAt).toBe('string')
  expect(out.updatedAt).toBe(out.createdAt)
})

test('normalizeScreen: guarantees density and panel id on every panel', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Legacy',
      panels: [
        { kind: 'character', characterId: 'c1' },
        {
          kind: 'character',
          id: 'p2',
          characterId: 'c2',
          density: 'expanded',
          statuses: [],
        },
      ],
    }),
  )
  expect(out.panels).toHaveLength(2)
  for (const panel of out.panels) {
    expect(typeof panel.id).toBe('string')
    expect(panel.id.length).toBeGreaterThan(0)
  }
  expect(out.panels[0].density).toBe('compact')
  expect(out.panels[1].density).toBe('expanded')
  // Distinct ids (the missing one is generated, not shared).
  expect(out.panels[0].id).not.toBe(out.panels[1].id)
})

test('normalizeScreen: backfills complete instance state', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Spawns',
      panels: [{ kind: 'npc-instance', id: 'p1', baseNpcId: 'n1' }],
    }),
  )
  const panel = out.panels[0] as Extract<ScreenPanel, { kind: 'npc-instance' }>
  expect(panel.state).toEqual({
    currentHP: 0,
    tempHP: 0,
    condition: 'active',
    // Live-play fields backfill to a full, fresh turn.
    currentAP: MAX_AP,
    cooldowns: [],
    mortalWounds: [],
    // A limited ability's budget backfills to "untouched" (reads as full) and
    // every modifier switch backfills to the base record's own state.
    abilityUses: {},
    abilityModifiers: {},
  })
  expect(panel.label).toBe('')
})

test('normalizeScreen: keeps a valid instance state and clamps negatives', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Spawns',
      panels: [
        {
          kind: 'npc-instance',
          id: 'p1',
          baseNpcId: 'n1',
          label: 'Bandit 2',
          state: { currentHP: -4, tempHP: -2, condition: 'downed' },
        },
      ],
    }),
  )
  const panel = out.panels[0] as Extract<ScreenPanel, { kind: 'npc-instance' }>
  expect(panel.label).toBe('Bandit 2')
  expect(panel.state).toEqual({
    currentHP: 0,
    tempHP: 0,
    condition: 'downed',
    currentAP: MAX_AP,
    cooldowns: [],
    mortalWounds: [],
    abilityUses: {},
    abilityModifiers: {},
  })
})

test('normalizeScreen: repairs the instance turn state (AP + cooldowns)', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Spawns',
      panels: [
        {
          kind: 'npc-instance',
          id: 'p1',
          baseNpcId: 'n1',
          state: { currentHP: 5, currentAP: 99, cooldowns: ['a1'] },
        },
        {
          kind: 'npc-instance',
          id: 'p2',
          baseNpcId: 'n1',
          state: { currentHP: 5, currentAP: -3, cooldowns: ['a1', 'a1', '', 7, 'a2'] },
        },
      ],
    }),
  )
  const [first, second] = out.panels as Extract<
    ScreenPanel,
    { kind: 'npc-instance' }
  >[]
  // AP is a whole number inside the turn budget.
  expect(first.state.currentAP).toBe(MAX_AP)
  expect(second.state.currentAP).toBe(0)
  // Cooldown ids are strings, de-duplicated, and blanks dropped — the list is
  // written straight from ability ids, so anything else is corrupt data.
  expect(second.state.cooldowns).toEqual(['a1', 'a2'])
})

test('normalizeScreen: repairs the instance Mortal Wound track', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Spawns',
      panels: [
        {
          kind: 'npc-instance',
          id: 'p1',
          baseNpcId: 'n1',
          // A legacy instance has no track at all; these entries cover the
          // shapes that could have been written since.
          state: {
            currentHP: 5,
            mortalWounds: [
              { roll: 14, name: 'Fracture' },
              { roll: 0, name: 'Damaged Throat' },
              { roll: 3 },
              'Exhaustion',
              null,
            ],
          },
        },
        // A legacy instance: no `mortalWounds` field at all.
        { kind: 'npc-instance', id: 'p2', baseNpcId: 'n1' },
      ],
    }),
  )
  const [first, second] = out.panels as Extract<
    ScreenPanel,
    { kind: 'npc-instance' }
  >[]
  // Entries without a wound name are dropped; a name without a usable D20 is
  // kept (the wound is what the GM tracks) with an unknown roll.
  expect(first.state.mortalWounds).toEqual([
    { roll: 14, name: 'Fracture' },
    { roll: 0, name: 'Damaged Throat' },
  ])
  expect(second.state.mortalWounds).toEqual([])
})

test('normalizeScreen: repairs the instance ability-use map', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Spawns',
      panels: [
        {
          kind: 'npc-instance',
          id: 'p1',
          baseNpcId: 'n1',
          state: {
            currentHP: 5,
            // Counts are whole numbers floored into [0, MAX_ABILITY_USES];
            // unusable entries are dropped. The per-ability maximum lives on
            // the base record and is applied at render time, not here.
            abilityUses: { a1: 2, a2: '1', a3: -4, a4: 2.9, a5: 'x', '': 3 },
          },
        },
        // A legacy instance: no `abilityUses` field at all.
        { kind: 'npc-instance', id: 'p2', baseNpcId: 'n1' },
      ],
    }),
  )
  const [first, second] = out.panels as Extract<
    ScreenPanel,
    { kind: 'npc-instance' }
  >[]
  expect(first.state.abilityUses).toEqual({ a1: 2, a2: 1, a3: 0, a4: 2 })
  expect(second.state.abilityUses).toEqual({})
})

test('normalizeScreen: repairs the instance modifier-switch map', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Spawns',
      panels: [
        {
          kind: 'npc-instance',
          id: 'p1',
          baseNpcId: 'n1',
          state: {
            currentHP: 5,
            // Only booleans are usable: anything else (a truthy string, a
            // number) is dropped rather than guessed at, and a blank id goes
            // with it. What an absent entry means lives on the base record.
            abilityModifiers: { a1: true, a2: false, a3: 'true', a4: 1, '': true },
          },
        },
        // A legacy instance: no `abilityModifiers` field at all.
        { kind: 'npc-instance', id: 'p2', baseNpcId: 'n1' },
      ],
    }),
  )
  const [first, second] = out.panels as Extract<
    ScreenPanel,
    { kind: 'npc-instance' }
  >[]
  expect(first.state.abilityModifiers).toEqual({ a1: true, a2: false })
  expect(second.state.abilityModifiers).toEqual({})
})

test('normalizeScreen: drops panels that reference nothing', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Broken',
      panels: [
        { kind: 'character' },
        { kind: 'npc-instance', id: 'p1' },
        null,
        'nope',
        { kind: 'character', id: 'ok', characterId: 'c1' },
      ],
    }),
  )
  expect(out.panels).toHaveLength(1)
  expect((out.panels[0] as Extract<ScreenPanel, { kind: 'character' }>).characterId).toBe('c1')
})

test('normalizeScreen: falls back to a default name', () => {
  const out = normalizeScreen(asScreen({ id: 's1', name: '' }))
  expect(out.name).toBe('Untitled Screen')
})

// ---- normalizeScreen: tracked panel statuses --------------------------------

test('normalizeScreen: backfills an empty status list on both panel kinds', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Pre-status screens',
      panels: [
        { kind: 'character', id: 'p1', characterId: 'c1' },
        { kind: 'npc-instance', id: 'p2', baseNpcId: 'n1' },
      ],
    }),
  )
  expect(out.panels[0].statuses).toEqual([])
  expect(out.panels[1].statuses).toEqual([])
})

test('normalizeScreen: keeps valid tracked statuses untouched (idempotent)', () => {
  const screen: GMScreen = {
    id: 's1',
    name: 'Session 4',
    panels: [
      {
        kind: 'character',
        id: 'p1',
        characterId: 'c1',
        density: 'compact',
        statuses: [
          { statusId: 'poisoned', duration: 'countdown', stacks: 3 },
          { statusId: 'prone', duration: 'quick', stacks: 1 },
        ],
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  const out = normalizeScreen(screen)
  expect(out).toEqual(screen)
  expect(normalizeScreen(out)).toEqual(out)
})

test('normalizeScreen: drops unusable status entries and repairs the rest', () => {
  const out = normalizeScreen(
    asScreen({
      id: 's1',
      name: 'Hand-edited',
      panels: [
        {
          kind: 'character',
          id: 'p1',
          characterId: 'c1',
          statuses: [
            { statusId: 'poisoned', duration: 'countdown', stacks: 2 },
            // No reference, unknown duration, junk value, duplicate reference.
            { duration: 'quick', stacks: 1 },
            { statusId: 'stunned', duration: 'forever', stacks: 1 },
            'nope',
            null,
            { statusId: 'poisoned', duration: 'permanent', stacks: 9 },
            // Stack counts are repaired to whole numbers within [1, 99].
            { statusId: 'blinded', duration: 'quick', stacks: -3 },
            { statusId: 'hidden', duration: 'persistent', stacks: 12.7 },
            { statusId: 'prone', duration: 'conditional', stacks: 500 },
            { statusId: 'dazed', duration: 'permanent' },
          ],
        },
      ],
    }),
  )
  expect(out.panels[0].statuses).toEqual([
    { statusId: 'poisoned', duration: 'countdown', stacks: 2 },
    { statusId: 'blinded', duration: 'quick', stacks: 1 },
    { statusId: 'hidden', duration: 'persistent', stacks: 12 },
    { statusId: 'prone', duration: 'conditional', stacks: 99 },
    { statusId: 'dazed', duration: 'permanent', stacks: 1 },
  ])
})
