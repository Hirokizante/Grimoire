/**
 * PanelMeter — a one-line resource meter for the encounter sheet's condensed
 * chrome: `[icon Label n/max track − +]`, all on a single row.
 *
 * The grid panels' meters (PanelHpBar, PanelApBar) stack a label row above a
 * control row, which costs two lines per pool. The encounter view's whole
 * point is density — every pool the GM spends from shares one line here, in
 * the same order the sheet page stacks them. The stepper glyphs, track
 * heights and hover/disabled treatments are the shared panel chrome's
 * (`.gm-step`, `.gm-hp__track`, SegmentedBar), so a meter here reads exactly
 * like its two-line sibling in a grid panel — just not twice as tall.
 *
 * `role="img"` + a spoken label on the track mirrors PanelHpBar: the number
 * is beside it, but the bar is a picture of the same value and must say so.
 */

import type { AppIcon } from '@/components/ui/icons'

import SegmentedBar from '@/components/ui/SegmentedBar'
import PanelStepper from '@/components/gmscreen/PanelStepper'

export interface PanelMeterProps {
  /** The pool's icon (Heart for HP, Sparkles for FP, Zap for AP, ...). */
  icon: AppIcon
  /** Icon color — a hex from the app theme's palette. */
  color: string
  /** Label printed in the row ("HP", "FP", "AP", "END"). */
  label: string
  /** Current value (already clamped by the caller). */
  value: number
  /** Pool maximum. */
  max: number
  /** −1 from the pool. */
  onSpend: () => void
  /** +1 to the pool. */
  onRestore: () => void
  /** Accessible name for the − stepper. */
  spendLabel: string
  /** Accessible name for the + stepper. */
  restoreLabel: string
  /** Tooltip for the track. */
  title?: string
  /**
   * Render a single continuous fill instead of per-point segments — for large
   * pools (HP, END) where one segment per point would overflow the track.
   */
  continuous?: boolean
}

export default function PanelMeter({
  icon: Icon,
  color,
  label,
  value,
  max,
  onSpend,
  onRestore,
  spendLabel,
  restoreLabel,
  title,
  continuous = false,
}: PanelMeterProps) {
  return (
    <div className="gm-meter">
      <Icon
        size={14}
        className="gm-meter__icon"
        style={{ color }}
        aria-hidden="true"
      />
      <span className="gm-bar__label">{label}</span>
      <span className="gm-bar__value">
        {value}
        <span className="gm-bar__max">/{max}</span>
      </span>
      <div
        className="gm-meter__track"
        role="img"
        aria-label={`${value} of ${max} ${label}`}
        title={title}
      >
        <SegmentedBar label="" value={value} max={max} color={color} continuous={continuous} />
      </div>
      <PanelStepper
        direction="spend"
        onClick={onSpend}
        disabled={value <= 0}
        label={spendLabel}
      />
      <PanelStepper
        direction="restore"
        onClick={onRestore}
        disabled={value >= max}
        label={restoreLabel}
      />
    </div>
  )
}
