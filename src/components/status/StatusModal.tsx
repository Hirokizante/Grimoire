/**
 * StatusModal — the global detail/edit modal for a status condition.
 *
 * Opened either from a card in the Status Compendium or from an inline
 * `[StatusName]` reference in a sheet description, both of which drive the
 * store's `modal` state. In view mode it shows the full information; an Edit
 * button switches to an inline editor (name, icon, description) mirroring the
 * AbilityBlockEditor flow. Closing with unsaved changes prompts to discard.
 */

import { useEffect, useState } from 'react'

import ConfirmModal from '@/components/sheet/ConfirmModal'
import MarkdownText from '@/components/ui/MarkdownText'
import StatusIcon from '@/components/status/StatusIcon'
import StatusIconPicker from '@/components/status/StatusIconPicker'
import { useModalDialog } from '@/hooks/useModalDialog'
import { useStatusStore } from '@/store/statusStore'
import { DEFAULT_STATUS_TAG } from '@/types/status'
import type { StatusCondition } from '@/types'

export default function StatusModal() {
  const modal = useStatusStore((s) => s.modal)
  const statuses = useStatusStore((s) => s.statuses)
  const updateStatus = useStatusStore((s) => s.updateStatus)
  const closeStatus = useStatusStore((s) => s.closeStatus)

  const status = modal.statusId
    ? (statuses.find((s) => s.id === modal.statusId) ?? null)
    : null

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<StatusCondition | null>(null)
  const [showDiscard, setShowDiscard] = useState(false)

  // Reset local editor state whenever a different status is opened.
  useEffect(() => {
    if (status) {
      setEditing(modal.startInEdit)
      setDraft({ ...status })
      setShowDiscard(false)
    } else {
      setEditing(false)
      setDraft(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.statusId, modal.startInEdit])

  const open = modal.statusId !== null && status !== null

  const isDirty =
    editing &&
    draft != null &&
    status != null &&
    (draft.name !== status.name ||
      draft.icon !== status.icon ||
      draft.iconType !== status.iconType ||
      draft.description !== status.description)

  const handleClose = () => {
    if (isDirty) {
      setShowDiscard(true)
    } else {
      closeStatus()
    }
  }

  const handleCancelEdit = () => {
    if (isDirty) {
      setShowDiscard(true)
    } else {
      setEditing(false)
      if (status) setDraft({ ...status })
    }
  }

  const handleSave = () => {
    if (!draft || !status) return
    const name = draft.name.trim()
    if (!name) return
    void updateStatus({ ...draft, name })
    setEditing(false)
  }

  const dialogRef = useModalDialog(handleClose, open && !showDiscard)

  if (!open || !status) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content status-modal"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit status' : 'Status details'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{editing ? 'Edit Status' : 'Status'}</h3>
          <button
            type="button"
            className="btn btn--icon modal-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {editing && draft ? (
          <div className="status-modal__body">
            <label className="status-modal__field">
              <span className="status-modal__label">Name</span>
              <input
                type="text"
                className="sheet-input"
                value={draft.name}
                autoFocus
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Enfeebled"
              />
            </label>

            <div className="status-modal__field">
              <span className="status-modal__label">Icon</span>
              <StatusIconPicker
                icon={draft.icon}
                iconType={draft.iconType}
                onChange={({ icon, iconType }) =>
                  setDraft({ ...draft, icon, iconType })
                }
              />
            </div>

            <label className="status-modal__field">
              <span className="status-modal__label">Description</span>
              <textarea
                className="sheet-textarea"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="What this condition does… (Markdown supported)"
                rows={5}
              />
            </label>
          </div>
        ) : (
          <div className="status-modal__body">
            <div className="status-modal__identity">
              <StatusIcon
                icon={status.icon}
                iconType={status.iconType}
                size={36}
                className="status-modal__icon"
              />
              <h4 className="status-modal__name">{status.name}</h4>
            </div>
            {status.tags.includes(DEFAULT_STATUS_TAG) && (
              <div className="status-modal__tags">
                <span className="status-tag">Default</span>
              </div>
            )}
            {status.description ? (
              <MarkdownText className="status-modal__description">
                {status.description}
              </MarkdownText>
            ) : (
              <p className="status-modal__description">No description.</p>
            )}
          </div>
        )}

        <div className="modal-footer">
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={!draft || !draft.name.trim()}
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleClose}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setDraft({ ...status })
                  setEditing(true)
                }}
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      {showDiscard && (
        <ConfirmModal
          title="Discard Changes?"
          message="You have unsaved changes to this status. Discard them?"
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          variant="danger"
          onConfirm={() => {
            setShowDiscard(false)
            setEditing(false)
            if (status) setDraft({ ...status })
            closeStatus()
          }}
          onClose={() => setShowDiscard(false)}
        />
      )}
    </div>
  )
}
