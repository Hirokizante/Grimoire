/**
 * FilterDropdown — a reusable multi-select filter panel for list pages.
 *
 * Renders a "Filter" button with a count badge. Clicking opens a dropdown
 * panel containing grouped checkbox lists. Click-outside closes the panel.
 * The parent owns the selected state and filtering logic — this component
 * is purely presentational.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Filter, X } from 'lucide-react'

export interface FilterOption {
  /** Display label. */
  label: string
  /** Unique value within the group. */
  value: string
}

export interface FilterGroup {
  /** Unique group identifier. */
  id: string
  /** Section heading shown above the options. */
  title: string
  /** Selectable options in this group. */
  options: FilterOption[]
}

export interface FilterDropdownProps {
  /** Ordered groups of filter options. */
  groups: FilterGroup[]
  /** Map of groupId → set of selected option values. */
  selected: Record<string, Set<string>>
  /** Toggle a single option on/off. */
  onToggle: (groupId: string, value: string) => void
  /** Clear every selection across all groups. */
  onClear: () => void
}

/** Count total active filters across all groups. */
function countSelected(selected: Record<string, Set<string>>): number {
  let n = 0
  for (const key of Object.keys(selected)) {
    n += selected[key].size
  }
  return n
}

export default function FilterDropdown({
  groups,
  selected,
  onToggle,
  onClear,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click-outside.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const activeCount = countSelected(selected)
  const hasGroups = groups.some((g) => g.options.length > 0)

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <button
        type="button"
        className={
          'btn page-head__btn filter-dropdown__btn' +
          (open ? ' filter-dropdown__btn--active' : '') +
          (activeCount > 0 ? ' filter-dropdown__btn--has-filters' : '')
        }
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <Filter size={14} />
        <span className="page-head__btn-label">Filter</span>
        {activeCount > 0 && (
          <span className="filter-dropdown__badge">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="filter-dropdown__panel" role="dialog" aria-label="Filters">
          <div className="filter-dropdown__header">
            <span className="filter-dropdown__title">Filters</span>
            <button
              type="button"
              className="btn btn--icon filter-dropdown__close"
              aria-label="Close filters"
              onClick={() => setOpen(false)}
            >
              <X size={15} />
            </button>
          </div>

          <div className="filter-dropdown__body">
            {!hasGroups ? (
              <p className="filter-dropdown__empty muted">No filters available.</p>
            ) : (
              groups.map((group) => {
                if (group.options.length === 0) return null
                const groupSelected = selected[group.id] ?? new Set<string>()
                return (
                  <div key={group.id} className="filter-dropdown__group">
                    <span className="filter-dropdown__group-title">
                      {group.title}
                    </span>
                    <ul className="filter-dropdown__options" role="list">
                      {group.options.map((opt) => {
                        const isChecked = groupSelected.has(opt.value)
                        return (
                          <li key={opt.value}>
                            <label className="filter-dropdown__option">
                              <input
                                type="checkbox"
                                className="filter-dropdown__checkbox"
                                checked={isChecked}
                                onChange={() => onToggle(group.id, opt.value)}
                              />
                              <span className="filter-dropdown__checkmark">
                                {isChecked && <Check size={12} strokeWidth={3} />}
                              </span>
                              <span className="filter-dropdown__option-label">
                                {opt.label}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })
            )}
          </div>

          {hasGroups && activeCount > 0 && (
            <div className="filter-dropdown__footer">
              <button
                type="button"
                className="btn btn--ghost filter-dropdown__clear"
                onClick={onClear}
              >
                Clear all
              </button>
              <button
                type="button"
                className="btn btn--primary filter-dropdown__done"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
