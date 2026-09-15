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

const { dbMap, logged } = vi.hoisted(() => ({
  dbMap: new Map<string, unknown>(),
  logged: [] as unknown[],
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
      logRoll: (entry: unknown) => {
        logged.push(entry)
      },
    }),
  },
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
  useAppThemeStore.setState({ theme: 'parchment' })
  useDiceRollStore.setState({
    isVisible: false,
    result: null,
    notation: '',
    source: null,
    ability: null,
    rollCharacter: null,
    activation: null,
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
