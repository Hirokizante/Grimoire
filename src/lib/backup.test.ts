/**
 * Unit tests for the full-app backup & restore flow (lib/backup.ts).
 *
 * The IndexedDB layer (@/lib/db) is mocked: buildFullBackup reads through
 * getAllCharacters/getAllVersionSnapshots/getAllRollLogEntries/getAllStatuses,
 * and restoreFullBackup writes through replaceAllData. parseFullBackup and
 * backupFilename are pure and tested directly.
 */

import { beforeEach, expect, test, vi } from 'vitest'

const dbState = {
  characters: [] as unknown[],
  versions: [] as unknown[],
  rollLogs: [] as unknown[],
  statuses: [] as unknown[],
}

vi.mock('@/lib/db', () => ({
  getAllCharacters: vi.fn(async () => structuredClone(dbState.characters)),
  getAllVersionSnapshots: vi.fn(async () => structuredClone(dbState.versions)),
  getAllRollLogEntries: vi.fn(async () => structuredClone(dbState.rollLogs)),
  getAllStatuses: vi.fn(async () => structuredClone(dbState.statuses)),
  replaceAllData: vi.fn(async () => {}),
}))

const {
  BACKUP_VERSION,
  backupFilename,
  buildFullBackup,
  parseFullBackup,
  restoreFullBackup,
} = await import('@/lib/backup')
const { replaceAllData } = await import('@/lib/db')
const { createDefaultCharacter, createDefaultNPC } = await import(
  '@/constants/gameData'
)
const { createDefaultStatuses } = await import('@/constants/statuses')
const typeHelpers = await import('@/lib/exportImport')
const { createSnapshot } = typeHelpers

import type { Character, StatusCondition } from '@/types'

/** Minimal valid roll-log entry fixture. */
function makeRollLog(id: string, characterId: string) {
  return {
    id,
    notation: '1d20+3',
    characterId,
    characterName: 'Test',
    source: { type: 'manual' as const },
    result: {
      terms: [],
      total: 12,
      breakdown: '1d20 (9) + 3',
      rolls: [{ die: 20, value: 9 }],
    },
    rolledAt: '2026-01-01T00:00:00.000Z',
    isNaturalTwenty: false,
    isNaturalOne: false,
  }
}

beforeEach(() => {
  dbState.characters = []
  dbState.versions = []
  dbState.rollLogs = []
  dbState.statuses = []
  vi.clearAllMocks()
})

// ---- backupFilename ---------------------------------------------------------

test('backupFilename: local-date format with padded month and day', () => {
  expect(backupFilename(new Date(2026, 0, 9))).toBe('Grimoire Backup 2026-01-09.json')
  expect(backupFilename(new Date(2026, 10, 20))).toBe('Grimoire Backup 2026-11-20.json')
})

// ---- buildFullBackup --------------------------------------------------------

test('buildFullBackup: snapshots all four stores with correct counts', async () => {
  const pc = createDefaultCharacter()
  const npc = createDefaultNPC()
  const status: StatusCondition = { ...createDefaultStatuses()[0] }
  dbState.characters = [pc, npc]
  dbState.versions = [createSnapshot(pc)]
  dbState.rollLogs = [makeRollLog('r1', pc.id)]
  dbState.statuses = [status]

  const backup = await buildFullBackup()

  expect(backup.app).toBe('grimoire')
  expect(backup.kind).toBe('full-backup')
  expect(backup.backupVersion).toBe(BACKUP_VERSION)
  expect(backup.counts).toEqual({
    characters: 1,
    npcs: 1,
    versions: 1,
    rollLogEntries: 1,
    statuses: 1,
  })
  expect(backup.data.characters).toHaveLength(2)
  expect(backup.data.statuses).toEqual([status])
})

test('buildFullBackup: JSON round-trips through parseFullBackup', async () => {
  const pc = createDefaultCharacter()
  dbState.characters = [pc]
  dbState.statuses = createDefaultStatuses()

  const backup = await buildFullBackup()
  const parsed = parseFullBackup(JSON.stringify(backup))

  expect(parsed.counts).toEqual(backup.counts)
  expect(parsed.data.characters[0].id).toBe(pc.id)
  expect(parsed.data.statuses).toHaveLength(backup.data.statuses.length)
})

// ---- parseFullBackup --------------------------------------------------------

test('parseFullBackup: rejects invalid JSON with a friendly message', () => {
  expect(() => parseFullBackup('not json {')).toThrow('not valid JSON')
})

test('parseFullBackup: rejects a single-character export file', () => {
  const pc = createDefaultCharacter()
  expect(() => parseFullBackup(JSON.stringify(pc))).toThrow(
    'not a Grimoire full backup',
  )
})

test('parseFullBackup: rejects bundle-shaped character exports', () => {
  const pc = createDefaultCharacter()
  const bundle = { character: pc, attachedNpcs: [], attachedStatuses: [] }
  expect(() => parseFullBackup(JSON.stringify(bundle))).toThrow(
    'not a Grimoire full backup',
  )
})

test('parseFullBackup: rejects backups from a newer app version', () => {
  const payload = {
    app: 'grimoire',
    kind: 'full-backup',
    backupVersion: BACKUP_VERSION + 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    data: { characters: [], versions: [], rollLogs: [], statuses: [] },
  }
  expect(() => parseFullBackup(JSON.stringify(payload))).toThrow(
    'newer version of Grimoire',
  )
})

test('parseFullBackup: filters malformed records but keeps valid ones', () => {
  const pc = createDefaultCharacter()
  const status = createDefaultStatuses()[0]
  const payload = {
    app: 'grimoire',
    kind: 'full-backup',
    backupVersion: BACKUP_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    data: {
      characters: [pc, { id: 'bad' }, 'nope'],
      versions: [{ id: 'v' }, null],
      rollLogs: [{ id: 'r', characterId: 'x' }],
      statuses: [status, { name: 'no id' }],
    },
  }
  const parsed = parseFullBackup(JSON.stringify(payload))
  expect(parsed.counts.characters).toBe(1)
  expect(parsed.counts.npcs).toBe(0)
  expect(parsed.counts.versions).toBe(0)
  expect(parsed.counts.rollLogEntries).toBe(0)
  expect(parsed.counts.statuses).toBe(1)
})

test('parseFullBackup: throws when every record is invalid', () => {
  const payload = {
    app: 'grimoire',
    kind: 'full-backup',
    backupVersion: BACKUP_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    data: { characters: [], versions: [], rollLogs: [], statuses: [] },
  }
  expect(() => parseFullBackup(JSON.stringify(payload))).toThrow('no data')
})

// ---- restoreFullBackup ------------------------------------------------------

test('restoreFullBackup: replaces all stores atomically via replaceAllData', async () => {
  const pc: Character = createDefaultCharacter()
  const backup = await buildFullBackup() // empty stores
  backup.data.characters = [pc]
  backup.counts.characters = 1

  const result = await restoreFullBackup(backup)

  expect(replaceAllData).toHaveBeenCalledWith(backup.data)
  expect(result.counts.characters).toBe(1)
})
