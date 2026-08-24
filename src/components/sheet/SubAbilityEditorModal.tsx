/**
 * SubAbilityEditorModal — a modal for creating or editing a Sub-Ability from
 * the sheet (outside the Ability Editor Modal).
 *
 * Unlike the sub-ability editor inside AbilityBlockEditor (which renders
 * side-by-side with the main ability editor), this modal is used when the user
 * clicks Edit/Remove on a sub-ability directly on a card in edit mode on the
 * sheet. It's a standalone modal wrapping AbilityBlockEditor with isSubAbility=true.
 */

import { useCallback, useMemo, useState } from 'react'

import AbilityBlockEditor, {
  blankSubAbility,
} from '@/components/sheet/AbilityBlockEditor'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import { useModalDialog } from '@/hooks/useModalDialog'
import type { AbilityBlock } from '@/types'

export interface SubAbilityEditorModalProps {
  /** The sub-ability to edit, or null when creating a new one. */
  ability: AbilityBlock | null
  /** The parent ability (for context; not mutated here). */
  parentAbility: AbilityBlock | null
  /** Which section the sub-ability is nested under. */
  section: 'description' | 'overcharge'
  /** Whether the modal is currently open. */
  open: boolean
  /** Called with the completed sub-ability AbilityBlock when the user saves. */
  onSave: (ability: AbilityBlock) => void
  /** Called when the user closes (Esc, overlay, cancel, or close button). */
  onClose: () => void
}

export default function SubAbilityEditorModal({
  ability,
  parentAbility,
  section,
  open,
  onSave,
  onClose,
}: SubAbilityEditorModalProps) {
  const editorKey = useMemo(
    () => (ability ? `sub-edit-${ability.id}` : 'new-sub-ability'),
    [ability],
  )

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }, [hasUnsavedChanges, onClose])

  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false)
    onClose()
  }, [onClose])

  const editorCancelHandler = useCallback(() => {
    handleCancel()
  }, [handleCancel])

  const handleDirtyChange = useCallback((isDirty: boolean) => {
    setHasUnsavedChanges(isDirty)
  }, [])

  const dialogRef = useModalDialog(
    () => {
      if (hasUnsavedChanges) {
        setShowDiscardConfirm(true)
      } else {
        onClose()
      }
    },
    open && !showDiscardConfirm,
  )

  if (!open) return null

  const sectionLabel = section === 'description' ? 'Description' : 'Overcharge'

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className="modal-content ability-editor-dialog ability-editor-dialog--sub"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ability ? 'Edit Sub-Ability' : 'New Sub-Ability'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            {ability ? 'Edit Sub-Ability' : 'New Sub-Ability'}
            {parentAbility && (
              <span className="ability-editor-dialog__context">
                {' '}
                under {parentAbility.name || 'Untitled Ability'} ({sectionLabel})
              </span>
            )}
          </h3>
        </div>

        <div className="ability-editor-dialog__body">
          <AbilityBlockEditor
            key={editorKey}
            ability={ability ?? blankSubAbility()}
            onSave={onSave}
            onCancel={editorCancelHandler}
            hideTitle
            onDirtyChange={handleDirtyChange}
            isSubAbility
          />
        </div>
      </div>

      {showDiscardConfirm && (
        <ConfirmModal
          title="Discard Changes?"
          message={
            ability
              ? 'You have unsaved changes to this sub-ability. Discard them?'
              : 'You have unsaved changes to the new sub-ability. Discard them?'
          }
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          variant="danger"
          onConfirm={handleConfirmDiscard}
          onClose={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  )
}
