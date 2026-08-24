/**
 * useSubAbilityEditor — shared state for editing Sub-Abilities from the sheet.
 *
 * Each ability-displaying section (Slotted, Pool, Core, NPC, Custom) needs to
 * support editing sub-abilities on AbilityBlockCards in edit mode. This hook
 * centralizes the sub-ability editor modal state and the save/remove handlers,
 * so each section only needs to provide the `onUpdateParent` callback that
 * writes the updated parent AbilityBlock back to the store.
 *
 * Returns:
 *   - `subAbilityActions`: a render function for AbilityBlockCard's
 *     `subAbilityActions` prop (Edit + Remove buttons per sub-ability).
 *   - `subAbilityEditorModal`: the React element to render at the bottom of
 *     the section (the SubAbilityEditorModal). Render it once per section.
 */

import { useState, useCallback, useMemo } from 'react'

import SubAbilityEditorModal from '@/components/sheet/SubAbilityEditorModal'
import type { AbilityBlock } from '@/types'

export interface UseSubAbilityEditorOptions {
  /**
   * Called when a sub-ability is saved (added or updated). The parent ability
   * (with its updated `subAbilitiesUnderDescription` / `subAbilitiesUnderOvercharge`
   * arrays) is passed back so the section can persist it to the store.
   */
  onUpdateParent: (parent: AbilityBlock) => void
}

export function useSubAbilityEditor({
  onUpdateParent,
}: UseSubAbilityEditorOptions) {
  const [editingSub, setEditingSub] = useState<AbilityBlock | null>(null)
  const [editingParent, setEditingParent] = useState<AbilityBlock | null>(null)
  const [editingSection, setEditingSection] = useState<
    'description' | 'overcharge'
  >('description')
  const [showEditor, setShowEditor] = useState(false)

  const openEdit = useCallback(
    (sub: AbilityBlock | null, parent: AbilityBlock, section: 'description' | 'overcharge') => {
      setEditingSub(sub)
      setEditingParent(parent)
      setEditingSection(section)
      setShowEditor(true)
    },
    [],
  )

  const handleSave = useCallback(
    (sub: AbilityBlock) => {
      if (!editingParent) return
      const key =
        editingSection === 'description'
          ? 'subAbilitiesUnderDescription'
          : 'subAbilitiesUnderOvercharge'
      const list = editingParent[key]
      const exists = list.some((s) => s.id === sub.id)
      const updatedList = exists
        ? list.map((s) => (s.id === sub.id ? sub : s))
        : [...list, sub]
      const updatedParent: AbilityBlock = {
        ...editingParent,
        [key]: updatedList,
      }
      onUpdateParent(updatedParent)
      setShowEditor(false)
      setEditingSub(null)
      setEditingParent(null)
    },
    [editingParent, editingSection, onUpdateParent],
  )

  const handleClose = useCallback(() => {
    setShowEditor(false)
    setEditingSub(null)
    setEditingParent(null)
  }, [])

  const handleRemove = useCallback(
    (subId: string, parent: AbilityBlock, section: 'description' | 'overcharge') => {
      const key =
        section === 'description'
          ? 'subAbilitiesUnderDescription'
          : 'subAbilitiesUnderOvercharge'
      const updatedParent: AbilityBlock = {
        ...parent,
        [key]: parent[key].filter((s) => s.id !== subId),
      }
      onUpdateParent(updatedParent)
    },
    [onUpdateParent],
  )

  const subAbilityActions = useMemo(
    () =>
      (sub: AbilityBlock, parent: AbilityBlock) => {
        // Determine which section this sub-ability is under by checking
        // the parent's arrays.
        const section: 'description' | 'overcharge' =
          parent.subAbilitiesUnderDescription.some((s) => s.id === sub.id)
            ? 'description'
            : 'overcharge'
        return (
          <>
            <button
              type="button"
              className="btn btn--ghost ability-card__action-btn"
              onClick={() => openEdit(sub, parent, section)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
              onClick={() => handleRemove(sub.id, parent, section)}
            >
              Remove
            </button>
          </>
        )
      },
    [openEdit, handleRemove],
  )

  const subAbilityEditorModal = (
    <SubAbilityEditorModal
      ability={editingSub}
      parentAbility={editingParent}
      section={editingSection}
      open={showEditor}
      onSave={handleSave}
      onClose={handleClose}
    />
  )

  return { subAbilityActions, subAbilityEditorModal }
}
