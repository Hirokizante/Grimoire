/**
 * SheetLabelPills — renders a sheet's labels as segmented pills.
 *
 * Each label renders as a two-segment capsule: the label NAME on an
 * accent-tinted segment and its optional VALUE on a raised-surface segment
 * beside it. Used on the sheet hero sections and the character/NPC list
 * pages so the same label looks identical everywhere.
 */

import type { SheetLabel } from '@/types'

export interface SheetLabelPillsProps {
  labels: SheetLabel[]
  /** 'md' for sheet hero rows, 'sm' for list-page cards/rows. */
  size?: 'sm' | 'md'
  className?: string
}

export default function SheetLabelPills({
  labels,
  size = 'md',
  className = '',
}: SheetLabelPillsProps) {
  if (labels.length === 0) return null

  return (
    <ul
      className={
        `label-pills label-pills--${size}` + (className ? ` ${className}` : '')
      }
      role="list"
      aria-label="Labels"
    >
      {labels.map((label) => (
        <li key={label.id} className="label-pill">
          <span className="label-pill__name">{label.name}</span>
          {label.value.trim() !== '' && (
            <span className="label-pill__value">{label.value}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
