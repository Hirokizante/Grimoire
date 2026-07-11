/**
 * SlottedAbilitiesSection — the active abilities a character has equipped for
 * an encounter. Shows slot usage (e.g. "3 / 5 slots used") and renders each
 * slotted ability as an {@link AbilityBlockCard}.
 *
 * Minor Abilities occupy half a slot each (DESIGN.md "Minor Abilities"). The
 * slot-counting logic here accounts for that: a regular ability counts as 1
 * slot, a Minor ability counts as 0.5.
 *
 * In edit mode an "Add Ability" button opens the {@link AbilityBlockEditor};
 * each card gains Edit, Remove, and "Move to Pool" buttons.
 */

import { useState } from 'react'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityBlockEditor from '@/components/sheet/AbilityBlockEditor'
import { useCharacterStore } from '@/store/characterStore'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface SlottedAbilitiesSectionProps {
  abilities: AbilityBlock[]
  maxSlots: number
  mode?: SheetMode
}

/** Slots consumed by an ability, counting Minor abilities as half a slot. */
function slotCost(ability: AbilityBlock): number {
  return ability.isMinor ? 0.5 : 1
}

export default function SlottedAbilitiesSection({
  abilities,
  maxSlots,
  mode = 'view',
}: SlottedAbilitiesSectionProps) {
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

  const used = abilities.reduce((sum, a) => sum + slotCost(a), 0)
  const usedLabel = Number.isInteger(used) ? `${used}` : used.toFixed(1)

  return (
    <section className="sheet-section sheet-section--slotted">
      <div className="sheet-section__heading-row">
        <h3 className="sheet-section__heading">Slotted Abilities</h3>
        <span className="sheet-section__counter">
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
        <p className="sheet-section__empty muted">
          No abilities slotted — click “Add Ability” to create one.
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
