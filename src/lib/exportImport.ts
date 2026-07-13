/**
 * Export / Import helpers for Grimoire character sheets.
 *
 * DESIGN.md "Sheet Export":
 *   - Export creates a JSON file with an auto-versioned filename.
 *   - Import reads that JSON and merges it back as a new character (or back
 *     into the existing one when re-importing a previous version).
 *   - Version snapshots are stored in the IndexedDB versions store, so the
 *     player can browse history.
 */

import { generateId } from '@/constants/gameData'
import {
  getVersionHistory,
  putVersionSnapshot,
} from '@/lib/db'
import type { Character, VersionSnapshot } from '@/types'

/**
 * Version-aware filename: "Character Name v1.2.json".
 *
 * dots/dashes inside the character name are preserved; version is separated
 * by " v" so it parses cleanly.
 */
export function versionedFilename(
  name: string,
  version: number,
): string {
  const safeName = name.trim().replace(/[/\\?%*:|"<>]/g, '_')
  return `${safeName} v${version}.json`
}

/**
 * Build a snapshot of a character at its current version. Does NOT yet
 * persist — call {@link storeVersionSnapshot} to save.
 */
export function createSnapshot(character: Character): VersionSnapshot {
  return {
    id: generateId(),
    characterId: character.id,
    version: character.version,
    createdAt: new Date().toISOString(),
    // Structured clone so later edits don't mutate the snapshot.
    data: structuredClone(character),
  }
}

/**
 * Persist a snapshot to the IndexedDB versions store.
 */
export async function storeVersionSnapshot(
  character: Character,
): Promise<VersionSnapshot> {
  const snap = createSnapshot(character)
  await putVersionSnapshot(snap)
  return snap
}

/**
 * Fetch the version history for a character (newest first).
 */
export async function listVersions(
  characterId: string,
): Promise<VersionSnapshot[]> {
  return getVersionHistory(characterId)
}

/**
 * Trigger a browser download of a character as JSON.
 *
 * Bumps the character's `.version` counter, then creates a snapshot and
 * downloads the file.
 */
export async function exportCharacter(character: Character): Promise<{
  filename: string
  snapshot: VersionSnapshot
}> {
  const filename = versionedFilename(character.name, character.version)
  const snapshot = await storeVersionSnapshot(character)
  downloadJson(character, filename)
  return { filename, snapshot }
}

/**
 * Parse a JSON string back into a Character, with basic shape validation.
 *
 * Throws if the data is missing required fields.
 */
export function parseCharacterJSON(text: string): Character {
  const data = JSON.parse(text) as unknown
  if (!isCharacterShape(data)) {
    throw new Error(
      'Invalid character sheet JSON: missing required fields',
    )
  }
  return data
}

/**
 * Minimal shape check — verifies key fields exist and have the right broad
 * type, but does NOT exhaustively validate the whole object.
 */
function isCharacterShape(data: unknown): data is Character {
  if (typeof data !== 'object' || data === null) return false
  const o = data as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.version === 'number' &&
    typeof o.milestones === 'number' &&
    typeof o.attributes === 'object' &&
    o.attributes !== null &&
    typeof o.skills === 'object' &&
    o.skills !== null &&
    typeof o.config === 'object' &&
    o.config !== null
  )
}

/**
 * Import a character from JSON text. Returns the parsed Character with a
 * new unique id so it can coexist with the original in the list.
 */
export function importCharacter(text: string): Character {
  const parsed = parseCharacterJSON(text)
  // Fresh id so the imported copy is a distinct character.
  return { ...parsed, id: generateId() }
}

/**
 * Re-import a snapshot back into the *same* character — restoring it to that
 * previous version. The character's `.version` counter is bumped to
 * `(previous version + 1)` so history is preserved forward.
 */
export function restoreFromSnapshot(
  snapshot: VersionSnapshot,
): Character {
  return {
    ...structuredClone(snapshot.data),
    version: snapshot.version + 1,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Initiate a browser download of `data` as a JSON file with the given name.
 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
