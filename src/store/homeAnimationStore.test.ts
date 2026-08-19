import { test, expect, beforeEach } from 'vitest'
import {
  isHomeAnimation,
  loadHomeAnimation,
  loadHomeAnimationEnabled,
  HOME_ANIMATION_STORAGE_KEY,
  HOME_ANIMATION_ENABLED_STORAGE_KEY,
  useHomeAnimationStore,
} from '@/store/homeAnimationStore'

// ---- Helpers --------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
  useHomeAnimationStore.setState({ animation: 'arcane', enabled: true })
})

// ---- Tests ----------------------------------------------------------------

test('defaults to arcane + enabled when nothing is stored', () => {
  expect(loadHomeAnimation()).toBe('arcane')
  expect(loadHomeAnimationEnabled()).toBe(true)
})

test('loadHomeAnimation: returns terminal when it is stored', () => {
  window.localStorage.setItem(HOME_ANIMATION_STORAGE_KEY, 'terminal')
  expect(loadHomeAnimation()).toBe('terminal')
})

test('isHomeAnimation: accepts every supported id and rejects others', () => {
  expect(isHomeAnimation('arcane')).toBe(true)
  expect(isHomeAnimation('terminal')).toBe(true)
  expect(isHomeAnimation('matrix')).toBe(false)
  expect(isHomeAnimation(null)).toBe(false)
})

test('loadHomeAnimation: falls back to arcane on unknown values', () => {
  window.localStorage.setItem(HOME_ANIMATION_STORAGE_KEY, 'matrix')
  expect(loadHomeAnimation()).toBe('arcane')
})

test('loadHomeAnimationEnabled: only an explicit "0" disables', () => {
  window.localStorage.setItem(HOME_ANIMATION_ENABLED_STORAGE_KEY, '0')
  expect(loadHomeAnimationEnabled()).toBe(false)
  window.localStorage.setItem(HOME_ANIMATION_ENABLED_STORAGE_KEY, '1')
  expect(loadHomeAnimationEnabled()).toBe(true)
  window.localStorage.setItem(HOME_ANIMATION_ENABLED_STORAGE_KEY, 'nope')
  expect(loadHomeAnimationEnabled()).toBe(true)
})

test('setAnimation: updates state and persists', () => {
  useHomeAnimationStore.getState().setAnimation('terminal')

  expect(useHomeAnimationStore.getState().animation).toBe('terminal')
  expect(window.localStorage.getItem(HOME_ANIMATION_STORAGE_KEY)).toBe(
    'terminal',
  )
})

test('setEnabled: updates state and persists', () => {
  useHomeAnimationStore.getState().setEnabled(false)

  expect(useHomeAnimationStore.getState().enabled).toBe(false)
  expect(window.localStorage.getItem(HOME_ANIMATION_ENABLED_STORAGE_KEY)).toBe(
    '0',
  )

  useHomeAnimationStore.getState().setEnabled(true)
  expect(window.localStorage.getItem(HOME_ANIMATION_ENABLED_STORAGE_KEY)).toBe(
    '1',
  )
})
