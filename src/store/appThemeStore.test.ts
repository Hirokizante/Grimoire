import { test, expect, beforeEach } from 'vitest'
import {
  isAppTheme,
  loadAppTheme,
  THEME_STORAGE_KEY,
  useAppThemeStore,
} from '@/store/appThemeStore'

// ---- Helpers --------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.appTheme
  useAppThemeStore.setState({ theme: 'midnight' })
})

// ---- Tests ----------------------------------------------------------------

test('defaults to midnight when nothing is stored', () => {
  expect(loadAppTheme()).toBe('midnight')
})

test('loadAppTheme: returns parchment when it is stored', () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, 'parchment')
  expect(loadAppTheme()).toBe('parchment')
})

test('loadAppTheme: returns mikami when it is stored', () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, 'mikami')
  expect(loadAppTheme()).toBe('mikami')
})

test('loadAppTheme: returns pitch-black when it is stored', () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, 'pitch-black')
  expect(loadAppTheme()).toBe('pitch-black')
})

test('isAppTheme: accepts every supported theme id and rejects others', () => {
  expect(isAppTheme('midnight')).toBe(true)
  expect(isAppTheme('parchment')).toBe(true)
  expect(isAppTheme('mikami')).toBe(true)
  expect(isAppTheme('pitch-black')).toBe(true)
  expect(isAppTheme('neon-dreams')).toBe(false)
  expect(isAppTheme(null)).toBe(false)
})

test('loadAppTheme: falls back to midnight on unknown values', () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, 'neon-dreams')
  expect(loadAppTheme()).toBe('midnight')
})

test('setTheme: updates state, persists, and applies the document attribute', () => {
  useAppThemeStore.getState().setTheme('parchment')

  expect(useAppThemeStore.getState().theme).toBe('parchment')
  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('parchment')
  expect(document.documentElement.dataset.appTheme).toBe('parchment')
})

test('setTheme: switching back to midnight clears the attribute', () => {
  useAppThemeStore.getState().setTheme('parchment')
  useAppThemeStore.getState().setTheme('midnight')

  expect(useAppThemeStore.getState().theme).toBe('midnight')
  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('midnight')
  expect(document.documentElement.dataset.appTheme).toBe('midnight')
})
