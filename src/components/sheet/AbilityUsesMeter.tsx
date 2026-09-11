/**
 * AbilityUsesMeter — the remaining-uses readout on an ability card.
 *
 * Rendered only for abilities flagged as limited in the editor. Two display
 * modes, switched on the *maximum* number of uses:
 *
 *   - 5 or fewer → one token (circle) per use: filled = still available,
 *     hollow = spent, so the row empties as the ability is used.
 *   - 6 or more → a compact `current / max` number, because a long row of
 *     tokens stops reading as a count.
 *
 * Purely presentational: uses are spent by the Activate button (see
 * useAbilityActivation) and restored on a full restore. The whole readout
 * carries a single accessible label so a screen reader announces the count
 * once instead of reading a row of anonymous dots.
 */

import {
  MAX_TOKEN_USES,
  abilityUses,
  expendsUseOnActivate,
} from '@/lib/abilityUses'
import type { AbilityBlock } from '@/types'

export interface AbilityUsesMeterProps {
  ability: AbilityBlock
  /** Extra classes (spacing differs between cards and sub-ability blocks). */
  className?: string
}

export default function AbilityUsesMeter({
  ability,
  className,
}: AbilityUsesMeterProps) {
  const uses = abilityUses(ability)
  if (!uses) return null

  const { max, current } = uses
  const name = ability.name || 'Untitled Ability'
  const depleted = current === 0

  // Explain the toggle's choice on hover — without it, "8/8 uses" staying put
  // after activating reads like a bug.
  const hint = expendsUseOnActivate(ability)
    ? `Restored on a rest. Activating ${name} uses one.`
    : `Restored on a rest. Activating ${name} does not use one.`

  return (
    <span
      className={
        'ability-uses' +
        (depleted ? ' ability-uses--depleted' : '') +
        (className ? ` ${className}` : '')
      }
      role="img"
      aria-label={`${current} of ${max} uses remaining`}
      title={hint}
    >
      <span className="ability-uses__label" aria-hidden="true">
        Uses
      </span>
      {max <= MAX_TOKEN_USES ? (
        <span className="ability-uses__tokens" aria-hidden="true">
          {Array.from({ length: max }, (_, i) => (
            <span
              key={i}
              className={
                'ability-uses__token' +
                (i < current ? ' ability-uses__token--filled' : '')
              }
            />
          ))}
        </span>
      ) : (
        <span className="ability-uses__count" aria-hidden="true">
          {current}
          <span className="ability-uses__count-sep">/</span>
          {max}
        </span>
      )}
    </span>
  )
}
