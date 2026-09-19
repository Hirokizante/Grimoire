/**
 * Component tests for the Status Compendium page's import/export flow.
 *
 * One Import button accepts both transfer shapes: a single status merges into
 * the compendium as soon as it is picked, while a whole compendium is staged
 * behind a confirmation because importing it REPLACES everything. Export
 * downloads the full compendium as one JSON file.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import StatusCompendiumPage from '@/pages/StatusCompendiumPage'
import { NotificationProvider } from '@/context/NotificationContext'
import { downloadJson } from '@/lib/exportImport'
import {
  buildStatusCompendiumFile,
  buildStatusFile,
} from '@/lib/statusTransfer'
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
  replaceAllStatuses: vi.fn(async () => {}),
  normalizeStatus: (s: unknown) => s,
  getAllVersionSnapshots: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
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

function makeFile(payload: unknown): File {
  return new File([JSON.stringify(payload)], 'transfer.json', {
    type: 'application/json',
  })
}

function renderPage() {
  const view = render(
    <NotificationProvider>
      <StatusCompendiumPage />
    </NotificationProvider>,
  )
  const input = view.container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement
  return { ...view, input }
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

test('importing a single status merges it into the compendium', async () => {
  useStatusStore.setState({ statuses: [makeStatus('local', 'Cursed')] })
  const { input } = renderPage()

  fireEvent.change(input, {
    target: { files: [makeFile(buildStatusFile(makeStatus('imp', 'Poisoned')))] },
  })

  await waitFor(() => {
    const names = useStatusStore.getState().statuses.map((s) => s.name)
    expect(names).toContain('Poisoned')
    expect(names).toContain('Cursed')
  })
})

test('importing a compendium asks first, then replaces everything', async () => {
  useStatusStore.setState({ statuses: [makeStatus('local', 'Old')] })
  const { input } = renderPage()

  fireEvent.change(input, {
    target: {
      files: [
        makeFile(
          buildStatusCompendiumFile([
            makeStatus('new-1', 'Poisoned'),
            makeStatus('new-2', 'Hidden'),
          ]),
        ),
      ],
    },
  })

  // Staged behind a confirmation that says it overwrites.
  const dialog = await screen.findByRole('dialog', {
    name: 'Import Status Compendium?',
  })
  expect(dialog).toHaveTextContent('replace your entire compendium')
  fireEvent.click(
    screen.getByRole('button', { name: 'Replace Compendium' }),
  )

  await waitFor(() => {
    expect(useStatusStore.getState().statuses.map((s) => s.name)).toEqual([
      'Poisoned',
      'Hidden',
    ])
  })
})

test('cancelling a compendium import leaves the compendium untouched', async () => {
  useStatusStore.setState({ statuses: [makeStatus('local', 'Old')] })
  const { input } = renderPage()

  fireEvent.change(input, {
    target: {
      files: [makeFile(buildStatusCompendiumFile([makeStatus('n', 'New')]))],
    },
  })
  await screen.findByRole('dialog', { name: 'Import Status Compendium?' })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(useStatusStore.getState().statuses.map((s) => s.name)).toEqual(['Old'])
})

test('exporting downloads the whole compendium', () => {
  const statuses = [
    makeStatus('a', 'Poisoned'),
    makeStatus('b', 'Hidden'),
  ]
  useStatusStore.setState({ statuses })
  renderPage()

  fireEvent.click(screen.getByRole('button', { name: 'Export' }))

  expect(downloadJsonMock).toHaveBeenCalledTimes(1)
  const [payload, filename] = downloadJsonMock.mock.calls[0]
  expect(filename).toMatch(/^Grimoire Status Compendium \d{4}-\d{2}-\d{2}\.json$/)
  expect(payload).toMatchObject({ kind: 'status-compendium', count: 2 })
})
