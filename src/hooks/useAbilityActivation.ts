/**
 * useAbilityActivation — the shared "Activate" behaviour behind both the
 * AbilityActivation wrapper (regular ability cards) and SubAbilityBlock (nested
 * Sub-Abilities, which render their own button).
 *
 * It answers three questions for a given ability + character:
 *
 *   1. Can the ability be afforded? AP / END (with the Exhaustion penalty) /
 *      FP / custom resource bars, plus any tracked status pool.
 *   2. Does it still have uses left? A limited ability at 0 uses cannot be
 *      activated at all, however much AP the character has.
 *   3. What happens when it is clicked? Deduct the costs, and — when the
 *      ability is limited with `expendOnActivate` on — consume one use.
 *
 * The hook is purely a planner: it never writes, so it is safe to call from a
 * component that only renders a card.
 *
 * **Resources are pluggable.** By default the costs come from the sheet's own
 * `characterStore` actions (the sheet pages). A GM Screen NPC *instance* is not
 * a store character — its Action Points live on the panel — so it passes an
 * {@link AbilityActivationResources} adapter and, when the ability is cooling
 * down, a {@link AbilityActivationOptions.blockedReason}. Everything else
 * (affordability, the exhaustion penalty, custom bars, limited uses) stays here
 * so there is exactly one activation implementation to keep honest.
 */

import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'

import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import {
  canAffordCustomCosts,
  insufficientCustomCostParts,
  resolveCustomAbilityCosts,
} from '@/lib/abilityCosts'
import { expendsUseOnActivate, hasUsesRemaining } from '@/lib/abilityUses'
import type { AbilityBlock, Character, CustomResourceBar } from '@/types'

/**
 * Where an activation's costs are read from and spent.
 *
 * Sheet pages use the default (the character store). A GM Screen NPC instance
 * supplies its own: `end`/`fp` are null because an NPC panel tracks neither, so
 * those costs are neither deducted nor allowed to block an activation.
 */
export interface AbilityActivationResources {
  /** Action Points left. */
  ap: number
  /** Endurance left, or null when this entity does not track END. */
  end: number | null
  /** Fate Points left, or null when this entity does not track FP. */
  fp: number | null
  /** Custom resource bars the ability's custom costs resolve against. */
  customBars: CustomResourceBar[]
  /** Deduct AP; false when the entity cannot afford it. */
  spendAP: (amount: number) => boolean
  /** Deduct END; false when the entity cannot afford it. */
  spendEND: (amount: number) => boolean
  /** Deduct FP; false when the entity cannot afford it. */
  spendFP: (amount: number) => boolean
  /** Deduct one custom bar; false when it cannot afford it. */
  spendCustom: (barId: string, amount: number) => boolean
  /** Consume one use of a limited ability; true when a use was really spent. */
  spendUse: () => boolean
}

/** Optional overrides for an activation that does not run against a sheet. */
export interface AbilityActivationOptions {
  /** Resource adapter; omit to use the character store (sheet pages). */
  resources?: AbilityActivationResources
  /**
   * A reason the ability cannot be used right now that is not a resource —
   * e.g. "On cooldown — Recharge 5". Disables the button and becomes its
   * tooltip, and refuses the click if one still arrives.
   */
  blockedReason?: string | null
  /**
   * Runs after a successful activation (the GM panel marks a Recharge
   * cooldown here). A returned string is appended to the success toast.
   */
  onActivated?: (ability: AbilityBlock) => string | void
}

/**
 * A per-ability activation override: the hook options an ability activates
 * with, plus an optional way to make one of its trait chips show live state
 * (the GM panel swaps the Recharge trait for its cooldown badge, rather than
 * printing the same information twice).
 *
 * Cards receive a {@link AbilityActivationOverrideResolver} rather than one
 * override so nested sub-abilities can resolve their own; returning null means
 * "this ability gets no Activate button".
 */
