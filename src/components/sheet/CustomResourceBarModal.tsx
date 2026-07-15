/**
 * CustomResourceBarModal — an immersive modal for creating a custom resource
 * bar. Wraps a compact form (name, max, color, recovers toggle) in the same
 * modal-overlay pattern used across the sheet.
 */

import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { generateId } from '@/constants/gameData'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { CustomResourceBar } from '@/types'

/** A sensible default color for fresh bars. */
const DEFAULT_BAR_COLOR = '#7c5fd6'

export interface CustomResourceBarModalProps {
  /** Whether the modal is currently open. */
  open: boolean
  /** Called with the new CustomResourceBar when the user confirms. */
  onSave: (bar: CustomResourceBar) => void
  /** Called when the user closes the modal (Esc, overlay, cancel). */
  onClose: () => void
}

export default function CustomResourceBarModal({
  open,
  onSave,
  onClose,
}: CustomResourceBarModalProps) {
  const [name, setName] = useState('')
  const [maxStr, setMaxStr] = useState('5')
  const [color, setColor] = useState(DEFAULT_BAR_COLOR)
  const [refillsOnRecover, setRefillsOnRecover] = useState(true)
  const [colorOpen, setColorOpen] = useState(false)

  useEscapeKey(onClose, open)

  if (!open) return null

  const handleSave = () => {
    const max = Math.max(1, Number(maxStr) || 1)
    onSave({
      id: generateId(),
      name: name.trim() || 'Resource',
      max,
      current: max,
      color,
      refillsOnRecover,
    })
    // Reset for next open.
    setName('')
    setMaxStr('5')
    setColor(DEFAULT_BAR_COLOR)
    setRefillsOnRecover(true)
    setColorOpen(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content custom-resource-bar-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Resource Bar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Add Resource Bar</h3>
          <button
            type="button"
            className="btn btn--ghost modal-close"
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
            <button
              type="button"
              className="btn btn--primary ability-editor__btn"
              onClick={handleSave}
            >
              Add Bar
            </button>
            <button
              type="button"
              className="btn btn--ghost ability-editor__btn"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
