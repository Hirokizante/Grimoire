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
 * The count is normally moved by the Activate button (see useAbilityActivation)
 * and refilled on a full restore. When the card can persist an adjustment —
 * view mode on a sheet the app owns — a compact **stepper** (− / +) is rendered
 * around the readout so the player can spend or hand back a use by hand
 * (a reaction spent out of turn, a GM-granted refill, a mis-click to undo).
 * The plus button stops at the ability's maximum; the minus stops at zero.
 *
 * The readout carries one accessible label so a screen reader announces the
 * count once instead of reading a row of anonymous dots; the stepper buttons
 * are separately labelled.
 */

import { Minus, Plus } from 'lucide-react'

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
  /**
   * Persist a manual adjustment to the remaining uses. Omitted (or the card is
   * in edit mode) renders the readout without steppers — a control that cannot
   * write must not look clickable.
   */
  onAdjust?: (remaining: number) => void
}

export default function AbilityUsesMeter({
  ability,
  className,
  onAdjust,
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

  const steppers = onAdjust != null

  return (
    <span
      className={
        'ability-uses' +
        (depleted ? ' ability-uses--depleted' : '') +
        (className ? ` ${className}` : '')
      }
      role="group"
      aria-label={`${name} uses`}
    >
      {steppers && (
        <button
          type="button"
          className="btn btn--icon ability-uses__step"
          onClick={() => onAdjust(current - 1)}
          disabled={current <= 0}
          aria-label={`Spend one use of ${name}`}
          title="Spend one use"
        >
          <Minus size={11} aria-hidden="true" />
        </button>
      )}

      <span
        className="ability-uses__value"
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

      {steppers && (
        <button
          type="button"
          className="btn btn--icon ability-uses__step"
          onClick={() => onAdjust(current + 1)}
          disabled={current >= max}
          aria-label={`Restore one use of ${name}`}
          title="Restore one use"
        >
          <Plus size={11} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
