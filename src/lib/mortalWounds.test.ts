/**
 * Unit tests for the shared Mortal Wounds helpers — the table lookup every
 * surface rolls and picks through, plus the slot rules the sheet and both GM
 * panel kinds share.
 */

import { test, expect, vi, afterEach } from 'vitest'

import { MORTAL_WOUNDS } from '@/constants/gameData'
import {
  PENDING_MORTAL_WOUND,
  characterMortalWounds,
  isKnockedOut,
  mortalWoundByName,
  mortalWoundByRoll,
  mortalWoundsTaken,
  nextMortalWoundSlot,
  rollOnMortalWoundTable,
} from '@/lib/mortalWounds'

afterEach(() => {
  vi.restoreAllMocks()
})

test('the table covers all twenty faces of a D20, one wound each', () => {
  expect(MORTAL_WOUNDS).toHaveLength(20)
  expect(MORTAL_WOUNDS.map((w) => w.id)).toEqual(
    Array.from({ length: 20 }, (_, i) => i + 1),
  )
  expect(new Set(MORTAL_WOUNDS.map((w) => w.name)).size).toBe(20)
})

test('rollOnMortalWoundTable: every face resolves to its own entry', () => {
  for (const entry of MORTAL_WOUNDS) {
    // rollDie(20) is floor(random * 20) + 1 — pin the die to each face.
    vi.spyOn(Math, 'random').mockReturnValue((entry.id - 0.5) / 20)
    const wound = rollOnMortalWoundTable()
    expect(wound.roll).toBe(entry.id)
    expect(wound.name).toBe(entry.name)
    expect(wound.description).toBe(entry.description)
  }
})

test('mortalWoundByName / mortalWoundByRoll: look the table up both ways', () => {
  expect(mortalWoundByName('Damaged Throat')?.id).toBe(8)
  expect(mortalWoundByRoll(8)?.name).toBe('Damaged Throat')
  // "Pending Roll" is a slot marker, not a table entry — never resolvable.
  expect(mortalWoundByName(PENDING_MORTAL_WOUND)).toBeNull()
  expect(mortalWoundByName('Broken Toe')).toBeNull()
  expect(mortalWoundByRoll(21)).toBeNull()
})

test('nextMortalWoundSlot: the oldest empty slot wins', () => {
  expect(nextMortalWoundSlot([null, null])).toBe(0)
  expect(nextMortalWoundSlot(['Sprain', null])).toBe(1)
  expect(nextMortalWoundSlot(['Sprain', 'Exhaustion'])).toBe(-1)
})

test('nextMortalWoundSlot: a pending wound is a slot still waiting for its name', () => {
  // The wound happened (the slot is taken) but has no name yet, so naming it —
  // by roll or by hand — fills that slot rather than opening a second one.
  expect(nextMortalWoundSlot([PENDING_MORTAL_WOUND, null])).toBe(0)
  expect(nextMortalWoundSlot(['Sprain', PENDING_MORTAL_WOUND])).toBe(1)
  expect(nextMortalWoundSlot([PENDING_MORTAL_WOUND, PENDING_MORTAL_WOUND])).toBe(0)
  expect(nextMortalWoundSlot([])).toBe(-1)
})

test('characterMortalWounds: keeps the slot each wound belongs to', () => {
  // Slots are cleared out of order, so an entry's position in the list is NOT
  // its slot index — the helper has to carry both.
  expect(characterMortalWounds(['Sprain', 'Exhaustion'])).toEqual([
    { slot: 0, roll: 12, name: 'Sprain' },
    { slot: 1, roll: 9, name: 'Exhaustion' },
  ])
  expect(characterMortalWounds([null, 'Exhaustion'])).toEqual([
    { slot: 1, roll: 9, name: 'Exhaustion' },
  ])
  expect(characterMortalWounds([null, null])).toEqual([])
})

test('characterMortalWounds: a pending slot reports no roll, never an invented one', () => {
  expect(characterMortalWounds([PENDING_MORTAL_WOUND, null])).toEqual([
    { slot: 0, roll: 0, name: PENDING_MORTAL_WOUND },
  ])
})

test('mortalWoundsTaken: a pending slot is a wound already taken', () => {
  // Unlike `nextMortalWoundSlot` — which still counts a pending slot as
  // fillable, because naming it does not take a second wound — this is the
  // count "can they take another?" is answered from.
  expect(mortalWoundsTaken([null, null])).toBe(0)
  expect(mortalWoundsTaken([PENDING_MORTAL_WOUND, null])).toBe(1)
  expect(mortalWoundsTaken(['Sprain', null])).toBe(1)
  expect(mortalWoundsTaken([null, 'Exhaustion'])).toBe(1)
  expect(mortalWoundsTaken([PENDING_MORTAL_WOUND, 'Exhaustion'])).toBe(2)
})

test('isKnockedOut: 0 HP with no wound left to take, and nothing less', () => {
  // The SRD's condition: "reduced to 0 HP and cannot take any more Mortal
  // Wounds". Standing at positive HP with a full track is the Critical
  // Condition — one 0 HP away — and at 0 HP with a slot in hand it is an
  // ordinary wound.
  expect(isKnockedOut(['Sprain', 'Exhaustion'], 0)).toBe(true)
  expect(isKnockedOut(['Sprain', 'Exhaustion'], -5)).toBe(true)
  expect(isKnockedOut([PENDING_MORTAL_WOUND, 'Exhaustion'], 0)).toBe(true)
  expect(isKnockedOut(['Sprain', 'Exhaustion'], 25)).toBe(false)
  expect(isKnockedOut(['Sprain', null], 0)).toBe(false)
  expect(isKnockedOut([PENDING_MORTAL_WOUND, null], 0)).toBe(false)
  expect(isKnockedOut([null, null], 0)).toBe(false)
})
