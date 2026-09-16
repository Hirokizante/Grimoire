/**
 * Slot-counting and validation logic for Slotted Abilities.
 *
 * Per DESIGN.md "Minor Abilities": a regular ability occupies 1 slot and a
 * Minor ability occupies 0.5 slots. The Slotted Abilities section has a fixed
 * capacity (`maxAbilitySlots` on the character); the pool is unbounded.
 *
 * Because Minor abilities are half-slots, the *used* count can be a non-integer
 * (e.g. 2.5). Display helpers format this cleanly.
 */

import type { AbilityBlock } from '@/types'

/** Slots consumed by a single ability: 1 for regular, 0.5 for Minor. */
export function slotCost(ability: AbilityBlock): number {
  return ability.isMinor ? 0.5 : 1
}

/** Total slots consumed by an array of abilities. */
export function slotsUsed(abilities: AbilityBlock[]): number {
  return abilities.reduce((sum, a) => sum + slotCost(a), 0)
}

/**
 * Whether adding `ability` to `current` abilities would exceed `maxSlots`.
 * Returns true when there is room for the ability's slot cost.
 */
export function canSlot(
  current: AbilityBlock[],
  maxSlots: number,
  ability: AbilityBlock,
): boolean {
  return slotsUsed(current) + slotCost(ability) <= maxSlots
}

/**
 * Format a slot usage count for display. Integers render without a decimal
 * (e.g. 3); half values render with one decimal (e.g. 2.5).
 */
export function formatSlots(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/**
 * Determine whether the slotted abilities are at or over capacity. Used to
 * drive the visual "slot overflow" indicator on the section counter.
 */
export function isOverflowed(abilities: AbilityBlock[], maxSlots: number): boolean {
  return slotsUsed(abilities) > maxSlots
}

/**
 * Whether a card being dragged over Slotted Abilities may land there.
 *
 * A card already slotted is always allowed: it already occupies its slot, so
 * re-asking "is there room for one more?" would make a section that is exactly
 * full — the normal, healthy state — refuse to let its own abilities be
 * reordered. Only a genuine arrival is measured against the budget.
 *
 * This is the single definition of "this section is full" shared by the drag
 * context (which refuses the drop) and the card grid (which reddens the
 * indicator while the card hovers), so a drop can never be previewed as valid
 * and then thrown away.
 */
export function canAcceptIntoSlots(
  abilityId: string,
  current: AbilityBlock[],
  maxSlots: number,
  candidate: AbilityBlock | undefined,
): boolean {
  if (!candidate) return true
  if (current.some((a) => a.id === abilityId)) return true
  return canSlot(current, maxSlots, candidate)
}
