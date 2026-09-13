/**
 * Unit tests for the Ability stat/attribute modifier helpers: validation,
 * aggregation across every place an ability can live, and the effective
 * (modified) attribute / combat-stat values.
 */

import { describe, expect, it } from 'vitest'

import { createDefaultCharacter, generateId } from '@/constants/gameData'
import {
  abilityModifiers,
  areAbilityModifiersActive,
  collectActiveModifiers,
  describeModifier,
  effectiveAttributes,
  effectiveCombatStats,
  effectiveNPCStats,
  findAbility,
  formatModifierValue,
  instanceAbilityModifiersActive,
  normalizeInstanceAbilityModifiers,
  withInstanceAbilityModifiers,
  hasAbilityModifiers,
  isModifierTarget,
  modifierTargetsFor,
  normalizeModifiers,
  setAbilityModifiersActive,
} from '@/lib/abilityModifiers'
import type { AbilityBlock, AbilityStatModifier, Character } from '@/types'

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

/** Character with VIT 2 / AGI 1 / GRT 3 and no abilities. */
function character(abilities: Partial<Character> = {}): Character {
  const base = createDefaultCharacter()
  return {
    ...base,
    id: 'char-1',
    attributes: { MAR: 3, POW: 4, AGI: 1, VIT: 2, GRT: 3 },
    milestones: 4,
    innateAbilities: [],
    slottedAbilities: [],
    abilityPool: [],
    customTabs: [],
    ...abilities,
  }
}

describe('normalizeModifiers', () => {
  it('returns [] for anything that is not an array', () => {
    expect(normalizeModifiers(undefined)).toEqual([])
    expect(normalizeModifiers(null)).toEqual([])
    expect(normalizeModifiers('+2 evasion')).toEqual([])
    expect(normalizeModifiers({ target: 'evasion', value: 2 })).toEqual([])
  })

  it('keeps valid entries in canonical target order', () => {
    const mods: AbilityStatModifier[] = [
      { target: 'evasion', value: 2 },
      { target: 'MAR', value: -1 },
    ]
    expect(normalizeModifiers(mods)).toEqual([
      { target: 'evasion', value: 2 },
      { target: 'MAR', value: -1 },
    ])
  })

  it('drops unknown targets, non-finite values and zeroes', () => {
    expect(
      normalizeModifiers([
        { target: 'luck', value: 3 },
        { target: 'evasion', value: Number.NaN },
        { target: 'armor', value: 0 },
        { target: 'saveDC', value: 2 },
        'nope',
      ]),
    ).toEqual([{ target: 'saveDC', value: 2 }])
  })

  it('merges duplicate targets so one ability cannot double-apply a value', () => {
    expect(
      normalizeModifiers([
        { target: 'movement', value: 2 },
        { target: 'movement', value: -3 },
        { target: 'movement', value: 4 },
      ]),
    ).toEqual([{ target: 'movement', value: 3 }])
  })

  it('validates target keys', () => {
    expect(isModifierTarget('evasion')).toBe(true)
    expect(isModifierTarget('MAR')).toBe(true)
    expect(isModifierTarget('evasion ')).toBe(false)
    expect(isModifierTarget(3)).toBe(false)
  })
})

describe('modifierTargetsFor', () => {
  it('hides END Recovery for NPCs (they have no END pool)', () => {
    const npcTargets = modifierTargetsFor('npc').map((t) => t.target)
    expect(npcTargets).not.toContain('endRecovery')
    expect(npcTargets).toContain('evasion')
    expect(npcTargets).toContain('VIT')
  })

  it('offers every target for player characters', () => {
    const targets = modifierTargetsFor('character').map((t) => t.target)
    expect(targets).toContain('endRecovery')
    expect(targets).toContain('maxHP')
    expect(targets).toEqual([
      'evasion', 'armor', 'movement', 'saveDC', 'maxHP', 'endRecovery',
      'MAR', 'POW', 'AGI', 'VIT', 'GRT',
    ])
  })
})

