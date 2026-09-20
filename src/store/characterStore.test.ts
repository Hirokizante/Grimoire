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
  normalizeCharacter: (char: Character) => char,
  // Mirrors db.stripLabels for exportImport's export path (saveVersion).
  stripLabels: ({ labels: _labels, ...rest }: Character) => rest as Character,
  getAllStatuses: vi.fn(async () => []),
  getStatus: vi.fn(async () => null),
  putStatus: vi.fn(async () => {}),
  deleteStatus: vi.fn(async () => {}),
  normalizeStatus: (s: Character) => s,
  getAllVersionSnapshots: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
  // GM Screens — every new db.ts helper is mirrored here (see .hermes.md).
  getAllScreens: vi.fn(async () => []),
  getScreen: vi.fn(async () => null),
  putScreen: vi.fn(async () => {}),
  deleteScreen: vi.fn(async () => {}),
  normalizeScreen: (screen: unknown) => screen,
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
  let char = setupChar({ milestones: 0 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
  })
  char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(1)
})

test('addMilestone: increases chosen attribute by 1', () => {
  let char = setupChar({ milestones: 0 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
  })
  char = useCharacterStore.getState().currentCharacter!
  expect(char.attributes.POW).toBe(5) // 4 + 1
})

test('addMilestone: increases chosen skill by 2', () => {
  let char = setupChar({ milestones: 0 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
  })
  char = useCharacterStore.getState().currentCharacter!
  expect(char.skills.Sneak).toBe(2) // 0 + 2
})

test('addMilestone: even milestone with slot choice increases slots', () => {
  let char = setupChar({ milestones: 1, maxAbilitySlots: 3 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
    choice: 'slot',
  })
  char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(2)
  expect(char.maxAbilitySlots).toBe(4) // 3 + 1
})

test('addMilestone: even milestone with FP choice increases maxFP', () => {
  let char = setupChar({ milestones: 1, maxFP: 3 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
    choice: 'fp',
  })
  char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(2)
  expect(char.maxFP).toBe(4) // 3 + 1
})

test('addMilestone: odd milestone does not apply choice even if given', () => {
  let char = setupChar({ milestones: 0, maxAbilitySlots: 3, maxFP: 3 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
    choice: 'slot',
  })
  char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(1)
  expect(char.maxAbilitySlots).toBe(3) // unchanged
  expect(char.maxFP).toBe(3) // unchanged
})

test('addMilestone: no choice on even milestone = no slot/FP change', () => {
  let char = setupChar({ milestones: 1, maxAbilitySlots: 3, maxFP: 3 })
  useCharacterStore.getState().addMilestone({
    attribute: 'POW',
    skill: 'Sneak',
  })
  char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(2)
  expect(char.maxAbilitySlots).toBe(3)
  expect(char.maxFP).toBe(3)
})

test('skipMilestone: increases count only, no bonuses', () => {
  let char = setupChar({ milestones: 0, attributes: { MAR: 3, POW: 4, AGI: 1, VIT: 2, GRT: 3 } })
  useCharacterStore.getState().skipMilestone()
  char = useCharacterStore.getState().currentCharacter!
  expect(char.milestones).toBe(1)
  expect(char.attributes.POW).toBe(4) // unchanged
  expect(char.maxAbilitySlots).toBe(3) // unchanged
  expect(char.maxFP).toBe(3) // unchanged
})

// ---- Resource spending ----------------------------------------------------

test('spendAP: deducts AP and returns true', () => {
  const char = setupChar({ currentAP: 3 })
  expect(useCharacterStore.getState().spendAP(char.id, 2)).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(1)
})

test('spendAP: insufficient AP returns false and does not deduct', () => {
  const char = setupChar({ currentAP: 1 })
  expect(useCharacterStore.getState().spendAP(char.id, 2)).toBe(false)
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(1)
})

test('spendEND: deducts END and returns true', () => {
  const char = setupChar({ currentEND: 10 })
  expect(useCharacterStore.getState().spendEND(char.id, 4)).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(6)
})

test('spendEND: insufficient END returns false', () => {
  const char = setupChar({ currentEND: 2 })
  expect(useCharacterStore.getState().spendEND(char.id, 4)).toBe(false)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(2)
})

test('spendFP: deducts FP and returns true', () => {
  const char = setupChar({ currentFP: 3 })
  expect(useCharacterStore.getState().spendFP(char.id, 1)).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.currentFP).toBe(2)
})

test('spendFP: insufficient FP returns false', () => {
  const char = setupChar({ currentFP: 0 })
  expect(useCharacterStore.getState().spendFP(char.id, 1)).toBe(false)
})

test('restoreAP: caps at MAX_AP (3)', () => {
  const char = setupChar({ currentAP: 2 })
  useCharacterStore.getState().restoreAP(char.id, 5)
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(3)
})

test('restoreEND: caps at MAX_END (10)', () => {
  const char = setupChar({ currentEND: 8 })
  useCharacterStore.getState().restoreEND(char.id, 5)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(10)
})

test('restoreFP: caps at maxFP', () => {
  const char = setupChar({ currentFP: 2, maxFP: 3 })
  useCharacterStore.getState().restoreFP(char.id, 5)
  expect(useCharacterStore.getState().currentCharacter!.currentFP).toBe(3)
})

// ---- Recover & End Turn ---------------------------------------------------

test('recover: resets END to max (10)', () => {
  const char = setupChar({ currentEND: 3, currentAP: 3 })
  useCharacterStore.getState().recover(char.id)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(10)
})

test('recover: with Damaged Throat, restores half END (5)', () => {
  const char = setupChar({
    currentEND: 2,
    mortalWounds: ['Damaged Throat', null],
  })
  useCharacterStore.getState().recover(char.id)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(5)
})

test('endTurn: converts AP to END and applies recovery', () => {
  // VIT 2, GRT 3 → END Recovery = max(1, 1 + floor(3/2)) = 2
  let char = setupChar({ currentAP: 2, currentEND: 5 })
  const gained = useCharacterStore.getState().endTurn(char.id)
  // AP to END: min(2, 10-5) = 2, Recovery: 2, total = 4
  expect(gained).toBe(4)
  char = useCharacterStore.getState().currentCharacter!
  expect(char.currentEND).toBe(9) // 5 + 4
  expect(char.currentAP).toBe(3) // reset to max
})

test('endTurn: Damaged Throat prevents END recovery', () => {
  const char = setupChar({
    currentAP: 2,
    currentEND: 5,
    mortalWounds: ['Damaged Throat', null],
  })
  const gained = useCharacterStore.getState().endTurn(char.id)
  // AP to END: 2, Recovery: 0 (Damaged Throat), total = 2
  expect(gained).toBe(2)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(7)
})

test('endTurn: at max END, END stays at max and AP resets', () => {
  const char = setupChar({ currentAP: 2, currentEND: 10 })
  useCharacterStore.getState().endTurn(char.id)
  // END stays at max (10), AP resets to 3
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(10)
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(3)
})

// ---- Damage ---------------------------------------------------------------

test('takeDamage: simple damage reduces HP', () => {
  const char = setupChar({ currentHP: 30 })
  const result = useCharacterStore.getState().takeDamage(char.id, 10)
  expect(result.finalHP).toBe(20)
  expect(result.hpLost).toBe(10)
  expect(result.causedMortalWound).toBe(false)
})

