/**
 * CoreAbilitySection — the heart of the sheet (DESIGN.md "Core Ability").
 *
 * Renders, in order:
 *   1. The Innate narrative description (free-form prose).
 *   2. The optional Innate Ability as an AbilityBlockCard.
 *   3. The Basic Attack as an AbilityBlockCard.
 *   4. The Fatebreaker ultimate as an AbilityBlockCard.
 *
 * In edit mode the innate description becomes a textarea; the Innate Ability,
 * Basic Attack, and Fatebreaker each get an Edit button that opens the
 * {@link AbilityBlockEditor}; and an "Add Innate Ability" button appears when
 * `innateAbility` is null.
 */

import { useState } from 'react'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityBlockEditor from '@/components/sheet/AbilityBlockEditor'
import { useCharacterStore } from '@/store/characterStore'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CoreAbilitySectionProps {
  innateDescription: string
  innateAbility: AbilityBlock | null
  basicAttack: AbilityBlock
  fatebreaker: AbilityBlock
  mode?: SheetMode
}

/** Which core ability is currently being edited, if any. */
type EditingField = 'innateAbility' | 'basicAttack' | 'fatebreaker' | null

export default function CoreAbilitySection({
  innateDescription,
  innateAbility,
  basicAttack,
  fatebreaker,
  mode = 'view',
}: CoreAbilitySectionProps) {
  const isEdit = mode === 'edit'
  const updateCoreAbility = useCharacterStore((s) => s.updateCoreAbility)

  const [editingField, setEditingField] = useState<EditingField>(null)
  const [editingAbility, setEditingAbility] = useState<AbilityBlock | null>(
    null,
  )

  const setInnateDescription = (value: string) =>
    updateCoreAbility('innateDescription', value)

  const openCoreEdit = (field: Exclude<EditingField, null>) => {
    const current =
      field === 'innateAbility'
        ? innateAbility
        : field === 'basicAttack'
          ? basicAttack
          : fatebreaker
    if (!current) return
    setEditingField(field)
    setEditingAbility(current)
  }

  const handleSave = (ability: AbilityBlock) => {
    if (editingField) {
      updateCoreAbility(editingField, ability)
    }
    setEditingField(null)
    setEditingAbility(null)
  }

  const handleCancel = () => {
    setEditingField(null)
    setEditingAbility(null)
  }

  const hasContent = innateDescription !== '' || innateAbility !== null

  return (
    <section className="sheet-section sheet-section--core">
      <h3 className="sheet-section__heading">Core Ability</h3>

      {!hasContent && !isEdit && (
        <p className="sheet-section__empty muted">
          No core ability defined yet.
        </p>
      )}

      {(isEdit || innateDescription) && (
        <div className="core-innate">
          <span className="core-innate__label">Innate</span>
          {isEdit ? (
            <textarea
              className="sheet-textarea"
              value={innateDescription}
              onChange={(e) => setInnateDescription(e.target.value)}
              placeholder="Describe the character's innate nature / powers…"
              rows={3}
            />
          ) : (
            <p className="core-innate__text">{innateDescription}</p>
          )}
        </div>
      )}

      <div className="ability-grid ability-grid--core">
        {innateAbility ? (
          <div className="ability-card-wrap">
            <AbilityBlockCard ability={innateAbility} />
            {isEdit && (
              <div className="ability-card__actions">
                <button
                  type="button"
                  className="btn btn--ghost ability-card__action-btn"
                  onClick={() => openCoreEdit('innateAbility')}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
                  onClick={() => updateCoreAbility('innateAbility', null)}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          isEdit && (
            <button
              type="button"
              className="btn btn--ghost section-add-btn"
              onClick={() => openCoreEdit('innateAbility')}
            >
              + Add Innate Ability
            </button>
          )
        )}

        <div className="ability-card-wrap">
          <AbilityBlockCard ability={basicAttack} />
          {isEdit && (
            <div className="ability-card__actions">
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn"
                onClick={() => openCoreEdit('basicAttack')}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="ability-card-wrap">
          <AbilityBlockCard ability={fatebreaker} />
          {isEdit && (
            <div className="ability-card__actions">
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn"
                onClick={() => openCoreEdit('fatebreaker')}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {editingField && (
        <AbilityBlockEditor
          ability={editingAbility}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </section>
  )
}
