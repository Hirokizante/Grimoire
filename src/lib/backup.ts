/**
 * Full-app backup & restore for Grimoire.
 *
 * A backup is a SINGLE JSON file capturing every piece of user data in the
 * app's IndexedDB:
 *   - all character sheets (player characters AND standalone NPCs — they share
 *     the `characters` store, discriminated by `kind`)
 *   - all version snapshots (character history)
 *   - the full status-condition compendium (built-in + custom)
 *   - the persistent dice roll log
 *   - every saved GM screen
 *
 * Restoring REPLACES the current contents of all five stores with the backup's
 * (in one atomic IndexedDB transaction) and reloads the in-memory stores. This
 * is a disaster-recovery tool, not a merge — the app warns before overwriting.
 *
 * The file shape is forward/backward versioned:
 *
 *   {
 *     app: 'grimoire',
 *     kind: 'full-backup',
 *     backupVersion: 2,
 *     createdAt: '<ISO timestamp>',
 *     counts: { characters, npcs, versions, rollLogEntries, statuses, screens },
 *     data: { characters, versions, rollLogs, statuses, screens }
 *   }
 *
 * v1 backups (no `screens` key) still restore: screens are treated as an empty
 * list, so the screens store is wiped like every other store (replace
 * semantics). Backups newer than {@link BACKUP_VERSION} are refused.
 */

import {
  getAllCharacters,
  getAllRollLogEntries,
  getAllScreens,
  getAllStatuses,
  getAllVersionSnapshots,
  replaceAllData,
} from '@/lib/db'
import { isCharacterShape, isStatusShape } from '@/lib/exportImport'
import type {
  Character,
  GMScreen,
  RollLogEntry,
  StatusCondition,
  VersionSnapshot,
} from '@/types'

/** Bump when the backup payload shape changes incompatibly. */
export const BACKUP_VERSION = 2

/** The single-file payload written to disk. */
export interface FullBackup {
  /** Fixed marker so restore can recognize our own files. */
  app: 'grimoire'
  /** Discriminator distinguishing backups from single-sheet exports. */
  kind: 'full-backup'
  /** Payload schema version ({@link BACKUP_VERSION}). */
  backupVersion: number
  /** ISO timestamp of when the backup was taken. */
  createdAt: string
  /** Convenience counts for UI summaries. */
  counts: {
    characters: number
    npcs: number
    versions: number
    rollLogEntries: number
    statuses: number
    screens: number
  }
  /** The records themselves, keyed by store. */
  data: {
    characters: Character[]
    versions: VersionSnapshot[]
    rollLogs: RollLogEntry[]
    statuses: StatusCondition[]
    screens: GMScreen[]
  }
}

/** What a restore leaves behind, for UI feedback. */
export interface RestoreResult {
  counts: FullBackup['counts']
}

/**
 * Read every store and assemble a complete backup payload.
 * Characters (PCs + NPCs) keep their exact stored form — normalize-on-read
 * (see db.ts) handles schema drift when they come back.
 */
export async function buildFullBackup(): Promise<FullBackup> {
  const [characters, versions, rollLogs, statuses, screens] = await Promise.all([
    getAllCharacters(),
    getAllVersionSnapshots(),
    getAllRollLogEntries(),
    getAllStatuses(),
    getAllScreens(),
  ])
  const npcs = characters.filter((c) => c.kind === 'npc')
  return {
    app: 'grimoire',
    kind: 'full-backup',
    backupVersion: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    counts: {
      characters: characters.length - npcs.length,
      npcs: npcs.length,
      versions: versions.length,
      rollLogEntries: rollLogs.length,
      statuses: statuses.length,
      screens: screens.length,
    },
    data: { characters, versions, rollLogs, statuses, screens },
  }
}

/**
 * Human-friendly download filename for a backup: `Grimoire Backup YYYY-MM-DD.json`
 * (local time), so successive backups sort chronologically.
 */
