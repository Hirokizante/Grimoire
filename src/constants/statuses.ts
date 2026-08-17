/**
 * Built-in Divergence status conditions plus factory helpers.
 *
 * The default conditions are seeded once into the IndexedDB `statuses` store
 * on first run (see db.ts `onupgradeneeded`). They carry the 'Default' tag so
 * the Status Compendium shows that tag instead of which sheets reference them.
 */

import { generateId } from './gameData'
import { DEFAULT_STATUS_TAG } from '@/types/status'
import type { StatusCondition } from '@/types'

/** Raw seed data for the built-in statuses (name, icon, description). */
interface StatusSeed {
  name: string
  icon: string
  description: string
}

/** Built-in Divergence status conditions (DESIGN.md "Status Conditions"). */
export const DEFAULT_STATUS_SEEDS: StatusSeed[] = [
  {
    name: 'Blinded',
    icon: '🙈',
    description:
      'Blind characters can only draw line of sight to adjacent tiles, and cannot make opportunity attacks.',
  },
  {
    name: 'Poisoned',
    icon: '☠️',
    description:
      'Poisoned characters take 1d6+POW damage at the end of their turn.',
  },
  {
    name: 'Regeneration',
    icon: '♻️',
    description:
      'Characters with Regeneration regain 1d6+POW HP at the end of their turn.',
  },
  {
    name: 'Cursed',
    icon: '🔮',
    description:
      'Cursed characters cannot regain HP in any way, except when taking a Mortal Wound.',
  },
  {
    name: 'Hidden',
    icon: '🌫️',
    description:
      "Hidden characters can't be targeted by hostile attacks or actions, and enemies only know their approximate location.",
  },
  {
    name: 'Invisible',
    icon: '👻',
    description:
      'All attacks against Invisible characters, regardless of type, have a 50 percent chance to miss outright, before an attack roll is made. Invisible characters are always able to Hide.',
  },
  {
    name: 'Stunned',
    icon: '💫',
    description:
      'Stunned characters cannot take any actions, reactions, or consume AP or END in any way. Their Evasion drops to 5, and they automatically fail all AGI saves.',
  },
  {
    name: 'Prone',
    icon: '🧎',
    description:
      'Attacks against Prone characters are made with +1 Advantage. They are counted as moving in difficult terrain and cannot Dash or Jump. Characters who are prone may spend half their movement to stand up on their turn.',
  },
  {
    name: 'Immobilized',
    icon: '⛓️',
    description:
      'Immobilized characters cannot move in any way and automatically fail all AGI saves.',
  },
  {
    name: 'Dazed',
    icon: '😵',
    description:
      'Dazed characters have +1 Disadvantage to all rolls, and cannot use reactions.',
  },
]

/** Build the full set of built-in statuses as persistable records. */
export function createDefaultStatuses(): StatusCondition[] {
  const now = new Date().toISOString()
  return DEFAULT_STATUS_SEEDS.map((seed) => ({
    id: generateId(),
    name: seed.name,
    icon: seed.icon,
    iconType: 'emoji',
    description: seed.description,
    tags: [DEFAULT_STATUS_TAG],
    createdAt: now,
    updatedAt: now,
  }))
}

/** Build a blank custom status condition (no name, icon, or description). */
export function createBlankStatus(): StatusCondition {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: '',
    icon: '',
    iconType: 'emoji',
    description: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
  }
}
