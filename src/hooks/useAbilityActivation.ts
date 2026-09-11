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
 */

import { useCallback, useMemo } from 'react'

import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import {
  canAffordCustomCosts,
  insufficientCustomCostParts,
  resolveCustomAbilityCosts,
} from '@/lib/abilityCosts'
import { expendsUseOnActivate, hasUsesRemaining } from '@/lib/abilityUses'
import type { AbilityBlock, Character } from '@/types'

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
  /** Affordability *and* remaining uses — what the button's disabled state reads. */
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
 */
export function useAbilityActivation(
  ability: AbilityBlock,
  character: Character,
): AbilityActivationPlan {
  const spendAP = useCharacterStore((s) => s.spendAP)
  const spendEND = useCharacterStore((s) => s.spendEND)
  const spendFP = useCharacterStore((s) => s.spendFP)
  const spendCustomResourceBar = useCharacterStore(
    (s) => s.spendCustomResourceBar,
  )
  const spendAbilityUse = useCharacterStore((s) => s.spendAbilityUse)
  const { notify } = useNotification()

  // Exhaustion: every END cost is 1 higher.
  const exhaustionMod = character.mortalWounds.includes('Exhaustion') ? 1 : 0
  const apCost = ability.cost.ap ?? 0
  const endCost =
    (ability.cost.end ?? 0) + (ability.cost.end != null ? exhaustionMod : 0)
  const fpCost = ability.cost.fp ?? 0

  // Custom resource costs resolve against this character's own bars. Memoized
  // so the activation callback stays stable across renders.
  const customCosts = useMemo(
    () =>
      resolveCustomAbilityCosts(
        ability.cost.custom,
        character.customResourceBars,
      ),
    [ability.cost.custom, character.customResourceBars],
  )

  const canAfford =
    character.currentAP >= apCost &&
    character.currentEND >= endCost &&
    character.currentFP >= fpCost &&
    canAffordCustomCosts(customCosts, character.customResourceBars)

  const canUse = hasUsesRemaining(ability)

  const insufficientParts: string[] = []
  if (character.currentAP < apCost)
    insufficientParts.push(`${apCost - character.currentAP} AP`)
  if (character.currentEND < endCost)
    insufficientParts.push(`${endCost - character.currentEND} END`)
  if (character.currentFP < fpCost)
    insufficientParts.push(`${fpCost - character.currentFP} FP`)
  insufficientParts.push(
    ...insufficientCustomCostParts(customCosts, character.customResourceBars),
  )

  const name = ability.name || 'Untitled Ability'
  const spendsUse = expendsUseOnActivate(ability)

  let tooltip: string
  if (!canUse) {
    tooltip = `No uses of ${name} remaining — restored on a rest`
  } else if (insufficientParts.length > 0) {
    tooltip = `Need ${insufficientParts.join(', ')}`
  } else {
    tooltip = `Activate: ${apCost} AP, ${endCost} END, ${fpCost} FP`
    if (spendsUse) tooltip += ' · spends 1 use'
  }

  const activate = useCallback(() => {
    // Uses are checked first: a limited ability at 0 must not burn resources
    // on an activation that cannot happen.
    if (!hasUsesRemaining(ability)) {
      notify(`No uses of ${name} remaining.`, 'error')
      return
    }
    // Deduct costs (order matters: check all first, then deduct).
    let ok = true
    if (apCost > 0) ok = spendAP(character.id, apCost) && ok
    if (endCost > 0) ok = spendEND(character.id, endCost) && ok
    if (fpCost > 0) ok = spendFP(character.id, fpCost) && ok
    for (const c of customCosts) {
      ok = spendCustomResourceBar(character.id, c.barId, c.amount) && ok
    }

    if (!ok) {
      notify('Insufficient resources to activate ability.', 'error')
      return
    }

    // Only a successful activation consumes a use, and only when the editor
    // opted this ability into the use economy. `spendAbilityUse` reports what
    // actually happened, so the toast never claims a use was spent when the
    // ability is unlimited or opted out.
    const spentUse = spendAbilityUse(character.id, ability.id)
    notify(
      spentUse ? `Activated ${name} (1 use spent)` : `Activated ${name}`,
      'success',
    )
  }, [
    ability,
    name,
    apCost,
    endCost,
    fpCost,
    customCosts,
    character.id,
    spendAP,
    spendEND,
    spendFP,
    spendCustomResourceBar,
    spendAbilityUse,
    notify,
    spendsUse,
  ])

  return {
    apCost,
    endCost,
    fpCost,
    customCosts,
    canAfford,
    canUse,
    canActivate: canAfford && canUse,
    tooltip,
    activate,
  }
}
