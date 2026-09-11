import { test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  GM_PANEL_MATCH_APP_THEME_STORAGE_KEY,
  loadGmPanelMatchAppTheme,
  useGmPanelThemeStore,
} from '@/store/gmPanelThemeStore'

// ---- Helpers --------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
  useGmPanelThemeStore.setState({ matchAppTheme: false })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---- Tests ----------------------------------------------------------------

test('defaults to off when nothing is stored', () => {
  // The historical behaviour — a player panel carries the sheet's own
  // customization — so a fresh install must not silently restyle panels.
  expect(loadGmPanelMatchAppTheme()).toBe(false)
})

test('loadGmPanelMatchAppTheme: only an explicit "1" turns it on', () => {
  window.localStorage.setItem(GM_PANEL_MATCH_APP_THEME_STORAGE_KEY, '1')
  expect(loadGmPanelMatchAppTheme()).toBe(true)

  for (const stored of ['0', 'true', 'yes', 'nope', '']) {
    window.localStorage.setItem(GM_PANEL_MATCH_APP_THEME_STORAGE_KEY, stored)
    expect(loadGmPanelMatchAppTheme()).toBe(false)
  }
})

test('setMatchAppTheme: updates state and persists both directions', () => {
  useGmPanelThemeStore.getState().setMatchAppTheme(true)

  expect(useGmPanelThemeStore.getState().matchAppTheme).toBe(true)
  expect(
    window.localStorage.getItem(GM_PANEL_MATCH_APP_THEME_STORAGE_KEY),
  ).toBe('1')

  useGmPanelThemeStore.getState().setMatchAppTheme(false)
  expect(useGmPanelThemeStore.getState().matchAppTheme).toBe(false)
  expect(
    window.localStorage.getItem(GM_PANEL_MATCH_APP_THEME_STORAGE_KEY),
  ).toBe('0')
})

test('loadGmPanelMatchAppTheme: falls back to off when storage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  expect(loadGmPanelMatchAppTheme()).toBe(false)
})

test('setMatchAppTheme: still applies for the session when storage throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  expect(() =>
    useGmPanelThemeStore.getState().setMatchAppTheme(true),
  ).not.toThrow()
  expect(useGmPanelThemeStore.getState().matchAppTheme).toBe(true)
})
