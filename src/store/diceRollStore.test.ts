/**
 * diceRollStore tests — the roll modal's theme resolution, plus the grouped
 * activation rolls that one Activate press produces.
 *
 * themeEntity decides whose palette the dice-result modal renders with:
 *   - player sheets → their own per-sheet colors
 *   - embedded NPC sections (rolled from inside a player sheet tab) → the
 *     host player sheet's colors
 *   - standalone NPC sheets → a config carrying the app theme's palette
 *
 * rollActivation decides how an activation's several rolls reach the log and
 * the modal: one log entry each, one grouped modal.
 *
 * IndexedDB and the roll-log store are mocked so the store runs in isolation.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { createDefaultCharacter, createDefaultNPC } from '@/constants/gameData'
import { DEFAULT_SHEET_COLORS } from '@/constants/gameData'
import type { Character } from '@/types'

const { dbMap, logged, updated, nextId } = vi.hoisted(() => ({
  dbMap: new Map<string, unknown>(),
  logged: [] as unknown[],
  updated: [] as { id: string; result: unknown }[],
  nextId: { value: 1 },
}))

vi.mock('@/lib/db', () => ({
  putRollLogEntry: vi.fn(async () => {}),
  // characterStore imports these at module load (loadCharacters/loadStatuses
  // fire when the store module initializes); stub them to keep the mock
  // complete without pulling in real IndexedDB.
  getAllCharacters: vi.fn(async () => []),
  getAllStatuses: vi.fn(async () => []),
  getAllScreens: vi.fn(async () => []),
  getAllVersionSnapshots: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
}))

vi.mock('@/store/rollLogStore', () => ({
  useRollLogStore: {
    getState: () => ({
      logRoll: (entry: Record<string, unknown>) => {
        const created: Record<string, unknown> = {
          ...entry,
          id: `log-${nextId.value++}`,
        }
        logged.push(created)
        return created
      },
      updateEntryResult: (id: string, result: unknown) => {
        updated.push({ id, result })
      },
    }),
  },
}))

/** Deterministic d6s for advantage rolls, consumed in roll order. */
const rollQueue: number[] = []
vi.mock('@/lib/dice', () => ({
  rollDie: () => rollQueue.shift() ?? 1,
}))

// The app-theme store reads localStorage at import time; seed it so the
// store initializes to parchment rather than the midnight default.
vi.mock('@/store/appThemeStore', async (importOriginal) => {
  window.localStorage.setItem('grimoire:app-theme', 'parchment')
  return importOriginal<typeof import('@/store/appThemeStore')>()
})

import { useDiceRollStore, themeEntity } from '@/store/diceRollStore'
import { useCharacterStore } from '@/store/characterStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { PARCHMENT_SHEET_COLORS } from '@/constants/gameData'
import { rollNotation } from '@/lib/diceRoller'
import { blankAbility } from '@/components/sheet/AbilityBlockEditor'

function makePlayer(overrides: Partial<Character> = {}): Character {
  return { ...createDefaultCharacter(), ...overrides }
}

function makeNPC(): Character {
  return {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Goblin',
    attributes: { MAR: 0, POW: 5, AGI: 0, VIT: 0, GRT: 0 },
  }
}

beforeEach(() => {
  dbMap.clear()
  logged.length = 0
  updated.length = 0
  nextId.value = 1
  rollQueue.length = 0
  useAppThemeStore.setState({ theme: 'parchment' })
  useDiceRollStore.setState({
    isVisible: false,
    result: null,
    notation: '',
    source: null,
    ability: null,
    rollCharacter: null,
    activation: null,
    rollLogEntryId: null,
  })
})

test('player sheet rolls theme with their own colors', () => {
  const player = makePlayer({
    id: 'player-1',
    config: {
      ...createDefaultCharacter().config,
      colors: { ...DEFAULT_SHEET_COLORS, accent: '#123456' },
    },
  })
  useDiceRollStore.setState({ rollCharacter: player })
  expect(themeEntity()).toBe(player)
})

