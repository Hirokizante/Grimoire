/**
 * SectionViewToggle — the compact grid/list switch that sits on the right edge
 * of an ability section's heading row (Slotted Abilities, Ability Pool, custom
 * ability sections, NPC abilities). The list pages render the same control in
 * their page header for the character/NPC galleries.
 *
 * One component, so the four ability sections cannot drift apart: they show the
 * same two buttons, in the same order, with the same active state and the same
 * accessible names.
 *
 * A surface that fixes its view mode — a GM panel body is always a list —
 * simply does not render the toggle (see the sections' `onViewModeChange`).
 */

import { LayoutGrid, List } from 'lucide-react'

export interface SectionViewToggleProps {
  viewMode: 'grid' | 'list'
  onChange: (mode: 'grid' | 'list') => void
  /** Accessible name for the group — e.g. "Slotted abilities view". */
  ariaLabel: string
}

export default function SectionViewToggle({
  viewMode,
  onChange,
  ariaLabel,
}: SectionViewToggleProps) {
  return (
    <div
      className="mode-toggle mode-toggle--compact"
      role="tablist"
      aria-label={ariaLabel}
    >
      <button
        className={
          'mode-toggle__btn' +
          (viewMode === 'grid' ? ' mode-toggle__btn--active' : '')
        }
        type="button"
        role="tab"
        aria-selected={viewMode === 'grid'}
        aria-label="Grid view"
        onClick={() => onChange('grid')}
      >
        <LayoutGrid size={16} />
      </button>
      <button
        className={
          'mode-toggle__btn' +
          (viewMode === 'list' ? ' mode-toggle__btn--active' : '')
        }
        type="button"
        role="tab"
        aria-selected={viewMode === 'list'}
        aria-label="List view"
        onClick={() => onChange('list')}
      >
        <List size={16} />
      </button>
    </div>
  )
}
