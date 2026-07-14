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
  normalizeCharacter,
  putVersionSnapshot,
} from '@/lib/db'
import type { Character, Semver, VersionSnapshot } from '@/types'

/** Semantic version increment level. */
export type SemverBump = 'major' | 'minor' | 'patch'

/**
 * Parse a semver string into its components.
 * Returns null for invalid input.
 *
 * Also handles legacy numeric values (e.g. `1`) by treating them as
 * `1.0.0`, so characters saved before the semver migration don't crash
 * the export dialog.
 */
export function parseSemver(v: string): { major: number; minor: number; patch: number } | null {
  const trimmed = String(v).trim()
  // Legacy numeric-only format → treat as MAJOR.0.0
  if (/^\d+$/.test(trimmed)) {
    return { major: Number(trimmed), minor: 0, patch: 0 }
  }
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(trimmed)
  if (!m) return null
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) }
}

/**
 * Normalize a semver string (trims whitespace).
 */
export function normalizeSemver(v: Semver): Semver {
  return v.trim()
}

/**
 * Validate a semver string against the strict MAJOR.MINOR.PATCH format.
 * Returns the normalized version, or null if invalid.
 */
export function serializeSemver(v: Semver): Semver | null {
  const parsed = parseSemver(v)
  if (!parsed) return null
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`
}

/**
 * Bump a semantic version string by the given level.
 * Default is 'patch', matching the typical "increment the version counter"
 * behavior. Pass 'minor' or 'major' for non-patch increments.
 *
 * @example
 * bumpSemver('1.0.0')      // '1.0.1'
 * bumpSemver('1.0.0', 'minor')  // '1.1.0'
 * bumpSemver('1.0.0', 'major')  // '2.0.0'
 */
export function bumpSemver(version: Semver, level: SemverBump = 'patch'): Semver {
  const parsed = parseSemver(version)
  if (!parsed) {
    // Fall back to default if input is invalid
    return level === 'major' ? '1.0.0'
      : level === 'minor' ? '0.1.0'
        : '0.0.1'
  }

  switch (level) {
    case 'major':
      return `${parsed.major + 1}.0.0`
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`
    case 'patch':
    default:
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`
  }
}

/**
 * Version-aware filename: "Character Name v1.2.json" or "Character Name v9.1.2.json".
 *
 * dots/dashes inside the character name are preserved; version is separated
 * by " v" so it parses cleanly.
 */
export function versionedFilename(name: string, version: Semver): string {
  const safeName = name.trim().replace(/[/\\?%*:|"<>]/g, '_')
  return `${safeName} v${version.trim()}.json`
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
 * Creates a snapshot and downloads the file. An optional `versionOverride`
 * can supply a semantic version (e.g. "9.1.2") instead of bumping the
 * character's current version. The character's version counter is updated
 * to match.
 */
export async function exportCharacter(
  character: Character,
  versionOverride?: Semver,
): Promise<{
  filename: string
  snapshot: VersionSnapshot
}> {
  const effectiveVersion = versionOverride ?? bumpSemver(character.version)
  const filename = versionedFilename(character.name, effectiveVersion)
  const snap = await storeVersionSnapshot({
    ...character,
    version: effectiveVersion,
  })
  downloadJson({ ...character, version: effectiveVersion }, filename)
  return { filename, snapshot: snap }
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
    typeof o.version === 'string' &&
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
  // Normalize in case the JSON uses the old single-ability field.
  return { ...normalizeCharacter(parsed), id: generateId() }
}

/**
 * Re-import a snapshot back into the *same* character — restoring it to that
 * previous version. The character's `.version` counter is bumped (patch
 * increment) so history is preserved forward.
 */
export function restoreFromSnapshot(
  snapshot: VersionSnapshot,
): Character {
  return {
    ...normalizeCharacter(structuredClone(snapshot.data)),
    version: bumpSemver(snapshot.version),
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