test('takeDamage: temp HP absorbed first', () => {
  const char = setupChar({ currentHP: 30, tempHP: 5 })
  const result = useCharacterStore.getState().takeDamage(char.id, 10)
  expect(result.tempHPConsumed).toBe(5)
  expect(result.hpLost).toBe(5)
  expect(result.finalHP).toBe(25)
})

test('takeDamage: damage exceeding HP causes mortal wound', () => {
  let char = setupChar({ currentHP: 5 })
  const result = useCharacterStore.getState().takeDamage(char.id, 15)
  expect(result.causedMortalWound).toBe(true)
  expect(result.mortalWoundsIncurred).toBe(1)
  expect(result.knockedOut).toBe(false)
  // HP resets to max after mortal wound, overflow spills
  char = useCharacterStore.getState().currentCharacter!
  expect(char.mortalWounds[0]).toBe('Pending Roll')
})

test('takeDamage: damage causing 2 mortal wounds → knocked out', () => {
  const char = setupChar({ currentHP: 5, mortalWounds: ['Sprain', null] })
  // One slot already filled, so one more mortal wound fills both → knocked out
  const result = useCharacterStore.getState().takeDamage(char.id, 40)
  expect(result.mortalWoundsIncurred).toBeGreaterThanOrEqual(1)
  expect(result.knockedOut).toBe(true)
})

test('takeDamage: a hit that fills the second wound is not a knock-out', () => {
  // 10 HP, one wound, 15 damage: the wound lands, HP resets to 30 with the 5
  // spill-over. The track is full and the character is standing — the next 0 HP
  // is the knock-out, this hit is not it (SRD "Hit Points and Mortal Wounds").
  const char = setupChar({ currentHP: 10, mortalWounds: ['Sprain', null] })
  const result = useCharacterStore.getState().takeDamage(char.id, 15)

  expect(result.mortalWoundsIncurred).toBe(1)
  expect(result.finalHP).toBe(25)
  expect(result.knockedOut).toBe(false)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([
    'Sprain',
    'Pending Roll',
  ])
})

test('takeDamage: the next 0 HP on a full track is the knock-out', () => {
  // Same character one hit later: 25 HP, both slots taken, 30 damage. No third
  // wound exists to pay for the 0 HP, so this is the knock-out — and no wound
  // is incurred by it (the cards on the track are the two already there).
  const char = setupChar({
    currentHP: 25,
    mortalWounds: ['Sprain', 'Exhaustion'],
  })
  const result = useCharacterStore.getState().takeDamage(char.id, 30)

  expect(result.mortalWoundsIncurred).toBe(0)
  expect(result.causedMortalWound).toBe(false)
  expect(result.knockedOut).toBe(true)
})

test('takeDamage: with resistance, halves damage', () => {
  const char = setupChar({ currentHP: 30 })
  const result = useCharacterStore.getState().takeDamage(char.id, 10, { resistant: true })
  expect(result.afterResistance).toBe(5)
  expect(result.finalHP).toBe(25)
})

test('heal: increases HP up to max', () => {
  const char = setupChar({ currentHP: 10 })
  useCharacterStore.getState().heal(char.id, 5)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(15)
})

test('heal: caps at max HP', () => {
  const char = setupChar({ currentHP: 28 })
  useCharacterStore.getState().heal(char.id, 10)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(30) // VIT 2 → maxHP 30
})

test('heal: Circulatory Dysfunction halves healing', () => {
  const char = setupChar({ currentHP: 10, mortalWounds: ['Circulatory Dysfunction', null] })
  useCharacterStore.getState().heal(char.id, 10)
  // Halved: floor(10/2) = 5 → HP 15
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(15)
})

// ---- Temp HP --------------------------------------------------------------

test('setTempHP: higher value takes precedence (does not stack)', () => {
  const char = setupChar({ tempHP: 5 })
  useCharacterStore.getState().setTempHP(char.id, 3)
  // 3 < 5, so it should stay 5
  expect(useCharacterStore.getState().currentCharacter!.tempHP).toBe(5)
})

test('setTempHP: higher value replaces', () => {
  const char = setupChar({ tempHP: 3 })
  useCharacterStore.getState().setTempHP(char.id, 8)
  expect(useCharacterStore.getState().currentCharacter!.tempHP).toBe(8)
})

// ---- Death Saves ----------------------------------------------------------

test('rollDeathSave: roll >= 10 = 1 success', () => {
  const char = setupChar({ currentHP: 0, mortalWounds: ['Sprain', 'Exhaustion'] })
  // Mock the die roll
  vi.spyOn(Math, 'random').mockReturnValue(14 / 20) // roll 15
  const result = useCharacterStore.getState().rollDeathSave(char.id)
  expect(result.roll).toBe(15)
  expect(result.successes).toBe(1)
  expect(result.failures).toBe(0)
  vi.restoreAllMocks()
})

test('rollDeathSave: roll < 10 = 1 failure', () => {
  const char = setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 0, failures: 0 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(4 / 20) // roll 5
  const result = useCharacterStore.getState().rollDeathSave(char.id)
  expect(result.roll).toBe(5)
  expect(result.failures).toBe(1)
  vi.restoreAllMocks()
})

test('rollDeathSave: nat 20 = 2 successes', () => {
  const char = setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 0, failures: 0 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(19 / 20) // roll 20
  const result = useCharacterStore.getState().rollDeathSave(char.id)
  expect(result.roll).toBe(20)
  expect(result.successes).toBe(2)
  expect(result.doubled).toBe(true)
  vi.restoreAllMocks()
})

test('rollDeathSave: nat 1 = 2 failures', () => {
  const char = setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 0, failures: 0 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(0) // roll 1
  const result = useCharacterStore.getState().rollDeathSave(char.id)
  expect(result.roll).toBe(1)
  expect(result.failures).toBe(2)
  expect(result.doubled).toBe(true)
  vi.restoreAllMocks()
})

test('rollDeathSave: 3 successes → revived at 1 HP', () => {
  const char = setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 2, failures: 0 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(14 / 20) // roll 15 → 1 more success
  const result = useCharacterStore.getState().rollDeathSave(char.id)
  expect(result.successes).toBe(3)
  expect(result.revived).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(1)
  vi.restoreAllMocks()
})

test('rollDeathSave: 3 failures → died', () => {
  const char = setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 0, failures: 2 },
  })
  vi.spyOn(Math, 'random').mockReturnValue(4 / 20) // roll 5 → 1 more failure
  const result = useCharacterStore.getState().rollDeathSave(char.id)
  expect(result.failures).toBe(3)
  expect(result.died).toBe(true)
  vi.restoreAllMocks()
})

// ---- Mortal Wounds --------------------------------------------------------

test('rollMortalWound: fills first empty slot', () => {
  let char = setupChar({ mortalWounds: [null, null] })
  vi.spyOn(Math, 'random').mockReturnValue(6 / 20) // roll 7 → Hemorrhage
  const result = useCharacterStore.getState().rollMortalWound(char.id)
  expect(result.roll).toBe(7)
  expect(result.woundName).toBe('Hemorrhage')
  expect(result.slotIndex).toBe(0)
  char = useCharacterStore.getState().currentCharacter!
  expect(char.mortalWounds[0]).toBe('Hemorrhage')
  vi.restoreAllMocks()
})