test('embedded NPC section rolls inherit the host player sheet colors', () => {
  const player = makePlayer({
    id: 'player-1',
    config: {
      ...createDefaultCharacter().config,
      colors: { ...DEFAULT_SHEET_COLORS, accent: '#123456' },
    },
  })
  useCharacterStore.setState({
    currentCharacter: player,
    characters: [player],
  })
  useDiceRollStore.setState({ rollCharacter: makeNPC() })

  const entity = themeEntity()
  expect(entity?.id).toBe('player-1')
  expect(entity?.config.colors.accent).toBe('#123456')
})

test('standalone NPC sheet rolls follow the app theme palette', () => {
  // No player character open — the NPC was rolled from its own page.
  useCharacterStore.setState({
    currentCharacter: null,
    characters: [],
  })
  useDiceRollStore.setState({ rollCharacter: makeNPC() })

  const entity = themeEntity()
  expect(entity?.id).toBe('npc-1')
  expect(entity?.config.colors).toEqual(PARCHMENT_SHEET_COLORS)
})

// ---- GM Screen rolls --------------------------------------------------------

test('GM screen NPC-instance rolls fall back to the app-theme palette', () => {
  // On the GM Screen no player sheet is open (`currentCharacter` is null), and
  // an instance rolls against its BASE NPC record — so the theme must resolve
  // to the app theme's NPC palette, exactly like a standalone NPC sheet.
  useCharacterStore.setState({
    currentCharacter: null,
    characters: [makeNPC()],
  })
  useDiceRollStore.setState({ rollCharacter: makeNPC() })

  const entity = themeEntity()
  expect(entity?.id).toBe('npc-1')
  expect(entity?.config.colors).toEqual(PARCHMENT_SHEET_COLORS)
})

test('GM screen player-panel rolls use that player’s own sheet colors', () => {
  // A player panel passes the real Character, and the GM screen deliberately
  // never sets `currentCharacter` — the panel's own config must win.
  const player = makePlayer({
    id: 'player-2',
    config: {
      ...createDefaultCharacter().config,
      colors: { ...DEFAULT_SHEET_COLORS, accent: '#654321' },
    },
  })
  useCharacterStore.setState({ currentCharacter: null, characters: [player] })
  useDiceRollStore.setState({ rollCharacter: player })

  const entity = themeEntity()
  expect(entity?.id).toBe('player-2')
  expect(entity?.config.colors.accent).toBe('#654321')
})

// ---- Activation rolls -------------------------------------------------------

/** One evaluated part of an activation, as the activation hook hands it over. */
function activationRoll(
  kind: 'accuracy' | 'damage' | 'custom',
  notation: string,
  character: Character,
  label?: string,
) {
  return {
    notation,
    kind,
    groupLabel:
      kind === 'custom' ? 'Custom' : kind === 'accuracy' ? 'Accuracy' : 'Damage',
    label,
    hidden: false,
    result: rollNotation(notation, character),
  }
}

function activate(character: Character, rolls: ReturnType<typeof activationRoll>[]) {
  useDiceRollStore.getState().rollActivation({
    abilityName: 'Cleave',
    abilityId: 'ab-1',
    character,
    rolls,
  })
}

test('an activation logs each roll and opens them together', () => {
  const bandit = makeNPC()
  activate(bandit, [
    activationRoll('accuracy', 'd20+POW', bandit),
    activationRoll('damage', '2d6', bandit),
    activationRoll('custom', '1d6', bandit, 'Burn'),
  ])

  // One entry per roll, each carrying the part it was.
  expect(logged).toHaveLength(3)
  const sources = logged.map(
    (e) =>
      (e as { source: { type: string; rollKind?: string; rollLabel?: string } })
        .source,
  )
  expect(sources.map((s) => s.type)).toEqual([
    'ability-activation',
    'ability-activation',
    'ability-activation',
  ])
  expect(sources.map((s) => s.rollKind)).toEqual(['accuracy', 'damage', 'custom'])
  expect(sources[2].rollLabel).toBe('Burn')

  // …and one modal holding all three, in the order they were rolled.
  const state = useDiceRollStore.getState()
  expect(state.isVisible).toBe(true)
  expect(state.activation?.abilityName).toBe('Cleave')
  expect(state.activation?.rolls.map((r) => r.notation)).toEqual([
    'd20+POW',
    '2d6',
    '1d6',
  ])
  // The modal is a group, not a single roll: the single-roll fields stay empty
  // so nothing renders twice.
  expect(state.result).toBeNull()
  expect(state.ability).toBeNull()
  expect(state.rollCharacter).toBe(bandit)
})

