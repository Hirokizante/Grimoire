/**
 * AbilityPoolSection — inactive abilities available to swap into slots before
 * an encounter (DESIGN.md "Ability Pool"). There is no limit on the number of
 * abilities in the pool; each is rendered as an {@link AbilityBlockCard}.
 *
 * In edit mode an "Add Ability" button opens the {@link AbilityBlockEditor};
 * each card gains Edit, Remove, and "Move to Slotted" buttons.
 */

import { useState } from 'react'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityBlockEditor from '@/components/sheet/AbilityBlockEditor'
import { useCharacterStore } from '@/store/characterStore'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

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
        <p className="sheet-section__empty muted">
          The ability pool is empty — click “Add Ability” to create one.
        </p>
      ) : (
        <div className="ability-grid">
          {abilities.map((ability) => (
            <div className="ability-card-wrap" key={ability.id}>
              <AbilityBlockCard ability={ability} />
              {isEdit && (
                <div className="ability-card__actions">
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
                </div>
              )}
            </div>
          ))}
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
