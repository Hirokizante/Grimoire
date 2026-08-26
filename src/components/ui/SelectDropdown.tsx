/**
 * SelectDropdown — a generic single-select dropdown for in-sheet pickers.
 *
 * Mirrors the list pages' SortDropdown look and behavior (same panel chrome,
 * checkmark, click-outside + Escape close) so it inherits the sheet's custom
 * color scheme through the shared CSS variables. Purely presentational — the
 * parent owns the selected value. Unlike <select>, this is fully styled by
 * the sheet theme.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  /** Unique value (returned by onSelect). */
  value: string
  /** Display label. */
  label: string
}

export interface SelectDropdownProps {
  /** Ordered options. */
  options: SelectOption[]
  /** Called with the chosen option's value. */
  onSelect: (value: string) => void
  /** Label on the trigger button (e.g. "+ Add Cost"). */
  buttonLabel: string
  /** Title of the dropdown panel. */
  title?: string
  /** Accessible label for the trigger button. */
  ariaLabel?: string
  /** Extra classes for the trigger button (e.g. ability-editor__add-sub-btn). */
  className?: string
}

export default function SelectDropdown({
  options,
  onSelect,
  buttonLabel,
  title = 'Options',
  ariaLabel,
  className = '',
}: SelectDropdownProps) {
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

  return (
    <div className="select-dropdown" ref={containerRef}>
      <button
        type="button"
        className={
          'btn btn--ghost select-dropdown__btn' +
          (open ? ' select-dropdown__btn--active' : '') +
          (className ? ` ${className}` : '')
        }
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={ariaLabel ?? buttonLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {buttonLabel}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="select-dropdown__panel" role="dialog" aria-label={title}>
          <div className="select-dropdown__header">
            <span className="select-dropdown__title">{title}</span>
          </div>
          <ul className="select-dropdown__options" role="list">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  className="select-dropdown__option"
                  onClick={() => {
                    onSelect(opt.value)
                    setOpen(false)
                  }}
                >
                  <span className="select-dropdown__option-label">{opt.label}</span>
                </button>
              </li>
            ))}
            {options.length === 0 && (
              <li>
                <span className="select-dropdown__empty">No options available.</span>
              </li>
            )}
          </ul>
          {options.length > 1 && (
            <div className="select-dropdown__footer">
              <button
                type="button"
                className="btn btn--ghost select-dropdown__done"
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
