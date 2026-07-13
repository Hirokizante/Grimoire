/**
 * Store integration tests — exercise the Zustand character store's complex
 * logic: milestone flow, damage, death saves, mortal wounds, resources,
 * recover/endTurn, healing with mortal wound modifiers.
 *
 * IndexedDB is mocked so we can test the store actions in isolation.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { useCharacterStore } from '@/store/characterStore'
import { createDefaultCharacter } from '@/constants/gameData'
import type { Character } from '@/types'

// ---- Mock IndexedDB -------------------------------------------------------

// Use vi.hoisted so dbMap is available when the hoisted vi.mock factory runs.
const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  getAllCharacters: vi.fn(async () => Array.from(dbMap.values())),
  getCharacter: vi.fn(async (id: string) => dbMap.get(id) ?? null),
  putCharacter: vi.fn(async (char: Character) => {
    dbMap.set(char.id, char)
  }),
  deleteCharacter: vi.fn(async (id: string) => {
    dbMap.delete(id)
  }),
  putVersionSnapshot: vi.fn(async () => {}),
  getVersionHistory: vi.fn(async () => []),
  deleteVersionSnapshot: vi.fn(async () => {}),
  putRollLogEntry: vi.fn(async () => {}),
  getRollLogForCharacter: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  deleteRollLogEntry: vi.fn(async () => {}),
  clearRollLogForCharacter: vi.fn(async () => {}),
}))

// ---- Helpers --------------------------------------------------------------

/** Reset store and create a fresh test character as the current character. */
function setupChar(overrides: Partial<Character> = {}): Character {
  const base = createDefaultCharacter()
  const char: Character = {
    ...base,
    attributes: { MAR: 3, POW: 4, AGI: 1, VIT: 2, GRT: 3 },
    maxFP: 3,
    maxAbilitySlots: 3,
    currentHP: 30, // VIT 2 → maxHP 30
    currentEND: 10,
    currentAP: 3,
    currentFP: 3,
    mortalWounds: [null, null],
    deathSaves: { successes: 0, failures: 0 },
    ...overrides,
  }
  dbMap.set(char.id, char)
  useCharacterStore.setState({ currentCharacter: char, characters: [char] })
  return char
}

// ---- Tests ----------------------------------------------------------------

beforeEach(() => {
  dbMap.clear()
  useCharacterStore.setState({
    characters: [],
    currentCharacter: null,
    isLoaded: true,
    isSaving: false,
    versionHistory: null,
    isRestoring: false,
    view: 'home',
  })
})

// ---- Milestone flow -------------------------------------------------------

test('addMilestone: increases milestone count by 1', () => {
  setupChar({ milestones: 0 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
  })
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(1)
})

test('addMilestone: increases chosen attribute by 1', () => {
  setupChar({ milestones: 0 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
  })
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.attributes.POW).toBe(5) // 4 + 1
})

test('addMilestone: increases chosen skill by 2', () => {
  setupChar({ milestones: 0 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
  })
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.skills.Sneak).toBe(2) // 0 + 2
})

test('addMilestone: even milestone with slot choice increases slots', () => {
  setupChar({ milestones: 1, maxAbilitySlots: 3 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
    choice: 'slot',
  })
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(2)
  expect(char.maxAbilitySlots).toBe(4) // 3 + 1
})

test('addMilestone: even milestone with FP choice increases maxFP', () => {
  setupChar({ milestones: 1, maxFP: 3 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
    choice: 'fp',
  })
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(2)
  expect(char.maxFP).toBe(4) // 3 + 1
})

test('addMilestone: odd milestone does not apply choice even if given', () => {
  setupChar({ milestones: 0, maxAbilitySlots: 3, maxFP: 3 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
    choice: 'slot',
  })
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(1)
  expect(char.maxAbilitySlots).toBe(3) // unchanged
  expect(char.maxFP).toBe(3) // unchanged
})

test('addMilestone: no choice on even milestone = no slot/FP change', () => {
  setupChar({ milestones: 1, maxAbilitySlots: 3, maxFP: 3 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
  })
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(2)
  expect(char.maxAbilitySlots).toBe(3)
  expect(char.maxFP).toBe(3)
})