test('rollMortalWound: filling the second slot is not a knock-out', () => {
  // The character is standing at 30 HP: the track is full, which is the
  // Critical Condition (the next 0 HP is the knock-out), not a knock-out now.
  const char = setupChar({ mortalWounds: ['Sprain', null] })
  vi.spyOn(Math, 'random').mockReturnValue(0) // roll 1 → Grave Danger
  const result = useCharacterStore.getState().rollMortalWound(char.id)
  expect(result.slotIndex).toBe(1)
  expect(result.trackFull).toBe(true)
  expect(result.knockedOut).toBe(false)
  vi.restoreAllMocks()
})

test('rollMortalWound: resolving a wound at 0 HP with a full track is a knock-out', () => {
  // Overkill can burn through both slots in one hit and leave the character at
  // 0 HP; naming the last wound is the moment that state is reached.
  const char = setupChar({
    currentHP: 0,
    mortalWounds: ['Sprain', 'Pending Roll'],
  })
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const result = useCharacterStore.getState().rollMortalWound(char.id)
  expect(result.trackFull).toBe(true)
  expect(result.knockedOut).toBe(true)
  vi.restoreAllMocks()
})

// ---- Mortal Wounds applied by hand (no D20) --------------------------------

test('addMortalWound: applies the named table entry to the first empty slot', () => {
  const char = setupChar({ mortalWounds: [null, null] })
  const result = useCharacterStore.getState().addMortalWound(char.id, 'Damaged Throat')

  // The entry's own D20 rides along, so the sheet/panel prints it like a roll.
  expect(result.roll).toBe(8)
  expect(result.woundName).toBe('Damaged Throat')
  expect(result.woundDescription).toContain('Unable to regain END')
  expect(result.slotIndex).toBe(0)
  expect(result.knockedOut).toBe(false)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([
    'Damaged Throat',
    null,
  ])
})

test('addMortalWound: names the oldest pending slot instead of opening a second one', () => {
  // `takeDamage` parked slot 0 on "Pending Roll": the wound happened, it just
  // has no name yet. Naming it by hand is what the player would otherwise roll.
  const char = setupChar({ mortalWounds: ['Pending Roll', null] })
  const result = useCharacterStore.getState().addMortalWound(char.id, 'Hemorrhage')

  expect(result.slotIndex).toBe(0)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([
    'Hemorrhage',
    null,
  ])
})

test('addMortalWound: filling the second slot reports the critical condition', () => {
  const char = setupChar({ mortalWounds: ['Sprain', null] })
  const result = useCharacterStore.getState().addMortalWound(char.id, 'Exhaustion')

  expect(result.slotIndex).toBe(1)
  // Full, but standing: a knock-out needs 0 HP as well.
  expect(result.trackFull).toBe(true)
  expect(result.knockedOut).toBe(false)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([
    'Sprain',
    'Exhaustion',
  ])
})

test('addMortalWound: filling the last slot at 0 HP knocks the character out', () => {
  const char = setupChar({ currentHP: 0, mortalWounds: ['Sprain', 'Pending Roll'] })
  const result = useCharacterStore.getState().addMortalWound(char.id, 'Exhaustion')

  expect(result.trackFull).toBe(true)
  expect(result.knockedOut).toBe(true)
})

test('addMortalWound: a full track gains nothing', () => {
  const char = setupChar({ mortalWounds: ['Sprain', 'Exhaustion'] })
  const result = useCharacterStore.getState().addMortalWound(char.id, 'Hemorrhage')

  expect(result.slotIndex).toBe(-1)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([
    'Sprain',
    'Exhaustion',
  ])
})

test('addMortalWound: a name off the table is refused', () => {
  // A wound's effects are looked up by name (healing, END recovery, …), so an
  // invented one would occupy a slot and change nothing.
  const char = setupChar()
  const result = useCharacterStore.getState().addMortalWound(char.id, 'Broken Toe')

  expect(result.slotIndex).toBe(-1)
  expect(result.woundName).toBe('')
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([null, null])
})

test('addMortalWound: an unknown character changes nothing', () => {
  const result = useCharacterStore.getState().addMortalWound('nope', 'Hemorrhage')
  expect(result.slotIndex).toBe(-1)
})

test('addMortalWound: the wound it applies is a real one to the rest of the sheet', () => {
  // Circulatory Dysfunction halves healing — proof that the manual path writes
  // a wound the rules actually see, not a decorative label in a slot.
  const char = setupChar({ currentHP: 10, mortalWounds: [null, null] })
  useCharacterStore.getState().addMortalWound(char.id, 'Circulatory Dysfunction')

  useCharacterStore.getState().heal(char.id, 10)

  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(15)
})

test('clearMortalWound: sets slot to null', () => {
  const char = setupChar({ mortalWounds: ['Sprain', 'Exhaustion'] })
  useCharacterStore.getState().clearMortalWound(char.id, 0)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds[0]).toBe(null)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds[1]).toBe('Exhaustion')
})

test('clearMortalWounds: empties the whole track, keeping the slot count', () => {
  const char = setupChar({ mortalWounds: ['Sprain', 'Exhaustion'] })
  useCharacterStore.getState().clearMortalWounds(char.id)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([null, null])

  // Clearing a clean track is harmless, and still leaves two empty slots.
  useCharacterStore.getState().clearMortalWounds(char.id)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([null, null])
})

// ---- Mortal Wounds from a GM panel (auto-rolled for the GM) ----------------

test('takePanelDamage: rolls the Mortal Wound it causes instead of pending it', () => {
  const char = setupChar({ currentHP: 5 })
  vi.spyOn(Math, 'random').mockReturnValue(6 / 20) // roll 7 → Hemorrhage
  const result = useCharacterStore.getState().takePanelDamage(char.id, 15)

  expect(result.causedMortalWound).toBe(true)
  expect(result.mortalWoundsIncurred).toBe(1)
  expect(result.mortalWoundRolls).toEqual([{ roll: 7, name: 'Hemorrhage' }])
  // HP resets to max with the 10 excess spilling over, exactly as on a sheet.
  expect(result.finalHP).toBe(20)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([
    'Hemorrhage',
    null,
  ])
  vi.restoreAllMocks()
})

test('takePanelDamage: a big hit can burn both slots and knock the character out', () => {
  // 30 max HP from 5 current: 65 damage → wound (HP 30 − 30), wound (HP 30 − 5),
  // and no third slot, so the character is knocked out.
  const char = setupChar({ currentHP: 5 })
  vi.spyOn(Math, 'random').mockReturnValue(6 / 20) // roll 7 → Hemorrhage
  const result = useCharacterStore.getState().takePanelDamage(char.id, 65)

  expect(result.mortalWoundsIncurred).toBe(2)
  expect(result.mortalWoundRolls).toHaveLength(2)
  expect(result.knockedOut).toBe(true)
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([
    'Hemorrhage',
    'Hemorrhage',
  ])
  vi.restoreAllMocks()
})

test('takePanelDamage: a plain hit leaves the track and the rolls untouched', () => {
  const char = setupChar({ currentHP: 30 })
  const result = useCharacterStore.getState().takePanelDamage(char.id, 4)
  expect(result.finalHP).toBe(26)
  expect(result.mortalWoundRolls).toBeUndefined()
  expect(useCharacterStore.getState().currentCharacter!.mortalWounds).toEqual([null, null])
})

