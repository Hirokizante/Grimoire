import { test, expect, beforeEach } from 'vitest'
import {
  loadSortKey,
  loadFilterSelection,
  matchesFacet,
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
    characterFilters: { player: {}, label: {} },
    npcFilters: { label: {} },
    statusFilters: { type: {}, sheet: {} },
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
  expect(Object.keys(sel.player).length).toBe(0)
  expect(Object.keys(sel.label).length).toBe(0)
})

test('loadFilterSelection: restores stored include/exclude modes per group', () => {
  window.localStorage.setItem(
    FILTERS_KEY,
    JSON.stringify({
      player: { Lucas: 'include' },
      label: { archer: 'include', mage: 'exclude' },
    }),
  )
  const sel = loadFilterSelection(FILTERS_KEY, ['player', 'label'])
  expect(sel.player.Lucas).toBe('include')
  expect(sel.label.archer).toBe('include')
  expect(sel.label.mage).toBe('exclude')
})

test('loadFilterSelection: migrates legacy array payloads as includes', () => {
  window.localStorage.setItem(
    FILTERS_KEY,
    JSON.stringify({ player: ['Lucas'], label: ['archer', 'mage'] }),
  )
  const sel = loadFilterSelection(FILTERS_KEY, ['player', 'label'])
  expect(sel.player.Lucas).toBe('include')
  expect(sel.label.archer).toBe('include')
  expect(sel.label.mage).toBe('include')
})

test('loadFilterSelection: drops unknown groups, modes, and non-string entries', () => {
  window.localStorage.setItem(
    FILTERS_KEY,
    JSON.stringify({
      player: { ok: 'include', 42: 'exclude', bad: 'rainbow' },
      rogueGroup: { x: 'include' },
    }),
  )
  const sel = loadFilterSelection(FILTERS_KEY, ['player', 'label'])
  expect(sel.player.ok).toBe('include')
  expect(sel.player.bad).toBeUndefined()
  expect(sel.rogueGroup).toBeUndefined()
})

test('loadFilterSelection: survives corrupt JSON', () => {
  window.localStorage.setItem(FILTERS_KEY, '{not json')
  const sel = loadFilterSelection(FILTERS_KEY, ['player', 'label'])
  expect(Object.keys(sel.player).length).toBe(0)
  expect(Object.keys(sel.label).length).toBe(0)
})

// ---- matchesFacet (tri-state semantics) ------------------------------------

describe('matchesFacet', () => {
  const hasAny = (v: string) => v === 'a' || v === 'b'

  test('empty selection always passes', () => {
    expect(matchesFacet({}, hasAny)).toBe(true)
  })

  test('include matches when the item carries the option', () => {
    expect(matchesFacet({ a: 'include' }, hasAny)).toBe(true)
  })

  test('include rejects when the item lacks every included option', () => {
    expect(matchesFacet({ c: 'include' }, hasAny)).toBe(false)
  })

  test('multiple includes behave as OR', () => {
    expect(matchesFacet({ a: 'include', c: 'include' }, hasAny)).toBe(true)
    expect(
      matchesFacet(
        { c: 'include', d: 'include' },
        (v) => v === 'c' || v === 'd',
      ),
    ).toBe(true)
    expect(matchesFacet({ a: 'include', b: 'include' }, hasAny)).toBe(true)
  })

  test('exclude disqualifies any item carrying the option', () => {
    expect(matchesFacet({ a: 'exclude' }, hasAny)).toBe(false)
    expect(matchesFacet({ z: 'exclude' }, hasAny)).toBe(true)
  })

  test('mixed include + exclude applies both rules', () => {
    // Carries "a" (included ✓) but also "b" — wait, b is included too; use an
    // excluded value the item actually has.
    expect(matchesFacet({ a: 'include', z: 'exclude' }, hasAny)).toBe(true)
    expect(matchesFacet({ a: 'include', b: 'exclude' }, hasAny)).toBe(false)
  })

  test('pure exclude = everything without that option passes', () => {
    expect(matchesFacet({ z: 'exclude' }, hasAny)).toBe(true)
    expect(matchesFacet({ a: 'exclude' }, hasAny)).toBe(false)
  })
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

test('toggleFilter: first click sets include and persists', () => {
  useListPrefsStore.getState().toggleFilter('characters', 'label', 'archer')

  const filters = useListPrefsStore.getState().characterFilters
  expect(filters.label?.archer).toBe('include')
  const payload = JSON.parse(
    window.localStorage.getItem(FILTERS_KEY) ?? '{}',
  ) as Record<string, Record<string, string>>
  expect(payload.label.archer).toBe('include')
})

test('toggleFilter: cycles include → exclude → unchecked', () => {
  const store = useListPrefsStore.getState()
  store.toggleFilter('characters', 'label', 'archer') // → include
  expect(
    useListPrefsStore.getState().characterFilters.label?.archer,
  ).toBe('include')

  useListPrefsStore.getState().toggleFilter('characters', 'label', 'archer') // → exclude
  expect(
    useListPrefsStore.getState().characterFilters.label?.archer,
  ).toBe('exclude')
  expect(
    window.localStorage.getItem(FILTERS_KEY),
  ).toContain('"exclude"')

  useListPrefsStore.getState().toggleFilter('characters', 'label', 'archer') // → unchecked
  expect(
    useListPrefsStore.getState().characterFilters.label?.archer,
  ).toBeUndefined()
  expect(
    window.localStorage.getItem(FILTERS_KEY),
  ).toBe(JSON.stringify({ player: {}, label: {} }))
})

test('toggleFilter keeps pages isolated (npc toggle does not touch characters)', () => {
  useListPrefsStore.getState().toggleFilter('characters', 'label', 'shared')
  useListPrefsStore.getState().toggleFilter('npcs', 'label', 'shared')

  const s = useListPrefsStore.getState()
  expect(s.npcFilters.label?.shared).toBe('include')

  // The characters payload must NOT contain the npc page's selection state.
  const charsPayload = JSON.parse(
    window.localStorage.getItem(FILTERS_KEY) ?? '{}',
  ) as Record<string, Record<string, string>>
  expect(charsPayload.label.shared).toBe('include')

  const npcsPayload = JSON.parse(
    window.localStorage.getItem('grimoire:list-prefs:npcs:filters') ?? '{}',
  ) as Record<string, Record<string, string>>
  expect(npcsPayload.label.shared).toBe('include')
})

test('clearFilters: resets that page only and persists empty selections', () => {
  const store = useListPrefsStore.getState()
  store.toggleFilter('characters', 'player', 'Lucas')
  store.toggleFilter('statuses', 'type', 'custom')

  useListPrefsStore.getState().clearFilters('characters')

  const s = useListPrefsStore.getState()
  expect(Object.keys(s.characterFilters.player ?? {}).length).toBe(0)
  expect(s.statusFilters.type?.custom).toBe('include')
  expect(window.localStorage.getItem(FILTERS_KEY)).toBe(
    JSON.stringify({ player: {}, label: {} }),
  )
})
