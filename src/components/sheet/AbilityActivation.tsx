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
 *
 * The GM Screen's NPC instances are not store characters: they pass an
 * {@link AbilityActivationOverrideResolver}, which redirects the costs to the
 * panel's own Action Points, gates the button on the instance's Recharge
 * cooldowns, and renders the cooldown badge. Everything else — the plan, the
 * deduction, the toast — is the same code path the player sheets use.
 */

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import { useCharacterStore } from '@/store/characterStore'
import {
  useAbilityActivation,
  type AbilityActivationOverride,
  type AbilityActivationOverrideResolver,
} from '@/hooks/useAbilityActivation'
import type { AbilityBlock, Character } from '@/types'

export interface AbilityActivationProps {
  ability: AbilityBlock
  /**
   * Entity the costs are deducted from and whose stats resolve the cards'
   * dice notation. Defaults to the store's `currentCharacter` (the normal
   * sheet page); GM-screen panels pass their own entity.
   */
  character?: Character
  /**
   * Per-ability override for entities the character store does not own (GM
   * Screen NPC instances). It is also what gives an ability an Activate button
   * while its own `showActivate` flag is off: a GM panel activates every
   * ability that has a cost, and the flag is not even offered in the NPC
   * editor. Omitted everywhere else, where `showActivate` keeps deciding.
   */
  activateOverride?: AbilityActivationOverrideResolver
}

/**
 * The activated card itself. Split out so {@link useAbilityActivation} always
 * receives a real character (the page-level wrapper bails out before this
 * mounts) and hooks are never called conditionally.
 */
function ActivatableCard({
  ability,
  character,
  override,
  activateOverride,
}: {
  ability: AbilityBlock
  character: Character
  override: AbilityActivationOverride | null
  activateOverride?: AbilityActivationOverrideResolver
}) {
  const plan = useAbilityActivation(ability, character, override?.options)

  return (
    <div className="ability-activation">
      <AbilityBlockCard
        ability={ability}
        mode="view"
        character={character}
        activateOverride={activateOverride}
      />
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
  activateOverride,
}: AbilityActivationProps) {
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const character = explicitCharacter ?? storeCharacter

  if (!character) return null

  const override = activateOverride?.(ability) ?? null

  // A resolver, when present, is the last word on what activates here: it
  // returns an override for every ability that should have a button (a GM panel
  // activates anything with a cost) and null for the rest, so the per-ability
  // `showActivate` flag — which the NPC editor does not even offer — cannot
  // re-enable a button the panel decided against. Without a resolver the flag
  // keeps deciding, exactly as it always has on the sheets.
  const activatable = activateOverride ? override != null : ability.showActivate

  if (!activatable) {
    // Nothing to activate: render the plain card (no button, no plan needed).
    // The resolver still travels with it — a parent may be a plain card while
    // its sub-abilities activate.
    return (
      <AbilityBlockCard
        ability={ability}
        mode="view"
        character={character}
        activateOverride={activateOverride}
      />
    )
  }

  return (
    <ActivatableCard
      ability={ability}
      character={character}
      override={override}
      activateOverride={activateOverride}
    />
  )
}