test('takePanelDamage: a wound the player left pending still resolves from the panel', () => {
  // The player's own sheet put slot 0 on "Pending Roll"; panel damage that
  // causes a second wound rolls a D20 for it — `rollMortalWound` fills the
  // oldest pending slot first — so the hit never adds an unresolved slot.
  const char = setupChar({ currentHP: 5, mortalWounds: ['Pending Roll', null] })
  vi.spyOn(Math, 'random').mockReturnValue(6 / 20) // roll 7 → Hemorrhage
  const result = useCharacterStore.getState().takePanelDamage(char.id, 15)
  expect(result.mortalWoundRolls).toEqual([{ roll: 7, name: 'Hemorrhage' }])
  expect(
    useCharacterStore.getState().currentCharacter!.mortalWounds.filter(
      (w) => w === 'Pending Roll',
    ),
  ).toHaveLength(1)
  vi.restoreAllMocks()
})

// ---- Full Restore ---------------------------------------------------------

test('fullRestore: resets everything', () => {
  let char = setupChar({
    currentHP: 5,
    tempHP: 3,
    currentEND: 2,
    currentAP: 1,
    currentFP: 0,
    mortalWounds: ['Sprain', 'Exhaustion'],
    deathSaves: { successes: 2, failures: 1 },
  })
  useCharacterStore.getState().fullRestore(char.id)
  char = useCharacterStore.getState().currentCharacter!
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
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
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
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
  }
  useCharacterStore.getState().addAbilityBlock('abilityPool', ability)
  useCharacterStore.getState().moveAbility('pool-1', 'abilityPool', 'slottedAbilities')
  const updated = useCharacterStore.getState().currentCharacter!
  expect(updated.abilityPool).toHaveLength(0)
  expect(updated.slottedAbilities).toHaveLength(1)
})

test('reorderAbility: reorders within slotted', () => {
  setupChar()
  const a1 = { id: 'a1', name: 'A1', traits: [], cost: {}, damage: '', description: '', overcharge: '', flavorText: '', isMinor: false, showActivate: true, subAbilitiesUnderDescription: [], subAbilitiesUnderOvercharge: [] }
  const a2 = { id: 'a2', name: 'A2', traits: [], cost: {}, damage: '', description: '', overcharge: '', flavorText: '', isMinor: false, showActivate: true, subAbilitiesUnderDescription: [], subAbilitiesUnderOvercharge: [] }
  const a3 = { id: 'a3', name: 'A3', traits: [], cost: {}, damage: '', description: '', overcharge: '', flavorText: '', isMinor: false, showActivate: true, subAbilitiesUnderDescription: [], subAbilitiesUnderOvercharge: [] }
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', a1)
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', a2)
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', a3)
  // Move a1 from index 0 to index 2
  useCharacterStore.getState().reorderAbility('slottedAbilities', 0, 2)
  const updated = useCharacterStore.getState().currentCharacter!
  expect(updated.slottedAbilities.map((a) => a.id)).toEqual(['a2', 'a3', 'a1'])
})

test('reorderAbility: dropping past the last card appends', () => {
  setupChar()
  const ability = (id: string) => ({ id, name: id, traits: [], cost: {}, damage: '', description: '', overcharge: '', flavorText: '', isMinor: false, showActivate: true, subAbilitiesUnderDescription: [], subAbilitiesUnderOvercharge: [] })
  for (const id of ['a1', 'a2', 'a3']) {
    useCharacterStore.getState().addAbilityBlock('slottedAbilities', ability(id))
  }
  // The gap below the last card is a gap index one past the end of the list, and
  // the drop preview draws the card landing there — so the drop has to take it
  // rather than reject the index and leave the card where it was.
  useCharacterStore.getState().reorderAbility('slottedAbilities', 0, 3)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities.map((a) => a.id),
  ).toEqual(['a2', 'a3', 'a1'])

  // A card already last, dropped in the gap under itself, stays exactly where it
  // is rather than being spliced out and back in.
  useCharacterStore.getState().reorderAbility('slottedAbilities', 2, 3)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities.map((a) => a.id),
  ).toEqual(['a2', 'a3', 'a1'])
})

/** Minimal slotted/custom ability fixture, identified by its id. */
function slotAbility(id: string) {
  return {
    id,
    name: id,
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

test('addAbilityBlock: inserts at the given index', () => {
  setupChar()
  for (const id of ['a1', 'a3']) {
    useCharacterStore.getState().addAbilityBlock('slottedAbilities', slotAbility(id))
  }
  // Duplication inserts the copy at the original's index + 1.
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', slotAbility('a2'), 1)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities.map((a) => a.id),
  ).toEqual(['a1', 'a2', 'a3'])
})

test('addAbilityBlock: an index past the end still appends', () => {
  setupChar()
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', slotAbility('a1'))
  useCharacterStore.getState().addAbilityBlock('slottedAbilities', slotAbility('a2'), 99)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities.map((a) => a.id),
  ).toEqual(['a1', 'a2'])
})

test('addCustomAbility: inserts at the given index', () => {
  setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  const sectionId = useCharacterStore.getState().addCustomSection(tabId, 'Offense')
  for (const id of ['a1', 'a3']) {
    useCharacterStore.getState().addCustomAbility(tabId, sectionId, slotAbility(id))
  }
  useCharacterStore.getState().addCustomAbility(tabId, sectionId, slotAbility('a2'), 1)
  const section = useCharacterStore
    .getState()
    .currentCharacter!.customTabs.find((t) => t.id === tabId)!
    .sections.find((s) => s.id === sectionId)!
  expect(section.kind).toBe('ability')
  expect(
    (section as { abilities: { id: string }[] }).abilities.map((a) => a.id),
  ).toEqual(['a1', 'a2', 'a3'])
})

// ---- Export / versioning ----------------------------------------------------
// (saveVersion auto-bumps by patch level)

test('saveVersion: defaults to auto-incrementing patch bump', async () => {
  let char = setupChar({ version: '5.0.0' })
  const snap = await useCharacterStore.getState().saveVersion()
  expect(snap).not.toBeNull()
  expect(snap!.version).toBe('5.0.1')
  // Character's internal counter matches the bumped version.
  char = useCharacterStore.getState().currentCharacter!
  expect(char.version).toBe('5.0.1')
})

test('saveVersion: overrides version counter with the provided value', async () => {
  let char = setupChar({ version: '3.0.0' })
  const snap = await useCharacterStore.getState().saveVersion('9.1.2')
  expect(snap).not.toBeNull()
  expect(snap!.version).toBe('9.1.2')
  char = useCharacterStore.getState().currentCharacter!
  expect(char.version).toBe('9.1.2')
})

test('saveVersion: consecutive auto bumps start from the overridden value', async () => {
  setupChar({ version: '3.0.0' })
  await useCharacterStore.getState().saveVersion('10.0.0')
  const snap2 = await useCharacterStore.getState().saveVersion()
  expect(snap2).not.toBeNull()
  expect(snap2!.version).toBe('10.0.1')
})

// ---- View-mode persistence ---------------------------------------------------

test('updateSectionViewMode: sets slotted view mode to list', () => {
  let char = setupChar()
  useCharacterStore.getState().updateSectionViewMode('slottedAbilities', 'list')
  char = useCharacterStore.getState().currentCharacter!
  expect(char.viewModes.slottedAbilities).toBe('list')
  // Pool untouched.
  expect(char.viewModes.abilityPool).toBe('grid')
})

test('updateSectionViewMode: sets pool view mode to list', () => {
  let char = setupChar()
  useCharacterStore.getState().updateSectionViewMode('abilityPool', 'list')
  char = useCharacterStore.getState().currentCharacter!
  expect(char.viewModes.abilityPool).toBe('list')
})

