/**
 * IndexedDB storage layer for Grimoire.
 *
 * A thin promise wrapper around the native IndexedDB API. The database holds a
 * single object store of {@link Character} records keyed by their `id`. All
 * functions here are framework-agnostic and safe to call from anywhere.
 */

import type { Character } from '@/types'

const DB_NAME = 'grimoire'
const DB_VERSION = 1
const STORE_NAME = 'characters'

/**
 * Open (and initialise) the Grimoire IndexedDB database.
 *
 * Creates the `characters` object store on first run / version bump. Resolves
 * with the ready {@link IDBDatabase}; rejects on any open/upgrade error.
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
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
 * Load every stored character, ordered by creation date (oldest first).
 */
export async function getAllCharacters(): Promise<Character[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const all = await promisifyRequest<Character[]>(store.getAll())
  db.close()
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * Fetch a single character by id, or `null` if not found.
 */
export async function getCharacter(id: string): Promise<Character | null> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const result = await promisifyRequest<Character | undefined>(store.get(id))
  db.close()
  return result ?? null
}

/**
 * Insert or replace a character record.
 */
export async function putCharacter(char: Character): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  await promisifyRequest(tx.objectStore(STORE_NAME).put(char))
  db.close()
}

/**
 * Remove a character record by id. No-op if the id doesn't exist.
 */
export async function deleteCharacter(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  await promisifyRequest(tx.objectStore(STORE_NAME).delete(id))
  db.close()
}