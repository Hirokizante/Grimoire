/**
 * ConfirmModal — a generic, styled confirmation dialog for destructive actions
 * and destructive-dismiss confirmations.
 *
 * Renders a variant-styled overlay with Confirm and Cancel buttons.
 * Overlay click or ✕ dismisses as "cancel". Esc also cancels via useEscapeKey.
 *
 * Used by ExportDialog, TabBar, AbilityPoolSection, SlottedAbilitiesSection,
 * and AbilityEditorModal for consistent confirmation UX.
 */
import { useEscapeKey } from '@/hooks/useEscapeKey'

export type ConfirmVariant = 'danger' | 'warning' | 'info'

export interface ConfirmModalProps {
  /** Title shown in the modal header. */
  title: string
  /** Body message (string or JSX). */
  message: string | React.ReactNode
  /** Label for the confirm button (defaults to "Confirm"). */
  confirmLabel?: string
  /** Label for the cancel button (defaults to "Cancel"). */
  cancelLabel?: string
  /** Visual variant for the confirm button (danger = red). */
  variant?: ConfirmVariant
  /** Called when the user confirms the action. */
  onConfirm: () => void
  /** Called when the user cancels (Esc, overlay, or close button). */
  onClose: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  useEscapeKey(onClose)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content confirm-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
        </div>

        <div className="confirm-delete-modal__body">
          <p className="confirm-delete-modal__message">{message}</p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn btn--${variant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