test('updateCustomSectionViewMode: sets a custom section view mode', () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  const secId = useCharacterStore.getState().addCustomSection(tabId, 'Offense')
  useCharacterStore.getState().updateCustomSectionViewMode(tabId, secId, 'list')
  char = useCharacterStore.getState().currentCharacter!
  expect(char.viewModes.customTabs[tabId][secId]).toBe('list')
})

test('addCustomSection: seeds viewModes with grid by default', () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  const secId = useCharacterStore.getState().addCustomSection(tabId, 'Offense')
  char = useCharacterStore.getState().currentCharacter!
  expect(char.viewModes.customTabs[tabId][secId]).toBe('grid')
})

test('removeCustomSection: cleans up viewModes entry', () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  const secId = useCharacterStore.getState().addCustomSection(tabId, 'Offense')
  useCharacterStore.getState().updateCustomSectionViewMode(tabId, secId, 'list')
  useCharacterStore.getState().removeCustomSection(tabId, secId)
  char = useCharacterStore.getState().currentCharacter!
  expect(char.viewModes.customTabs[tabId]?.[secId]).toBeUndefined()
})

test('removeCustomTab: cleans up viewModes entry for the whole tab', () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  useCharacterStore.getState().addCustomSection(tabId, 'Offense')
  useCharacterStore.getState().removeCustomTab(tabId)
  char = useCharacterStore.getState().currentCharacter!
  expect(char.viewModes.customTabs[tabId]).toBeUndefined()
})

test('updateCustomSectionViewMode: overrides a previously-set custom section mode', () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  const secId = useCharacterStore.getState().addCustomSection(tabId, 'Defense')
  useCharacterStore.getState().updateCustomSectionViewMode(tabId, secId, 'list')
  useCharacterStore.getState().updateCustomSectionViewMode(tabId, secId, 'grid')
  char = useCharacterStore.getState().currentCharacter!
  expect(char.viewModes.customTabs[tabId][secId]).toBe('grid')
})

// ---- Custom section reordering -----------------------------------------------

/** The named sections of one tab, in order. */
function sectionNames(tabId: string): string[] {
  return useCharacterStore
    .getState()
    .currentCharacter!.customTabs.find((t) => t.id === tabId)!
    .sections.map((s) => s.name)
}

test('reorderCustomSection: moves a section down within its tab', () => {
  setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  useCharacterStore.getState().addCustomSection(tabId, 'One')
  const twoId = useCharacterStore.getState().addCustomSection(tabId, 'Two')
  useCharacterStore.getState().addCustomTextSection(tabId, 'Three')
  useCharacterStore.getState().updateCustomSectionViewMode(tabId, twoId, 'list')

  useCharacterStore.getState().reorderCustomSection(tabId, 0, 1)

  expect(sectionNames(tabId)).toEqual(['Two', 'One', 'Three'])
  // Reordering is positional only: per-section view modes are keyed by id and
  // must survive the move.
  const char = useCharacterStore.getState().currentCharacter!
  expect(char.viewModes.customTabs[tabId][twoId]).toBe('list')
})

test('reorderCustomSection: moves a section up within its tab', () => {
  setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  useCharacterStore.getState().addCustomSection(tabId, 'One')
  useCharacterStore.getState().addCustomSection(tabId, 'Two')
  useCharacterStore.getState().addCustomTextSection(tabId, 'Three')

  useCharacterStore.getState().reorderCustomSection(tabId, 2, 1)

  expect(sectionNames(tabId)).toEqual(['One', 'Three', 'Two'])
})

test('reorderCustomSection: out-of-range moves are never written', () => {
  setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Powers')
  useCharacterStore.getState().addCustomSection(tabId, 'One')
  useCharacterStore.getState().addCustomSection(tabId, 'Two')

  const before = useCharacterStore.getState().currentCharacter

  useCharacterStore.getState().reorderCustomSection(tabId, 0, 0) // no-op
  useCharacterStore.getState().reorderCustomSection(tabId, 0, -1) // first, up
  useCharacterStore.getState().reorderCustomSection(tabId, 1, 2) // last, down
  useCharacterStore.getState().reorderCustomSection(tabId, 2, 0) // from past end
  useCharacterStore.getState().reorderCustomSection('missing-tab', 0, 1)

  // `updateCharacter` always stamps a fresh object, so reference identity is
  // the proof that a dead arrow started no write and no autosave.
  expect(useCharacterStore.getState().currentCharacter).toBe(before)
  expect(sectionNames(tabId)).toEqual(['One', 'Two'])
})

test('reorderCustomSection: leaves other tabs untouched', () => {
  setupChar()
  const powers = useCharacterStore.getState().addCustomTab('Powers')
  useCharacterStore.getState().addCustomSection(powers, 'One')
  useCharacterStore.getState().addCustomSection(powers, 'Two')
  const lore = useCharacterStore.getState().addCustomTab('Lore')
  useCharacterStore.getState().addCustomSection(lore, 'Keep')
  useCharacterStore.getState().addCustomSection(lore, 'Me')

  useCharacterStore.getState().reorderCustomSection(powers, 0, 1)

  expect(sectionNames(powers)).toEqual(['Two', 'One'])
  expect(sectionNames(lore)).toEqual(['Keep', 'Me'])
})

// ---- Custom NPC sections ------------------------------------------------------

test('addCustomNPCSection: adds an npc-kind section referencing a new NPC record', async () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Allies')
  const secId = useCharacterStore.getState().addCustomNPCSection(tabId, 'Goblin')

  char = useCharacterStore.getState().currentCharacter!
  const section = char.customTabs
    .find((t) => t.id === tabId)!
    .sections.find((s) => s.id === secId)!

  expect(section.kind).toBe('npc')
  expect(section.name).toBe('Goblin')

  // The NPC record should have been persisted to the characters list.
  const npcId = (section as { npcId: string }).npcId
  // Wait a tick for the async putCharacter to resolve.
  await Promise.resolve()
  const npc = useCharacterStore.getState().characters.find((c) => c.id === npcId)
  expect(npc).toBeDefined()
  expect(npc!.kind).toBe('npc')
})

test('removeCustomSection: keeps the attached NPC record for an npc section', async () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Allies')
  const secId = useCharacterStore.getState().addCustomNPCSection(tabId, 'Goblin')
  await Promise.resolve()

  char = useCharacterStore.getState().currentCharacter!
  const section = char.customTabs
    .find((t) => t.id === tabId)!
    .sections.find((s) => s.id === secId)!
  const npcId = (section as { npcId: string }).npcId
  expect(useCharacterStore.getState().characters.some((c) => c.id === npcId)).toBe(true)

  await useCharacterStore.getState().removeCustomSection(tabId, secId)

  const after = useCharacterStore.getState().currentCharacter!
  expect(
    after.customTabs.find((t) => t.id === tabId)!.sections.some((s) => s.id === secId),
  ).toBe(false)
  // The NPC record must survive — it can only be deleted from the NPC list.
  expect(useCharacterStore.getState().characters.some((c) => c.id === npcId)).toBe(true)
})

