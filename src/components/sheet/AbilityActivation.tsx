/**
 * AbilityActivation — wraps an AbilityBlockCard with an "Activate" button
 * in view mode, deducting the ability's AP/END/FP costs from the character.
 *
 * Per DESIGN.md "Automatic Resource Tracking": the player selects what
 * Abilities they want to perform, and the costs are automatically deducted
 * from their AP, END, and FP.
 *
 * Abilities flagged as limited in the editor also spend one of their uses on
 * activation (unless the author switched that off), and a limited ability with
 * no uses left cannot be activated at all. See lib/abilityUses.ts.
 *
 * If the character has insufficient resources — or no uses left — the button is
 * disabled and shows a tooltip explaining why.
 *
 * Exhaustion mortal wound: all END costs are 1 more than usual.
 */

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import { useCharacterStore } from '@/store/characterStore'
import { useAbilityActivation } from '@/hooks/useAbilityActivation'
import type { AbilityBlock, Character } from '@/types'

export interface AbilityActivationProps {
  ability: AbilityBlock
  /**
   * Entity the costs are deducted from and whose stats resolve the cards'
   * dice notation. Defaults to the store's `currentCharacter` (the normal
   * sheet page); GM-screen panels pass their own entity.
   */
  character?: Character
}

/**
 * The activated card itself. Split out so {@link useAbilityActivation} always
 * receives a real character (the page-level wrapper bails out before this
 * mounts) and hooks are never called conditionally.
 */
function ActivatableCard({
  ability,
  character,
}: {
  ability: AbilityBlock
  character: Character
}) {
  const plan = useAbilityActivation(ability, character)

  return (
    <div className="ability-activation">
      <AbilityBlockCard ability={ability} mode="view" character={character} />
      <div className="ability-activation__footer">
        <button
          type="button"
          className="btn btn--primary ability-activation__btn"
          onClick={plan.activate}
          disabled={!plan.canActivate}
          title={plan.tooltip}
        >
          Activate
        </button>
      </div>
    </div>
  )
}

export default function AbilityActivation({
  ability,
  character: explicitCharacter,
}: AbilityActivationProps) {
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const character = explicitCharacter ?? storeCharacter

  if (!character) return null

  // Nothing to activate: render the plain card (no button, no plan needed).
  if (!ability.showActivate) {
    return <AbilityBlockCard ability={ability} mode="view" character={character} />
  }

  return <ActivatableCard ability={ability} character={character} />
}
