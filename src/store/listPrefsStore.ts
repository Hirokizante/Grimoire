/**
 * Zustand store for list-page display preferences — the sort key and filter
 * selections on CharacterListPage, NPCListPage, and StatusCompendiumPage.
 *
 * NOTE: These are app-level UI preferences, like the app theme and home
 * animation — they live in localStorage (synchronously available before first
 * paint) rather than IndexedDB, so prefs survive page switches AND full site
 * reloads. One storage key pair per page; every page shares the same
 * ListSortKey union but has its own set of filter group ids.
 *
 * Filters are TRI-STATE per option: unchecked → include → exclude → unchecked.
 * The selection is stored as { groupId: { value: mode } } where mode is
 * 'include' | 'exclude'. Persisted payload shape is
 * { groupId: { value: 'include' | 'exclude' } }; older array payloads
 * ({ groupId: [values] }) are migrated on read as includes.
 */

import { create } from 'zustand'

/** Filter modes for one option in a group. Absent = unchecked. */
export type FilterMode = 'include' | 'exclude'

/**
 * One group's selection: option value → active mode. A value missing from the
 * map is simply unchecked.
 */
export type GroupSelection = Record<string, FilterMode>

/** Whole-page selection: groupId → that group's tri-state map. */
export type PageSelection = Record<string, GroupSelection>

// ---- Shared helpers -------------------------------------------------------

/** Type guard for a plain string-keyed object (used to validate stored JSON). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read a stored sort key, returning `fallback` unless it exactly matches one
 * of the allowed values.
 */
export function loadSortKey<T extends string>(
  storageKey: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return (allowed as readonly string[]).includes(stored ?? '')
      ? (stored as T)
      : fallback
  } catch {
    // localStorage unavailable — use default.
    return fallback
  }
}

/**
 * Read a stored filter-selection map into the {@link PageSelection} shape the
 * FilterDropdown expects. Accepts the current object payload
 * ({ groupId: { value: 'include' | 'exclude' } }) and migrates the legacy
 * array payload ({ groupId: [values] }) as includes. Unknown group ids,
 * non-string values, and unknown modes are dropped defensively so a stale or
 * hand-edited localStorage payload can never break rendering.
 */
export function loadFilterSelection(
  storageKey: string,
  validGroupIds: readonly string[],
): PageSelection {
  const result: PageSelection = {}
  for (const id of validGroupIds) result[id] = {}
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return result
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return result
    for (const id of validGroupIds) {
      const stored = parsed[id]
      if (Array.isArray(stored)) {
        // Legacy pre-tri-state payload: every listed value was an include.
        const legacy: GroupSelection = {}
        for (const v of stored) {
          if (typeof v === 'string') legacy[v] = 'include'
        }
        result[id] = legacy
        continue
      }
      if (!isRecord(stored)) continue
      const group: GroupSelection = {}
      for (const [value, mode] of Object.entries(stored)) {
        if ((mode === 'include' || mode === 'exclude') && value) {
          group[value] = mode
        }
      }
      result[id] = group
    }
    return result
  } catch {
    // Corrupt JSON or unavailable storage — start from empty selections.
    return result
  }
}

interface ListPrefsStoreState {
  /** Per-page sort keys. */
  characterSortKey: ListSortKey
  npcSortKey: ListSortKey
  statusSortKey: ListSortKey
  /** Per-page tri-state filter selections (groupId → value → mode). */
  characterFilters: PageSelection
  npcFilters: PageSelection
  statusFilters: PageSelection
  setCharacterSortKey: (key: ListSortKey) => void
  setNpcSortKey: (key: ListSortKey) => void
  setStatusSortKey: (key: ListSortKey) => void
  /**
   * Cycle one option through unchecked → include → exclude → unchecked.
   * The first click on an unchecked option makes it an INCLUDE; clicking an
   * already-active option flips it between include and exclude, then off.
   */
  toggleFilter: (
    page: ListPageId,
    groupId: string,
    value: string,
  ) => void
  clearFilters: (page: ListPageId) => void
}

/** Which list page a preference belongs to — one storage key pair each. */
export type ListPageId = 'characters' | 'npcs' | 'statuses'

const SORT_KEYS = ['name', 'created', 'modified'] as const
/** Every list page sorts by Name / Date created / Date modified. */
export type ListSortKey = (typeof SORT_KEYS)[number]

const STORAGE_PREFIX = 'grimoire:list-prefs'
const SORT_STORAGE_KEYS: Record<ListPageId, string> = {
  characters: `${STORAGE_PREFIX}:characters:sort`,
  npcs: `${STORAGE_PREFIX}:npcs:sort`,
  statuses: `${STORAGE_PREFIX}:statuses:sort`,
}
const FILTER_STORAGE_KEYS: Record<ListPageId, string> = {
  characters: `${STORAGE_PREFIX}:characters:filters`,
  npcs: `${STORAGE_PREFIX}:npcs:filters`,
  statuses: `${STORAGE_PREFIX}:statuses:filters`,
}

