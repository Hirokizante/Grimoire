/**
 * IndexedDB storage layer for Grimoire.
 *
 * A thin promise wrapper around the native IndexedDB API. The database holds
 * two object stores:
 *   - `characters`: the live {@link Character} records keyed by `id`.
 *   - `versions`: {@link VersionSnapshot} records for character version
 *     history, keyed by `id` and indexed by `characterId`.
 *
 * All functions here are framework-agnostic and safe to call from anywhere.
 */

import type { AbilityBlock, Character, CharacterViewModes, VersionSnapshot } from '@/types'

const DB_NAME = 'grimoire'
const DB_VERSION = 3
const CHAR_STORE = 'characters'
const VERSION_STORE = 'versions'
const ROLL_LOG_STORE = 'roll_logs'

/**
 * Open (and initialise) the Grimoire IndexedDB database.
 *
 * Creates the object stores on first run / version bump. Resolves with the
 * ready {@link IDBDatabase}; rejects on any open/upgrade error.
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(CHAR_STORE)) {
        db.createObjectStore(CHAR_STORE, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(VERSION_STORE)) {
        const versionStore = db.createObjectStore(VERSION_STORE, {
          keyPath: 'id',
        })
        versionStore.createIndex('characterId', 'characterId', {
          unique: false,
        })
      }

      if (!db.objectStoreNames.contains(ROLL_LOG_STORE)) {
        const rollLogStore = db.createObjectStore(ROLL_LOG_STORE, {
          keyPath: 'id',
        })
        rollLogStore.createIndex('characterId', 'characterId', {
          unique: false,
        })
      }
    }
  })
}

/**
 * Wrap an {@link IDBRequest} in a Promise, rejecting on error and resolving
 * with `request.result` on success.
 */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Normalize a freshly-loaded Character record to the latest schema.
 *
 * Migrates the old single-ability `innateAbility` field to the new
 * multi-ability `innateAbilities` array, guaranteeing downstream code never
 * sees an undefined `innateAbilities`.
 */
export function normalizeCharacter(raw: Character): Character {
  const result = { ...raw }

  // Migrate from old single-ability shape (field rename innateAbility →
  // innateAbilities). We still need to DROP the old key even when it
  // overlaps — the shallow spread above copies it onto `result`.
  if (!Array.isArray(result.innateAbilities)) {
    const rawObj = raw as unknown as {
      innateAbility?: import('@/types').AbilityBlock | null
    } & Record<string, unknown>
    const { innateAbility } = rawObj
    // Drop the legacy key and set the new array r/place.
    const rest = { ...result } as Record<string, unknown>
    delete rest.innateAbility
    Object.assign(result, rest, {
      innateAbilities:
        innateAbility && typeof innateAbility === 'object'
          ? [innateAbility]
          : [],
    })
  }

  // Ensure every AbilityBlock has `showActivate` (added in this release).
  // Existing records default to true so every ability keeps its Activate
  // button until a user explicitly hides it.
  const blockArrays: (keyof Character)[] = [
    'innateAbilities',
    'slottedAbilities',
    'abilityPool',
  ]
  for (const key of blockArrays) {
    const arr = result[key] as unknown as AbilityBlock[] | undefined
    if (Array.isArray(arr)) {
      ;(result as unknown as Record<string, unknown>)[key] = arr.map(
        (a) => ({
          ...a,
          showActivate: a.showActivate ?? true,
        }),
      )
    }
  }
  // Also normalize blocks nested inside customTabs[].sections[].abilities[].
  if (Array.isArray(result.customTabs)) {
    result.customTabs = result.customTabs.map((tab) => ({
      ...tab,
      sections: tab.sections.map((section) => ({
        ...section,
        abilities: section.abilities.map((a) => ({
          ...a,
          showActivate: a.showActivate ?? true,
        })),
      })),
    }))
  }

  // Ensure customTabs exists (migration for older records without it).
  if (!Array.isArray(result.customTabs)) {
    result.customTabs = []
  }

  // Ensure customResourceBars exists (migration for records without it).
  if (!Array.isArray(result.customResourceBars)) {
    result.customResourceBars = []
  }

  // Ensure scalar AbilityBlock shapes (basicAttack, fatebreaker) carry
  // showActivate too.
  const scalarBlocks: (keyof Character)[] = ['basicAttack', 'fatebreaker']
  for (const key of scalarBlocks) {
    const block = result[key] as unknown as AbilityBlock | undefined
    if (block && typeof block === 'object') {
      ;(result as unknown as Record<string, unknown>)[key] = {
        ...block,
        showActivate: block.showActivate ?? true,
      }
    }
  }

  // Ensure viewModes exists and is complete (migration for records created
  // before view-modes were persisted). Build a full shape so any tabs or
  // sections present in customTabs get an entry — existing choices preserved,
  // new ones default to 'grid'.
  const rawRecord = result as unknown as Record<string, unknown>
  const existing =
    rawRecord.viewModes && typeof rawRecord.viewModes === 'object'
      ? (rawRecord.viewModes as Partial<CharacterViewModes>)
      : null
  const customTabModes: Record<string, Record<string, 'grid' | 'list'>> = {
    ...(existing?.customTabs ?? {}),
  }
  for (const tab of result.customTabs) {
    if (!customTabModes[tab.id]) customTabModes[tab.id] = {}
    for (const section of tab.sections) {
      if (!customTabModes[tab.id][section.id]) {
        customTabModes[tab.id][section.id] = 'grid'
      }
    }
  }
  result.viewModes = {
    slottedAbilities: existing?.slottedAbilities ?? 'grid',
    abilityPool: existing?.abilityPool ?? 'grid',
    customTabs: customTabModes,
  } satisfies CharacterViewModes

  return result as Character
}