export function backupFilename(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `Grimoire Backup ${y}-${m}-${d}.json`
}

/** Shape guard for a version snapshot (id + characterId + data payload). */
function isVersionSnapshotShape(data: unknown): data is VersionSnapshot {
  if (typeof data !== 'object' || data === null) return false
  const o = data as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.characterId === 'string' &&
    typeof o.version === 'string' &&
    typeof o.createdAt === 'string' &&
    typeof o.data === 'object' &&
    o.data !== null
  )
}

/** Shape guard for a roll-log entry (id + characterId + notation + rolledAt). */
function isRollLogEntryShape(data: unknown): data is RollLogEntry {
  if (typeof data !== 'object' || data === null) return false
  const o = data as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.characterId === 'string' &&
    typeof o.notation === 'string' &&
    typeof o.rolledAt === 'string'
  )
}

/** Shape guard for a GM screen (id + name + panels array). */
function isScreenShape(data: unknown): data is GMScreen {
  if (typeof data !== 'object' || data === null) return false
  const o = data as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.panels)
  )
}

/**
 * Parse and validate a backup file's JSON text.
 *
 * Throws a plain-language Error (safe to surface in a toast) when the file
 * isn't Grimoire full-backup JSON — including when the user picked a
 * single-character export instead of a full backup.
 */
export function parseFullBackup(text: string): FullBackup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as Record<string, unknown>).app !== 'grimoire' ||
    (data as Record<string, unknown>).kind !== 'full-backup'
  ) {
    throw new Error(
      'That file is not a Grimoire full backup. (Single-character exports can be imported from the Characters page.)',
    )
  }
  const o = data as Record<string, unknown>
  const backupVersion = typeof o.backupVersion === 'number' ? o.backupVersion : 0
  if (backupVersion > BACKUP_VERSION) {
    throw new Error(
      `This backup was made with a newer version of Grimoire (v${backupVersion}) and can't be restored here.`,
    )
  }
  const raw = (o.data ?? {}) as Record<string, unknown>
  const characters = Array.isArray(raw.characters)
    ? raw.characters.filter(isCharacterShape)
    : []
  const versions = Array.isArray(raw.versions)
    ? raw.versions.filter(isVersionSnapshotShape)
    : []
  const rollLogs = Array.isArray(raw.rollLogs)
    ? raw.rollLogs.filter(isRollLogEntryShape)
    : []
  const statuses = Array.isArray(raw.statuses)
    ? raw.statuses.filter(isStatusShape)
    : []
  // v1 backups predate GM screens — a missing key means "no screens".
  const screens = Array.isArray(raw.screens)
    ? (raw.screens as unknown[]).filter(isScreenShape)
    : []

  const npcs = characters.filter((c) => c.kind === 'npc')
  const parsed: FullBackup = {
    app: 'grimoire',
    kind: 'full-backup',
    backupVersion: BACKUP_VERSION,
    createdAt:
      typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    counts: {
      characters: characters.length - npcs.length,
      npcs: npcs.length,
      versions: versions.length,
      rollLogEntries: rollLogs.length,
      statuses: statuses.length,
      screens: screens.length,
    },
    data: { characters, versions, rollLogs, statuses, screens },
  }
  if (
    parsed.counts.characters +
      parsed.counts.npcs +
      parsed.counts.statuses +
      parsed.counts.versions +
      parsed.counts.rollLogEntries +
      parsed.counts.screens ===
    0
  ) {
    throw new Error('This backup file contains no data.')
  }
  return parsed
}

/**
 * Wipe the four object stores and write the backup's records back, atomically
 * (single IndexedDB transaction — see replaceAllData). Returns the restored
 * counts for the success toast.
 */
export async function restoreFullBackup(backup: FullBackup): Promise<RestoreResult> {
  await replaceAllData(backup.data)
  return { counts: backup.counts }
}