/** The filter groups each page defines — unknown stored groups are dropped. */
const VALID_FILTER_GROUPS: Record<ListPageId, readonly string[]> = {
  characters: ['player', 'label'],
  npcs: ['label'],
  statuses: ['type', 'sheet'],
}

const DEFAULT_FILTERS: Record<ListPageId, PageSelection> = {
  characters: { player: {}, label: {} },
  npcs: { label: {} },
  statuses: { type: {}, sheet: {} },
}

/**
 * Persist a page's filter map ({ groupId: { value: mode } }) to localStorage.
 * Empty groups are kept as empty objects so "cleared" state round-trips
 * explicitly.
 */
function saveFilters(page: ListPageId, selection: PageSelection) {
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEYS[page], JSON.stringify(selection))
  } catch {
    // Storage unavailable — the choice still applies for this session.
  }
}

/** Cycle one option's mode inside a copied group selection. */
function cycleMode(group: GroupSelection, value: string): GroupSelection {
  const next = { ...group }
  switch (next[value]) {
    case undefined:
      next[value] = 'include'
      break
    case 'include':
      next[value] = 'exclude'
      break
    case 'exclude':
      delete next[value]
      break
  }
  return next
}

/**
 * Evaluate one group's tri-state selection against an item.
 *
 * `has(value)` reports whether the item carries that option (e.g. the
 * character's player name equals the option, or its label set contains it).
 * Semantics: an EXCLUDED option that matches disqualifies the item outright;
 * if any INCLUDED options exist, at least one must match; an empty selection
 * always passes.
 */
export function matchesFacet(
  selection: GroupSelection,
  has: (value: string) => boolean,
): boolean {
  const entries = Object.entries(selection)
  if (entries.length === 0) return true
  let hasInclude = false
  let includeMatched = false
  for (const [value, mode] of entries) {
    if (mode === 'exclude') {
      if (has(value)) return false
    } else {
      hasInclude = true
      if (has(value)) includeMatched = true
    }
  }
  return !hasInclude || includeMatched
}

export const useListPrefsStore = create<ListPrefsStoreState>((set, get) => ({
  characterSortKey: loadSortKey(SORT_STORAGE_KEYS.characters, SORT_KEYS, 'name'),
  npcSortKey: loadSortKey(SORT_STORAGE_KEYS.npcs, SORT_KEYS, 'name'),
  statusSortKey: loadSortKey(SORT_STORAGE_KEYS.statuses, SORT_KEYS, 'name'),
  characterFilters: loadFilterSelection(FILTER_STORAGE_KEYS.characters, VALID_FILTER_GROUPS.characters),
  npcFilters: loadFilterSelection(FILTER_STORAGE_KEYS.npcs, VALID_FILTER_GROUPS.npcs),
  statusFilters: loadFilterSelection(FILTER_STORAGE_KEYS.statuses, VALID_FILTER_GROUPS.statuses),

  setCharacterSortKey: (key) => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEYS.characters, key)
    } catch {
      // Storage unavailable — session-only.
    }
    set({ characterSortKey: key })
  },
  setNpcSortKey: (key) => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEYS.npcs, key)
    } catch {
      // Storage unavailable — session-only.
    }
    set({ npcSortKey: key })
  },
  setStatusSortKey: (key) => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEYS.statuses, key)
    } catch {
      // Storage unavailable — session-only.
    }
    set({ statusSortKey: key })
  },

  toggleFilter: (page, groupId, value) => {
    const selectionKey =
      page === 'characters'
        ? 'characterFilters'
        : page === 'npcs'
          ? 'npcFilters'
          : 'statusFilters'
    const current = get()[selectionKey]
    const next = {
      ...current,
      [groupId]: cycleMode(current[groupId] ?? {}, value),
    }
    saveFilters(page, next)
    set({ [selectionKey]: next } as Pick<ListPrefsStoreState, typeof selectionKey>)
  },

  clearFilters: (page) => {
    const selectionKey =
      page === 'characters'
        ? 'characterFilters'
        : page === 'npcs'
          ? 'npcFilters'
          : 'statusFilters'
    // Fresh objects (not shared DEFAULT references) so later mutations never
    // touch the defaults.
    const next: PageSelection = Object.fromEntries(
      Object.keys(DEFAULT_FILTERS[page]).map((id) => [id, {}]),
    )
    saveFilters(page, next)
    set({ [selectionKey]: next } as Pick<ListPrefsStoreState, typeof selectionKey>)
  },
}))
