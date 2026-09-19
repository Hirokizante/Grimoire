import { test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  DICE_RANGES_STORAGE_KEY,
  loadDiceRanges,
  useDiceDisplayStore,
} from '@/store/diceDisplayStore'

// ---- Helpers --------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
  useDiceDisplayStore.setState({ showRanges: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---- Tests ----------------------------------------------------------------

test('defaults to off when nothing is stored', () => {
  // The historical behaviour — the notation as written — so a fresh install
  // must not silently relabel every dice badge.
  expect(loadDiceRanges()).toBe(false)
})

test('loadDiceRanges: only an explicit "1" turns it on', () => {
  window.localStorage.setItem(DICE_RANGES_STORAGE_KEY, '1')
  expect(loadDiceRanges()).toBe(true)

  for (const stored of ['0', 'true', 'yes', 'nope', '']) {
    window.localStorage.setItem(DICE_RANGES_STORAGE_KEY, stored)
    expect(loadDiceRanges()).toBe(false)
  }
})

test('setShowRanges: updates state and persists both directions', () => {
  useDiceDisplayStore.getState().setShowRanges(true)

  expect(useDiceDisplayStore.getState().showRanges).toBe(true)
  expect(window.localStorage.getItem(DICE_RANGES_STORAGE_KEY)).toBe('1')

  useDiceDisplayStore.getState().setShowRanges(false)
  expect(useDiceDisplayStore.getState().showRanges).toBe(false)
  expect(window.localStorage.getItem(DICE_RANGES_STORAGE_KEY)).toBe('0')
})

test('loadDiceRanges: falls back to off when storage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  expect(loadDiceRanges()).toBe(false)
})

test('setShowRanges: still applies for the session when storage throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  expect(() =>
    useDiceDisplayStore.getState().setShowRanges(true),
  ).not.toThrow()
  expect(useDiceDisplayStore.getState().showRanges).toBe(true)
})
