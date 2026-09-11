/**
 * PanelStepper — the square −/+ control every resource bar in a GM panel uses.
 *
 * One component for HP and for an NPC instance's Action Points is what keeps
 * the two bars identical: the same lucide glyph, the same 1.75rem box, the same
 * flex centring, the same hover/disabled treatment. They had drifted apart —
 * the HP steppers were typed "−"/"+" text glyphs whose ink sits wherever the
 * font's metrics put it (visibly high in their box), while the AP meter
 * borrowed the sheet's `.resource-bar__btn` and sat next to the bar instead of
 * in line with it. A vector glyph in a flex-centred box cannot drift.
 *
 * Layout is the caller's job: both bars put `spend` to the LEFT of the track
 * and `restore` to the RIGHT (see `.gm-bar__controls`).
 */

import { Minus, Plus } from 'lucide-react'

export interface PanelStepperProps {
  /** Which end of the bar this control is: `spend` renders −, `restore` renders +. */
  direction: 'spend' | 'restore'
  onClick: () => void
  /** Accessible name, e.g. "Deal 1 damage to Bandit" / "Spend Action Points". */
  label: string
  /** Tooltip. Defaults to the accessible name. */
  title?: string
  disabled?: boolean
}

export default function PanelStepper({
  direction,
  onClick,
  label,
  title,
  disabled = false,
}: PanelStepperProps) {
  const Icon = direction === 'spend' ? Minus : Plus
  return (
    <button
      type="button"
      className="btn btn--icon gm-step"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
    >
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
    </button>
  )
}
