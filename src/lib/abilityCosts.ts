/**
 * abilityCosts — resolution + affordability helpers for custom Ability costs.
 *
 * A cost entry is stored on the AbilityCost as `{ [barId]: amount }` (see
 * `AbilityCost.custom`). Bar ids are resolved against a character's own
 * `customResourceBars` at render/activation time, so exports/imports and
 * renamed bars keep working — only the id must still exist on the sheet the
 * ability lives on.
 *
 * These helpers back BOTH activation paths (AbilityActivation for regular
 * abilities and SubAbilityBlock for sub-abilities) so they can never drift.
 */

import type {
  CustomResourceBar,
  ResolvedCustomAbilityCost,
} from '@/types'

/**
 * Resolve an AbilityCost's `custom` map against the character's resource
 * bars. Entries whose bar no longer exists are dropped; zero/negative
 * amounts are ignored. Order follows the character's bar order so badges
 * render in the same sequence as the StatsSection bars.
 */
export function resolveCustomAbilityCosts(
  custom: Record<string, number> | undefined,
  bars: CustomResourceBar[],
): ResolvedCustomAbilityCost[] {
  if (!custom) return []
  const resolved: ResolvedCustomAbilityCost[] = []
  for (const bar of bars) {
    const amount = custom[bar.id]
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
      resolved.push({ barId: bar.id, name: bar.name, color: bar.color, amount })
    }
  }
  return resolved
}

/** True when every resolved custom cost fits within its bar's current pool. */
export function canAffordCustomCosts(
  resolved: ResolvedCustomAbilityCost[],
  bars: CustomResourceBar[],
): boolean {
  return resolved.every((cost) => {
    const bar = bars.find((b) => b.id === cost.barId)
    return !!bar && bar.current >= cost.amount
  })
}

/**
 * Build the "Need X Foo" tooltip fragment for unaffordable custom costs.
 * Returns an empty array when everything is affordable.
 */
export function insufficientCustomCostParts(
  resolved: ResolvedCustomAbilityCost[],
  bars: CustomResourceBar[],
): string[] {
  const parts: string[] = []
  for (const cost of resolved) {
    const bar = bars.find((b) => b.id === cost.barId)
    if (!bar || bar.current < cost.amount) {
      parts.push(`${cost.amount - Math.max(0, bar?.current ?? 0)} ${cost.name}`)
    }
  }
  return parts
}