test('an activation with nothing rolled does not open the modal', () => {
  activate(makeNPC(), [])

  expect(logged).toHaveLength(0)
  expect(useDiceRollStore.getState().isVisible).toBe(false)
})

test('dismissing closes the activation and clears its rolls', () => {
  const bandit = makeNPC()
  activate(bandit, [activationRoll('accuracy', 'd20+POW', bandit)])

  useDiceRollStore.getState().dismiss()

  const state = useDiceRollStore.getState()
  expect(state.isVisible).toBe(false)
  expect(state.activation).toBeNull()
  expect(state.rollCharacter).toBeNull()
})

test('a single roll replaces an open activation', () => {
  const bandit = makeNPC()
  activate(bandit, [activationRoll('accuracy', 'd20+POW', bandit)])

  useDiceRollStore.getState().roll({
    notation: '1d20',
    character: bandit,
    ability: { ...blankAbility(), name: 'Cleave' },
  })

  const state = useDiceRollStore.getState()
  expect(state.activation).toBeNull()
  expect(state.result?.notation).toBe('1d20')
})

// ---- Advantage / Disadvantage -----------------------------------------------

test('applying advantage updates the open result and rewrites its log entry', () => {
  const bandit = makeNPC()
  useDiceRollStore.getState().roll({ notation: '1d20', character: bandit })
  const baseTotal = useDiceRollStore.getState().result!.total
  const entryId = useDiceRollStore.getState().rollLogEntryId
  expect(entryId).toBe('log-1')

  rollQueue.push(3, 6)
  useDiceRollStore.getState().applyAdvantage(2, 0)

  const after = useDiceRollStore.getState()
  expect(after.result?.total).toBe(baseTotal + 6)
  expect(after.result?.advantage).toMatchObject({
    kind: 'advantage',
    dice: 2,
    rolls: [3, 6],
    modifier: 6,
    baseTotal,
  })
  // One entry, rewritten in place — not a second advantage entry.
  expect(logged).toHaveLength(1)
  expect(updated).toEqual([{ id: entryId, result: after.result }])
})

test('clearing advantage restores the base total', () => {
  const bandit = makeNPC()
  useDiceRollStore.getState().roll({ notation: '1d20', character: bandit })
  const baseTotal = useDiceRollStore.getState().result!.total

  rollQueue.push(6)
  useDiceRollStore.getState().applyAdvantage(1, 0)
  expect(useDiceRollStore.getState().result?.total).toBe(baseTotal + 6)

  useDiceRollStore.getState().applyAdvantage(0, 0)
  const cleared = useDiceRollStore.getState().result!
  expect(cleared.total).toBe(baseTotal)
  expect(cleared.advantage).toBeUndefined()
})

test('a no-op advantage change does not rewrite the log', () => {
  const bandit = makeNPC()
  useDiceRollStore.getState().roll({ notation: '1d20', character: bandit })
  useDiceRollStore.getState().applyAdvantage(0, 0)
  expect(updated).toHaveLength(0)
})

