/**
 * PanelHpBar — the HP block shared by BOTH kinds of GM Screen panel.
 *
 * A player panel and an NPC instance showed byte-for-byte the same markup with
 * different handlers, which is exactly how two panels drift apart over time.
 * They now render this, so the HP bar reads identically whichever sheet the
 * panel holds (only the numbers and the handlers differ).
 *
 * Layout, top to bottom:
 *   1. the label row — heart, "HP", current/max, the temp-HP pill, and the GM's
 *      tracked-status strip (passed in as `statuses`, since only the panel
 *      knows which screen/panel it belongs to);
 *   2. the control row — `−` on the left of the track, `+` on the right, and the
 *      Damage… dialog trigger after them. The steppers live in line with the
 *      bar they change (they used to sit on a second row under it) and come
 *      from the shared {@link PanelStepper}, so they are the same control as
 *      the AP meter's.
 *
 * The track keeps `role="img"` + a spoken "N of M hit points" label: the number
 * is already next to it, but the bar itself is a picture of the same value and
 * must say so.
 */

import type { ReactNode } from 'react'
import { HeartPulse } from '@/components/ui/icons'

import PanelStepper from '@/components/gmscreen/PanelStepper'

export interface PanelHpBarProps {
  /** Entity name, used in the steppers' accessible names. */
  name: string
  /** Current HP (already clamped at 0 by the caller). */
  hp: number
  /** Maximum HP for this entity (from the sheet, or the NPC base's statblock). */
  maxHP: number
  /** Temporary HP; the pill only appears above 0. */
  tempHP: number
  /** −1 HP. */
  onDamage: () => void
  /** +1 HP. */
  onHeal: () => void
  /** Opens the Damage dialog (armor / resistance / temp HP pipeline). */
  onOpenDamageDialog: () => void
  /** The panel's tracked-status strip, rendered inline with the HP number. */
  statuses?: ReactNode
}

export default function PanelHpBar({
  name,
  hp,
  maxHP,
  tempHP,
  onDamage,
  onHeal,
  onOpenDamageDialog,
  statuses,
}: PanelHpBarProps) {
  const fillPercent = maxHP > 0 ? Math.min(100, (hp / maxHP) * 100) : 0

  return (
    <div className="gm-hp">
      <div className="gm-hp__row">
        <HeartPulse size={14} className="gm-hp__icon" aria-hidden="true" />
        <span className="gm-bar__label">HP</span>
        <span className="gm-bar__value">
          {hp}
          <span className="gm-bar__max">/{maxHP}</span>
        </span>
        {tempHP > 0 && (
          <span className="gm-hp__temp" title="Temporary HP (absorbed first)">
            +{tempHP}
          </span>
        )}
        {statuses}
      </div>
      <div className="gm-bar__controls">
        <PanelStepper
          direction="spend"
          onClick={onDamage}
          label={`Deal 1 damage to ${name}`}
          title="−1 HP"
          // Same rule as the sheet's own bars (and the AP meter): a stepper is
          // disabled exactly when its action would be a no-op.
          disabled={hp <= 0}
        />
        <div
          className="gm-hp__track"
          role="img"
          aria-label={`${hp} of ${maxHP} hit points`}
        >
          <div className="gm-hp__fill" style={{ width: `${fillPercent}%` }} />
        </div>
        <PanelStepper
          direction="restore"
          onClick={onHeal}
          label={`Heal ${name} 1 HP`}
          title="+1 HP"
          disabled={hp >= maxHP}
        />
        <button
          type="button"
          className="btn btn--ghost gm-hp__damage"
          onClick={onOpenDamageDialog}
        >
          Damage…
        </button>
      </div>
    </div>
  )
}