test('addCustomNPCReference: attaches an existing saved NPC by reference', () => {
  const current = setupChar()
  // Seed a pre-existing NPC in the store (simulating an already-saved record).
  const existingNpc: Character = {
    ...createDefaultCharacter(),
    id: 'npc-existing',
    name: 'Brigand',
    kind: 'npc',
  }
  useCharacterStore.setState({ characters: [current, existingNpc] })

  const tabId = useCharacterStore.getState().addCustomTab('Encounters')
  const secId = useCharacterStore
    .getState()
    .addCustomNPCReference(tabId, existingNpc.id)

  const target = useCharacterStore.getState().currentCharacter!
  const section = target.customTabs
    .find((t) => t.id === tabId)!
    .sections.find((s) => s.id === secId)!

  expect(section.kind).toBe('npc')
  expect((section as { npcId: string }).npcId).toBe('npc-existing')
  expect(section.name).toBe('Brigand')
  // No new record should be created — only the reference is stored.
  const npcCount = useCharacterStore
    .getState()
    .characters.filter((c) => c.kind === 'npc').length
  expect(npcCount).toBe(1)
})

test('addCustomNPCReference: returns empty string when NPC is not found', () => {
  setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Encounters')
  const secId = useCharacterStore
    .getState()
    .addCustomNPCReference(tabId, 'does-not-exist')
  expect(secId).toBe('')
})

test('createAttachedNPC: creates a named NPC and attaches it without navigating', async () => {
  const current = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Encounters')
  const secId = useCharacterStore.getState().createAttachedNPC(tabId, 'Goblin')

  const target = useCharacterStore.getState().currentCharacter!
  expect(target.id).toBe(current.id) // currentCharacter is NOT changed

  const section = target.customTabs
    .find((t) => t.id === tabId)!
    .sections.find((s) => s.id === secId)!
  expect(section.kind).toBe('npc')
  expect(section.name).toBe('Goblin')

  await Promise.resolve()
  const npcId = (section as { npcId: string }).npcId
  const npc = useCharacterStore.getState().characters.find((c) => c.id === npcId)
  expect(npc).toBeDefined()
  expect(npc!.kind).toBe('npc')
  expect(npc!.name).toBe('Goblin')
})

test('createAttachedNPC: falls back to default NPC name when blank', async () => {
  setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Encounters')
  useCharacterStore.getState().createAttachedNPC(tabId, '   ')

  await Promise.resolve()
  const npc = useCharacterStore
    .getState()
    .characters.find((c) => c.kind === 'npc')
  expect(npc).toBeDefined()
  expect(npc!.name).toBe('New NPC')
})

// ---- Custom text sections ------------------------------------------------------

test('addCustomTextSection: adds a text-kind section with empty content', () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Lore')
  const secId = useCharacterStore.getState().addCustomTextSection(tabId, 'Backstory')

  char = useCharacterStore.getState().currentCharacter!
  const section = char.customTabs
    .find((t) => t.id === tabId)!
    .sections.find((s) => s.id === secId)!

  expect(section.kind).toBe('text')
  expect(section.name).toBe('Backstory')
  expect((section as { content: string }).content).toBe('')
})

test('updateCustomTextSectionContent: sets the markdown body of a text section', () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Lore')
  const secId = useCharacterStore.getState().addCustomTextSection(tabId, 'Backstory')

  useCharacterStore
    .getState()
    .updateCustomTextSectionContent(tabId, secId, 'Born under a blood moon.')

  char = useCharacterStore.getState().currentCharacter!
  const section = char.customTabs
    .find((t) => t.id === tabId)!
    .sections.find((s) => s.id === secId)!
  expect((section as { content: string }).content).toBe('Born under a blood moon.')
})

test('updateCustomTextSectionContent: leaves non-text sections untouched', () => {
  let char = setupChar()
  const tabId = useCharacterStore.getState().addCustomTab('Lore')
  const textSecId = useCharacterStore.getState().addCustomTextSection(tabId, 'Backstory')
  const abilitySecId = useCharacterStore.getState().addCustomSection(tabId, 'Offense')

  useCharacterStore
    .getState()
    .updateCustomTextSectionContent(tabId, abilitySecId, 'should not apply')

  char = useCharacterStore.getState().currentCharacter!
  const textSection = char.customTabs
    .find((t) => t.id === tabId)!
    .sections.find((s) => s.id === textSecId)!
  expect((textSection as { content: string }).content).toBe('')
})

// ---- Import conflict: updateExistingCharacterFromImportFile ----------------------

test('updateExistingCharacterFromImportFile: updates id/name and preserves live state', async () => {
  // Existing character "Nacht" in DB.
  const existing = createDefaultCharacter()
  existing.name = 'Nacht'
  existing.version = '1.0.0'
  existing.currentHP = 12
  existing.currentEND = 4
  existing.currentAP = 2
  existing.currentFP = 1
  existing.tempHP = 3
  existing.mortalWounds = ['Sprain', null]
  existing.deathSaves = { successes: 1, failures: 0 }
  dbMap.set(existing.id, existing)
  useCharacterStore.setState({
    currentCharacter: existing,
    characters: [existing],
  })

  // Imported JSON with newer structural data.
  const imported = createDefaultCharacter()
  imported.name = 'Nacht'
  imported.version = '1.2.0'
  imported.attributes = { ...imported.attributes, POW: 7 }
  imported.backstory = 'Updated lore'

  await useCharacterStore.getState().updateExistingCharacterFromImportFile(
    existing,
    JSON.stringify(imported),
  )

  const updated = useCharacterStore.getState().currentCharacter!
  // Preserved:
  expect(updated.id).toBe(existing.id)
  expect(updated.name).toBe('Nacht')
  expect(updated.currentHP).toBe(12)
  expect(updated.currentEND).toBe(4)
  expect(updated.currentAP).toBe(2)
  expect(updated.currentFP).toBe(1)
  expect(updated.tempHP).toBe(3)
  expect(updated.mortalWounds).toEqual(['Sprain', null])
  expect(updated.deathSaves).toEqual({ successes: 1, failures: 0 })
  // Taken from imported:
  expect(updated.attributes.POW).toBe(7)
  expect(updated.backstory).toBe('Updated lore')
  expect(updated.version).toBe('1.2.0')
})

// ---- Labels -----------------------------------------------------------------

test('setLabels: replaces the current character labels and syncs the list', async () => {
  const char = setupChar()
  expect(char.labels).toEqual([])

  const labels = [
    { id: 'l1', name: 'Party', value: '' },
    { id: 'l2', name: 'Boss', value: 'Act 2' },
  ]
  useCharacterStore.getState().setLabels(labels)

  const updated = useCharacterStore.getState().currentCharacter!
  expect(updated.labels).toEqual(labels)
  // The characters list mirrors the update.
  expect(
    useCharacterStore.getState().characters.find((c) => c.id === char.id)!
      .labels,
  ).toEqual(labels)
})

test('setLabels: clearing labels yields an empty list', () => {
  setupChar({
    labels: [{ id: 'l1', name: 'Old', value: '' }],
  })
  useCharacterStore.getState().setLabels([])
  expect(useCharacterStore.getState().currentCharacter!.labels).toEqual([])
})

// ---- Ability stat/attribute modifiers ---------------------------------------

/** Slotted ability with the given modifier payload (VIT 2 → maxHP 30). */
function modifierAbility(overrides: Record<string, unknown> = {}) {
  return {
    id: 'buff-1',
    name: 'Battle Focus',
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
    modifiers: [{ target: 'maxHP', value: 10 }],
    ...overrides,
  }
}

test('setAbilityModifiersActive: switches a slotted ability on and off', () => {
  setupChar({ slottedAbilities: [modifierAbility()] as Character['slottedAbilities'] })

  useCharacterStore.getState().setAbilityModifiersActive('buff-1', true)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[0]
      .modifiersActive,
  ).toBe(true)

  useCharacterStore.getState().setAbilityModifiersActive('buff-1', false)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[0]
      .modifiersActive,
  ).toBe(false)
})

