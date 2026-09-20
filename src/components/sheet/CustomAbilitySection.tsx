/**
 * CustomAbilitySection — a user-created ability section within a custom tab.
 *
 * Mirrors the functionality of SlottedAbilitiesSection and AbilityPoolSection
 * exactly, including drag-and-drop (via SortableAbilityCard + SortableContext)
 * and the ability to add/edit abilities. No slot limit.
 */

import { useState, useCallback } from 'react'
import { Pencil, Check, Trash2 } from '@/components/ui/icons'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityBlockList from '@/components/sheet/AbilityBlockList'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import PasteAbilityButton from '@/components/sheet/PasteAbilityButton'
import SectionViewToggle from '@/components/sheet/SectionViewToggle'
import SectionReorderButtons from '@/components/sheet/SectionReorderButtons'
import { useAbilityListDnd } from '@/hooks/useAbilityListDnd'
import { useAbilityClipboard } from '@/hooks/useAbilityClipboard'
import { useCharacterStore } from '@/store/characterStore'
import { cloneAbilityBlock } from '@/lib/abilityClone'
import { useSubAbilityEditor } from '@/hooks/useSubAbilityEditor'
import type { AbilityBlock, CustomAbilitySection } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CustomAbilitySectionProps {
  tabId: string
  section: CustomAbilitySection
  mode?: SheetMode
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  /** Zero-based position of this section within its tab (edit-mode reorder). */
  index?: number
  /** Total sections in the tab (edit-mode reorder boundary). */
  count?: number
}

export default function CustomAbilitySection({
  tabId,
  section,
  mode = 'view',
  viewMode = 'grid',
  onViewModeChange,
  index = 0,
  count = 1,
}: CustomAbilitySectionProps) {
  const isEdit = mode === 'edit'
  const addCustomAbility = useCharacterStore((s) => s.addCustomAbility)
  const updateCustomAbility = useCharacterStore((s) => s.updateCustomAbility)
  const renameCustomSection = useCharacterStore((s) => s.renameCustomSection)
  const removeCustomSection = useCharacterStore((s) => s.removeCustomSection)
  const { copyAbility } = useAbilityClipboard()

  const [editing, setEditing] = useState<AbilityBlock | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [renaming, setRenaming] = useState(false)
  const [sectionNameDraft, setSectionNameDraft] = useState('')

  const handleUpdateParent = useCallback(
    (parent: AbilityBlock) => {
      updateCustomAbility(tabId, section.id, parent.id, parent)
    },
    [updateCustomAbility, tabId, section.id],
  )

  const { subAbilityActions, subAbilityEditorModal } = useSubAbilityEditor({
    onUpdateParent: handleUpdateParent,
  })

  const startRenameSection = () => {
    setSectionNameDraft(section.name)
    setRenaming(true)
  }
  const commitRenameSection = () => {
    if (sectionNameDraft.trim()) {
      renameCustomSection(tabId, section.id, sectionNameDraft.trim())
    }
    setRenaming(false)
  }
  const cancelRenameSection = () => {
    setRenaming(false)
  }

  const { setDroppableRef, isOver } = useAbilityListDnd({
    id: section.id,
    items: section.abilities,
    layout: viewMode === 'list' ? 'list' : 'cards',
  })

  const openNew = () => {
    setEditing(null)
    setShowEditor(true)
  }
  const handleSave = (ability: AbilityBlock) => {
    if (editing) {
      updateCustomAbility(tabId, section.id, editing.id, ability)
    } else {
      addCustomAbility(tabId, section.id, ability)
    }
    setShowEditor(false)
    setEditing(null)
  }
  const handleCancel = () => {
    setShowEditor(false)
    setEditing(null)
  }

  /** A fresh copy of `ability`, landing directly after it. */
  const duplicateAbility = (ability: AbilityBlock) => {
    const index = section.abilities.findIndex((a) => a.id === ability.id)
    addCustomAbility(
      tabId,
      section.id,
      cloneAbilityBlock(ability),
      index < 0 ? undefined : index + 1,
    )
  }

  const isListView = viewMode === 'list'

  return (
    <section className="sheet-section sheet-section--custom">
      <div className="sheet-section__heading-row">
        {isEdit && renaming ? (
          <span className="section-rename">
            <input
              type="text"
              className="sheet-input section-rename__input"
              value={sectionNameDraft}
              autoFocus
              onChange={(e) => setSectionNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRenameSection()
                if (e.key === 'Escape') cancelRenameSection()
              }}
            />
            <button
              type="button"
              className="btn btn--icon section-rename__btn"
              onClick={commitRenameSection}
              aria-label="Confirm rename"
            >
              <Check size={14} />
            </button>
          </span>
        ) : (
          <span className="section-heading-wrap">
            <h3 className="sheet-section__heading">{section.name}</h3>
            {isEdit && (
              <button
                type="button"
                className="btn btn--icon section-rename__trigger"
                onClick={startRenameSection}
                aria-label="Rename section"
              >
                <Pencil size={12} />
              </button>
            )}
          </span>
        )}
          <div className="sheet-section__heading-row-right">
            {isEdit && (
              <SectionReorderButtons
                tabId={tabId}
                index={index}
                count={count}
                name={section.name}
              />
            )}
            {onViewModeChange && (
              <SectionViewToggle
                viewMode={viewMode}
                onChange={onViewModeChange}
                ariaLabel={`${section.name} view`}
              />
            )}
            {isEdit && (
              <button
                type="button"
                className="btn btn--icon section-delete-btn"
                onClick={() => setShowDeleteConfirm(true)}
                aria-label={`Delete ${section.name} section`}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
      </div>

      {isEdit && (
        <div className="section-add-row">
          <button
            type="button"
            className="btn btn--ghost section-add-btn"
            onClick={openNew}
          >
            + Add Ability
          </button>
          <PasteAbilityButton
            onPaste={(ability) => addCustomAbility(tabId, section.id, ability)}
          />
        </div>
      )}

      {!isEdit ? (
        section.abilities.length === 0 ? (
          <p className="sheet-section__empty muted">
            No abilities in this section.
          </p>
        ) : (
          <div
            className={
              isListView
                ? 'ability-grid ability-grid--list'
                : 'ability-grid ability-grid--cards'
            }
          >
            {section.abilities.map((ability) => (
              <AbilityActivation key={ability.id} ability={ability} />
            ))}
          </div>
        )
      ) : (
        <AbilityBlockList
          section={section.id}
          abilities={section.abilities}
          layout={isListView ? 'list' : 'cards'}
          droppableRef={setDroppableRef}
          isOver={isOver}
          subAbilityActions={subAbilityActions}
          emptyMessage={
            <>No abilities yet — click “Add Ability” or drag one in.</>
          }
          actions={(ability) => (
            <>
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn"
                onClick={() => {
                  setEditing(ability)
                  setShowEditor(true)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn"
                onClick={() => duplicateAbility(ability)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn"
                onClick={() => copyAbility(ability)}
              >
                Copy
              </button>
            </>
          )}
        />
      )}

      <AbilityEditorModal
        ability={editing}
        open={showEditor}
        onSave={handleSave}
        onClose={handleCancel}
      />

      {subAbilityEditorModal}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Section?"
          message={
            <>
              Are you sure you want to delete <strong>{section.name}</strong> and
              all abilities in it? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => removeCustomSection(tabId, section.id)}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </section>
  )
}
