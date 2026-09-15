/**
 * CustomAttributeModal — the "Add Attribute" / "Edit Attribute" dialog for a
 * sheet's custom attributes.
 *
 * Collects the four things a custom attribute is: a name, a value, an optional
 * shorthand (the short token used in dice notation, the way Martial is
 * abbreviated MAR), and whether view mode should offer +/− steppers for it.
 * Wrapped in the same modal-overlay pattern as every other sheet dialog.
 *
 * Without an `attribute` prop it acts as the "Add Attribute" dialog; with one,
 * the form is prefilled with that attribute's values and saving updates it in
 * place ("Edit Attribute"), with an extra Delete button that asks the caller to
 * confirm removal.
 */

import { useEffect, useState } from 'react'

import { generateId } from '@/constants/gameData'
import { useModalDialog } from '@/hooks/useModalDialog'
import type { CustomAttribute } from '@/types'

export interface CustomAttributeModalProps {
  /** Whether the modal is currently open. */
  open: boolean
  /**
   * The attribute being edited. When provided the modal runs in edit mode,
   * prefilled with this attribute's values; when omitted it runs in add mode.
   */
  attribute?: CustomAttribute
  /**
   * Called with the resulting CustomAttribute when the user confirms: a
   * brand-new attribute in add mode, or an updated copy (same id) in edit mode.
   */
  onSave: (attribute: CustomAttribute) => void
  /** Called when the user clicks Delete (edit mode only). */
  onDelete?: () => void
  /** Called when the user closes the modal (Esc, overlay, cancel). */
  onClose: () => void
}

export default function CustomAttributeModal({
  open,
  attribute,
  onSave,
  onDelete,
  onClose,
}: CustomAttributeModalProps) {
  const [name, setName] = useState('')
  const [valueStr, setValueStr] = useState('0')
  const [shorthand, setShorthand] = useState('')
  const [showSteppers, setShowSteppers] = useState(false)

  // Sync the form every time the modal opens: edit mode prefills the target
  // attribute's values, add mode starts fresh. `open` is a dependency so
  // reopening the same attribute (or cancelling and re-adding) re-syncs.
  useEffect(() => {
    if (attribute) {
      setName(attribute.name)
      setValueStr(String(attribute.value))
      setShorthand(attribute.shorthand)
      setShowSteppers(attribute.showSteppers)
    } else {
      setName('')
      setValueStr('0')
      setShorthand('')
      setShowSteppers(false)
    }
  }, [attribute, open])

  const dialogRef = useModalDialog(onClose, open)

  if (!open) return null

  const isEditing = attribute != null
  const trimmedName = name.trim()
  const trimmedShorthand = shorthand.trim()

  /**
   * The token the strip will print on top and dice notation will accept. The
   * full name stands in when no shorthand was given, so the preview always
   * shows what a roll would look like.
   */
  const notationToken = trimmedShorthand || trimmedName || 'FOO'

  const parsedValue = Number(valueStr)
  const value = Number.isFinite(parsedValue) ? Math.round(parsedValue) : 0

  const handleSave = () => {
    const base: CustomAttribute = {
      id: attribute?.id ?? generateId(),
      name: trimmedName || 'Attribute',
      value,
      shorthand: trimmedShorthand,
      showSteppers,
    }
    onSave(base)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content custom-attribute-modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Edit Attribute' : 'Add Attribute'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Attribute' : 'Add Attribute'}</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="custom-attribute-modal__body">
          <label className="ability-editor__field">
            <span className="ability-editor__label">Name</span>
            <input
              type="text"
              className="sheet-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Martial, Sanity, Honor"
              autoFocus
            />
          </label>

          <label className="ability-editor__field">
            <span className="ability-editor__label">Value</span>
            <input
              type="number"
              className="sheet-input sheet-input--num"
              step={1}
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
            />
          </label>

          <label className="ability-editor__field">
            <span className="ability-editor__label">Shorthand (optional)</span>
            <input
              type="text"
              className="sheet-input custom-attribute-modal__shorthand"
              value={shorthand}
              onChange={(e) => setShorthand(e.target.value)}
              placeholder="e.g. MAR"
              maxLength={12}
            />
          </label>

          <p className="custom-attribute-modal__hint">
            Roll it by name in any dice notation —{' '}
            <code>2d6+{notationToken}</code> adds this attribute's value to the
            roll. The shorthand is the short form (Martial → MAR) and is used
            wherever the name fits too.
          </p>

          <label className="ability-editor__field ability-editor__field--inline">
            <input
              type="checkbox"
              checked={showSteppers}
              onChange={(e) => setShowSteppers(e.target.checked)}
            />
            <span className="ability-editor__label">
              Show +/− steppers in view mode
            </span>
          </label>

          <div className="ability-editor__actions">
            {isEditing && onDelete && (
              <button
                type="button"
                className="btn btn--danger ability-editor__btn custom-attribute-modal__delete"
                onClick={onDelete}
              >
                Delete Attribute
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
              disabled={trimmedName === ''}
              title={trimmedName === '' ? 'Give the attribute a name first' : undefined}
            >
              {isEditing ? 'Save' : 'Add Attribute'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