export interface AbilityActivationOverride {
  options: AbilityActivationOptions
  /**
   * Renders one authored trait chip's content. Return a node to replace the
   * chip's text, or null/undefined to render the trait exactly as authored.
   * The card supplies the chip itself (each card kind has its own chip style),
   * so a replacement is only the content inside it.
   */
  renderTrait?: (trait: string) => ReactNode
}

/** Resolves the override for one ability (null = no activation at all). */
export type AbilityActivationOverrideResolver = (
  ability: AbilityBlock,
) => AbilityActivationOverride | null

export interface AbilityActivationPlan {
  /** Every cost the activation deducts, already exhaustion-adjusted. */
  apCost: number
  endCost: number
  fpCost: number
  customCosts: ReturnType<typeof resolveCustomAbilityCosts>
  /** AP / END / FP / custom bars can cover the activation. */
  canAfford: boolean
  /** The ability still has uses left (always true when unlimited). */
  canUse: boolean
  /** Affordability *and* remaining uses *and* no external block. */
  canActivate: boolean
  /** Hover text: why the button is blocked, or what activation spends. */
  tooltip: string
  /** Click handler: deducts the costs, then consumes a use when configured to. */
  activate: () => void
}

/**
 * @param ability The ability being activated.
 * @param character The entity the costs come from — the store's current
 *   character on the sheet pages, or a GM panel's own entity.
 * @param options Resource adapter / external block / post-activation hook for
 *   entities the character store does not own (GM Screen NPC instances).
 */
