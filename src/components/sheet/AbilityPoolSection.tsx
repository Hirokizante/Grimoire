/**
 * AbilityPoolSection — inactive abilities available to swap into slots before
 * an encounter (DESIGN.md "Ability Pool"). There is no limit on the number of
 * abilities in the pool; each is rendered as an {@link AbilityBlockCard}.
 */

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import type { AbilityBlock } from '@/types'

export interface AbilityPoolSectionProps {
  abilities: AbilityBlock[]
}

export default function AbilityPoolSection({
  abilities,
}: AbilityPoolSectionProps) {
  return (
    <section className="sheet-section sheet-section--pool">
      <h3 className="sheet-section__heading">Ability Pool</h3>

      {abilities.length === 0 ? (
        <p className="sheet-section__empty muted">
          The ability pool is empty.
        </p>
      ) : (
        <div className="ability-grid">
          {abilities.map((ability) => (
            <AbilityBlockCard key={ability.id} ability={ability} />
          ))}
        </div>
      )}
    </section>
  )
}