/**
 * CustomResourceBarModal — an immersive modal for creating or editing a
 * custom resource bar. Wraps a compact form (name, max, color, recovers
 * toggle) in the same modal-overlay pattern used across the sheet.
 *
 * Without a `bar` prop it acts as the "Add Resource Bar" dialog; with one,
 * the form is prefilled with the bar's values and saving updates it in
 * place ("Edit Resource Bar"), with an extra Delete button that asks the
 * caller to confirm removal.
 */

import { useEffect, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { generateId } from '@/constants/gameData'
import { useModalDialog } from '@/hooks/useModalDialog'
import type { CustomResourceBar } from '@/types'

/** A sensible default color for fresh bars. */
const DEFAULT_BAR_COLOR = '#7c5fd6'

export interface CustomResourceBarModalProps {
  /** Whether the modal is currently open. */
  open: boolean
  /**
   * The bar being edited. When provided the modal runs in edit mode,
   * prefilled with this bar's values; when omitted it runs in add mode.
   */
  bar?: CustomResourceBar
  /**
   * Called with the resulting CustomResourceBar when the user confirms:
   * a brand-new bar in add mode, or an updated copy (same id/current) in
   * edit mode.
   */
  onSave: (bar: CustomResourceBar) => void
  /** Called when the user clicks Delete (edit mode only). */
  onDelete?: () => void
  /** Called when the user closes the modal (Esc, overlay, cancel). */
  onClose: () => void
}

export default function CustomResourceBarModal({
  open,
  bar,
  onSave,
  onDelete,
  onClose,
}: CustomResourceBarModalProps) {
  const [name, setName] = useState('')
  const [maxStr, setMaxStr] = useState('5')
  const [color, setColor] = useState(DEFAULT_BAR_COLOR)
  const [refillsOnRecover, setRefillsOnRecover] = useState(true)
  const [colorOpen, setColorOpen] = useState(false)

  // Sync the form every time the modal opens: edit mode prefills the
  // target bar's values, add mode starts fresh. `open` is a dependency so
  // reopening the same bar (or cancelling and re-adding) re-syncs.
  useEffect(() => {
    if (bar) {
      setName(bar.name)
      setMaxStr(String(bar.max))
      setColor(bar.color)
      setRefillsOnRecover(bar.refillsOnRecover)
    } else {
      setName('')
      setMaxStr('5')
      setColor(DEFAULT_BAR_COLOR)
      setRefillsOnRecover(true)
    }
    setColorOpen(false)
  }, [bar, open])

  const dialogRef = useModalDialog(onClose, open)

  if (!open) return null

  const isEditing = bar != null

  const handleSave = () => {
    const max = Math.max(1, Number(maxStr) || 1)
    if (isEditing) {
      onSave({
        ...bar,
        name: name.trim() || 'Resource',
        max,
        // Keep live-play state in bounds if the max shrank.
        current: Math.min(bar.current, max),
        color,
        refillsOnRecover,
      })
    } else {
      onSave({
        id: generateId(),
        name: name.trim() || 'Resource',
        max,
        current: max,
        color,
        refillsOnRecover,
      })
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content custom-resource-bar-modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Edit Resource Bar' : 'Add Resource Bar'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Resource Bar' : 'Add Resource Bar'}</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="custom-resource-bar-modal__body">
          <label className="ability-editor__field">
            <span className="ability-editor__label">Name</span>
            <input
              type="text"
              className="sheet-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rage, Mana, Ki"
            />
          </label>

          <label className="ability-editor__field">
            <span className="ability-editor__label">Max Value</span>
            <input
              type="number"
              className="sheet-input sheet-input--num"
              min={1}
              value={maxStr}
              onChange={(e) => setMaxStr(e.target.value)}
            />
          </label>

          <label className="ability-editor__field">
            <span className="ability-editor__label">Color</span>
            <div className="customize__swatch-wrap customize__swatch-wrap--inline">
              <button
                type="button"
                className="customize__swatch"
                style={{ backgroundColor: color }}
                onClick={() => setColorOpen((p) => !p)}
                title={`Color: ${color}`}
                aria-label={`Color: ${color}`}
              >
                <span className="customize__swatch-label">Color</span>
              </button>
              <input
                type="text"
                className="customize__hex-input"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {colorOpen && (
                <div className="customize__popover">
                  <HexColorPicker color={color} onChange={setColor} />
                </div>
              )}
            </div>
          </label>

          <label className="ability-editor__field ability-editor__field--inline">
            <input
              type="checkbox"
              checked={refillsOnRecover}
              onChange={(e) => setRefillsOnRecover(e.target.checked)}
            />
            <span className="ability-editor__label">
              Refill to max upon Recovering
            </span>
          </label>

          <div className="ability-editor__actions">
            {isEditing && onDelete && (
              <button
                type="button"
                className="btn btn--danger ability-editor__btn resource-bar-modal__delete"
                onClick={onDelete}
              >
                Delete Bar
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost ability-editor__btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary ability-editor__btn"
              onClick={handleSave}
            >
              {isEditing ? 'Save' : 'Add Bar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}