/**
 * Cloning AbilityBlocks for duplication and paste.
 *
 * A copy is a **new block**, never a second reference to the same one: the
 * block is deep-cloned (`structuredClone`) and every id in the tree is
 * regenerated — the block's own and both sub-ability lists' — so two cards can
 * never share a dnd-kit id or a React key, and no array or object is shared
 * between the two blocks. Live-play state does not travel either: the uses
 * budget starts full and every modifier switch starts off, because that state
 * belongs to the block it was copied from (two copies sharing a half-spent
 * budget, or one modifier effect counted twice, would both be wrong).
 *
 * Everything authored does travel: name, traits, costs, damage, text,
 * modifiers, activation rolls, sub-abilities, and a sub-ability's colour
 * override.
 *
 * Custom costs keep pointing at the **source** sheet's resource-bar ids. A bar
 * the pasting sheet does not define is simply not shown (see
 * `resolveCustomAbilityCosts`), exactly as it would be after an import.
 */

import { generateId } from '@/constants/gameData'
import { normalizeAbilityUses } from '@/lib/abilityUses'
import type { AbilityBlock } from '@/types'

/**
 * Regenerate a freshly-cloned block's ids and reset its live-play state. Mutates
 * `ability` — which is only ever the throwaway clone, never the source.
 */
function reidentify(ability: AbilityBlock): AbilityBlock {
  const uses = normalizeAbilityUses(ability.uses)
  ability.id = generateId()
  ability.modifiersActive = false
  if (uses) {
    // The authored limit travels; the spent count is re-seeded to full.
    ability.uses = { ...uses, current: uses.max }
  } else {
    // A malformed entry reads as unlimited, so the copy stores no budget.
    delete ability.uses
  }
  ability.subAbilitiesUnderDescription = (
    ability.subAbilitiesUnderDescription ?? []
  ).map(reidentify)
  ability.subAbilitiesUnderOvercharge = (
    ability.subAbilitiesUnderOvercharge ?? []
  ).map(reidentify)
  return ability
}

/**
 * A copy of `ability` with fresh ids everywhere, live-play state reset
 * (`uses.current` back to its maximum, `modifiersActive` off), and no shared
 * structure: editing either block afterwards cannot reach the other. `ability`
 * itself is never mutated.
 */
export function cloneAbilityBlock(ability: AbilityBlock): AbilityBlock {
  return reidentify(structuredClone(ability))
}
