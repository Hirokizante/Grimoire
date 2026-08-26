/**
 * Zustand store for list-page display preferences — the sort key and filter
 * selections on CharacterListPage, NPCListPage, and StatusCompendiumPage.
 *
 * NOTE: These are app-level UI preferences, like the app theme and home
 * animation — they live in localStorage (synchronously available before first
 * paint) rather than IndexedDB, so prefs survive page switches AND full site
 * reloads. One storage key pair per page; every page shares the same
 * ListSortKey union but has its own set of filter group ids.
 */

import { create } from 'zustand'

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
 * Read a stored filter-selection map ({ groupId: [values] }) into the
 * `Record<string, Set<string>>` shape the FilterDropdown expects. Unknown
 * group ids and non-string entries are dropped defensively so a stale or
 * hand-edited localStorage payload can never break rendering.
 */
export function loadFilterSelection(
  storageKey: string,
  validGroupIds: readonly string[],
): Record<string, Set<string>> {
  const result: Record<string, Set<string>> = {}
  for (const id of validGroupIds) result[id] = new Set()
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return result
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return result
    for (const id of validGroupIds) {
      const values = parsed[id]
      if (!Array.isArray(values)) continue
      const set = new Set<string>()
      for (const v of values) if (typeof v === 'string') set.add(v)
      result[id] = set
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
  /** Per-page filter selections (groupId → selected value set). */
  characterFilters: Record<string, Set<string>>
  npcFilters: Record<string, Set<string>>
  statusFilters: Record<string, Set<string>>
  setCharacterSortKey: (key: ListSortKey) => void
  setNpcSortKey: (key: ListSortKey) => void
  setStatusSortKey: (key: ListSortKey) => void
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

const DEFAULT_FILTERS: Record<ListPageId, Record<string, Set<string>>> = {
  characters: { player: new Set(), label: new Set() },
  npcs: { label: new Set() },
  statuses: { type: new Set(), sheet: new Set() },
}

/** Persist a page's filter map ({ groupId: [values] }) to localStorage. */
function saveFilters(page: ListPageId, selection: Record<string, Set<string>>) {
  try {
    const payload: Record<string, string[]> = {}
    for (const [groupId, set] of Object.entries(selection)) {
      payload[groupId] = Array.from(set)
    }
    window.localStorage.setItem(FILTER_STORAGE_KEYS[page], JSON.stringify(payload))
  } catch {
    // Storage unavailable — the choice still applies for this session.
  }
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
    const nextSet = new Set(current[groupId] ?? [])
    if (nextSet.has(value)) nextSet.delete(value)
    else nextSet.add(value)
    const next = { ...current, [groupId]: nextSet }
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
    const next = { ...DEFAULT_FILTERS[page] }
    saveFilters(page, next)
    set({ [selectionKey]: next } as Pick<ListPrefsStoreState, typeof selectionKey>)
  },
}))
