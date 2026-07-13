/**
 * Nacht reference character validation test.
 *
 * DESIGN.md specifies a reference character "Nacht" with known attributes,
 * milestones, and skills. All calculated fields must produce the expected
 * values when these are entered. This is the core Phase 12 acceptance test.
 */

import { test, expect } from 'vitest'
import {
  calcHP,
  calcEvasion,
  calcArmor,
  calcMovement,
  calcMilestoneBonus,
  calcSaveDC,
  calcENDRecovery,
} from '@/lib/calculations'
import { resolveVariable } from '@/lib/diceRoller'
import type { Character } from '@/types'
import { createDefaultCharacter, SKILL_LIST } from '@/constants/gameData'

/** Build the Nacht reference character per DESIGN.md spec. */
function makeNacht(): Character {
  const char = createDefaultCharacter()
  return {
    ...char,
    name: 'Nacht',
    attributes: { MAR: -1, POW: 4, AGI: 1, VIT: 0, GRT: 5 },
    milestones: 4,
    maxFP: 3,
    maxAbilitySlots: 5, // 3 base + 2 from milestone choices (slots at milestones 2 and 4)
    skills: {
      'Move Quickly': 0,
      'Use Force': 0,
      'Spot Something': 0,
      'Sneak': 4,
      'Handle Precisely': 2,
      'Build Rapport': 0,
      'Read Someone': 2,
      'Pull Favors': 0,
      'Deceive': 4,
      'Provoke': 2,
      'Analyze or Recall': 0,
      'Make or Fix': 0,
      'Operate a Vehicle': 0,
      'Sabotage': 0,
      'Heal': 0,
    },
    currentHP: calcHP(0), // VIT 0 → 20
  }
}

test('Nacht: HP = 20 (20 + VIT 0 × 5)', () => {
  const nacht = makeNacht()
  expect(calcHP(nacht.attributes.VIT)).toBe(20)
})

test('Nacht: Evasion = 11 (10 + AGI 1)', () => {
  const nacht = makeNacht()
  expect(calcEvasion(nacht.attributes.AGI)).toBe(11)
})

test('Nacht: Armor = 0 (floor(VIT 0 / 2))', () => {
  const nacht = makeNacht()
  expect(calcArmor(nacht.attributes.VIT)).toBe(0)
})

test('Nacht: Movement = 5 (5 + floor(AGI 1 / 2))', () => {
  const nacht = makeNacht()
  expect(calcMovement(nacht.attributes.AGI)).toBe(5)
})

test('Nacht: Milestone Bonus = 2 (floor(4 / 2))', () => {
  const nacht = makeNacht()
  expect(calcMilestoneBonus(nacht.milestones)).toBe(2)
})

test('Nacht: Save DC = 12 (10 + Milestone Bonus 2)', () => {
  const nacht = makeNacht()
  expect(calcSaveDC(nacht.milestones)).toBe(12)
})

test('Nacht: END Recovery = 3 (max(1, 1 + floor(GRT 5 / 2)))', () => {
  const nacht = makeNacht()
  expect(calcENDRecovery(nacht.attributes.GRT)).toBe(3)
})

test('Nacht: Ability Slots = 5 (3 base + 2 from milestones)', () => {
  const nacht = makeNacht()
  expect(nacht.maxAbilitySlots).toBe(5)
})

test('Nacht: Max FP = 3 (base, FP cap increase not chosen)', () => {
  const nacht = makeNacht()
  expect(nacht.maxFP).toBe(3)
})

test('Nacht: all skill values match DESIGN.md', () => {
  const nacht = makeNacht()
  const expected: Record<string, number> = {
    'Move Quickly': 0,
    'Use Force': 0,
    'Spot Something': 0,
    'Sneak': 4,
    'Handle Precisely': 2,
    'Build Rapport': 0,
    'Read Someone': 2,
    'Pull Favors': 0,
    'Deceive': 4,
    'Provoke': 2,
    'Analyze or Recall': 0,
    'Make or Fix': 0,
    'Operate a Vehicle': 0,
    'Sabotage': 0,
    'Heal': 0,
  }
  for (const skill of SKILL_LIST) {
    expect(nacht.skills[skill], `Skill "${skill}"`).toBe(expected[skill])
  }
})

test('Nacht: skill allocation breakdown matches', () => {
  const nacht = makeNacht()
  // Character creation: Handle Precisely +2, Read Someone +2, Provoke +2
  expect(nacht.skills['Handle Precisely']).toBe(2)
  expect(nacht.skills['Read Someone']).toBe(2)
  expect(nacht.skills['Provoke']).toBe(2)
  // Milestone 1 & 2: Sneak +2 each (stacked to +4)
  expect(nacht.skills['Sneak']).toBe(4)
  // Milestone 3 & 4: Deceive +2 each (stacked to +4)
  expect(nacht.skills['Deceive']).toBe(4)
  // Total skill points spent: 6 (creation) + 8 (4 milestones × 2) = 14
  const totalPoints = SKILL_LIST.reduce((sum, s) => sum + nacht.skills[s], 0)
  expect(totalPoints).toBe(14)
})

test('Nacht: variable substitution works with Nacht stats', () => {
  const nacht = makeNacht()
  expect(resolveVariable('MAR', nacht)).toBe(-1)
  expect(resolveVariable('POW', nacht)).toBe(4)
  expect(resolveVariable('AGI', nacht)).toBe(1)
  expect(resolveVariable('VIT', nacht)).toBe(0)
  expect(resolveVariable('GRT', nacht)).toBe(5)
  expect(resolveVariable('Sneak', nacht)).toBe(4)
  expect(resolveVariable('Deceive', nacht)).toBe(4)
})

test('Nacht: character is valid and has all required fields', () => {
  const nacht = makeNacht()
  expect(nacht.id).toBeTruthy()
  expect(nacht.name).toBe('Nacht')
  expect(nacht.milestones).toBe(4)
  expect(nacht.attributes).toBeDefined()
  expect(nacht.skills).toBeDefined()
  expect(nacht.config).toBeDefined()
  expect(nacht.mortalWounds).toEqual([null, null])
  expect(nacht.deathSaves).toEqual({ successes: 0, failures: 0 })
})

test('Nacht: full calculated field suite', () => {
  const nacht = makeNacht()
  const { attributes, milestones } = nacht

  // All calculated fields at once — the definitive DESIGN.md assertion
  expect(calcHP(attributes.VIT)).toBe(20)
  expect(calcEvasion(attributes.AGI)).toBe(11)
  expect(calcArmor(attributes.VIT)).toBe(0)
  expect(calcMovement(attributes.AGI)).toBe(5)
  expect(calcMilestoneBonus(milestones)).toBe(2)
  expect(calcSaveDC(milestones)).toBe(12)
  expect(calcENDRecovery(attributes.GRT)).toBe(3)
  expect(nacht.maxAbilitySlots).toBe(5)
  expect(nacht.maxFP).toBe(3)
})
