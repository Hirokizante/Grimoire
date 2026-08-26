import { test, expect, beforeEach } from 'vitest'
import {
  loadSortKey,
  loadFilterSelection,
  useListPrefsStore,
} from '@/store/listPrefsStore'

const SORT_KEY = 'grimoire:list-prefs:characters:sort'
const FILTERS_KEY = 'grimoire:list-prefs:characters:filters'

// ---- Helpers --------------------------------------------------------------

beforeEach(() => {
  window.localStorage.clear()
  useListPrefsStore.setState({
    characterSortKey: 'name',
    npcSortKey: 'name',
    statusSortKey: 'name',
    characterFilters: { player: new Set(), label: new Set() },
    npcFilters: { label: new Set() },
    statusFilters: { type: new Set(), sheet: new Set() },
  })
})

// ---- loadSortKey ----------------------------------------------------------

test('loadSortKey: defaults to name when nothing is stored', () => {
  expect(loadSortKey(SORT_KEY, ['name', 'created', 'modified'] as const, 'name')).toBe(
    'name',
  )
})

test('loadSortKey: returns the stored value when valid', () => {
  window.localStorage.setItem(SORT_KEY, 'modified')
  expect(loadSortKey(SORT_KEY, ['name', 'created', 'modified'] as const, 'name')).toBe(
    'modified',
  )
})

test('loadSortKey: falls back on unknown stored values', () => {
  window.localStorage.setItem(SORT_KEY, 'rainbow')
  expect(loadSortKey(SORT_KEY, ['name', 'created', 'modified'] as const, 'name')).toBe(
    'name',
  )
})

// ---- loadFilterSelection --------------------------------------------------

test('loadFilterSelection: empty selections when nothing is stored', () => {
  const sel = loadFilterSelection(FILTERS_KEY, ['player', 'label'])
  expect(sel.player.size).toBe(0)
  expect(sel.label.size).toBe(0)
})

test('loadFilterSelection: restores stored selections per group', () => {
  window.localStorage.setItem(
    FILTERS_KEY,
    JSON.stringify({ player: ['Lucas'], label: ['archer', 'mage'] }),
  )
  const sel = loadFilterSelection(FILTERS_KEY, ['player', 'label'])
  expect(Array.from(sel.player)).toEqual(['Lucas'])
  expect([...sel.label].sort()).toEqual(['archer', 'mage'])
})

test('loadFilterSelection: drops unknown groups and non-string entries', () => {
  window.localStorage.setItem(
    FILTERS_KEY,
    JSON.stringify({ player: ['ok', 42, null], rogueGroup: ['x'] }),
  )
  const sel = loadFilterSelection(FILTERS_KEY, ['player', 'label'])
  expect(Array.from(sel.player)).toEqual(['ok'])
  expect(sel.rogueGroup).toBeUndefined()
})

test('loadFilterSelection: survives corrupt JSON', () => {
  window.localStorage.setItem(FILTERS_KEY, '{not json')
  const sel = loadFilterSelection(FILTERS_KEY, ['player', 'label'])
  expect(sel.player.size).toBe(0)
  expect(sel.label.size).toBe(0)
})

// ---- store actions --------------------------------------------------------

test('setCharacterSortKey: updates state and persists', () => {
  useListPrefsStore.getState().setCharacterSortKey('created')

  expect(useListPrefsStore.getState().characterSortKey).toBe('created')
  expect(window.localStorage.getItem(SORT_KEY)).toBe('created')
})

test('sort keys are stored per page independently', () => {
  useListPrefsStore.getState().setCharacterSortKey('modified')
  useListPrefsStore.getState().setNpcSortKey('created')
  useListPrefsStore.getState().setStatusSortKey('name')

  const s = useListPrefsStore.getState()
  expect(s.characterSortKey).toBe('modified')
  expect(s.npcSortKey).toBe('created')
  expect(s.statusSortKey).toBe('name')
  expect(window.localStorage.getItem('grimoire:list-prefs:npcs:sort')).toBe(
    'created',
  )
})

test('toggleFilter: toggles a character filter value and persists', () => {
  const store = useListPrefsStore.getState()
  store.toggleFilter('characters', 'label', 'archer')
  expect(
    useListPrefsStore
      .getState()
      .characterFilters.label?.has('archer'),
  ).toBe(true)
  expect(window.localStorage.getItem(FILTERS_KEY)).toContain('archer')

  useListPrefsStore.getState().toggleFilter('characters', 'label', 'archer')
  expect(
    useListPrefsStore
      .getState()
      .characterFilters.label?.has('archer'),
  ).toBe(false)
})

test('toggleFilter keeps pages isolated (npc toggle does not touch characters)', () => {
  useListPrefsStore.getState().toggleFilter('characters', 'label', 'shared')
  useListPrefsStore.getState().toggleFilter('npcs', 'label', 'shared')

  const s = useListPrefsStore.getState()
  expect(s.npcFilters.label?.has('shared')).toBe(true)

  // The characters payload must NOT contain the npc page's selection state.
  const charsPayload = JSON.parse(
    window.localStorage.getItem(FILTERS_KEY) ?? '{}',
  ) as Record<string, string[]>
  expect(charsPayload.label).toEqual(['shared'])

  const npcsPayload = JSON.parse(
    window.localStorage.getItem('grimoire:list-prefs:npcs:filters') ?? '{}',
  ) as Record<string, string[]>
  expect(npcsPayload.label).toEqual(['shared'])
})

test('clearFilters: resets that page only and persists empty selections', () => {
  const store = useListPrefsStore.getState()
  store.toggleFilter('characters', 'player', 'Lucas')
  store.toggleFilter('statuses', 'type', 'custom')

  useListPrefsStore.getState().clearFilters('characters')

  const s = useListPrefsStore.getState()
  expect(s.characterFilters.player?.size).toBe(0)
  expect(s.statusFilters.type?.has('custom')).toBe(true)
  expect(window.localStorage.getItem(FILTERS_KEY)).toBe(
    JSON.stringify({ player: [], label: [] }),
  )
})
