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