test('applying disadvantage to an activation roll updates only that roll', () => {
  const bandit = makeNPC()
  activate(bandit, [
    activationRoll('accuracy', 'd20+POW', bandit),
    activationRoll('damage', '2d6', bandit),
  ])
  const before = useDiceRollStore.getState().activation!
  const accuracyTotal = before.rolls[0].result.total
  const damageResult = before.rolls[1].result

  rollQueue.push(5)
  useDiceRollStore.getState().applyActivationAdvantage(0, 0, 1)

  const after = useDiceRollStore.getState().activation!
  expect(after.rolls[0].result.total).toBe(accuracyTotal - 5)
  expect(after.rolls[0].result.advantage).toMatchObject({
    kind: 'disadvantage',
    dice: 1,
    modifier: -5,
    baseTotal: accuracyTotal,
  })
  expect(after.rolls[0].advantage).toBe(0)
  expect(after.rolls[0].disadvantage).toBe(1)
  // The other roll is untouched.
  expect(after.rolls[1].result).toBe(damageResult)
  expect(updated).toEqual([
    { id: after.rolls[0].logEntryId, result: after.rolls[0].result },
  ])
})

test('an out-of-range activation index is ignored', () => {
  const bandit = makeNPC()
  activate(bandit, [activationRoll('accuracy', 'd20+POW', bandit)])
  const before = useDiceRollStore.getState().activation

  useDiceRollStore.getState().applyActivationAdvantage(9, 1, 0)

  expect(useDiceRollStore.getState().activation).toBe(before)
  expect(updated).toHaveLength(0)
})

// ---- Critical hits -----------------------------------------------------------

test('toggling a critical re-rolls the damage and updates the log entry', () => {
  const bandit = makeNPC()
  useDiceRollStore.getState().roll({
    notation: '2d6',
    character: bandit,
    source: { type: 'ability-damage', abilityName: 'Cleave' },
  })
  const baseTotal = useDiceRollStore.getState().result!.total
  const entryId = useDiceRollStore.getState().rollLogEntryId
  expect(entryId).toBe('log-1')

  // 2d6 (6, 6) = 12 beats the base 2d6 (1, 1) = 2.
  rollQueue.push(6, 6)
  useDiceRollStore.getState().toggleCritical()

  const crit = useDiceRollStore.getState().result!
  expect(crit.total).toBe(12)
  expect(crit.critical).toMatchObject({
    chosen: 1,
    rolls: [{ total: baseTotal }, { total: 12 }],
  })
  expect(updated).toEqual([{ id: entryId, result: crit }])

  // Toggling again restores the first roll and rewrites the same entry.
  useDiceRollStore.getState().toggleCritical()
  const restored = useDiceRollStore.getState().result!
  expect(restored.total).toBe(baseTotal)
  expect(restored.critical).toBeUndefined()
  expect(updated).toEqual([
    { id: entryId, result: crit },
    { id: entryId, result: restored },
  ])
})

test('toggling a critical on an activation damage roll updates only that roll', () => {
  const bandit = makeNPC()
  activate(bandit, [
    activationRoll('damage', '2d6', bandit),
    activationRoll('custom', '1d6', bandit, 'Burn'),
  ])
  const before = useDiceRollStore.getState().activation!
  const damageTotal = before.rolls[0].result.total
  const customResult = before.rolls[1].result

  rollQueue.push(5, 6)
  useDiceRollStore.getState().toggleActivationCritical(0)

  const after = useDiceRollStore.getState().activation!
  expect(after.rolls[0].result.total).toBe(11)
  expect(after.rolls[0].result.critical).toMatchObject({ chosen: 1 })
  expect(damageTotal).toBeLessThan(11)
  // The other roll is untouched.
  expect(after.rolls[1].result).toBe(customResult)
  expect(updated).toEqual([
    { id: after.rolls[0].logEntryId, result: after.rolls[0].result },
  ])
})

test('toggling a critical on a non-damage single roll still works from the store', () => {
  // The modal only offers the control for damage rolls; the store itself is
  // generic so a table rule ("that check crits") can drive it.
  const bandit = makeNPC()
  useDiceRollStore.getState().roll({ notation: '2d6', character: bandit })
  const baseTotal = useDiceRollStore.getState().result!.total

  rollQueue.push(4, 4)
  useDiceRollStore.getState().toggleCritical()
  expect(useDiceRollStore.getState().result?.total).toBe(8)
  expect(useDiceRollStore.getState().result?.critical).toMatchObject({ chosen: 1 })
  expect(useDiceRollStore.getState().result?.total).toBeGreaterThanOrEqual(baseTotal)
})
