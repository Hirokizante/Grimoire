/**
 * AbilityEditorModal — an immersive modal dialog for creating or editing an Ability.
 *
 * Wraps AbilityBlockEditor in a full-screen overlay, providing a large, focused
 * workspace for ability creation without the cramped inline panel feel. Overlay
 * clicks and the Esc key both cancel. When there are unsaved changes, a
 * confirmation dialog is shown before discarding.
 *
 * When the side-by-side Sub-Ability editor panel is open, the modal expands to
 * accommodate both panels.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

import AbilityBlockEditor from '@/components/sheet/AbilityBlockEditor'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import { useModalDialog } from '@/hooks/useModalDialog'
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
  /** NPC variant: hide character-only controls in the editor form. */
  npcMode?: boolean
  /**
   * When true, the editor is for a Sub-Ability (hides Minor toggle and
   * "Add Sub-Ability" buttons). Used by the Sub-Ability editor modal.
   */
  isSubAbility?: boolean
}

export default function AbilityEditorModal({
  ability,
  open,
  onSave,
  onClose,
  npcMode = false,
  isSubAbility = false,
}: AbilityEditorModalProps) {
  // Stable key so a fresh AbilityBlockEditor mounts on every open (clean state).
  const editorKey = useMemo(
    () => (ability ? `edit-${ability.id}` : 'new-ability'),
    [ability],
  )

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [subPanelOpen, setSubPanelOpen] = useState(false)

  // Reset sub-panel state when the modal closes so reopening doesn't keep
  // the wide layout from a previous session.
  useEffect(() => {
    if (!open) setSubPanelOpen(false)
  }, [open])

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

  // Pass a stable onClose to the editor's cancel button.
  const editorCancelHandler = useCallback(() => {
    handleCancel()
  }, [handleCancel])

  // Track dirty state from the editor.
  const handleDirtyChange = useCallback((isDirty: boolean) => {
    setHasUnsavedChanges(isDirty)
  }, [])

  // Track sub-editor panel state to expand the modal.
  const handleSubEditorToggle = useCallback((isOpen: boolean) => {
    setSubPanelOpen(isOpen)
  }, [])

  // If there are unsaved changes, intercept Esc too. Scroll lock, focus trap
  // and focus restore come from useModalDialog.
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

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div
        className={
          'modal-content ability-editor-dialog' +
          (subPanelOpen ? ' ability-editor-dialog--wide' : '') +
          (isSubAbility ? ' ability-editor-dialog--sub' : '')
        }
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ability ? 'Edit Ability' : 'New Ability'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{ability ? 'Edit Ability' : 'New Ability'}</h3>
        </div>

        <div className="ability-editor-dialog__body">
          <AbilityBlockEditor
            key={editorKey}
            ability={ability}
            onSave={onSave}
            onCancel={editorCancelHandler}
            hideTitle
            onDirtyChange={handleDirtyChange}
            npcMode={npcMode}
            isSubAbility={isSubAbility}
            onSubEditorToggle={handleSubEditorToggle}
          />
        </div>
      </div>

      {showDiscardConfirm && (
        <ConfirmModal
          title="Discard Changes?"
          message={
           ability
              ? 'You have unsaved changes to this ability. Discard them?'
              : 'You have unsaved changes to the new ability. Discard them?'
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