test('setAbilityModifiersActive: unknown ability ids leave the sheet untouched', () => {
  setupChar({
    slottedAbilities: [modifierAbility()] as Character['slottedAbilities'],
  })
  useCharacterStore.getState().setAbilityModifiersActive('nope', true)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[0],
  ).toEqual(modifierAbility())
})

test('active modifiers raise the effective HP cap used by heal and fullRestore', () => {
  const char = setupChar({
    slottedAbilities: [modifierAbility()] as Character['slottedAbilities'],
    currentHP: 5,
  })

  // Modifiers are off: healing caps at the base 30 HP.
  useCharacterStore.getState().heal(char.id, 100)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(30)

  useCharacterStore.getState().setAbilityModifiersActive('buff-1', true)
  useCharacterStore.getState().heal(char.id, 100)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(40)

  // Switching the modifier off again drops the cap back to the base value.
  useCharacterStore.getState().setAbilityModifiersActive('buff-1', false)
  useCharacterStore.getState().resetHP(char.id)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(30)
})

test('active END Recovery modifiers feed into endTurn', () => {
  const char = setupChar({
    currentEND: 0,
    currentAP: 0,
    slottedAbilities: [
      modifierAbility({ modifiers: [{ target: 'endRecovery', value: 2 }] }),
    ] as Character['slottedAbilities'],
  })

  // Base END Recovery with GRT 3 is 1 + floor(3/2) = 2.
  useCharacterStore.getState().setAbilityModifiersActive('buff-1', true)
  expect(useCharacterStore.getState().endTurn(char.id)).toBe(4)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(4)
})

test('switching off a Max HP modifier clamps current HP to the new maximum', () => {
  const char = setupChar({
    slottedAbilities: [modifierAbility()] as Character['slottedAbilities'],
    currentHP: 5,
  })

  useCharacterStore.getState().setAbilityModifiersActive('buff-1', true)
  useCharacterStore.getState().heal(char.id, 100)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(40)

  useCharacterStore.getState().setAbilityModifiersActive('buff-1', false)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(30)
})

// ---- Id-targeted mutations (GM Screen support) ------------------------------

test('updateCharacter: mutates a non-current character and leaves current alone', () => {
  const current = setupChar()
  const other: Character = { ...createDefaultCharacter(), id: 'other', name: 'Other', currentHP: 20 }
  useCharacterStore.setState({ characters: [current, other] })

  useCharacterStore.getState().updateCharacter('other', (c) => ({ ...c, currentHP: 7 }))

  const state = useCharacterStore.getState()
  expect(state.characters.find((c) => c.id === 'other')!.currentHP).toBe(7)
  expect(state.currentCharacter!.id).toBe(current.id)
  expect(state.currentCharacter!.currentHP).toBe(30)
})

test('updateCharacter: syncs currentCharacter when it is the target', () => {
  const char = setupChar()
  useCharacterStore.getState().updateCharacter(char.id, (c) => ({ ...c, currentHP: 3 }))
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(3)
})

test('updateCharacter: unknown id is a no-op', () => {
  const char = setupChar()
  useCharacterStore.getState().updateCharacter('nope', (c) => ({ ...c, currentHP: 1 }))
  expect(useCharacterStore.getState().characters[0].currentHP).toBe(char.currentHP)
})

test('takeDamage: applies to the targeted character, not the current one', () => {
  const current = setupChar()
  const other: Character = { ...createDefaultCharacter(), id: 'other', currentHP: 20, tempHP: 0 }
  useCharacterStore.setState({ characters: [current, other] })

  const result = useCharacterStore.getState().takeDamage('other', 5)

  expect(result.finalHP).toBe(15)
  expect(useCharacterStore.getState().characters.find((c) => c.id === 'other')!.currentHP).toBe(15)
  expect(useCharacterStore.getState().currentCharacter!.currentHP).toBe(30)
})

test('spendAP: targets a non-current character and reports insufficiency', () => {
  const current = setupChar()
  const other: Character = { ...createDefaultCharacter(), id: 'other', currentAP: 1 }
  useCharacterStore.setState({ characters: [current, other] })

  expect(useCharacterStore.getState().spendAP('other', 2)).toBe(false)
  expect(useCharacterStore.getState().spendAP('other', 1)).toBe(true)
  expect(useCharacterStore.getState().characters.find((c) => c.id === 'other')!.currentAP).toBe(0)
  // The current character's AP is untouched.
  expect(useCharacterStore.getState().currentCharacter!.currentAP).toBe(3)
})

test('endTurn: reports the END gained for the targeted character only', () => {
  const current = setupChar()
  const other: Character = {
    ...createDefaultCharacter(),
    id: 'other',
    currentAP: 2,
    currentEND: 5,
    attributes: { MAR: 3, POW: 4, AGI: 1, VIT: 2, GRT: 3 },
    mortalWounds: [null, null],
  }
  useCharacterStore.setState({ characters: [current, other] })

  // AP 2 → END (capped at 10: +2) then END Recovery 2 → 9, total gained 4.
  expect(useCharacterStore.getState().endTurn('other')).toBe(4)
  expect(useCharacterStore.getState().characters.find((c) => c.id === 'other')!.currentEND).toBe(9)
  expect(useCharacterStore.getState().currentCharacter!.currentEND).toBe(10)
})

test('heal and fullRestore: id-targeted and independent per character', () => {
  const current = setupChar()
  const other: Character = { ...createDefaultCharacter(), id: 'other', currentHP: 5, tempHP: 4 }
  useCharacterStore.setState({ characters: [current, other] })

  useCharacterStore.getState().heal('other', 3)
  expect(useCharacterStore.getState().characters.find((c) => c.id === 'other')!.currentHP).toBe(8)

  useCharacterStore.getState().fullRestore('other')
  const restored = useCharacterStore.getState().characters.find((c) => c.id === 'other')!
  expect(restored.tempHP).toBe(0)
  expect(restored.currentEND).toBe(10)
  expect(restored.currentAP).toBe(3)
})

test('spendCustomResourceBar: targets the right character and right bar', () => {
  const barA = { id: 'bar-a', name: 'A', max: 3, current: 3, color: '#fff', refillsOnRecover: false }
  const barB = { id: 'bar-b', name: 'B', max: 3, current: 2, color: '#fff', refillsOnRecover: false }
  const current = setupChar({ customResourceBars: [barA] })
  const other: Character = { ...createDefaultCharacter(), id: 'other', customResourceBars: [barB] }
  useCharacterStore.setState({ characters: [current, other] })

  expect(useCharacterStore.getState().spendCustomResourceBar('other', 'bar-a')).toBe(false)
  expect(useCharacterStore.getState().spendCustomResourceBar('other', 'bar-b')).toBe(true)

  expect(useCharacterStore.getState().characters.find((c) => c.id === 'other')!.customResourceBars[0].current).toBe(1)
  expect(useCharacterStore.getState().currentCharacter!.customResourceBars[0].current).toBe(3)

  useCharacterStore.getState().restoreCustomResourceBar('other', 'bar-b', 5)
  expect(useCharacterStore.getState().characters.find((c) => c.id === 'other')!.customResourceBars[0].current).toBe(3)
})

