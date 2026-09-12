/**
 * SlottedAbilitiesSection — the active abilities a character has equipped for
 * an encounter. Shows slot usage (e.g. "3 / 5 slots used") and renders each
 * slotted ability as a sortable card.
 *
 * Minor Abilities occupy half a slot each (DESIGN.md "Minor Abilities"). The
 * slot-counting is handled by {@link slotLogic}.
 *
 * In edit mode an "Add Ability" button opens the {@link AbilityEditorModal};
 * each card gains Edit, Remove, and "Move to Pool" buttons and can be dragged
 * to reorder or to move to the pool.
 *
 * The section is wrapped in a dnd-kit `SortableContext` (vertical) and
 * `useDroppable` so it acts as a drop target for abilities dragged from the
 * pool. The parent {@link AbilitiesDndContext} handles the actual drag logic.
 */

import { useState, useCallback } from 'react'
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import SectionViewToggle from '@/components/sheet/SectionViewToggle'
import SortableAbilityCard, {
  type AbilitySectionId,
} from '@/components/sheet/SortableAbilityCard'
import { useCharacterStore } from '@/store/characterStore'
import { useSubAbilityEditor } from '@/hooks/useSubAbilityEditor'
import { formatSlots, isOverflowed, slotsUsed } from '@/lib/slotLogic'
import type { AbilityBlock, Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

const SECTION: AbilitySectionId = 'slottedAbilities'

export interface SlottedAbilitiesSectionProps {
  abilities: AbilityBlock[]
  maxSlots: number
  mode?: SheetMode
  viewMode?: 'grid' | 'list'
  /**
   * Omit to render a FIXED view mode with no grid/list toggle. The GM Screen
   * passes nothing, so panels always read as a list (a grid is unreadable at
   * panel width). The sheet pages pass this and keep both toggles.
   */
  onViewModeChange?: (mode: 'grid' | 'list') => void
  /**
   * Entity the cards belong to. Defaults to the store's `currentCharacter`;
   * the GM Screen passes the panel's own entity so dice notation resolves
   * against the right stats and costs deduct from the right record.
   */
  owner?: Character
}

export default function SlottedAbilitiesSection({
  abilities,
  maxSlots,
  mode = 'view',
  viewMode = 'grid',
  onViewModeChange,
  owner,
}: SlottedAbilitiesSectionProps) {
  const isEdit = mode === 'edit'
  const isView = !isEdit
  const isListView = viewMode === 'list'
  const addAbilityBlock = useCharacterStore((s) => s.addAbilityBlock)
  const updateAbilityBlock = useCharacterStore((s) => s.updateAbilityBlock)
  const removeAbilityBlock = useCharacterStore((s) => s.removeAbilityBlock)
  const moveAbility = useCharacterStore((s) => s.moveAbility)

  const [editing, setEditing] = useState<AbilityBlock | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [abilityToRemove, setAbilityToRemove] = useState<{ id: string; name: string } | null>(null)

  const handleUpdateParent = useCallback(
    (parent: AbilityBlock) => {
      updateAbilityBlock('slottedAbilities', parent.id, parent)
    },
    [updateAbilityBlock],
  )

  const { subAbilityActions, subAbilityEditorModal } = useSubAbilityEditor({
    onUpdateParent: handleUpdateParent,
  })

  // Droppable — makes the section a drop target for cross-section drags.
  const { setNodeRef, isOver } = useDroppable({ id: SECTION, data: { section: SECTION } })

  const openNew = () => {
    setEditing(null)
    setShowEditor(true)
  }
  const openEdit = (ability: AbilityBlock) => {
    setEditing(ability)
    setShowEditor(true)
  }
  const handleSave = (ability: AbilityBlock) => {
    if (editing) {
      updateAbilityBlock('slottedAbilities', editing.id, ability)
    } else {
      addAbilityBlock('slottedAbilities', ability)
    }
    setShowEditor(false)
    setEditing(null)
  }
  const handleCancel = () => {
    setShowEditor(false)
    setEditing(null)
  }

  const handleRemoveRequest = (abilityId: string) => {
    const ability = abilities.find((a) => a.id === abilityId)
    if (!ability) return
    setAbilityToRemove({ id: abilityId, name: ability.name })
  }

  const handleConfirmRemove = () => {
    if (!abilityToRemove) return
    removeAbilityBlock('slottedAbilities', abilityToRemove.id)
    setAbilityToRemove(null)
  }

  const used = slotsUsed(abilities)
  const usedLabel = formatSlots(used)
  const overflow = isOverflowed(abilities, maxSlots)

  return (
    <section className="sheet-section sheet-section--slotted">
      <div className="sheet-section__heading-row">
        <h3 className="sheet-section__heading">Slotted Abilities</h3>
        <div className="sheet-section__heading-row-right">
          {onViewModeChange && (
            <SectionViewToggle
              viewMode={viewMode}
              onChange={onViewModeChange}
              ariaLabel="Slotted abilities view"
            />
          )}
          <span
            className={
              'sheet-section__counter' +
              (overflow ? ' sheet-section__counter--over' : '')
            }
          >
            {usedLabel} / {maxSlots} slots
          </span>
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

      {abilities.length === 0 && !isEdit ? (
        <p className="sheet-section__empty muted">
          No abilities slotted for this encounter.
        </p>
      ) : abilities.length === 0 ? (
        <div
          ref={setNodeRef}
          className={
            'ability-dropzone ability-dropzone--empty' +
            (isOver ? ' ability-dropzone--over' : '')
          }
        >
          <p className="sheet-section__empty muted">
            No abilities slotted — click “Add Ability” or drag one in.
          </p>
        </div>
      ) : isView ? (
        <div
          className={
            isListView
              ? 'ability-grid ability-grid--list'
              : 'ability-grid ability-grid--cards'
          }
        >
          {abilities.map((ability) => (
            <AbilityActivation key={ability.id} ability={ability} character={owner} />
          ))}
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
            items={abilities.map((a) => a.id)}
            strategy={isListView ? verticalListSortingStrategy : rectSortingStrategy}
          >
            {abilities.map((ability) => (
              <SortableAbilityCard
                key={ability.id}
                ability={ability}
                section={SECTION}
                mode={mode}
                subAbilityActions={isEdit ? subAbilityActions : undefined}
                actions={
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost ability-card__action-btn"
                      onClick={() => openEdit(ability)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost ability-card__action-btn"
                      onClick={() =>
                        moveAbility(ability.id, 'slottedAbilities', 'abilityPool')
                      }
                    >
                      Move to Pool
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
                      onClick={() => handleRemoveRequest(ability.id)}
                    >
                      Remove
                    </button>
                  </>
                }
              />
            ))}
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

      {abilityToRemove && (
        <ConfirmModal
          title="Remove Ability?"
          message={
            <>
              Are you sure you want to remove{' '}
              <strong>{abilityToRemove.name || 'Untitled Ability'}</strong> from
              the slotted abilities? This cannot be undone.
            </>
          }
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleConfirmRemove}
          onClose={() => setAbilityToRemove(null)}
        />
      )}
    </section>
  )
}
