import { test, expect, beforeEach } from 'vitest'
import {
  isUiStyle,
  loadUiStyle,
  UI_STYLE_STORAGE_KEY,
  useUiStyleStore,
} from '@/store/uiStyleStore'

// ---- Helpers --------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.uiStyle
  useUiStyleStore.setState({ style: 'default' })
})

// ---- Tests ----------------------------------------------------------------

test('defaults to default when nothing is stored', () => {
  expect(loadUiStyle()).toBe('default')
})

test('loadUiStyle: returns terminal when it is stored', () => {
  window.localStorage.setItem(UI_STYLE_STORAGE_KEY, 'terminal')
  expect(loadUiStyle()).toBe('terminal')
})

test('isUiStyle: accepts every supported style id and rejects others', () => {
  expect(isUiStyle('default')).toBe(true)
  expect(isUiStyle('terminal')).toBe(true)
  expect(isUiStyle('brutalist')).toBe(false)
  expect(isUiStyle(null)).toBe(false)
})

test('loadUiStyle: falls back to default on unknown values', () => {
  window.localStorage.setItem(UI_STYLE_STORAGE_KEY, 'brutalist')
  expect(loadUiStyle()).toBe('default')
})

test('setStyle: updates state, persists, and applies the document attribute', () => {
  useUiStyleStore.getState().setStyle('terminal')

  expect(useUiStyleStore.getState().style).toBe('terminal')
  expect(window.localStorage.getItem(UI_STYLE_STORAGE_KEY)).toBe('terminal')
  expect(document.documentElement.dataset.uiStyle).toBe('terminal')
})

test('setStyle: switching back to default updates the attribute', () => {
  useUiStyleStore.getState().setStyle('terminal')
  useUiStyleStore.getState().setStyle('default')

  expect(useUiStyleStore.getState().style).toBe('default')
  expect(window.localStorage.getItem(UI_STYLE_STORAGE_KEY)).toBe('default')
  expect(document.documentElement.dataset.uiStyle).toBe('default')
})
