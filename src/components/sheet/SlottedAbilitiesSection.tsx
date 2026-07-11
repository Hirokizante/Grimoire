/**
 * SlottedAbilitiesSection — the active abilities a character has equipped for
 * an encounter. Shows slot usage (e.g. "3 / 5 slots used") and renders each
 * slotted ability as a sortable card.
 *
 * Minor Abilities occupy half a slot each (DESIGN.md "Minor Abilities"). The
 * slot-counting is handled by {@link slotLogic}.
 *
 * In edit mode an "Add Ability" button opens the {@link AbilityBlockEditor};
 * each card gains Edit, Remove, and "Move to Pool" buttons and can be dragged
 * to reorder or to move to the pool.
 *
 * The section is wrapped in a dnd-kit `SortableContext` (vertical) and
 * `useDroppable` so it acts as a drop target for abilities dragged from the
 * pool. The parent {@link AbilitiesDndContext} handles the actual drag logic.
 */

import { useState } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityBlockEditor from '@/components/sheet/AbilityBlockEditor'
import SortableAbilityCard, {
  type AbilitySectionId,
} from '@/components/sheet/SortableAbilityCard'
import { useCharacterStore } from '@/store/characterStore'
import { formatSlots, isOverflowed, slotsUsed } from '@/lib/slotLogic'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

const SECTION: AbilitySectionId = 'slottedAbilities'

export interface SlottedAbilitiesSectionProps {
  abilities: AbilityBlock[]
  maxSlots: number
  mode?: SheetMode
}

export default function SlottedAbilitiesSection({
  abilities,
  maxSlots,
  mode = 'view',
}: SlottedAbilitiesSectionProps) {
  const isEdit = mode === 'edit'
  const isView = !isEdit
  const addAbilityBlock = useCharacterStore((s) => s.addAbilityBlock)
  const updateAbilityBlock = useCharacterStore((s) => s.updateAbilityBlock)
  const removeAbilityBlock = useCharacterStore((s) => s.removeAbilityBlock)
  const moveAbility = useCharacterStore((s) => s.moveAbility)

  const [editing, setEditing] = useState<AbilityBlock | null>(null)
  const [showEditor, setShowEditor] = useState(false)

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

  const used = slotsUsed(abilities)
  const usedLabel = formatSlots(used)
  const overflow = isOverflowed(abilities, maxSlots)

  return (
    <section className="sheet-section sheet-section--slotted">
      <div className="sheet-section__heading-row">
        <h3 className="sheet-section__heading">Slotted Abilities</h3>
        <span
          className={
            'sheet-section__counter' +
            (overflow ? ' sheet-section__counter--over' : '')
          }
        >
          {usedLabel} / {maxSlots} slots
        </span>
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
        <div className="ability-grid">
          {abilities.map((ability) => (
            <AbilityActivation key={ability.id} ability={ability} />
          ))}
        </div>
      ) : (
        <div
          ref={setNodeRef}
          className={
            'ability-grid' +
            (isOver ? ' ability-dropzone--over' : '')
          }
        >
          <SortableContext
            items={abilities.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            {abilities.map((ability) => (
              <SortableAbilityCard
                key={ability.id}
                ability={ability}
                section={SECTION}
                mode={mode}
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
                      onClick={() =>
                        removeAbilityBlock('slottedAbilities', ability.id)
                      }
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

      {showEditor && (
        <AbilityBlockEditor
          ability={editing}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </section>
  )
}
