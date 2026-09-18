/**
 * rollLogStore tests — the persistent roll history's write path.
 *
 * The store self-loads from IndexedDB at import time, so the db module is
 * mocked. Only the behaviours the dice-result modal relies on are pinned here:
 * `logRoll` returns the created entry (the modal keeps its id to update later),
 * and `updateEntryResult` rewrites that entry in place when
 * Advantage/Disadvantage is applied after the roll was logged.
 */

import { beforeEach, expect, test, vi } from 'vitest'

const { puts, deletes } = vi.hoisted(() => ({
  puts: [] as { id: string; result: unknown }[],
  deletes: [] as string[],
}))

vi.mock('@/lib/db', () => ({
  putRollLogEntry: vi.fn(async (entry: { id: string; result: unknown }) => {
    puts.push(entry)
  }),
  getAllRollLogEntries: vi.fn(async () => []),
  deleteRollLogEntry: vi.fn(async (id: string) => {
    deletes.push(id)
  }),
  clearRollLogForCharacter: vi.fn(async () => {}),
}))

import { useRollLogStore } from '@/store/rollLogStore'
import type { RollResult } from '@/lib/diceRoller'

const baseResult: RollResult = {
  notation: 'd20+MAR',
  total: 10,
  terms: [],
  breakdown: 'd20+MAR → 7 + 3 = 10',
}

function logOne() {
  return useRollLogStore.getState().logRoll({
    notation: 'd20+MAR',
    characterId: 'char-1',
    characterName: 'Vera',
    source: { type: 'manual' },
    result: baseResult,
  })
}

beforeEach(() => {
  puts.length = 0
  deletes.length = 0
  useRollLogStore.setState({ entries: [] })
})

test('logRoll prepends the entry and persists it', () => {
  const entry = logOne()

  expect(useRollLogStore.getState().entries[0]).toBe(entry)
  expect(puts).toEqual([entry])
})

test('updateEntryResult rewrites the entry in place and persists it', () => {
  const entry = logOne()
  const adjusted: RollResult = {
    ...baseResult,
    total: 16,
    advantage: {
      kind: 'advantage',
      dice: 1,
      rolls: [6],
      modifier: 6,
      baseTotal: 10,
      advantage: 1,
      disadvantage: 0,
    },
  }

  useRollLogStore.getState().updateEntryResult(entry.id, adjusted)

  const stored = useRollLogStore.getState().entries[0]
  expect(stored.id).toBe(entry.id)
  expect(stored.result).toBe(adjusted)
  // The entry was rewritten, not duplicated.
  expect(useRollLogStore.getState().entries).toHaveLength(1)
  expect(puts).toEqual([entry, stored])
})

test('updateEntryResult leaves other entries and unknown ids alone', () => {
  const first = logOne()
  const second = logOne()

  useRollLogStore.getState().updateEntryResult('missing', baseResult)
  expect(puts).toHaveLength(2)

  const adjusted: RollResult = { ...baseResult, total: 12 }
  useRollLogStore.getState().updateEntryResult(second.id, adjusted)

  const entries = useRollLogStore.getState().entries
  expect(entries[0].result).toBe(adjusted)
  expect(entries[1]).toBe(first)
})
