/**
 * CustomAbilitySection — a user-created ability section within a custom tab.
 *
 * Mirrors the functionality of SlottedAbilitiesSection and AbilityPoolSection
 * exactly, including drag-and-drop (via SortableAbilityCard + SortableContext)
 * and the ability to add/edit abilities. No slot limit.
 */

import { useState, useCallback } from 'react'
import { LayoutGrid, List, Pencil, Check, Trash2 } from 'lucide-react'

import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import SortableAbilityCard from '@/components/sheet/SortableAbilityCard'
import { useCharacterStore } from '@/store/characterStore'
import { useSubAbilityEditor } from '@/hooks/useSubAbilityEditor'
import type { AbilityBlock, CustomAbilitySection } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CustomAbilitySectionProps {
  tabId: string
  section: CustomAbilitySection
  mode?: SheetMode
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
}

export default function CustomAbilitySection({
  tabId,
  section,
  mode = 'view',
  viewMode = 'grid',
  onViewModeChange,
}: CustomAbilitySectionProps) {
  const isEdit = mode === 'edit'
  const addCustomAbility = useCharacterStore((s) => s.addCustomAbility)
  const updateCustomAbility = useCharacterStore((s) => s.updateCustomAbility)
  const renameCustomSection = useCharacterStore((s) => s.renameCustomSection)
  const removeCustomSection = useCharacterStore((s) => s.removeCustomSection)

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

  const { setNodeRef, isOver } = useDroppable({
    id: section.id,
    data: { section: section.id, sectionKind: 'ability' as const },
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
            {onViewModeChange && (
              <div
                className="mode-toggle mode-toggle--compact"
                role="tablist"
                aria-label={`${section.name} view`}
              >
                <button
                  className={
                    'mode-toggle__btn' +
                    (viewMode === 'grid' ? ' mode-toggle__btn--active' : '')
                  }
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'grid'}
                  aria-label="Grid view"
                  onClick={() => onViewModeChange('grid')}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  className={
                    'mode-toggle__btn' +
                    (viewMode === 'list' ? ' mode-toggle__btn--active' : '')
                  }
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'list'}
                  aria-label="List view"
                  onClick={() => onViewModeChange('list')}
                >
                  <List size={16} />
                </button>
              </div>
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
        <button
          type="button"
          className="btn btn--ghost section-add-btn"
          onClick={openNew}
        >
          + Add Ability
        </button>
      )}

      {section.abilities.length === 0 && !isEdit ? (
        <p className="sheet-section__empty muted">
          No abilities in this section.
        </p>
      ) : section.abilities.length === 0 ? (
        <div
          ref={setNodeRef}
          className={
            'ability-dropzone ability-dropzone--empty' +
            (isOver ? ' ability-dropzone--over' : '')
          }
        >
          <p className="sheet-section__empty muted">
            No abilities yet — click "Add Ability" or drag one in.
          </p>
        </div>
      ) : (
        <div
          ref={setNodeRef}
          className={
            (isListView
              ? 'ability-grid ability-grid--list'
              : 'ability-grid ability-grid--cards') +
            (isOver ? ' ability-dropzone--over' : '')
          }
        >
          <SortableContext
            items={section.abilities.map((a) => a.id)}
            strategy={isListView ? verticalListSortingStrategy : rectSortingStrategy}
          >
            {section.abilities.map((ability) =>
              isEdit ? (
                <SortableAbilityCard
                  key={ability.id}
                  ability={ability}
                  section={section.id}
                  mode={mode}
                  subAbilityActions={isEdit ? subAbilityActions : undefined}
                  actions={
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
                    </>
                  }
                />
              ) : (
                <AbilityActivation key={ability.id} ability={ability} />
              )
            )}
          </SortableContext>
        </div>
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
