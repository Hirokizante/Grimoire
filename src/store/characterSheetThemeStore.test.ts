import { test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  CHARACTER_SHEET_MATCH_APP_THEME_STORAGE_KEY,
  loadCharacterSheetMatchAppTheme,
  useCharacterSheetThemeStore,
} from '@/store/characterSheetThemeStore'

// ---- Helpers --------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
  useCharacterSheetThemeStore.setState({ matchAppTheme: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---- Tests ----------------------------------------------------------------

test('defaults to off when nothing is stored', () => {
  // The historical behaviour — a sheet carries its own customization — so a
  // fresh install must not silently restyle character sheets.
  expect(loadCharacterSheetMatchAppTheme()).toBe(false)
})

test('loadCharacterSheetMatchAppTheme: only an explicit "1" turns it on', () => {
  window.localStorage.setItem(
    CHARACTER_SHEET_MATCH_APP_THEME_STORAGE_KEY,
    '1',
  )
  expect(loadCharacterSheetMatchAppTheme()).toBe(true)

  for (const stored of ['0', 'true', 'yes', 'nope', '']) {
    window.localStorage.setItem(
      CHARACTER_SHEET_MATCH_APP_THEME_STORAGE_KEY,
      stored,
    )
    expect(loadCharacterSheetMatchAppTheme()).toBe(false)
  }
})

test('setMatchAppTheme: updates state and persists both directions', () => {
  useCharacterSheetThemeStore.getState().setMatchAppTheme(true)

  expect(useCharacterSheetThemeStore.getState().matchAppTheme).toBe(true)
  expect(
    window.localStorage.getItem(CHARACTER_SHEET_MATCH_APP_THEME_STORAGE_KEY),
  ).toBe('1')

  useCharacterSheetThemeStore.getState().setMatchAppTheme(false)
  expect(useCharacterSheetThemeStore.getState().matchAppTheme).toBe(false)
  expect(
    window.localStorage.getItem(CHARACTER_SHEET_MATCH_APP_THEME_STORAGE_KEY),
  ).toBe('0')
})

test('loadCharacterSheetMatchAppTheme: falls back to off when storage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  expect(loadCharacterSheetMatchAppTheme()).toBe(false)
})

test('setMatchAppTheme: still applies for the session when storage throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  expect(() =>
    useCharacterSheetThemeStore.getState().setMatchAppTheme(true),
  ).not.toThrow()
  expect(useCharacterSheetThemeStore.getState().matchAppTheme).toBe(true)
})
