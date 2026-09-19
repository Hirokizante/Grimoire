/**
 * Export / import helpers for status conditions.
 *
 * A transfer file is JSON produced from the Status Compendium:
 *
 *   { app: 'grimoire', kind: 'status', fileVersion: 1, exportedAt, status }
 *   { app: 'grimoire', kind: 'status-compendium', fileVersion: 1, exportedAt,
 *     count, statuses }
 *
 * A single-status import merges: a same-named condition is updated in place
 * (id preserved) and a new name is added. A compendium import REPLACES the
 * whole compendium — the page confirms before doing it.
 *
 * Parsing is deliberately forgiving for hand-authored files: a bare
 * StatusCondition object, or a bare array of them, is accepted too. Files
 * recognizable as a different Grimoire export (a character sheet, a full
 * backup) are rejected with a message pointing at the right importer.
 */

import { generateId } from '@/constants/gameData'
import { normalizeStatus } from '@/lib/db'
import { isCharacterShape } from '@/lib/exportImport'
import type { StatusCondition, StatusIconType } from '@/types'

/** Bump when the transfer payload shape changes incompatibly. */
export const STATUS_TRANSFER_VERSION = 1

/** A single-status export file. */
export interface StatusFile {
  /** Fixed marker so the importer can recognize our own files. */
  app: 'grimoire'
  /** Discriminator distinguishing status files from other exports. */
  kind: 'status'
  /** Payload schema version ({@link STATUS_TRANSFER_VERSION}). */
  fileVersion: number
  /** ISO timestamp of when the status was exported. */
  exportedAt: string
  /** The condition itself. */
  status: StatusCondition
}

/** A whole-compendium export file. */
export interface StatusCompendiumFile {
  app: 'grimoire'
  kind: 'status-compendium'
  fileVersion: number
  exportedAt: string
  /** Convenience count for UI summaries. */
  count: number
  /** Every condition in the compendium (built-in + custom). */
  statuses: StatusCondition[]
}

/** What {@link parseStatusImport} found in a picked file. */
export type StatusImport =
  | { kind: 'status'; status: StatusCondition }
  | { kind: 'compendium'; statuses: StatusCondition[] }

/** The icon types a status record may declare. */
const ICON_TYPES: StatusIconType[] = ['emoji', 'pack', 'image']

/** Strip characters that are unsafe in download filenames. */
function safeFilenamePart(name: string): string {
  return name.trim().replace(/[/\\?%*:|"<>]/g, '_')
}

/** Download filename for a single status: `Status - Poisoned.json`. */
export function statusFilename(status: StatusCondition): string {
  return `Status - ${safeFilenamePart(status.name) || 'Untitled'}.json`
}

/**
 * Human-friendly filename for a compendium export:
 * `Grimoire Status Compendium YYYY-MM-DD.json` (local time).
 */
export function statusCompendiumFilename(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `Grimoire Status Compendium ${y}-${m}-${d}.json`
}

/** Build the JSON-serializable single-status export payload. */
export function buildStatusFile(status: StatusCondition): StatusFile {
  return {
    app: 'grimoire',
    kind: 'status',
    fileVersion: STATUS_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    status,
  }
}

/** Build the JSON-serializable whole-compendium export payload. */
export function buildStatusCompendiumFile(
  statuses: StatusCondition[],
): StatusCompendiumFile {
  return {
    app: 'grimoire',
    kind: 'status-compendium',
    fileVersion: STATUS_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    count: statuses.length,
    statuses,
  }
}

/**
 * Normalize one status record from a transfer file. Requires only a name —
 * everything else is back-filled, and a missing id gets a fresh one, so a
 * hand-authored `{ "name": "Poisoned" }` imports cleanly.
 *
 * Returns null when the record is not an object or carries no usable name.
 */
function parseStatusRecord(raw: unknown): StatusCondition | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.name !== 'string' || o.name.trim() === '') return null
  const now = new Date().toISOString()
  const iconType = ICON_TYPES.includes(o.iconType as StatusIconType)
    ? (o.iconType as StatusIconType)
    : 'emoji'
  return normalizeStatus({
    id: typeof o.id === 'string' && o.id ? o.id : generateId(),
    name: o.name,
    icon: typeof o.icon === 'string' ? o.icon : '',
    iconType,
    description: typeof o.description === 'string' ? o.description : '',
    tags: Array.isArray(o.tags)
      ? o.tags.filter((t): t is string => typeof t === 'string')
      : [],
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : now,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : now,
  })
}

/**
 * Parse a list of status records. Throws instead of silently dropping a
 * malformed entry: a compendium import replaces everything, so a partial
 * list would quietly delete conditions.
 */
function parseStatusList(raw: unknown, sourceLabel: string): StatusCondition[] {
  if (!Array.isArray(raw)) {
    throw new Error(`That file is not a ${sourceLabel}: the list is missing.`)
  }
  return raw.map((entry, index) => {
    const status = parseStatusRecord(entry)
    if (!status) {
      throw new Error(
        `That ${sourceLabel} has an invalid entry at position ${index + 1} (a status needs a name).`,
      )
    }
    return status
  })
}

/**
 * Parse and validate a picked status-transfer file.
 *
 * Accepts the two export shapes plus bare records for hand-authored files.
 * Throws a plain-language Error (safe to surface in a toast) when the file is
 * a different Grimoire export or isn't status data at all.
 */
export function parseStatusImport(text: string): StatusImport {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  // Bare array of records — a hand-authored compendium.
  if (Array.isArray(data)) {
    const statuses = parseStatusList(data, 'status compendium')
    if (statuses.length === 0) {
      throw new Error('This status compendium file contains no statuses.')
    }
    return { kind: 'compendium', statuses }
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error("That file doesn't contain a status or a status compendium.")
  }
  const o = data as Record<string, unknown>

  if (o.app === 'grimoire' && o.kind === 'full-backup') {
    throw new Error(
      "That file is a Grimoire full backup. Restore it from Settings → Backup & Restore (it would overwrite everything, not just statuses).",
    )
  }
  if ('character' in o || isCharacterShape(o)) {
    throw new Error(
      'That file is a character sheet, not a status. Character sheets import from the Characters page.',
    )
  }

  if (o.app === 'grimoire' && o.kind === 'status-compendium') {
    const statuses = parseStatusList(o.statuses, 'status compendium')
    if (statuses.length === 0) {
      throw new Error('This status compendium file contains no statuses.')
    }
    return { kind: 'compendium', statuses }
  }

  if (o.app === 'grimoire' && o.kind === 'status') {
    const status = parseStatusRecord(o.status)
    if (!status) {
      throw new Error('This status file is missing its status record.')
    }
    return { kind: 'status', status }
  }

  // Bare status object — a hand-authored single-status file.
  const bare = parseStatusRecord(data)
  if (bare) return { kind: 'status', status: bare }

  throw new Error("That file doesn't contain a status or a status compendium.")
}