describe('collectActiveModifiers', () => {
  const buff = block({
    name: 'Buff',
    modifiers: [
      { target: 'evasion', value: 2 },
      { target: 'MAR', value: 1 },
    ],
    modifiersActive: true,
  })

  it('ignores switched-off abilities', () => {
    const char = character({ slottedAbilities: [buff, { ...buff, id: 'b2', modifiersActive: false }] })
    expect(collectActiveModifiers(char)).toEqual({ evasion: 2, MAR: 1 })
  })

  it('sums modifiers from core, slotted, pool and custom-tab abilities', () => {
    const innate = block({
      id: 'innate-1',
      modifiers: [{ target: 'POW', value: 1 }],
      modifiersActive: true,
    })
    const pooled = block({
      id: 'pool-1',
      modifiers: [{ target: 'evasion', value: -1 }],
      modifiersActive: true,
    })
    const custom = block({
      id: 'custom-1',
      modifiers: [{ target: 'armor', value: 3 }],
      modifiersActive: true,
    })
    const char = character({
      innateAbilities: [innate],
      slottedAbilities: [buff],
      abilityPool: [pooled],
      customTabs: [
        {
          id: 'tab-1',
          name: 'Tab',
          sections: [
            { kind: 'ability', id: 'sec-1', name: 'Offense', abilities: [custom] },
            {
              kind: 'text',
              id: 'sec-2',
              name: 'Notes',
              content: 'no abilities here',
            },
          ],
        },
      ],
    })
    expect(collectActiveModifiers(char)).toEqual({
      evasion: 1,
      MAR: 1,
      POW: 1,
      armor: 3,
    })
  })

  it('counts nested sub-abilities and de-duplicates repeated ids', () => {
    const sub = block({
      id: 'sub-1',
      modifiers: [{ target: 'GRT', value: 2 }],
      modifiersActive: true,
    })
    const parent = block({
      id: 'parent-1',
      modifiers: [{ target: 'evasion', value: 1 }],
      modifiersActive: true,
      subAbilitiesUnderDescription: [sub],
    })
    // Same block listed twice (hand-merged import) — counted once.
    const char = character({ slottedAbilities: [parent, parent] })
    expect(collectActiveModifiers(char)).toEqual({ evasion: 1, GRT: 2 })
  })

  it('ignores abilities that declare modifiers but were never switched on', () => {
    const char = character({
      slottedAbilities: [{ ...buff, id: 'off-1', modifiersActive: undefined }],
    })
    expect(collectActiveModifiers(char)).toEqual({})
    expect(areAbilityModifiersActive(char.slottedAbilities[0])).toBe(false)
    expect(hasAbilityModifiers(char.slottedAbilities[0])).toBe(true)
  })
})

describe('effective values', () => {
  const char = character({
    slottedAbilities: [
      block({
        id: 'buff-1',
        modifiers: [
          { target: 'VIT', value: 1 },
          { target: 'evasion', value: 2 },
          { target: 'endRecovery', value: 1 },
          { target: 'maxHP', value: 5 },
        ],
        modifiersActive: true,
      }),
    ],
  })

  it('layers attribute modifiers on the base attributes', () => {
    expect(effectiveAttributes(char)).toEqual({
      MAR: 3,
      POW: 4,
      AGI: 1,
      VIT: 3,
      GRT: 3,
    })
  })

  it('derives stats from effective attributes, then adds direct stat modifiers', () => {
    // VIT 2 → 3 raises Max HP 30 → 35 and Armor 1 → 1 (floor(3/2)).
    // Evasion 11 + 2 = 13; END Recovery 2 + 1 = 3; Max HP 35 + 5 = 40.
    expect(effectiveCombatStats(char)).toEqual({
      evasion: 13,
      armor: 1,
      movement: 5,
      saveDC: 12,
      endRecovery: 3,
      maxHP: 40,
    })
  })

  it('never lets modified stats drop below their sensible floor', () => {
    const debuffed = character({
      slottedAbilities: [
        block({
          id: 'debuff-1',
          modifiers: [
            { target: 'armor', value: -10 },
            { target: 'movement', value: -99 },
            { target: 'endRecovery', value: -99 },
            { target: 'maxHP', value: -999 },
          ],
          modifiersActive: true,
        }),
      ],
    })
    const stats = effectiveCombatStats(debuffed)
    expect(stats.armor).toBe(0)
    expect(stats.movement).toBe(0)
    expect(stats.endRecovery).toBe(0)
    expect(stats.maxHP).toBe(1)
  })

  it('applies modifiers to NPC combat stats', () => {
    const npc: Character = {
      ...character(),
      kind: 'npc',
      npcStats: { evasion: 12, armor: 2, movement: 6, saveDC: 14, hp: 40, mortalWounds: 1 },
      slottedAbilities: [
        block({
          id: 'npc-buff',
          modifiers: [
            { target: 'evasion', value: 3 },
            { target: 'maxHP', value: -10 },
            // Not offered for NPCs, but a hand-edited export could carry it:
            // it must not leak into NPC stats.
            { target: 'endRecovery', value: 5 },
          ],
          modifiersActive: true,
        }),
      ],
    }
    expect(effectiveNPCStats(npc)).toEqual({
      evasion: 15,
      armor: 2,
      movement: 6,
      saveDC: 14,
      hp: 30,
      mortalWounds: 1,
    })
  })

  it('falls back to the default NPC stats when none are stored', () => {
    const npc: Character = { ...character(), kind: 'npc', npcStats: undefined }
    expect(effectiveNPCStats(npc)).toEqual({
      evasion: 10,
      armor: 0,
      movement: 5,
      saveDC: 10,
      hp: 20,
      mortalWounds: 0,
    })
  })
})

