/**
 * AbilityPoolSection — inactive abilities available to swap into slots before
 * an encounter (DESIGN.md "Ability Pool"). There is no limit on the number of
 * abilities in the pool; each is rendered as a sortable card.
 *
 * In edit mode an "Add Ability" button opens the {@link AbilityEditorModal};
 * each card gains Edit, Remove, and "Move to Slotted" buttons and can be
 * dragged to reorder or to move into the slotted section.
 *
 * The section is wrapped in a dnd-kit `SortableContext` (vertical) and
 * `useDroppable` so it acts as a drop target for abilities dragged from the
 * slotted section. The parent {@link AbilitiesDndContext} handles the drag.
 */

import { useState } from 'react'
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import SortableAbilityCard, {
  type AbilitySectionId,
} from '@/components/sheet/SortableAbilityCard'
import { useCharacterStore } from '@/store/characterStore'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

const SECTION: AbilitySectionId = 'abilityPool'

export interface AbilityPoolSectionProps {
  abilities: AbilityBlock[]
  mode?: SheetMode
}

export default function AbilityPoolSection({
  abilities,
  mode = 'view',
}: AbilityPoolSectionProps) {
  const isEdit = mode === 'edit'
  const addAbilityBlock = useCharacterStore((s) => s.addAbilityBlock)
  const updateAbilityBlock = useCharacterStore((s) => s.updateAbilityBlock)
  const removeAbilityBlock = useCharacterStore((s) => s.removeAbilityBlock)
  const moveAbility = useCharacterStore((s) => s.moveAbility)

  const [editing, setEditing] = useState<AbilityBlock | null>(null)
  const [showEditor, setShowEditor] = useState(false)

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

  return (
    <section className="sheet-section sheet-section--pool">
      <h3 className="sheet-section__heading">Ability Pool</h3>

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
          The ability pool is empty.
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
            The ability pool is empty — click “Add Ability” to create one.
          </p>
        </div>
      ) : (
        <div
          ref={setNodeRef}
          className={
            'ability-grid ability-grid--cards' +
            (isOver ? ' ability-dropzone--over' : '')
          }
        >
          <SortableContext
            items={abilities.map((a) => a.id)}
            strategy={rectSortingStrategy}
          >
            {abilities.map((ability) => (
              <SortableAbilityCard
                key={ability.id}
                ability={ability}
                section={SECTION}
                mode={mode}
                actions={
                  isEdit ? (
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
                        onClick={() => removeAbilityBlock('abilityPool', ability.id)}
                      >
                        Remove
                      </button>
                    </>
                  ) : undefined
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
    </section>
  )
}
