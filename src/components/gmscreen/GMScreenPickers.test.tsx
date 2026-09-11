/**
 * Component tests for the GM Screen add-pickers and the missing-record
 * placeholder.
 *
 * These cover the assembly flow the success criteria call out: adding a
 * player character (with the duplicate guard), spawning NPC instances from a
 * base, the "create base + instance in one step" quick-create, and the
 * placeholder shown when a referenced record is deleted.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'

import AddCharacterModal from '@/components/gmscreen/AddCharacterModal'
import AddNpcModal from '@/components/gmscreen/AddNpcModal'
import MissingPanel from '@/components/gmscreen/MissingPanel'
import { NotificationProvider } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { createDefaultCharacter, createDefaultNPC } from '@/constants/gameData'
import type { Character, GMScreen } from '@/types'

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  getAllScreens: vi.fn(async () => Array.from(dbMap.values())),
  getScreen: vi.fn(async (id: string) => dbMap.get(id) ?? null),
  putScreen: vi.fn(async (screen: GMScreen) => {
    dbMap.set(screen.id, screen)
  }),
  deleteScreen: vi.fn(async (id: string) => {
    dbMap.delete(id)
  }),
  normalizeScreen: (s: GMScreen) => s,
  getAllCharacters: vi.fn(async () => []),
  getCharacter: vi.fn(async () => null),
  putCharacter: vi.fn(async () => {}),
  deleteCharacter: vi.fn(async () => {}),
  putVersionSnapshot: vi.fn(async () => {}),
  getVersionHistory: vi.fn(async () => []),
  deleteVersionSnapshot: vi.fn(async () => {}),
  putRollLogEntry: vi.fn(async () => {}),
  getRollLogForCharacter: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  deleteRollLogEntry: vi.fn(async () => {}),
  clearRollLogForCharacter: vi.fn(async () => {}),
  normalizeCharacter: (c: Character) => c,
  stripLabels: ({ labels: _l, ...rest }: Character) => rest as Character,
  getAllStatuses: vi.fn(async () => []),
  getStatus: vi.fn(async () => null),
  putStatus: vi.fn(async () => {}),
  deleteStatus: vi.fn(async () => {}),
  normalizeStatus: (s: unknown) => s,
  getAllVersionSnapshots: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
}))

const SCREEN_ID = 'screen-1'

function makePlayer(overrides: Partial<Character> = {}): Character {
  return {
    ...createDefaultCharacter(),
    id: 'pc-1',
    name: 'Vex',
    playerName: 'Lucas',
    ...overrides,
  }
}

function makeNpc(overrides: Partial<Character> = {}): Character {
  return {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    npcStats: { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20, mortalWounds: 0 },
    ...overrides,
  }
}

/** Seed one open, empty screen plus the given records. */
function seed(...characters: Character[]) {
  useCharacterStore.setState({ characters, currentCharacter: null })
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    currentScreenId: SCREEN_ID,
    isLoaded: true,
    isSaving: false,
  })
}

function panels() {
  return useGMScreenStore.getState().screens[0].panels
}

beforeEach(() => {
  dbMap.clear()
  localStorage.clear()
  useCharacterStore.setState({ characters: [], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [],
    currentScreenId: null,
    isLoaded: true,
    isSaving: false,
  })
})

// ---- AddCharacterModal -----------------------------------------------------

