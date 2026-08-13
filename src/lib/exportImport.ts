/**
 * Export / Import helpers for Grimoire character sheets.
 *
 * DESIGN.md "Sheet Export":
 *   - Export creates a JSON file with an auto-versioned filename.
 *   - Import reads that JSON and merges it back as a new character (or back
 *     into the existing one when re-importing a previous version).
 *   - Version snapshots are stored in the IndexedDB versions store, so the
 *     player can browse history.
 *
 * Custom-tab NPC sections: when a character has any NPC sections, the export
 * bundle includes the attached NPCs as a separate `attachedNpcs` array so
 * they round-trip across import. The legacy flat character shape is
 * preserved when no NPCs are attached so older import flows stay compatible.
 */

import { generateId } from '@/constants/gameData'
import {
  deleteVersionSnapshot,
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
 * Collect every NPC attached to a character via custom-tab NPC sections.
 *
 * An attached NPC is a Character record with `kind === 'npc'` whose id
 * matches a `kind: 'npc'` section's `npcId` somewhere in the character's
 * custom tabs. The NPCs are looked up against the provided character list
 * (the canonical source of NPC records in the same IndexedDB store).
 *
 * Returns an empty array if the character has no NPC sections or the
 * referenced NPC records cannot be found.
 */
export function collectAttachedNPCs(
  character: Character,
  allCharacters: Character[],
): Character[] {
  const ids = new Set<string>()
  for (const tab of character.customTabs) {
    for (const section of tab.sections) {
      if (section.kind === 'npc') ids.add(section.npcId)
    }
  }
  if (ids.size === 0) return []
  return allCharacters.filter(
    (c) => ids.has(c.id) && c.kind === 'npc',
  )
}

/**
 * Build a JSON-serializable export bundle that includes the parent character
 * plus every NPC attached via custom-tab NPC sections. The shape is:
 *
 *   { character: Character; attachedNpcs: Character[] }
 *
 * If the parent character has no attached NPCs, `attachedNpcs` is an empty
 * array. The bundle is forward-compatible: import utilities that don't
 * recognize the wrapper can still read the `character` field.
 */
export function buildExportBundle(
  character: Character,
  allCharacters: Character[],
): { character: Character; attachedNpcs: Character[] } {
  return {
    character,
    attachedNpcs: collectAttachedNPCs(character, allCharacters),
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
 *
 * If `allCharacters` is provided, any NPCs attached to this character via
 * custom-tab NPC sections are included in the exported bundle as
 * `attachedNpcs`. The legacy flat character shape is preserved when no
 * NPCs are attached so existing import utilities stay compatible.
 */
export async function exportCharacter(
  character: Character,
  versionOverride?: Semver,
  allCharacters?: Character[],
): Promise<{
  filename: string
  snapshot: VersionSnapshot
}> {
  const effectiveVersion = versionOverride ?? bumpSemver(character.version)
  const filename = versionedFilename(character.name, effectiveVersion)
  const versioned = { ...character, version: effectiveVersion }
  const snap = await storeVersionSnapshot(versioned)
  const attached = allCharacters
    ? collectAttachedNPCs(versioned, allCharacters)
    : []
  const payload =
    attached.length > 0
      ? { character: versioned, attachedNpcs: attached }
      : versioned
  downloadJson(payload, filename)
  return { filename, snapshot: snap }
}

/** Minimal shape check — verifies key fields exist and have the right broad
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
 * Detect the bundle export shape `{ character, attachedNpcs }`. Returns
 * `true` only when the object has a `character` field with a valid shape.
 */
function isBundleShape(data: unknown): data is {
  character: Character
  attachedNpcs?: Character[]
} {
  if (typeof data !== 'object' || data === null) return false
  const o = data as Record<string, unknown>
  return (
    'character' in o &&
    typeof o.character === 'object' &&
    o.character !== null &&
    isCharacterShape(o.character)
  )
}

/**
 * Parse a JSON string back into a Character, with basic shape validation.
 *
 * Accepts both the legacy flat character shape and the bundle shape
 * `{ character, attachedNpcs }` produced by {@link exportCharacter}.
 * When given a bundle, only the `character` field is parsed and returned
 * — use {@link parseImportBundle} to read attached NPCs as well.
 *
 * Throws if the data is missing required fields.
 */
export function parseCharacterJSON(text: string): Character {
  const data = JSON.parse(text) as unknown
  if (isBundleShape(data)) {
    return data.character
  }
  if (!isCharacterShape(data)) {
    throw new Error(
      'Invalid character sheet JSON: missing required fields',
    )
  }
  return data
}

/**
 * Parse a JSON string into an export bundle, returning both the parent
 * character and any attached NPCs.
 *
 * Each attached NPC is normalized and assigned a fresh id so it can coexist
 * with existing records. The parent character's custom-tab NPC-section
 * `npcId` references are REWRITTEN to point at the fresh ids, so a bundle
 * round-trips fully: importing a character with attached NPCs relinks the
 * sections to the newly-created NPC records.
 */
export function parseImportBundle(
  text: string,
): { character: Character; attachedNpcs: Character[] } {
  const data = JSON.parse(text) as unknown
  if (isBundleShape(data)) {
    // Build a oldId -> newId map from the raw attached NPCs.
    const idMap = new Map<string, string>()
    const npcs = Array.isArray(data.attachedNpcs)
      ? data.attachedNpcs
        .filter((n): n is Character => isCharacterShape(n))
        .map((npc) => {
          const freshId = generateId()
          idMap.set(npc.id, freshId)
          return {
            ...normalizeCharacter(npc),
            id: freshId,
          }
        })
      : []

    // Rewrite the parent character's NPC-section references to the fresh ids.
    const character = rewriteNPCSectionReferences(data.character, idMap)

    return {
      character,
      attachedNpcs: npcs,
    }
  }
  // Legacy flat shape — no attached NPCs.
  if (!isCharacterShape(data)) {
    throw new Error(
      'Invalid character sheet JSON: missing required fields',
    )
  }
  return { character: data, attachedNpcs: [] }
}

/**
 * Rewrite `kind: 'npc'` section `npcId` references on a character using an
 * old-id → new-id map. Returns a new character object with updated sections
 * (or the same character if there are no NPC sections / no remapped ids).
 */
function rewriteNPCSectionReferences(
  character: Character,
  idMap: Map<string, string>,
): Character {
  if (idMap.size === 0) return character
  let changed = false
  const customTabs = character.customTabs.map((tab) => {
    let tabChanged = false
    const sections = tab.sections.map((section) => {
      if (section.kind !== 'npc') return section
      const newId = idMap.get(section.npcId)
      if (!newId) return section
      tabChanged = true
      changed = true
      return { ...section, npcId: newId }
    })
    return tabChanged ? { ...tab, sections } : tab
  })
  return changed ? { ...character, customTabs } : character
}

/**
 * Compare two semver strings.
 * Returns >0 if a>b, <0 if a<b, 0 if equal.
 * Invalid versions are treated as "0.0.0".
 */
export function compareSemver(
   a: Semver,
   b: Semver,
 ): number {
  const pa = parseSemver(a) ?? { major: 0, minor: 0, patch: 0 }
  const pb = parseSemver(b) ?? { major: 0, minor: 0, patch: 0 }
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  return pa.patch - pb.patch
}

/**
 * Determine the resulting version when updating an existing character from an
 * imported one. If the imported version is strictly newer, use it.
 * Otherwise bump the existing version (patch) so history progresses forward.
 */
export function resolveUpdatedVersion(
  existingVersion: Semver,
  importedVersion: Semver,
): Semver {
  return compareSemver(importedVersion, existingVersion) > 0
    ? importedVersion
    : bumpSemver(existingVersion)
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
 * Update an existing character's data from an imported sheet, preserving that
 * character's id and live-play counters (currentHP/END/AP/FP, mortal wounds,
 * death saves, etc.) so in-progress combat state isn't lost.
 *
 * The imported character replaces all structural data (attributes, skills,
 * abilities, backstory, config, etc.) while the existing character keeps:
 *   - id, name, playerName
 *   - all current* / tempHP / mortalWounds / deathSaves
 *
 * The version is resolved via {@link resolveUpdatedVersion}: if the imported
 * version is strictly newer, use it; otherwise bump the existing version so
 * history always advances forward.
 *
 * `imported` is the parsed Character (already normalized). Callers that have
 * raw JSON text should call {@link parseCharacterJSON} first.
 */
export function updateExistingCharacterFromImport(
  existing: Character,
  imported: Character,
): Character {
  const normalized = normalizeCharacter(imported)
  const newVersion = resolveUpdatedVersion(existing.version, normalized.version)
  return {
    ...normalized,
    id: existing.id,
    name: existing.name,
    playerName: existing.playerName,
    // Preserve live-play state from the current sheet.
    currentHP: existing.currentHP,
    tempHP: existing.tempHP,
    currentEND: existing.currentEND,
    currentAP: existing.currentAP,
    currentFP: existing.currentFP,
    mortalWounds: existing.mortalWounds,
    deathSaves: existing.deathSaves,
    version: newVersion,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Delete a version snapshot from history.
 */
export async function deleteVersion(snapshotId: string): Promise<void> {
  await deleteVersionSnapshot(snapshotId)
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
