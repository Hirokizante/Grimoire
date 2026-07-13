/**
 * AbilityEditorModal — an immersive modal dialog for creating or editing an Ability.
 *
 * Wraps AbilityBlockEditor in a full-screen overlay, providing a large, focused
 * workspace for ability creation without the cramped inline panel feel. Overlay
 * clicks and the Esc key both cancel.
 */
import { useEffect, useMemo } from 'react'

import AbilityBlockEditor from '@/components/sheet/AbilityBlockEditor'
import type { AbilityBlock } from '@/types'

export interface AbilityEditorModalProps {
  /** The ability to edit, or null when creating a new one. */
  ability: AbilityBlock | null
  /** Whether the modal is currently open. */
  open: boolean
  /** Called with the completed AbilityBlock when the user saves. */
  onSave: (ability: AbilityBlock) => void
  /** Called when the user closes (Esc, overlay, cancel, or close button). */
  onClose: () => void
}

export default function AbilityEditorModal({
  ability,
  open,
  onSave,
  onClose,
}: AbilityEditorModalProps) {
  // Stable key so a fresh AbilityBlockEditor mounts on every open (clean state).
  const editorKey = useMemo(
    () => (ability ? `edit-${ability.id}` : 'new-ability'),
    [ability],
  )

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content ability-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={ability ? 'Edit Ability' : 'New Ability'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{ability ? 'Edit Ability' : 'New Ability'}</h3>
          <button
            type="button"
            className="btn btn--ghost modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="ability-editor-dialog__body">
          <AbilityBlockEditor
            key={editorKey}
            ability={ability}
            onSave={onSave}
            onCancel={onClose}
            hideTitle
          />
        </div>
      </div>
    </div>
  )
}