test('AddCharacterModal: lists player characters and adds one', () => {
  seed(makePlayer())
  render(
    <NotificationProvider>
      <AddCharacterModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  expect(screen.getByText('Vex')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  expect(panels()).toHaveLength(1)
  expect(panels()[0]).toMatchObject({ kind: 'character', characterId: 'pc-1' })
})

test('AddCharacterModal: a character already on the screen is disabled', () => {
  seed(makePlayer())
  useGMScreenStore.getState().addCharacterPanel(SCREEN_ID, 'pc-1')

  render(
    <NotificationProvider>
      <AddCharacterModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  expect(screen.getByText('Already on this screen')).toBeInTheDocument()
  // No available character → the footer action is disabled.
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()

  // Clicking the disabled row is a no-op, not a second panel.
  fireEvent.click(screen.getByRole('button', { name: /Vex/ }))
  expect(panels()).toHaveLength(1)
})

test('AddCharacterModal: search narrows the list by name', () => {
  seed(makePlayer(), makePlayer({ id: 'pc-2', name: 'Kestrel', playerName: 'Sam' }))
  render(
    <NotificationProvider>
      <AddCharacterModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  fireEvent.change(screen.getByLabelText('Search characters'), { target: { value: 'kes' } })

  expect(screen.queryByText('Vex')).not.toBeInTheDocument()
  expect(screen.getByText('Kestrel')).toBeInTheDocument()
})

test('AddCharacterModal: NPCs are never offered as character panels', () => {
  seed(makePlayer(), makeNpc())
  render(
    <NotificationProvider>
      <AddCharacterModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  expect(screen.getByText('Vex')).toBeInTheDocument()
  expect(screen.queryByText('Bandit')).not.toBeInTheDocument()
})

// ---- AddNpcModal -----------------------------------------------------------

test('AddNpcModal: spawning twice from one base creates two instances', () => {
  seed(makeNpc())
  render(
    <NotificationProvider>
      <AddNpcModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  const row = screen.getByRole('button', { name: /Bandit/ })
  fireEvent.click(row)
  fireEvent.click(row)

  const created = panels()
  expect(created).toHaveLength(2)
  expect(created.map((p) => (p.kind === 'npc-instance' ? p.label : ''))).toEqual([
    'Bandit',
    'Bandit 2',
  ])
  // Both spawned at full HP — independent pools over one base.
  for (const panel of created) {
    expect(panel.kind === 'npc-instance' && panel.state.currentHP).toBe(20)
  }
})

test('AddNpcModal: each row shows how many instances are already on the screen', () => {
  seed(makeNpc())
  useGMScreenStore.getState().addNpcInstancePanel(SCREEN_ID, 'npc-1')

  render(
    <NotificationProvider>
      <AddNpcModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  expect(screen.getByText(/1 on this screen/)).toBeInTheDocument()
})

test('AddNpcModal: quick-create makes a base record and spawns an instance', async () => {
  seed()
  render(
    <NotificationProvider>
      <AddNpcModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  fireEvent.change(screen.getByLabelText('New NPC…'), { target: { value: 'Goblin' } })
  // Quick-create awaits a db write, so flush the update inside act().
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Create & spawn/ }))
  })

  // The base lands in the character list and the panel points at it.
  expect(panels()).toHaveLength(1)
  const base = useCharacterStore.getState().characters.find((c) => c.name === 'Goblin')
  expect(base?.kind).toBe('npc')
  expect(panels()[0]).toMatchObject({
    kind: 'npc-instance',
    baseNpcId: base!.id,
    label: 'Goblin',
  })
  // No navigation: the GM screen stays put (no current character).
  expect(useCharacterStore.getState().currentCharacter).toBeNull()
})

test('AddNpcModal: the quick-create button stays disabled for a blank name', () => {
  seed()
  render(
    <NotificationProvider>
      <AddNpcModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  expect(screen.getByRole('button', { name: /Create & spawn/ })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('New NPC…'), { target: { value: '   ' } })
  expect(screen.getByRole('button', { name: /Create & spawn/ })).toBeDisabled()
})

test('AddNpcModal: an empty NPC library explains how to create one', () => {
  seed()
  render(
    <NotificationProvider>
      <AddNpcModal screenId={SCREEN_ID} onClose={() => {}} />
    </NotificationProvider>,
  )

  expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument()
})

// ---- MissingPanel ----------------------------------------------------------

test('MissingPanel: names the deleted record kind and offers removal', () => {
  const onRemove = vi.fn()
  render(<MissingPanel kind="npc-instance" onRemove={onRemove} />)

  const region = screen.getByText(/Missing NPC/).closest('.gm-panel') as HTMLElement
  expect(region).not.toBeNull()
  fireEvent.click(within(region).getByRole('button', { name: 'Remove panel' }))
  expect(onRemove).toHaveBeenCalledTimes(1)
})

test('MissingPanel: character placeholders say character, not NPC', () => {
  render(<MissingPanel kind="character" onRemove={() => {}} />)
  expect(screen.getByText(/Missing character/)).toBeInTheDocument()
})

// ---- End-to-end assembly within one screen ---------------------------------

test('a screen can mix a player character and several NPC instances', () => {
  seed(makePlayer(), makeNpc())
  const store = useGMScreenStore.getState()

  store.addCharacterPanel(SCREEN_ID, 'pc-1')
  store.addNpcInstancePanel(SCREEN_ID, 'npc-1')
  store.addNpcInstancePanel(SCREEN_ID, 'npc-1')
  store.addNpcInstancePanel(SCREEN_ID, 'npc-1')

  const created = panels()
  expect(created.map((p) => p.kind)).toEqual([
    'character',
    'npc-instance',
    'npc-instance',
    'npc-instance',
  ])
})