/** Load every stored character, ordered by creation date (oldest first). */
export async function getAllCharacters(): Promise<Character[]> {
  const db = await openDB()
  const tx = db.transaction(CHAR_STORE, 'readonly')
  const store = tx.objectStore(CHAR_STORE)
  const all = await promisifyRequest<Character[]>(store.getAll())
  db.close()
  return all
    .map(normalizeCharacter)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * Fetch a single character by id, or `null` if not found.
 */
export async function getCharacter(id: string): Promise<Character | null> {
  const db = await openDB()
  const tx = db.transaction(CHAR_STORE, 'readonly')
  const store = tx.objectStore(CHAR_STORE)
  const result = await promisifyRequest<Character | undefined>(store.get(id))
  db.close()
  return result ? normalizeCharacter(result) : null
}

/** Insert or replace a character record. */
export async function putCharacter(char: Character): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(CHAR_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(CHAR_STORE).put(char))
  db.close()
}

/** Remove a character record by id. No-op if the id doesn't exist. */
export async function deleteCharacter(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(CHAR_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(CHAR_STORE).delete(id))
  db.close()
}

// ---- Version snapshots --------------------------------------------------------

/**
 * Store a new {@link VersionSnapshot}. Returns the snapshot object as stored.
 */
export async function putVersionSnapshot(
  snapshot: VersionSnapshot,
): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(VERSION_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(VERSION_STORE).put(snapshot))
  db.close()
}

/**
 * Fetch every snapshot for a given character, newest first.
 */
export async function getVersionHistory(
  characterId: string,
): Promise<VersionSnapshot[]> {
  const db = await openDB()
  const tx = db.transaction(VERSION_STORE, 'readonly')
  const store = tx.objectStore(VERSION_STORE)
  const index = store.index('characterId')
  const all = await promisifyRequest<VersionSnapshot[]>(
    index.getAll(characterId),
  )
  db.close()
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Delete a single version snapshot by id. */
export async function deleteVersionSnapshot(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(VERSION_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(VERSION_STORE).delete(id))
  db.close()
}

// ---- Roll log --------------------------------------------------------

import type { RollLogEntry } from '@/types'

/** Persist a roll-log entry. */
export async function putRollLogEntry(entry: RollLogEntry): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(ROLL_LOG_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(ROLL_LOG_STORE).put(entry))
  db.close()
}

/** Fetch every roll-log entry for a character, newest first. */
export async function getRollLogForCharacter(
  characterId: string,
): Promise<RollLogEntry[]> {
  const db = await openDB()
  const tx = db.transaction(ROLL_LOG_STORE, 'readonly')
  const store = tx.objectStore(ROLL_LOG_STORE)
  const index = store.index('characterId')
  const all = await promisifyRequest<RollLogEntry[]>(
    index.getAll(characterId),
  )
  db.close()
  return all.sort((a, b) => b.rolledAt.localeCompare(a.rolledAt))
}

/** Fetch every roll-log entry across all characters, newest first. */
export async function getAllRollLogEntries(): Promise<RollLogEntry[]> {
  const db = await openDB()
  const tx = db.transaction(ROLL_LOG_STORE, 'readonly')
  const store = tx.objectStore(ROLL_LOG_STORE)
  const all = await promisifyRequest<RollLogEntry[]>(store.getAll())
  db.close()
  return all.sort((a, b) => b.rolledAt.localeCompare(a.rolledAt))
}

/** Delete a single roll-log entry by id. */
export async function deleteRollLogEntry(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(ROLL_LOG_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(ROLL_LOG_STORE).delete(id))
  db.close()
}

/** Delete every roll-log entry for a character. */
export async function clearRollLogForCharacter(
  characterId: string,
): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(ROLL_LOG_STORE, 'readwrite')
  const store = tx.objectStore(ROLL_LOG_STORE)
  const index = store.index('characterId')
  const keys = await promisifyRequest<IDBValidKey[]>(
    index.getAllKeys(characterId),
  )
  for (const key of keys) {
    store.delete(key)
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