test('skipMilestone: increases count only, no bonuses', () => {
  setupChar({ milestones: 0, attributes: { MAR: 3, POW: 4, AGI: 1, VIT: 2, GRT: 3 } })
  useCharacterStore.getState().skipMilestone()
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(1)
  expect(char.attributes.POW).toBe(4) // unchanged
  expect(char.maxAbilitySlots).toBe(3) // unchanged
  expect(char.maxFP).toBe(3) // unchanged
})

// ---- Resource spending ----------------------------------------------------

test('spendAP: deducts AP and returns true', () => {
  setupChar({ currentAP: 3 })
  expect(useCharacterStore.getState().spendAP(2)).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(1)
})

test('spendAP: insufficient AP returns false and does not deduct', () => {
  setupChar({ currentAP: 1 })
  expect(useCharacterStore.getState().spendAP(2)).toBe(false)
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(1)
})

test('spendEND: deducts END and returns true', () => {
  setupChar({ currentEND: 10 })
  expect(useCharacterStore.getState().spendEND(4)).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(6)
})

test('spendEND: insufficient END returns false', () => {
  setupChar({ currentEND: 2 })
  expect(useCharacterStore.getState().spendEND(4)).toBe(false)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(2)
})

test('spendFP: deducts FP and returns true', () => {
  setupChar({ currentFP: 3 })
  expect(useCharacterStore.getState().spendFP(1)).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.currentFP).toBe(2)
})

test('spendFP: insufficient FP returns false', () => {
  setupChar({ currentFP: 0 })
  expect(useCharacterStore.getState().spendFP(1)).toBe(false)
})

test('restoreAP: caps at MAX_AP (3)', () => {
  setupChar({ currentAP: 2 })
  useCharacterStore.getState().restoreAP(5)
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(3)
})

test('restoreEND: caps at MAX_END (10)', () => {
  setupChar({ currentEND: 8 })
  useCharacterStore.getState().restoreEND(5)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(10)
})

test('restoreFP: caps at maxFP', () => {
  setupChar({ currentFP: 2, maxFP: 3 })
  useCharacterStore.getState().restoreFP(5)
  expect(useCharacterStore.getState().currentCharacter!.currentFP).toBe(3)
})

// ---- Recover & End Turn ---------------------------------------------------

test('recover: resets END to max (10)', () => {
  setupChar({ currentEND: 3, currentAP: 3 })
  useCharacterStore.getState().recover()
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(10)
})

test('recover: with Damaged Throat, restores half END (5)', () => {
  setupChar({
    currentEND: 2,
    mortalWounds: ['Damaged Throat', null],
  })
  useCharacterStore.getState().recover()
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(5)
})

test('endTurn: converts AP to END and applies recovery', () => {
  // VIT 2, GRT 3 → END Recovery = max(1, 1 + floor(3/2)) = 2
  setupChar({ currentAP: 2, currentEND: 5 })
  const gained = useCharacterStore.getState().endTurn()
  // AP to END: min(2, 10-5) = 2, Recovery: 2, total = 4
  expect(gained).toBe(4)
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.currentEND).toBe(9) // 5 + 4
  expect(char.currentAP).toBe(3) // reset to max
})

test('endTurn: Damaged Throat prevents END recovery', () => {
  setupChar({
    currentAP: 2,
    currentEND: 5,
    mortalWounds: ['Damaged Throat', null],
  })
  const gained = useCharacterStore.getState().endTurn()
  // AP to END: 2, Recovery: 0 (Damaged Throat), total = 2
  expect(gained).toBe(2)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(7)
})

test('endTurn: at max END, END stays at max and AP resets', () => {
  setupChar({ currentAP: 2, currentEND: 10 })
  useCharacterStore.getState().endTurn()
  // END stays at max (10), AP resets to 3
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(10)
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(3)
})

// ---- Damage ---------------------------------------------------------------

test('takeDamage: simple damage reduces HP', () => {
  setupChar({ currentHP: 30 })
  const result = useCharacterStore.getState().takeDamage(10)
  expect(result.finalHP).toBe(20)
  expect(result.hpLost).toBe(10)
  expect(result.causedMortalWound).toBe(false)
})

test('takeDamage: temp HP absorbed first', () => {
  setupChar({ currentHP: 30, tempHP: 5 })
  const result = useCharacterStore.getState().takeDamage(10)
  expect(result.tempHPConsumed).toBe(5)
  expect(result.hpLost).toBe(5)
  expect(result.finalHP).toBe(25)
})

