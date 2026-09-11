/**
 * abilityRecharge — the Recharge trait's rules, as used by the GM Screen's NPC
 * instances.
 *
 * SRD: "Recharge abilities are abilities that can only be used when passing a
 * D6 roll. For instance, an Ability that has Recharge (4) would need to roll 4
 * and above on the D6 to use the ability." Reading the trait itself is
 * {@link parseAbilityTrait}'s job (lib/abilityTraits.ts); this module owns what
 * the value *means*:
 *
 *   - an ability with the trait goes **on cooldown** the moment it is used,
 *   - at the start of the owner's next turn one Recharge Die (d6) is rolled,
 *   - every cooling ability whose Recharge value is **≤ the roll** comes back,
 *   - abilities that roll below their value stay cooling for another round.
 *
 * Cooldowns are stored as bare ability ids (see `NpcInstanceState.cooldowns`)
 * and resolved against the base record at roll time — the same
 * "instances are deltas" rule the rest of the GM Screen follows, so editing the
 * base's traits (or deleting the ability) can never leave a stale cooldown
 * pinned to a phantom value. An id that no longer resolves to a Recharge
 * ability is simply dropped from the cooldown list.
 */

import { ABILITY_TRAITS, abilityTraitValue, hasAbilityTrait } from '@/lib/abilityTraits'
import { forEachAbility } from '@/lib/abilityModifiers'
import { rollDie } from '@/lib/dice'
import type { RollResult } from '@/lib/diceRoller'
import type { AbilityBlock, Character } from '@/types'

/** The Recharge Die is a d6 (SRD "Recharge"). */
export const RECHARGE_DIE_SIDES = 6

/** Dice notation the Recharge Die is rolled and logged under ("1d6"). */
export const RECHARGE_ROLL_NOTATION = `1d${RECHARGE_DIE_SIDES}`

/** The ability's Recharge value (`Recharge (4)` → 4), or null without one. */
export function abilityRechargeValue(ability: AbilityBlock): number | null {
  return abilityTraitValue(ability.traits, ABILITY_TRAITS.recharge.key)
}

/** Whether the ability carries the Recharge trait at all (with or without a value). */
export function hasRechargeTrait(ability: AbilityBlock): boolean {
  return hasAbilityTrait(ability.traits, ABILITY_TRAITS.recharge.key)
}

/**
 * Whether the ability is governed by Recharge: it has a *usable* value, so it
 * can go on cooldown and come back on a die roll. `Recharge (x)` with no number
 * tracks nothing and is not treated as a cooldown ability.
 */
export function isRechargeAbility(ability: AbilityBlock): boolean {
  return abilityRechargeValue(ability) != null
}

/** Roll the Recharge Die (1d6). */
export function rollRechargeDie(): number {
  return rollDie(RECHARGE_DIE_SIDES)
}

/** An ability currently sitting on Recharge cooldown. */
export interface RechargeableAbility {
  /** Ability id, as stored in the cooldown list. */
  id: string
  /** Display name (falls back to "Untitled Ability"). */
  name: string
  /** The ability's Recharge value. */
  value: number
}

/** The outcome of one Recharge Die roll. */
export interface RechargeOutcome {
  /** The Recharge Die result (1–6). */
  roll: number
  /** Abilities that came off cooldown (value ≤ roll), in cooldown order. */
  recharged: RechargeableAbility[]
  /** Abilities that rolled short and stay cooling for another round. */
  stillCooling: RechargeableAbility[]
}

/**
 * Index every ability on an entity by id — top-level abilities *and* nested
 * sub-abilities, using the shared sheet-tree walk so a Recharge sub-ability is
 * found exactly like a top-level one.
 */
export function abilityIndex(entity: Character): Map<string, AbilityBlock> {
  const index = new Map<string, AbilityBlock>()
  forEachAbility(entity, (ability) => {
    if (ability.id && !index.has(ability.id)) index.set(ability.id, ability)
  })
  return index
}

/**
 * Resolve one Recharge Die result against the ability ids currently on cooldown.
 *
 * Ids that no longer resolve to a Recharge ability on `entity` (the ability was
 * deleted, or had its trait removed) are dropped rather than kept cooling
 * forever — they belong to neither list.
 */
export function resolveRecharge(
  entity: Character,
  cooldownIds: readonly string[],
  roll: number,
): RechargeOutcome {
  const index = abilityIndex(entity)
  const recharged: RechargeableAbility[] = []
  const stillCooling: RechargeableAbility[] = []

  for (const id of cooldownIds) {
    const ability = index.get(id)
    const value = ability ? abilityRechargeValue(ability) : null
    if (!ability || value == null) continue
    const entry: RechargeableAbility = {
      id,
      name: ability.name || 'Untitled Ability',
      value,
    }
    if (value <= roll) recharged.push(entry)
    else stillCooling.push(entry)
  }

  return { roll, recharged, stillCooling }
}

/**
 * The loggable {@link RollResult} for a Recharge Die roll.
 *
 * The die has already been rolled by the caller (the store action owns the
 * roll so the cooldown resolution and the logged number can never disagree),
 * so this only wraps the known result in the dice roller's shape — the roll log
 * then renders it exactly like any other `1d6`.
 */
export function rechargeRollResult(roll: number): RollResult {
  return {
    notation: RECHARGE_ROLL_NOTATION,
    total: roll,
    terms: [
      {
        term: { type: 'dice', count: 1, sides: RECHARGE_DIE_SIDES },
        value: roll,
        label: RECHARGE_ROLL_NOTATION,
        rolls: [roll],
      },
    ],
    breakdown: `${RECHARGE_ROLL_NOTATION} → ${roll} = ${roll}`,
  }
}