describe('setAbilityModifiersActive', () => {
  it('switches an ability anywhere on the sheet, including nested sub-abilities', () => {
    const sub = block({
      id: 'sub-1',
      modifiers: [{ target: 'MAR', value: 2 }],
    })
    const parent = block({ id: 'parent-1', subAbilitiesUnderDescription: [sub] })
    const char = character({ slottedAbilities: [parent] })

    const next = setAbilityModifiersActive(char, 'sub-1', true)

    expect(next.slottedAbilities[0].subAbilitiesUnderDescription[0].modifiersActive).toBe(true)
    expect(effectiveAttributes(next).MAR).toBe(5)
    // Unrelated blocks keep their identity.
    expect(next.slottedAbilities[0].id).toBe('parent-1')
  })

  it('switches abilities in custom tab sections too', () => {
    const ability = block({
      id: 'custom-1',
      modifiers: [{ target: 'POW', value: 1 }],
    })
    const char = character({
      customTabs: [
        {
          id: 'tab-1',
          name: 'Tab',
          sections: [{ kind: 'ability', id: 'sec-1', name: 'Offense', abilities: [ability] }],
        },
      ],
    })

    const next = setAbilityModifiersActive(char, 'custom-1', true)
    const section = next.customTabs[0].sections[0]
    expect(section.kind === 'ability' && section.abilities[0].modifiersActive).toBe(true)
  })

  it('returns the same character for unknown ids and refuses to switch on an empty list', () => {
    const empty = block({ id: 'empty-1' })
    const char = character({ slottedAbilities: [empty] })

    expect(setAbilityModifiersActive(char, 'missing', true)).toBe(char)

    const next = setAbilityModifiersActive(char, 'empty-1', true)
    expect(next).toBe(char)
    expect(next.slottedAbilities[0].modifiersActive).toBeUndefined()
  })

  it('switches off again, restoring the base values', () => {
    const buff = block({
      id: 'buff-1',
      modifiers: [{ target: 'evasion', value: 5 }],
      modifiersActive: true,
    })
    const char = character({ slottedAbilities: [buff] })

    const off = setAbilityModifiersActive(char, 'buff-1', false)
    expect(effectiveCombatStats(off).evasion).toBe(11)
  })
})

describe('display helpers', () => {
  it('formats signed values and describes modifiers', () => {
    expect(formatModifierValue(2)).toBe('+2')
    expect(formatModifierValue(-3)).toBe('-3')
    expect(describeModifier({ target: 'evasion', value: 2 })).toBe('+2 Evasion')
    expect(describeModifier({ target: 'AGI', value: -1 })).toBe('-1 AGI')
    expect(abilityModifiers(block())).toEqual([])
  })
})

