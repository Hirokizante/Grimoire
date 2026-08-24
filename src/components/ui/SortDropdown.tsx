/**
 * SortDropdown — a single-select sort control for list pages.
 *
 * Mirrors FilterDropdown's look and behavior: a button showing the active
 * sort option next to an icon opens a dropdown panel; clicking an option
 * moves the checkmark. Click-outside and Escape close the panel.
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Check, X } from 'lucide-react'

export interface SortOption {
  /** Unique value (matches the page's sort key). */
  value: string
  /** Display label. */
  label: string
}

export interface SortDropdownProps {
  /** Ordered sort options. */
  options: SortOption[]
  /** Currently selected value. */
  value: string
  /** Select a sort option. */
  onChange: (value: string) => void
  /** Accessible label for the button. */
  label?: string
}

export default function SortDropdown({
  options,
  value,
  onChange,
  label = 'Sort',
}: SortDropdownProps) {
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

  const activeLabel =
    options.find((o) => o.value === value)?.label ?? options[0]?.label ?? ''

  return (
    <div className="sort-dropdown" ref={containerRef}>
      <button
        type="button"
        className={
          'btn page-head__btn sort-dropdown__btn' +
          (open ? ' sort-dropdown__btn--active' : '')
        }
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <ArrowUpDown size={14} />
        <span className="page-head__btn-label">{activeLabel}</span>
      </button>

      {open && (
        <div className="sort-dropdown__panel" role="dialog" aria-label="Sort">
          <div className="sort-dropdown__header">
            <span className="sort-dropdown__title">Sort by</span>
            <button
              type="button"
              className="btn btn--icon sort-dropdown__close"
              aria-label="Close sort menu"
              onClick={() => setOpen(false)}
            >
              <X size={15} />
            </button>
          </div>

          <ul className="sort-dropdown__options" role="list">
            {options.map((opt) => {
              const isActive = opt.value === value
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={
                      'sort-dropdown__option' +
                      (isActive ? ' sort-dropdown__option--active' : '')
                    }
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => onChange(opt.value)}
                  >
                    <span className="sort-dropdown__check">
                      {isActive && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="sort-dropdown__option-label">
                      {opt.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="sort-dropdown__footer">
            <button
              type="button"
              className="btn btn--primary sort-dropdown__done"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}