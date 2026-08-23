/**
 * CreateStatusModal — a styled modal for naming a new status condition.
 *
 * Mirrors CreateCharacterModal. After the name is confirmed, the parent
 * creates the (blank) status and opens it in the StatusModal editor so the
 * description and icon can be filled in.
 */

import { useEffect, useRef, useState } from 'react'
import { useModalDialog } from '@/hooks/useModalDialog'

export interface CreateStatusModalProps {
  /** Called with the non-empty name on confirm. */
  onCreate: (name: string) => void
  /** Called on cancel (Esc, overlay, or close button). */
  onClose: () => void
}

export default function CreateStatusModal({
  onCreate,
  onClose,
}: CreateStatusModalProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const dialogRef = useModalDialog(onClose)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content create-status-modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Create new status"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>New Status</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="create-status-modal__body">
            <label className="create-status-modal__field">
              <span className="create-status-modal__label">Status Name</span>
              <input
                ref={inputRef}
                type="text"
                className="sheet-input"
                placeholder="Enter a name…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
              />
            </label>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!name.trim()}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
