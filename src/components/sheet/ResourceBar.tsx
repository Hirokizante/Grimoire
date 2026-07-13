/**
 * ResourceBar — a unified segmented bar with inline +/− controls.
 *
 * Replaces the old pattern of a SegmentedBar followed by a separate
 * ResourceTracker row. The bar label and current/max value are shown above
 * the track, and +/− buttons flank the bar itself so players can spend or
 * restore resources directly.
 *
 * In edit mode the buttons are hidden (edit mode is for building the sheet,
 * not playing). An optional `onLabelClick` callback makes the label area
 * clickable (used by HP to open the DamageDialog).
 */

import SegmentedBar from '@/components/ui/SegmentedBar'

export interface ResourceBarProps {
  /** Human-readable label shown above the bar. */
  label: string
  /** Current value (filled segments count). */
  value: number
  /** Maximum value (total segments count). */
  max: number
  /** CSS color for filled segments (e.g. a CSS var or hex). */
  color: string
  /** Spend 1 resource (− button). Disabled when value ≤ 0. */
  onSpend?: () => void
  /** Restore 1 resource (+ button). Disabled when value ≥ max. */
  onRestore?: () => void
  /** Optional: make the label area clickable (e.g. HP → DamageDialog). */
  onLabelClick?: () => void
  /** Whether to show +/− buttons (hidden in edit mode). */
  interactive?: boolean
  /** Optional: tooltip for the label area. */
  labelTitle?: string
}

export default function ResourceBar({
  label,
  value,
  max,
  color,
  onSpend,
  onRestore,
  onLabelClick,
  interactive = false,
  labelTitle,
}: ResourceBarProps) {
  const canSpend = onSpend && value > 0
  const canRestore = onRestore && value < max

  return (
    <div className="resource-bar">
      <div
        className={
          'resource-bar__head' +
          (onLabelClick ? ' resource-bar__head--clickable' : '')
        }
        onClick={onLabelClick}
        role={onLabelClick ? 'button' : undefined}
        title={labelTitle}
      >
        <span className="resource-bar__label">{label}</span>
        <span className="resource-bar__value">
          {value}
          <span className="resource-bar__max"> / {max}</span>
        </span>
      </div>
      <div className="resource-bar__body">
        {interactive && (
          <button
            type="button"
            className="btn btn--ghost resource-bar__btn"
            onClick={onSpend}
            disabled={!canSpend}
            aria-label={`Spend ${label}`}
          >
            −
          </button>
        )}
        <div className="resource-bar__track-wrap">
          <SegmentedBar
            label=""
            value={value}
            max={max}
            color={color}
          />
        </div>
        {interactive && (
          <button
            type="button"
            className="btn btn--ghost resource-bar__btn"
            onClick={onRestore}
            disabled={!canRestore}
            aria-label={`Restore ${label}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}
