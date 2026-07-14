/**
 * ConfirmDeleteModal — a styled confirmation dialog for destructive actions.
 *
 * Replaces the native `window.confirm` in CharacterListPage. Renders a
 * danger-styled warning with Confirm (danger) and Cancel (ghost) buttons.
 * Overlay click or ✕ dismisses as "cancel".
 */

import { useEscapeKey } from '@/hooks/useEscapeKey'

export interface ConfirmDeleteModalProps {
  /** The character/item name being deleted (shown in the message). */
  itemName: string
  /** Called when the user confirms the deletion. */
  onConfirm: () => void
  /** Called when the user cancels (Esc, overlay, or close button). */
  onClose: () => void
}

export default function ConfirmDeleteModal({
  itemName,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  useEscapeKey(onClose)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content confirm-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm deletion"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Delete Character</h3>
        </div>

        <div className="confirm-delete-modal__body">
          <p className="confirm-delete-modal__message">
            Are you sure you want to delete{' '}
            <strong className="confirm-delete-modal__item-name">
              “{itemName}”
            </strong>
            ? This cannot be undone.
          </p>
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
            type="button"
            className="btn btn--danger"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
