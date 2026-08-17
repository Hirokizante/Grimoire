/**
 * Status-condition domain types for the Divergence TTRPG.
 *
 * Status conditions are reference records — game effects like "Poisoned" or
 * "Hidden" — that ability descriptions reference by name in square brackets
 * (e.g. "inflicts [Poisoned]"). They live in their own IndexedDB store,
 * seeded with the built-in Divergence conditions and extensible with custom
 * ones players create for their sheets.
 */

/** How a status's icon is stored and rendered. */
export type StatusIconType = 'emoji' | 'pack' | 'image'

/**
 * A single status condition, either built-in ("Default") or user-created.
 */
export interface StatusCondition {
  /** Stable unique identifier. */
  id: string
  /** Display name (e.g. "Poisoned"). References match this case-insensitively. */
  name: string
  /**
   * Icon payload. Its meaning depends on `iconType`: an emoji character(s)
   * for 'emoji', a lucide icon key for 'pack', or a data URL (SVG/PNG) for
   * 'image'. Empty string means no icon (renders a placeholder glyph).
   */
  icon: string
  /** How to interpret/render `icon`. */
  iconType: StatusIconType
  /** Full rules text describing the condition's effect. */
  description: string
  /**
   * Categorization tags. Built-in statuses carry 'Default'; they show this tag
   * in the compendium instead of which sheets reference them. Custom statuses
   * carry no tags and instead show their referencing sheets.
   */
  tags: string[]
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of last update. */
  updatedAt: string
}

/** The tag built-in Divergence status conditions carry. */
export const DEFAULT_STATUS_TAG = 'Default'
