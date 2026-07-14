/**
 * Shared label helpers for dice roll sources.
 *
 * Used by DiceResultModal and RollLogDrawer to produce human-readable
 * descriptions of where a roll originated.
 */

import type { RollLogEntry, RollSource } from '@/types'

/**
 * Friendly label for a roll source, with optional prefix variants.
 *
 * @param source - The roll source to label.
 * @param prefix - When `'Check: '`, prepends it to skill/attribute checks
 *   (used by the roll-log drawer). Default is no prefix.
 */
export function sourceLabel(
  source: RollSource | null,
  prefix = '',
): string | null {
  if (!source) return null
  switch (source.type) {
    case 'ability-damage':
      return `Damage: ${source.abilityName}`
    case 'skill-check':
      return `${prefix}${source.skillName}`
    case 'attribute-check':
      return `${prefix}${source.attributeName}`
    case 'attack':
      return `Attack${source.abilityName ? ` (${source.abilityName})` : ''}`
    case 'saving-throw':
      return `Save${source.stat ? ` (${source.stat})` : ''}`
    case 'manual':
      return source.note || 'Manual roll'
  }
}

/**
 * Friendly label for a roll-log entry's source, using the "Check: " prefix
 * for skill and attribute checks.
 */
export function rollLogSourceLabel(entry: RollLogEntry): string {
  const label = sourceLabel(entry.source, 'Check: ')
  return label ?? 'Manual'
}
