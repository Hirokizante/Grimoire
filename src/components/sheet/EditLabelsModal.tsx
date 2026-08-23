/**
 * EditLabelsModal — create, rename, and remove the sheet's labels.
 *
 * Works on a local draft copied from the character when the modal opens;
 * "Done" commits the whole list via onSave (store.setLabels), while the
 * header ✕ / Escape / overlay click dismiss WITHOUT saving. Every
 * dismissable Grimoire modal pairs a quick-dismiss header button with a
 * contextual footer action — they are not redundant.
 */

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { generateId } from '@/constants/gameData'
import { useModalDialog } from '@/hooks/useModalDialog'
import type { SheetLabel } from '@/types'

export interface EditLabelsModalProps {
  /** Current labels on the sheet (copied into a draft on mount). */
  labels: SheetLabel[]
  /** Called with the finalized list when the user confirms with Done. */
  onSave: (labels: SheetLabel[]) => void
  /** Called when the user closes the modal (Esc, overlay, ✕). */
  onClose: () => void
}

/** Hard cap so a sheet can't accumulate an unbounded pill row. */
const MAX_LABELS = 12

export default function EditLabelsModal({
  labels,
  onSave,
  onClose,
}: EditLabelsModalProps) {
  const [draft, setDraft] = useState<SheetLabel[]>(() =>
    labels.map((l) => ({ ...l })),
  )
  const dialogRef = useModalDialog(onClose)

  const updateRow = (id: string, patch: Partial<SheetLabel>) =>
    setDraft((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeRow = (id: string) =>
    setDraft((rows) => rows.filter((r) => r.id !== id))

  const addRow = () => {
    if (draft.length >= MAX_LABELS) return
    setDraft((rows) => [...rows, { id: generateId(), name: '', value: '' }])
  }

  const handleDone = () => {
    // Drop rows with blank names and trim whitespace before committing.
    const cleaned = draft
      .map((r) => ({ ...r, name: r.name.trim(), value: r.value.trim() }))
      .filter((r) => r.name !== '')
    onSave(cleaned)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content edit-labels-modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Labels"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Edit Labels</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="edit-labels-modal__body">
          <p className="edit-labels-modal__hint">
            Labels help you organize sheets. They stay on this device — they
            are never included in exports. A value is optional.
          </p>

          {draft.length === 0 ? (
            <p className="edit-labels-modal__empty muted">
              No labels yet — add one below.
            </p>
          ) : (
            <ul className="edit-labels-modal__list" role="list">
              {draft.map((label) => (
                <li key={label.id} className="edit-labels-modal__row">
                  <input
                    type="text"
                    className="sheet-input edit-labels-modal__name-input"
                    value={label.name}
                    maxLength={24}
                    placeholder="Label"
                    aria-label="Label name"
                    onChange={(e) => updateRow(label.id, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addRow()
                      }
                    }}
                  />
                  <input
                    type="text"
                    className="sheet-input edit-labels-modal__value-input"
                    value={label.value}
                    maxLength={24}
                    placeholder="Value (optional)"
                    aria-label="Label value (optional)"
                    onChange={(e) => updateRow(label.id, { value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addRow()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn--icon edit-labels-modal__delete"
                    onClick={() => removeRow(label.id)}
                    aria-label={`Delete label ${label.name || '(unnamed)'}`}
                    title="Delete label"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="btn btn--ghost edit-labels-modal__add-btn"
            onClick={addRow}
            disabled={draft.length >= MAX_LABELS}
          >
            <Plus size={14} />
            Add Label
          </button>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleDone}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