test('takeDamage: damage exceeding HP causes mortal wound', () => {
  setupChar({ currentHP: 5 })
  const result = useCharacterStore.getState().takeDamage(15)
  expect(result.causedMortalWound).toBe(true)
  expect(result.mortalWoundsIncurred).toBe(1)
  expect(result.knockedOut).toBe(false)
  // HP resets to max after mortal wound, overflow spills
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.mortalWounds[0]).toBe('Pending Roll')
})

test('takeDamage: damage causing 2 mortal wounds → knocked out', () => {
  setupChar({ currentHP: 5, mortalWounds: ['Sprain', null] })
  // One slot already filled, so one more mortal wound fills both → knocked out
  const result = useCharacterStore.getState().takeDamage(40)
  expect(result.mortalWoundsIncurred).toBeGreaterThanOrEqual(1)
  expect(result.knockedOut).toBe(true)
})

test('takeDamage: with resistance, halves damage', () => {
  setupChar({ currentHP: 30 })
  const result = useCharacterStore.getState().takeDamage(10, { resistant: true })
  expect(result.afterResistance).toBe(5)
  expect(result.finalHP).toBe(25)
})

test('heal: increases HP up to max', () => {
  setupChar({ currentHP: 10 })
  useCharacterStore.getState().heal(5)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(15)
})

test('heal: caps at max HP', () => {
  setupChar({ currentHP: 28 })
  useCharacterStore.getState().heal(10)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(30) // VIT 2 → maxHP 30
})

test('heal: Circulatory Dysfunction halves healing', () => {
  setupChar({ currentHP: 10, mortalWounds: ['Circulatory Dysfunction', null] })
  useCharacterStore.getState().heal(10)
  // Halved: floor(10/2) = 5 → HP 15
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(15)
})

// ---- Temp HP --------------------------------------------------------------

test('setTempHP: higher value takes precedence (does not stack)', () => {
  setupChar({ tempHP: 5 })
  useCharacterStore.getState().setTempHP(3)
  // 3 < 5, so it should stay 5
  expect(useCharacterStore.getState().currentCharacter!.tempHP).toBe(5)
})

test('setTempHP: higher value replaces', () => {
  setupChar({ tempHP: 3 })
  useCharacterStore.getState().setTempHP(8)
  expect(useCharacterStore.getState().currentCharacter!.tempHP).toBe(8)
})

// ---- Death Saves ----------------------------------------------------------

test('rollDeathSave: roll >= 10 = 1 success', () => {
  setupChar({ currentHP: 0, mortalWounds: ['Sprain', 'Exhaustion'] })
  // Mock the die roll
  vi.spyOn(Math, 'random').mockReturnValue(14 / 20) // roll 15
  const result = useCharacterStore.getState().rollDeathSave()
  expect(result.roll).toBe(15)
  expect(result.successes).toBe(1)
  expect(result.failures).toBe(0)
  vi.restoreAllMocks()
})

test('rollDeathSave: roll < 10 = 1 failure', () => {
  setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 0, failures: 0 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(4 / 20) // roll 5
  const result = useCharacterStore.getState().rollDeathSave()
  expect(result.roll).toBe(5)
  expect(result.failures).toBe(1)
  vi.restoreAllMocks()
})

test('rollDeathSave: nat 20 = 2 successes', () => {
  setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 0, failures: 0 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(19 / 20) // roll 20
  const result = useCharacterStore.getState().rollDeathSave()
  expect(result.roll).toBe(20)
  expect(result.successes).toBe(2)
  expect(result.doubled).toBe(true)
  vi.restoreAllMocks()
})

test('rollDeathSave: nat 1 = 2 failures', () => {
  setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 0, failures: 0 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(0) // roll 1
  const result = useCharacterStore.getState().rollDeathSave()
  expect(result.roll).toBe(1)
  expect(result.failures).toBe(2)
  expect(result.doubled).toBe(true)
  vi.restoreAllMocks()
})

test('rollDeathSave: 3 successes → revived at 1 HP', () => {
  setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 2, failures: 0 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(14 / 20) // roll 15 → 1 more success
  const result = useCharacterStore.getState().rollDeathSave()
  expect(result.successes).toBe(3)
  expect(result.revived).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(1)
  vi.restoreAllMocks()
})