export function useAbilityActivation(
  ability: AbilityBlock,
  character: Character,
  options: AbilityActivationOptions = {},
): AbilityActivationPlan {
  const storeSpendAP = useCharacterStore((s) => s.spendAP)
  const storeSpendEND = useCharacterStore((s) => s.spendEND)
  const storeSpendFP = useCharacterStore((s) => s.spendFP)
  const storeSpendCustomResourceBar = useCharacterStore(
    (s) => s.spendCustomResourceBar,
  )
  const storeSpendAbilityUse = useCharacterStore((s) => s.spendAbilityUse)
  const { notify } = useNotification()

  const { resources: overrideResources, blockedReason, onActivated } = options

  // The sheet's own resources. Memoized on the character record (which the
  // store replaces on every write) so `activate` stays stable between renders;
  // the GM panel's adapter arrives fully formed instead.
  const defaultResources = useMemo<AbilityActivationResources>(
    () => ({
      ap: character.currentAP,
      end: character.currentEND,
      fp: character.currentFP,
      customBars: character.customResourceBars ?? [],
      spendAP: (amount) => storeSpendAP(character.id, amount),
      spendEND: (amount) => storeSpendEND(character.id, amount),
      spendFP: (amount) => storeSpendFP(character.id, amount),
      spendCustom: (barId, amount) =>
        storeSpendCustomResourceBar(character.id, barId, amount),
      spendUse: () => storeSpendAbilityUse(character.id, ability.id),
    }),
    [
      character,
      ability.id,
      storeSpendAP,
      storeSpendEND,
      storeSpendFP,
      storeSpendCustomResourceBar,
      storeSpendAbilityUse,
    ],
  )
  const resources: AbilityActivationResources =
    overrideResources ?? defaultResources
  const { customBars } = resources
  const tracksEND = resources.end != null
  const tracksFP = resources.fp != null

  // Exhaustion: every END cost is 1 higher.
  const exhaustionMod = character.mortalWounds.includes('Exhaustion') ? 1 : 0
  const apCost = ability.cost.ap ?? 0
  const endCost =
    (ability.cost.end ?? 0) + (ability.cost.end != null ? exhaustionMod : 0)
  const fpCost = ability.cost.fp ?? 0

  // Custom resource costs resolve against this entity's own bars. Memoized
  // so the activation callback stays stable across renders.
  const customCosts = useMemo(
    () => resolveCustomAbilityCosts(ability.cost.custom, customBars),
    [ability.cost.custom, customBars],
  )

  const canAfford =
    resources.ap >= apCost &&
    (!tracksEND || (resources.end as number) >= endCost) &&
    (!tracksFP || (resources.fp as number) >= fpCost) &&
    canAffordCustomCosts(customCosts, customBars)

  const canUse = hasUsesRemaining(ability)

  const blocked = blockedReason?.trim() ? blockedReason.trim() : null

  const insufficientParts: string[] = []
  if (resources.ap < apCost)
    insufficientParts.push(`${apCost - resources.ap} AP`)
  if (tracksEND && (resources.end as number) < endCost)
    insufficientParts.push(`${endCost - (resources.end as number)} END`)
  if (tracksFP && (resources.fp as number) < fpCost)
    insufficientParts.push(`${fpCost - (resources.fp as number)} FP`)
  insufficientParts.push(...insufficientCustomCostParts(customCosts, customBars))

  const name = ability.name || 'Untitled Ability'
  const spendsUse = expendsUseOnActivate(ability)

  let tooltip: string
  if (!canUse) {
    tooltip = `No uses of ${name} remaining — restored on a rest`
  } else if (blocked) {
    tooltip = blocked
  } else if (insufficientParts.length > 0) {
    tooltip = `Need ${insufficientParts.join(', ')}`
  } else {
    // Untracked pools (an NPC panel's END/FP) are left out rather than
    // advertised as a cost that will never be deducted.
    const costs = [`${apCost} AP`]
    if (tracksEND) costs.push(`${endCost} END`)
    if (tracksFP) costs.push(`${fpCost} FP`)
    tooltip = `Activate: ${costs.join(', ')}`
    if (spendsUse) tooltip += ' · spends 1 use'
  }

  const activate = useCallback(() => {
    // Uses are checked first: a limited ability at 0 must not burn resources
    // on an activation that cannot happen.
    if (!hasUsesRemaining(ability)) {
      notify(`No uses of ${name} remaining.`, 'error')
      return
    }
    // A disabled button cannot be clicked, but the plan is also called from
    // places that do not render one — never let a blocked ability through.
    if (blocked) {
      notify(blocked, 'error')
      return
    }
    // Deduct costs (order matters: check all first, then deduct).
    let ok = true
    if (apCost > 0) ok = resources.spendAP(apCost) && ok
    if (tracksEND && endCost > 0) ok = resources.spendEND(endCost) && ok
    if (tracksFP && fpCost > 0) ok = resources.spendFP(fpCost) && ok
    for (const c of customCosts) {
      ok = resources.spendCustom(c.barId, c.amount) && ok
    }

    if (!ok) {
      notify('Insufficient resources to activate ability.', 'error')
      return
    }

    // Only a successful activation consumes a use, and only when the editor
    // opted this ability into the use economy. `spendUse` reports what
    // actually happened, so the toast never claims a use was spent when the
    // ability is unlimited or opted out.
    const spentUse = resources.spendUse()
    // The caller's post-activation step (a Recharge cooldown on GM panels) can
    // add its own note to the same toast.
    const note = onActivated?.(ability)
    const extras: string[] = []
    if (spentUse) extras.push('1 use spent')
    if (typeof note === 'string' && note) extras.push(note)
    notify(
      extras.length
        ? `Activated ${name} (${extras.join(' · ')})`
        : `Activated ${name}`,
      'success',
    )
  }, [
    ability,
    name,
    apCost,
    endCost,
    fpCost,
    tracksEND,
    tracksFP,
    customCosts,
    resources,
    blocked,
    onActivated,
    notify,
  ])

  return {
    apCost,
    endCost,
    fpCost,
    customCosts,
    canAfford,
    canUse,
    canActivate: canAfford && canUse && !blocked,
    tooltip,
    activate,
  }
}
