import { test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  GM_SCREEN_VIEW_STORAGE_KEY,
  loadGmScreenViewMode,
  useGmScreenViewStore,
} from '@/store/gmScreenViewStore'

// ---- Helpers --------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
  useGmScreenViewStore.setState({ viewMode: 'grid' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---- Tests ----------------------------------------------------------------

test('defaults to grid when nothing is stored', () => {
  // The historical behaviour — draggable panels in two columns — so a fresh
  // install must not silently change the GM Screen's layout.
  expect(loadGmScreenViewMode()).toBe('grid')
  expect(useGmScreenViewStore.getState().viewMode).toBe('grid')
})

test('loadGmScreenViewMode: only a stored mode id counts; anything else falls back', () => {
  window.localStorage.setItem(GM_SCREEN_VIEW_STORAGE_KEY, 'immersive')
  expect(loadGmScreenViewMode()).toBe('immersive')

  for (const stored of ['grid', '0', 'true', 'list', 'nope', '']) {
    window.localStorage.setItem(GM_SCREEN_VIEW_STORAGE_KEY, stored)
    expect(loadGmScreenViewMode()).toBe('grid')
  }
})

test('setViewMode: updates state and persists both modes', () => {
  useGmScreenViewStore.getState().setViewMode('immersive')

  expect(useGmScreenViewStore.getState().viewMode).toBe('immersive')
  expect(window.localStorage.getItem(GM_SCREEN_VIEW_STORAGE_KEY)).toBe(
    'immersive',
  )

  useGmScreenViewStore.getState().setViewMode('grid')
  expect(useGmScreenViewStore.getState().viewMode).toBe('grid')
  expect(window.localStorage.getItem(GM_SCREEN_VIEW_STORAGE_KEY)).toBe('grid')
})

test('loadGmScreenViewMode: falls back to grid when storage throws', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  expect(loadGmScreenViewMode()).toBe('grid')
})

test('setViewMode: still applies for the session when storage throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled')
  })

  expect(() =>
    useGmScreenViewStore.getState().setViewMode('immersive'),
  ).not.toThrow()
  expect(useGmScreenViewStore.getState().viewMode).toBe('immersive')
})
