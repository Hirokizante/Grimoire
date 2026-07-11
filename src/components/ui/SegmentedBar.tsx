/**
 * SegmentedBar — a row of filled/empty segments used to visualize a resource
 * pool such as HP, Fate Points, Action Points, or Endurance (DESIGN.md,
 * "UI/UX": "Prioritize using interactive segmented bars over plain number
 * displays").
 */

export interface SegmentedBarProps {
  /** Current value (filled segments count). */
  value: number
  /** Maximum value (total segments count). */
  max: number
  /** CSS color for filled segments (e.g. a CSS var or hex). */
  color: string
  /** Human-readable label shown above the bar. */
  label: string
}

export default function SegmentedBar({
  value,
  max,
  color,
  label,
}: SegmentedBarProps) {
  const total = Math.max(0, max)
  const filled = Math.min(Math.max(0, value), total)

  const segments = Array.from({ length: total }, (_, i) => i < filled)

  return (
    <div className="seg-bar">
      <div className="seg-bar__head">
        <span className="seg-bar__label">{label}</span>
        <span className="seg-bar__value">
          {value}
          <span className="seg-bar__max"> / {max}</span>
        </span>
      </div>
      {total > 0 ? (
        <div
          className="seg-bar__track"
          style={{ '--seg-color': color } as React.CSSProperties}
        >
          {segments.map((isFilled, i) => (
            <span
              key={i}
              className={
                'seg-bar__segment' +
                (isFilled ? ' seg-bar__segment--filled' : '')
              }
            />
          ))}
        </div>
      ) : (
        <div className="seg-bar__track seg-bar__track--empty" />
      )}
    </div>
  )
}