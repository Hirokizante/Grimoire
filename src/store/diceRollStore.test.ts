/**
 * diceRollStore tests — the roll modal's theme resolution.
 *
 * themeEntity decides whose palette the dice-result modal renders with:
 *   - player sheets → their own per-sheet colors
 *   - embedded NPC sections (rolled from inside a player sheet tab) → the
 *     host player sheet's colors
 *   - standalone NPC sheets → a config carrying the app theme's palette
 *
 * IndexedDB and the roll-log store are mocked so the store runs in isolation.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { createDefaultCharacter, createDefaultNPC } from '@/constants/gameData'
import { DEFAULT_SHEET_COLORS } from '@/constants/gameData'
import type { Character } from '@/types'

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  putRollLogEntry: vi.fn(async () => {}),
  // characterStore imports these at module load (loadCharacters/loadStatuses
  // fire when the store module initializes); stub them to keep the mock
  // complete without pulling in real IndexedDB.
  getAllCharacters: vi.fn(async () => []),
  getAllStatuses: vi.fn(async () => []),
}))

vi.mock('@/store/rollLogStore', () => ({
  useRollLogStore: {
    getState: () => ({ logRoll: vi.fn() }),
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
  useAppThemeStore.setState({ theme: 'parchment' })
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