test('rollDeathSave: 3 failures → died', () => {
  setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 0, failures: 2 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(4 / 20) // roll 5 → 1 more failure
  const result = useCharacterStore.getState().rollDeathSave()
  expect(result.failures).toBe(3)
  expect(result.died).toBe(true)
  vi.restoreAllMocks()
})

// ---- Mortal Wounds --------------------------------------------------------

test('rollMortalWound: fills first empty slot', () => {
  setupChar({ mortalWounds: [null, null] })
  vi.spyOn(Math, 'random').mockReturnValue(6 / 20) // roll 7 → Hemorrhage
  const result = useCharacterStore.getState().rollMortalWound()
  expect(result.roll).toBe(7)
  expect(result.woundName).toBe('Hemorrhage')
  expect(result.slotIndex).toBe(0)
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.mortalWounds[0]).toBe('Hemorrhage')
  vi.restoreAllMocks()
})

test('rollMortalWound: fills second slot and detects knockout', () => {
  setupChar({ mortalWounds: ['Sprain', null] })
  vi.spyOn(Math, 'random').mockReturnValue(0) // roll 1 → Grave Danger
  const result = useCharacterStore.getState().rollMortalWound()
  expect(result.slotIndex).toBe(1)
  expect(result.knockedOut).toBe(true)
  vi.restoreAllMocks()
})

test('clearMortalWound: sets slot to null', () => {
  setupChar({ mortalWounds: ['Sprain', 'Exhaustion'] })
  useCharacterStore.getState().clearMortalWound(0)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds[0]).toBe(null)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds[1]).toBe('Exhaustion')
})

// ---- Full Restore ---------------------------------------------------------

test('fullRestore: resets everything', () => {
  setupChar({
    currentHP: 5,
    tempHP: 3,
    currentEND: 2,
    currentAP: 1,
    currentFP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 2, failures: 1 },
  })
  useCharacterStore.getState().fullRestore()
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.currentHP).toBe(30) // VIT 2 → maxHP 30
  expect(char.tempHP).toBe(0)
  expect(char.currentEND).toBe(10)
  expect(char.currentAP).toBe(3)
  expect(char.currentFP).toBe(3) // maxFP
  expect(char.mortalWounds).toEqual([null, null])
  expect(char.deathSaves).toEqual({ successes: 0, failures: 0 })
})

// ---- Ability management ---------------------------------------------------

test('addAbilityBlock: appends to slotted abilities', () => {
  setupChar()
  const newAbility = {
    id: 'test-1',
    name: 'Test Ability',
    traits: ['Action'],
    cost: { ap: 1 },
    damage: '1d6',
    description: 'Test',
    overcharge: '',
    flavorText: '',
    isMinor: false,
  }
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', newAbility)
  const updated = useCharacterStore.getState().currentCharacter!
  expect(updated.slottedAbilities).toHaveLength(1)
  expect(updated.slottedAbilities[0].name).toBe('Test Ability')
})

test('moveAbility: moves from pool to slotted', () => {
  setupChar()
  const ability = {
    id: 'pool-1',
    name: 'Pool Ability',
    traits: [],
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
  }
  useCharacterStore.getState().addAbilityBlock('abilityPool', ability)
  useCharacterStore.getState().moveAbility('pool-1', 'abilityPool', 'slottedAbilities')
  const updated = useCharacterStore.getState().currentCharacter!
  expect(updated.abilityPool).toHaveLength(0)
  expect(updated.slottedAbilities).toHaveLength(1)
})

test('reorderAbility: reorders within slotted', () => {
  setupChar()
  const a1 = { id: 'a1', name: 'A1', traits: [], cost: {}, damage: '', description: '', overcharge: '', flavorText: '', isMinor: false }
  const a2 = { id: 'a2', name: 'A2', traits: [], cost: {}, damage: '', description: '', overcharge: '', flavorText: '', isMinor: false }
  const a3 = { id: 'a3', name: 'A3', traits: [], cost: {}, damage: '', description: '', overcharge: '', flavorText: '', isMinor: false }
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', a1)
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', a2)
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', a3)
  // Move a1 from index 0 to index 2
  useCharacterStore.getState().reorderAbility('slottedAbilities', 0, 2)
  const updated = useCharacterStore.getState().currentCharacter!
  expect(updated.slottedAbilities.map((a) => a.id)).toEqual(['a2', 'a3', 'a1'])
})