test('autosave: each edited character gets its own debounced write', async () => {
  vi.useFakeTimers()
  try {
    const current = setupChar()
    const other: Character = { ...createDefaultCharacter(), id: 'other', currentHP: 20 }
    useCharacterStore.setState({ characters: [current, other] })
    dbMap.clear()

    // Two different characters edited in the same tick must BOTH persist.
    useCharacterStore.getState().updateCharacter(current.id, (c) => ({ ...c, currentHP: 11 }))
    useCharacterStore.getState().updateCharacter('other', (c) => ({ ...c, currentHP: 12 }))

    await vi.advanceTimersByTimeAsync(600)

    expect((dbMap.get(current.id) as Character).currentHP).toBe(11)
    expect((dbMap.get('other') as Character).currentHP).toBe(12)
  } finally {
    vi.useRealTimers()
  }
})

test('saveCharacter: persists immediately and cancels the pending autosave', async () => {
  vi.useFakeTimers()
  try {
    const char = setupChar()
    dbMap.clear()
    useCharacterStore.getState().updateCharacter(char.id, (c) => ({ ...c, currentHP: 9 }))

    await useCharacterStore.getState().saveCharacter(char.id)
    expect((dbMap.get(char.id) as Character).currentHP).toBe(9)

    // The debounced write was cancelled — advancing timers writes nothing new.
    dbMap.delete(char.id)
    await vi.advanceTimersByTimeAsync(600)
    expect(dbMap.has(char.id)).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})

test('createNpcBase: persists a named NPC without selecting it', async () => {
  const current = setupChar()
  const npc = await useCharacterStore.getState().createNpcBase('Bandit')

  expect(npc).not.toBeNull()
  expect(npc!.kind).toBe('npc')
  expect(npc!.name).toBe('Bandit')
  expect(useCharacterStore.getState().currentCharacter!.id).toBe(current.id)
  expect(useCharacterStore.getState().characters.map((c) => c.id)).toContain(npc!.id)
  expect(dbMap.has(npc!.id)).toBe(true)
})

test('createNpcBase: a blank name creates nothing', async () => {
  const current = setupChar()
  const npc = await useCharacterStore.getState().createNpcBase('   ')
  expect(npc).toBeNull()
  expect(useCharacterStore.getState().characters).toHaveLength(1)
  expect(useCharacterStore.getState().currentCharacter!.id).toBe(current.id)
})

// ---- Load failure handling -------------------------------------------------

test('loadCharacters: a storage failure still completes the load', async () => {
  const db = await import('@/lib/db')
  vi.spyOn(db, 'getAllCharacters').mockRejectedValueOnce(
    new Error('local database is locked'),
  )
  useCharacterStore.setState({ isLoaded: false, loadError: null })

  await useCharacterStore.getState().loadCharacters()

  const state = useCharacterStore.getState()
  expect(state.isLoaded).toBe(true)
  expect(state.loadError).toBe('local database is locked')
  expect(state.characters).toEqual([])
})

test('loadCharacters: a successful load clears a previous error', async () => {
  useCharacterStore.setState({ isLoaded: true, loadError: 'stale failure' })
  await useCharacterStore.getState().loadCharacters()
  expect(useCharacterStore.getState().loadError).toBeNull()
})

// ---- Limited-use abilities --------------------------------------------------

/** Slotted limited ability fixture (3 uses by default, no modifiers). */
function limitedAbility(overrides: Record<string, unknown> = {}) {
  const { modifiers: _modifiers, ...base } = modifierAbility()
  return {
    ...base,
    id: 'limited-1',
    name: 'Frost Nova',
    uses: { max: 3, current: 3, expendOnActivate: true },
    ...overrides,
  }
}

test('spendAbilityUse: consumes one use and reports it', () => {
  const char = setupChar({
    slottedAbilities: [
      limitedAbility({ uses: { max: 3, current: 3, expendOnActivate: true } }),
    ] as Character['slottedAbilities'],
  })

  expect(useCharacterStore.getState().spendAbilityUse(char.id, 'limited-1')).toBe(true)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[0].uses,
  ).toEqual({ max: 3, current: 2, expendOnActivate: true })
})

test('spendAbilityUse: refuses when no uses are left', () => {
  const char = setupChar({
    slottedAbilities: [
      limitedAbility({ uses: { max: 3, current: 0, expendOnActivate: true } }),
    ] as Character['slottedAbilities'],
  })

  expect(useCharacterStore.getState().spendAbilityUse(char.id, 'limited-1')).toBe(false)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[0].uses!.current,
  ).toBe(0)
})

test('spendAbilityUse: an unlimited or opted-out ability spends nothing', () => {
  const char = setupChar({
    slottedAbilities: [
      limitedAbility({ uses: undefined }),
      limitedAbility({ uses: { max: 3, current: 3, expendOnActivate: false } }),
    ] as Character['slottedAbilities'],
  })

  expect(useCharacterStore.getState().spendAbilityUse(char.id, 'limited-1')).toBe(false)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[1].uses!.current,
  ).toBe(3)
})

test('spendAbilityUse: reaches an innate ability and a nested sub-ability', () => {
  const char = setupChar({
    innateAbilities: [
      limitedAbility({ id: 'innate-1' }),
      limitedAbility({
        id: 'parent-1',
        subAbilitiesUnderDescription: [limitedAbility({ id: 'sub-1' })],
      }),
    ] as Character['innateAbilities'],
  })

  expect(useCharacterStore.getState().spendAbilityUse(char.id, 'sub-1')).toBe(true)
  expect(
    useCharacterStore.getState().currentCharacter!.innateAbilities[1]
      .subAbilitiesUnderDescription[0].uses!.current,
  ).toBe(2)
})

test('spendAbilityUse: an unknown id leaves the store untouched', () => {
  const char = setupChar({
    slottedAbilities: [limitedAbility()] as Character['slottedAbilities'],
  })

  expect(useCharacterStore.getState().spendAbilityUse('nope', 'limited-1')).toBe(false)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[0].uses!.current,
  ).toBe(3)
  expect(useCharacterStore.getState().currentCharacter!.updatedAt).toBe(char.updatedAt)
})

test('setAbilityUsesRemaining: clamps and ignores unlimited abilities', () => {
  const char = setupChar({
    slottedAbilities: [
      limitedAbility({ uses: { max: 3, current: 3, expendOnActivate: true } }),
      limitedAbility({ id: 'plain-1', uses: undefined }),
    ] as Character['slottedAbilities'],
  })

  useCharacterStore.getState().setAbilityUsesRemaining(char.id, 'limited-1', 99)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[0].uses!.current,
  ).toBe(3)

  useCharacterStore.getState().setAbilityUsesRemaining(char.id, 'limited-1', -5)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[0].uses!.current,
  ).toBe(0)

  useCharacterStore.getState().setAbilityUsesRemaining(char.id, 'plain-1', 2)
  expect(
    useCharacterStore.getState().currentCharacter!.slottedAbilities[1].uses,
  ).toBeUndefined()
})

test('fullRestore: refills every limited ability on the sheet', () => {
  const char = setupChar({
    currentHP: 1,
    innateAbilities: [
      limitedAbility({
        id: 'innate-1',
        uses: { max: 3, current: 0, expendOnActivate: true },
      }),
    ] as Character['innateAbilities'],
    slottedAbilities: [
      limitedAbility({
        uses: { max: 5, current: 0, expendOnActivate: true },
      }),
    ] as Character['slottedAbilities'],
  })

  useCharacterStore.getState().fullRestore(char.id)

  const restored = useCharacterStore.getState().currentCharacter!
  expect(restored.innateAbilities[0].uses!.current).toBe(3)
  expect(restored.slottedAbilities[0].uses!.current).toBe(5)
})
