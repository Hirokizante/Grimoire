import { test, expect } from 'vitest'

import {
  STATUS_TRANSFER_VERSION,
  buildStatusCompendiumFile,
  buildStatusFile,
  parseStatusImport,
  statusCompendiumFilename,
  statusFilename,
} from '@/lib/statusTransfer'
import type { StatusCondition } from '@/types'

function makeStatus(partial: Partial<StatusCondition> = {}): StatusCondition {
  return {
    id: 'st-1',
    name: 'Poisoned',
    icon: '☠️',
    iconType: 'emoji',
    description: 'Takes damage at the start of each turn.',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...partial,
  }
}

/** A minimal object passing the character shape guard. */
function makeCharacterJSON(): unknown {
  return {
    id: 'pc-1',
    name: 'Vex',
    version: '1.0.0',
    milestones: 0,
    attributes: {},
    skills: {},
    config: {},
  }
}

// ---- filenames -------------------------------------------------------------

test('statusFilename: names the file after the status', () => {
  expect(statusFilename(makeStatus({ name: 'Poisoned' }))).toBe(
    'Status - Poisoned.json',
  )
})

test('statusFilename: sanitizes unsafe characters and falls back for blanks', () => {
  expect(statusFilename(makeStatus({ name: 'A/B:C*D' }))).toBe(
    'Status - A_B_C_D.json',
  )
  expect(statusFilename(makeStatus({ name: '   ' }))).toBe(
    'Status - Untitled.json',
  )
})

test('statusCompendiumFilename: dated like the full backup', () => {
  expect(statusCompendiumFilename(new Date(2026, 8, 19))).toBe(
    'Grimoire Status Compendium 2026-09-19.json',
  )
})

// ---- building + parsing ----------------------------------------------------

test('buildStatusFile: carries the transfer marker and the record', () => {
  const status = makeStatus()
  const file = buildStatusFile(status)
  expect(file.app).toBe('grimoire')
  expect(file.kind).toBe('status')
  expect(file.fileVersion).toBe(STATUS_TRANSFER_VERSION)
  expect(Number.isNaN(Date.parse(file.exportedAt))).toBe(false)
  expect(file.status).toEqual(status)
})

test('buildStatusCompendiumFile: carries every status plus a count', () => {
  const statuses = [makeStatus(), makeStatus({ id: 'st-2', name: 'Cursed' })]
  const file = buildStatusCompendiumFile(statuses)
  expect(file.app).toBe('grimoire')
  expect(file.kind).toBe('status-compendium')
  expect(file.count).toBe(2)
  expect(file.statuses).toEqual(statuses)
})

test('parseStatusImport: a single-status export round-trips', () => {
  const status = makeStatus()
  const parsed = parseStatusImport(JSON.stringify(buildStatusFile(status)))
  expect(parsed).toEqual({ kind: 'status', status })
})

test('parseStatusImport: a compendium export round-trips', () => {
  const statuses = [makeStatus(), makeStatus({ id: 'st-2', name: 'Cursed' })]
  const parsed = parseStatusImport(
    JSON.stringify(buildStatusCompendiumFile(statuses)),
  )
  expect(parsed).toEqual({ kind: 'compendium', statuses })
})

test('parseStatusImport: accepts a bare hand-authored status and back-fills defaults', () => {
  const parsed = parseStatusImport(JSON.stringify({ name: 'Enfeebled' }))
  expect(parsed.kind).toBe('status')
  if (parsed.kind !== 'status') return
  expect(parsed.status.name).toBe('Enfeebled')
  expect(parsed.status.id).toBeTruthy()
  expect(parsed.status.icon).toBe('')
  expect(parsed.status.iconType).toBe('emoji')
  expect(parsed.status.description).toBe('')
  expect(parsed.status.tags).toEqual([])
  expect(Number.isNaN(Date.parse(parsed.status.createdAt))).toBe(false)
})

test('parseStatusImport: accepts a bare array as a compendium', () => {
  const parsed = parseStatusImport(
    JSON.stringify([{ name: 'Poisoned' }, { name: 'Hidden', icon: '👁️' }]),
  )
  expect(parsed.kind).toBe('compendium')
  if (parsed.kind !== 'compendium') return
  expect(parsed.statuses.map((s) => s.name)).toEqual(['Poisoned', 'Hidden'])
  expect(parsed.statuses[1].icon).toBe('👁️')
})

test('parseStatusImport: normalizes an unknown iconType to emoji', () => {
  const parsed = parseStatusImport(
    JSON.stringify({ name: 'Old', iconType: 'lucide', icon: 'skull' }),
  )
  if (parsed.kind !== 'status') throw new Error('expected a status')
  expect(parsed.status.iconType).toBe('emoji')
})

// ---- rejection -------------------------------------------------------------

test('parseStatusImport: rejects invalid JSON', () => {
  expect(() => parseStatusImport('not json')).toThrow('not valid JSON')
})

test('parseStatusImport: points a full backup at Settings', () => {
  expect(() =>
    parseStatusImport(
      JSON.stringify({ app: 'grimoire', kind: 'full-backup', backupVersion: 2 }),
    ),
  ).toThrow(/Settings/)
})

test('parseStatusImport: points a character sheet at the Characters page', () => {
  expect(() => parseStatusImport(JSON.stringify(makeCharacterJSON()))).toThrow(
    /Characters page/,
  )
  expect(() =>
    parseStatusImport(
      JSON.stringify({ character: makeCharacterJSON(), attachedNpcs: [] }),
    ),
  ).toThrow(/Characters page/)
})

test('parseStatusImport: rejects an empty compendium rather than wiping everything', () => {
  expect(() =>
    parseStatusImport(JSON.stringify(buildStatusCompendiumFile([]))),
  ).toThrow('contains no statuses')
  expect(() => parseStatusImport('[]')).toThrow('contains no statuses')
})

test('parseStatusImport: rejects a malformed compendium entry instead of dropping it', () => {
  expect(() =>
    parseStatusImport(JSON.stringify([{ name: 'Poisoned' }, { icon: '☠️' }])),
  ).toThrow('position 2')
})

test('parseStatusImport: rejects unrelated JSON', () => {
  expect(() => parseStatusImport(JSON.stringify({ foo: 'bar' }))).toThrow(
    "doesn't contain a status",
  )
})
