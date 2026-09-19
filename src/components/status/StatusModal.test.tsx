/**
 * Component tests for the global status modal's view mode.
 *
 * A compendium card previews the sheets that reference a status in a single
 * truncated row; the modal is where the full set lives. These tests pin that
 * view mode lists every referencing sheet (matching is case-insensitive, like
 * inline `[Name]` references), hides the section when nothing references the
 * status, keeps it out of the edit form, and offers the JSON export there.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import StatusModal from '@/components/status/StatusModal'
import { NotificationProvider } from '@/context/NotificationContext'
import { downloadJson } from '@/lib/exportImport'
import { createDefaultCharacter } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import { useStatusStore } from '@/store/statusStore'
import type { Character, StatusCondition } from '@/types'

vi.mock('@/lib/db', () => ({
  getAllScreens: vi.fn(async () => []),
  getScreen: vi.fn(async () => null),
  putScreen: vi.fn(async () => {}),
  deleteScreen: vi.fn(async () => {}),
  normalizeScreen: (s: unknown) => s,
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
  replaceAllStatuses: vi.fn(async () => {}),
}))

// Keep the browser download out of jsdom — the payload itself is asserted.
vi.mock('@/lib/exportImport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/exportImport')>()),
  downloadJson: vi.fn(),
}))

const downloadJsonMock = vi.mocked(downloadJson)

function makeStatus(id: string, name: string): StatusCondition {
  return {
    id,
    name,
    icon: '☠️',
    iconType: 'emoji',
    description: `${name} does something unpleasant.`,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

/** A sheet whose Basic Attack prose carries the given status references. */
function makeCharacter(id: string, name: string, referenceText: string): Character {
  const character = createDefaultCharacter()
  return {
    ...character,
    id,
    name,
    basicAttack: { ...character.basicAttack, description: referenceText },
  }
}

function renderModal() {
  return render(
    <NotificationProvider>
      <StatusModal />
    </NotificationProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useCharacterStore.setState({ characters: [], currentCharacter: null })
  useStatusStore.setState({
    statuses: [],
    isLoaded: true,
    modal: { statusId: null, startInEdit: false },
  })
})

test('view mode lists every sheet that references the status', () => {
  const poisoned = makeStatus('st-poisoned', 'Poisoned')
  useCharacterStore.setState({
    characters: [
      makeCharacter('pc-1', 'Vex', 'Inflicts [Poisoned] on hit.'),
      makeCharacter('pc-2', 'Mira', 'Cures [poisoned] at the start of her turn.'),
      makeCharacter('pc-3', 'Bandit', 'A plain attack with no references.'),
    ],
  })
  useStatusStore.setState({ statuses: [poisoned] })
  useStatusStore.getState().openStatus(poisoned.id)

  renderModal()

  const dialog = screen.getByRole('dialog', { name: 'Status details' })
  expect(within(dialog).getByText('Referenced in sheets')).toBeInTheDocument()
  expect(within(dialog).getByText('Vex')).toBeInTheDocument()
  expect(within(dialog).getByText('Mira')).toBeInTheDocument()
  expect(within(dialog).queryByText('Bandit')).not.toBeInTheDocument()
})

test('hides the reference list when no sheet references the status', () => {
  const poisoned = makeStatus('st-poisoned', 'Poisoned')
  useCharacterStore.setState({
    characters: [makeCharacter('pc-1', 'Vex', 'A plain attack.')],
  })
  useStatusStore.setState({ statuses: [poisoned] })
  useStatusStore.getState().openStatus(poisoned.id)

  renderModal()

  const dialog = screen.getByRole('dialog', { name: 'Status details' })
  expect(within(dialog).queryByText('Referenced in sheets')).not.toBeInTheDocument()
})

test('the reference list is view-only, not part of the edit form', () => {
  const poisoned = makeStatus('st-poisoned', 'Poisoned')
  useCharacterStore.setState({
    characters: [makeCharacter('pc-1', 'Vex', 'Inflicts [Poisoned] on hit.')],
  })
  useStatusStore.setState({ statuses: [poisoned] })
  useStatusStore.getState().openStatus(poisoned.id)

  renderModal()
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

  const dialog = screen.getByRole('dialog', { name: 'Edit status' })
  expect(within(dialog).queryByText('Referenced in sheets')).not.toBeInTheDocument()
  expect(within(dialog).queryByText('Vex')).not.toBeInTheDocument()
})

test('view mode exports the status as a JSON file', () => {
  const poisoned = makeStatus('st-poisoned', 'Poisoned')
  useStatusStore.setState({ statuses: [poisoned] })
  useStatusStore.getState().openStatus(poisoned.id)

  renderModal()
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))

  expect(downloadJsonMock).toHaveBeenCalledTimes(1)
  const [payload, filename] = downloadJsonMock.mock.calls[0]
  expect(filename).toBe('Status - Poisoned.json')
  expect(payload).toMatchObject({ kind: 'status', status: poisoned })
})

test('the export button is view-only, not part of the edit form', () => {
  const poisoned = makeStatus('st-poisoned', 'Poisoned')
  useStatusStore.setState({ statuses: [poisoned] })
  useStatusStore.getState().openStatus(poisoned.id)

  renderModal()
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

  expect(
    screen.queryByRole('button', { name: 'Export' }),
  ).not.toBeInTheDocument()
})