describe('findAbility', () => {
  it('finds an ability wherever it lives on the sheet', () => {
    const innate = block({ id: 'innate-1' })
    const slotted = block({ id: 'slotted-1' })
    const pooled = block({ id: 'pool-1' })
    const tabbed = block({ id: 'tab-1' })
    const nested = block({ id: 'nested-1' })
    const customTab = {
      id: 'tab',
      name: 'Tab',
      sections: [{ id: 'sec', name: 'Sec', kind: 'ability' as const, abilities: [tabbed] }],
    }
    const char = character({
      innateAbilities: [innate],
      slottedAbilities: [
        { ...slotted, subAbilitiesUnderDescription: [nested] },
      ],
      abilityPool: [pooled],
      customTabs: [customTab as Character['customTabs'][number]],
    })

    expect(findAbility(char, 'innate-1')).toBe(innate)
    expect(findAbility(char, 'slotted-1')).toBe(char.slottedAbilities[0])
    expect(findAbility(char, 'nested-1')).toBe(nested)
    expect(findAbility(char, 'pool-1')).toBe(pooled)
    expect(findAbility(char, 'tab-1')).toBe(tabbed)
  })

  it('returns null for an unknown or blank id', () => {
    const char = character({ slottedAbilities: [block({ id: 'a' })] })
    expect(findAbility(char, 'nope')).toBeNull()
    expect(findAbility(char, '')).toBeNull()
  })
})

describe('NPC instance modifier switches', () => {
  const armed = (id: string, overrides: Partial<AbilityBlock> = {}) =>
    block({
      id,
      modifiers: [{ target: 'evasion', value: 2 }],
      ...overrides,
    })

  it('normalizes an untrusted switch map', () => {
    expect(
      normalizeInstanceAbilityModifiers({ a: true, b: false, c: 'true', d: 1 }),
    ).toEqual({ a: true, b: false })
    // A blank id is dropped; non-objects read as an untouched map.
    expect(normalizeInstanceAbilityModifiers({ '': true })).toEqual({})
    expect(normalizeInstanceAbilityModifiers(null)).toEqual({})
    expect(normalizeInstanceAbilityModifiers(['a'])).toEqual({})
  })

  it('reads an untouched switch from the ability’s own flag', () => {
    expect(instanceAbilityModifiersActive(armed('a'), undefined)).toBe(false)
    expect(
      instanceAbilityModifiersActive(armed('a', { modifiersActive: true }), undefined),
    ).toBe(true)
    // A recorded switch wins, in both directions.
    expect(instanceAbilityModifiersActive(armed('a'), true)).toBe(true)
    expect(
      instanceAbilityModifiersActive(armed('a', { modifiersActive: true }), false),
    ).toBe(false)
    // An ability with no modifiers is never active: there is nothing to apply.
    expect(instanceAbilityModifiersActive(block({ id: 'plain' }), true)).toBe(false)
  })

  it('projects an untouched instance back to the base reference', () => {
    const char = character({ slottedAbilities: [armed('a')] })
    expect(withInstanceAbilityModifiers(char, {})).toBe(char)
    expect(withInstanceAbilityModifiers(char, undefined)).toBe(char)
    // Recording the value the ability already has is also a no-op.
    expect(withInstanceAbilityModifiers(char, { a: false })).toBe(char)
  })

  it('applies the instance’s switches without touching the base', () => {
    const baseAbility = armed('a')
    const plain = block({ id: 'plain' })
    const char = character({ slottedAbilities: [baseAbility, plain] })

    const projected = withInstanceAbilityModifiers(char, { a: true })

    expect(projected.slottedAbilities[0].modifiersActive).toBe(true)
    expect(effectiveCombatStats(projected).evasion).toBe(
      effectiveCombatStats(char).evasion + 2,
    )
    // The untouched sibling keeps its reference, and the base record is
    // unchanged — a switch flipped on one instance never leaks.
    expect(projected.slottedAbilities[1]).toBe(plain)
    expect(char.slottedAbilities[0].modifiersActive).toBeUndefined()
  })

  it('can switch a base ability off, and reaches sub-abilities', () => {
    const sub = armed('sub', { modifiersActive: true })
    const parent = block({
      id: 'parent',
      modifiers: [{ target: 'armor', value: 1 }],
      modifiersActive: true,
      subAbilitiesUnderDescription: [sub],
    })
    const char = character({ slottedAbilities: [parent] })

    const projected = withInstanceAbilityModifiers(char, { parent: false, sub: false })

    expect(projected.slottedAbilities[0].modifiersActive).toBe(false)
    expect(
      projected.slottedAbilities[0].subAbilitiesUnderDescription[0].modifiersActive,
    ).toBe(false)
    expect(effectiveCombatStats(projected).armor).toBe(
      effectiveCombatStats(char).armor - 1,
    )
  })
})
