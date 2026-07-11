/**
 * CoreAbilitySection — the heart of the sheet (DESIGN.md "Core Ability").
 *
 * Renders, in order:
 *   1. The Innate narrative description (free-form prose).
 *   2. The optional Innate Ability as an AbilityBlockCard.
 *   3. The Basic Attack as an AbilityBlockCard.
 *   4. The Fatebreaker ultimate as an AbilityBlockCard.
 */

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import type { AbilityBlock } from '@/types'

export interface CoreAbilitySectionProps {
  innateDescription: string
  innateAbility: AbilityBlock | null
  basicAttack: AbilityBlock
  fatebreaker: AbilityBlock
}

export default function CoreAbilitySection({
  innateDescription,
  innateAbility,
  basicAttack,
  fatebreaker,
}: CoreAbilitySectionProps) {
  const hasContent =
    innateDescription !== '' || innateAbility !== null

  return (
    <section className="sheet-section sheet-section--core">
      <h3 className="sheet-section__heading">Core Ability</h3>

      {!hasContent && (
        <p className="sheet-section__empty muted">
          No core ability defined yet.
        </p>
      )}

      {innateDescription && (
        <div className="core-innate">
          <span className="core-innate__label">Innate</span>
          <p className="core-innate__text">{innateDescription}</p>
        </div>
      )}

      <div className="ability-grid ability-grid--core">
        {innateAbility && <AbilityBlockCard ability={innateAbility} />}
        <AbilityBlockCard ability={basicAttack} />
        <AbilityBlockCard ability={fatebreaker} />
      </div>
    </section>
  )
}