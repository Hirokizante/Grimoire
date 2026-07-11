/**
 * SlottedAbilitiesSection — the active abilities a character has equipped for
 * an encounter. Shows slot usage (e.g. "3 / 5 slots used") and renders each
 * slotted ability as an {@link AbilityBlockCard}.
 *
 * Minor Abilities occupy half a slot each (DESIGN.md "Minor Abilities"). The
 * slot-counting logic here accounts for that: a regular ability counts as 1
 * slot, a Minor ability counts as 0.5.
 */

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import type { AbilityBlock } from '@/types'

export interface SlottedAbilitiesSectionProps {
  abilities: AbilityBlock[]
  maxSlots: number
}

/** Slots consumed by an ability, counting Minor abilities as half a slot. */
function slotCost(ability: AbilityBlock): number {
  return ability.isMinor ? 0.5 : 1
}

export default function SlottedAbilitiesSection({
  abilities,
  maxSlots,
}: SlottedAbilitiesSectionProps) {
  const used = abilities.reduce((sum, a) => sum + slotCost(a), 0)
  const usedLabel = Number.isInteger(used) ? `${used}` : used.toFixed(1)

  return (
    <section className="sheet-section sheet-section--slotted">
      <div className="sheet-section__heading-row">
        <h3 className="sheet-section__heading">Slotted Abilities</h3>
        <span className="sheet-section__counter">
          {usedLabel} / {maxSlots} slots
        </span>
      </div>

      {abilities.length === 0 ? (
        <p className="sheet-section__empty muted">
          No abilities slotted for this encounter.
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