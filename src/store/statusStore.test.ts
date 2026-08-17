import { test, expect, beforeEach, vi } from 'vitest'
import { useStatusStore } from '@/store/statusStore'
import type { StatusCondition } from '@/types'

// ---- Mock IndexedDB (status store) ---------------------------------------

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  getAllStatuses: vi.fn(async () => Array.from(dbMap.values()) as StatusCondition[]),
  getStatus: vi.fn(async (id: string) => dbMap.get(id) ?? null),
  putStatus: vi.fn(async (status: StatusCondition) => {
    dbMap.set(status.id, status)
  }),
  deleteStatus: vi.fn(async (id: string) => {
    dbMap.delete(id)
  }),
  normalizeStatus: (status: StatusCondition) => status,
}))

// ---- Helpers --------------------------------------------------------------

function makeStatus(partial: Partial<StatusCondition> = {}): StatusCondition {
  return {
    id: 'id-1',
    name: 'Poisoned',
    icon: '☠️',
    iconType: 'emoji',
    description: 'Takes damage.',
    tags: [],
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    ...partial,
  }
}

beforeEach(() => {
  dbMap.clear()
  useStatusStore.setState({
    statuses: [],
    isLoaded: false,
    modal: { statusId: null, startInEdit: false },
  })
})

// ---- Tests ----------------------------------------------------------------

test('loadStatuses: populates statuses from the db', async () => {
  dbMap.set('a', makeStatus({ id: 'a' }))
  dbMap.set('b', makeStatus({ id: 'b', name: 'Cursed' }))
  await useStatusStore.getState().loadStatuses()
  expect(useStatusStore.getState().statuses).toHaveLength(2)
})

test('createStatus: persists, appends, and opens the edit modal', async () => {
  const created = await useStatusStore.getState().createStatus('Enfeebled')
  const state = useStatusStore.getState()
  expect(created.name).toBe('Enfeebled')
  expect(created.icon).toBe('')
  expect(state.statuses).toHaveLength(1)
  expect(state.modal.statusId).toBe(created.id)
  expect(state.modal.startInEdit).toBe(true)
})

test('updateStatus: persists and replaces in place', async () => {
  useStatusStore.setState({ statuses: [makeStatus()] })
  await useStatusStore
    .getState()
    .updateStatus({ ...makeStatus(), name: 'Venom', description: 'New text.' })
  const s = useStatusStore.getState().statuses[0]
  expect(s.name).toBe('Venom')
  expect(s.description).toBe('New text.')
})

test('deleteStatus: removes the record and closes the modal if it was open', async () => {
  useStatusStore.setState({
    statuses: [makeStatus()],
    modal: { statusId: 'id-1', startInEdit: false },
  })
  await useStatusStore.getState().deleteStatus('id-1')
  const state = useStatusStore.getState()
  expect(state.statuses).toHaveLength(0)
  expect(state.modal.statusId).toBeNull()
})

test('importStatuses: existing name wins, new names are added with fresh ids', async () => {
  useStatusStore.setState({
    statuses: [
      makeStatus({ id: 'existing', name: 'Poisoned', description: 'local' }),
    ],
  })

  await useStatusStore.getState().importStatuses([
    makeStatus({ id: 'imp-1', name: 'Poisoned', description: 'imported' }),
    makeStatus({ id: 'imp-2', name: 'Cursed' }),
  ])

  const statuses = useStatusStore.getState().statuses
  expect(statuses).toHaveLength(2)

  const poisoned = statuses.find((s) => s.name === 'Poisoned')!
  expect(poisoned.id).toBe('existing') // kept local record
  expect(poisoned.description).toBe('local')

  const cursed = statuses.find((s) => s.name === 'Cursed')!
  expect(cursed.id).not.toBe('imp-2') // fresh id, avoids collisions
})

test('importStatuses: skips blank names and no-ops on empty input', async () => {
  useStatusStore.setState({ statuses: [makeStatus()] })
  await useStatusStore.getState().importStatuses([])
  expect(useStatusStore.getState().statuses).toHaveLength(1)

  await useStatusStore
    .getState()
    .importStatuses([makeStatus({ id: 'blank', name: '   ' })])
  expect(useStatusStore.getState().statuses).toHaveLength(1)
})
