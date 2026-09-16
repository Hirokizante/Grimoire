/**
 * AbilityPoolSection — inactive abilities available to swap into slots before
 * an encounter (DESIGN.md "Ability Pool"). There is no limit on the number of
 * abilities in the pool; each is rendered as a sortable card.
 *
 * In edit mode an "Add Ability" button opens the {@link AbilityEditorModal};
 * each card gains Edit, Remove, and "Move to Slotted" buttons and can be
 * dragged to reorder or to move into the slotted section.
 *
 * The card grid is an {@link AbilityBlockList}: it registers this section as a
 * drop target for abilities dragged out of the slotted section and reports the
 * index a drop resolved to, which the parent {@link AbilitiesDndContext} uses
 * as the destination. The pool has no budget of its own, so it never refuses a
 * card.
 *
 * **Nothing in the pool activates.** These abilities are not slotted, so their
 * cards carry no Activate button — and because a sub-ability is bound to its
 * parent (it cannot be slotted on its own), the nested cards do not either; see
 * the `activateOverride` passed below.
 */

import { useState, useCallback } from 'react'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityBlockList from '@/components/sheet/AbilityBlockList'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import SectionViewToggle from '@/components/sheet/SectionViewToggle'
import { useAbilityListDnd } from '@/hooks/useAbilityListDnd'
import { useSubAbilityEditor } from '@/hooks/useSubAbilityEditor'
import { useCharacterStore } from '@/store/characterStore'
import { NO_ACTIVATION } from '@/hooks/useAbilityActivation'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

const SECTION = 'abilityPool'

export interface AbilityPoolSectionProps {
  abilities: AbilityBlock[]
  mode?: SheetMode
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
}

export default function AbilityPoolSection({
  abilities,
  mode = 'view',
  viewMode = 'grid',
  onViewModeChange,
}: AbilityPoolSectionProps) {
  const isEdit = mode === 'edit'
  const addAbilityBlock = useCharacterStore((s) => s.addAbilityBlock)
  const updateAbilityBlock = useCharacterStore((s) => s.updateAbilityBlock)
  const removeAbilityBlock = useCharacterStore((s) => s.removeAbilityBlock)
  const moveAbility = useCharacterStore((s) => s.moveAbility)

  const [editing, setEditing] = useState<AbilityBlock | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [abilityToRemove, setAbilityToRemove] = useState<{ id: string; name: string } | null>(null)

  const handleUpdateParent = useCallback(
    (parent: AbilityBlock) => {
      updateAbilityBlock('abilityPool', parent.id, parent)
    },
    [updateAbilityBlock],
  )

  const { subAbilityActions, subAbilityEditorModal } = useSubAbilityEditor({
    onUpdateParent: handleUpdateParent,
  })

  const layout = viewMode === 'list' ? 'list' : 'cards'
  const { setDroppableRef, isOver } = useAbilityListDnd({
    id: SECTION,
    items: abilities,
    layout,
  })

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
      updateAbilityBlock('abilityPool', editing.id, ability)
    } else {
      addAbilityBlock('abilityPool', ability)
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
    removeAbilityBlock('abilityPool', abilityToRemove.id)
    setAbilityToRemove(null)
  }

  return (
    <section className="sheet-section sheet-section--pool">
      <div className="sheet-section__heading-row">
        <h3 className="sheet-section__heading">Ability Pool</h3>
        <div className="sheet-section__heading-row-right">
          {onViewModeChange && (
            <SectionViewToggle
              viewMode={viewMode}
              onChange={onViewModeChange}
              ariaLabel="Ability pool view"
            />
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

      {!isEdit ? (
        abilities.length === 0 ? (
          <p className="sheet-section__empty muted">The ability pool is empty.</p>
        ) : (
          <div
            className={
              layout === 'list'
                ? 'ability-grid ability-grid--list'
                : 'ability-grid ability-grid--cards'
            }
          >
            {abilities.map((ability) => (
              <AbilityBlockCard
                key={ability.id}
                ability={ability}
                mode={mode}
                // The pool is inactive by definition: nothing here activates.
                activateOverride={NO_ACTIVATION}
              />
            ))}
          </div>
        )
      ) : (
        <AbilityBlockList
          section={SECTION}
          abilities={abilities}
          layout={layout}
          droppableRef={setDroppableRef}
          isOver={isOver}
          subAbilityActions={subAbilityActions}
          // The pool is inactive by definition: nothing here activates. The
          // resolver is the last word, which is what stops a nested sub-ability
          // from falling back to its own `showActivate` flag and growing a
          // button that spends the character's real AP.
          activateOverride={NO_ACTIVATION}
          emptyMessage={
            <>The ability pool is empty — click “Add Ability” to create one.</>
          }
          actions={(ability) => (
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
                  moveAbility(ability.id, 'abilityPool', 'slottedAbilities')
                }
              >
                Move to Slotted
              </button>
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
                onClick={() => handleRemoveRequest(ability.id)}
              >
                Remove
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

      {abilityToRemove && (
        <ConfirmModal
          title="Remove Ability?"
          message={
            <>
              Are you sure you want to remove{' '}
              <strong>{abilityToRemove.name || 'Untitled Ability'}</strong> from
              the ability pool? This cannot be undone.
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
