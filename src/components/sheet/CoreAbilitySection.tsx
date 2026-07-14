/**
 * CoreAbilitySection — the heart of the sheet (DESIGN.md "Core Ability").
 *
 * Renders, in order:
 *   1. The Innate narrative description (free-form prose).
 *   2. Zero or more Innate Abilities as AbilityBlockCards.
 *   3. The Basic Attack as an AbilityBlockCard.
 *   4. The Fatebreaker ultimate as an AbilityBlockCard.
 *
 * In edit mode the innate description becomes a textarea; Innate Abilities,
 * Basic Attack, and Fatebreaker each get an Edit button that opens the
 * {@link AbilityEditorModal}; and an "Add Innate Ability" button appends a
 * new blank ability.
 */

import { useState } from 'react'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import MarkdownText from '@/components/ui/MarkdownText'
import { useCharacterStore } from '@/store/characterStore'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface CoreAbilitySectionProps {
  innateDescription: string
  innateAbilities: AbilityBlock[]
  basicAttack: AbilityBlock
  fatebreaker: AbilityBlock
  mode?: SheetMode
}

/** Which core ability is currently being edited, if any. */
type EditingField =
  | { field: 'innateAbility'; id: string }
  | { field: 'basicAttack' }
  | { field: 'fatebreaker' }
  | null

export default function CoreAbilitySection({
  innateDescription,
  innateAbilities,
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
    let current: AbilityBlock | null = null
    if (field.field === 'innateAbility') {
      current =
        innateAbilities.find((a) => a.id === field.id) ?? null
    } else if (field.field === 'basicAttack') {
      current = basicAttack
    } else if (field.field === 'fatebreaker') {
      current = fatebreaker
    }
    setEditingField(field)
    setEditingAbility(current)
  }

  const handleSave = (ability: AbilityBlock) => {
    if (!editingField) return
    if (editingField.field === 'innateAbility') {
      const updated = innateAbilities.map((a) =>
        a.id === ability.id ? ability : a,
      )
      // If this was a brand-new ability (not in the list yet), append it.
      if (!innateAbilities.some((a) => a.id === ability.id)) {
        updated.push(ability)
      }
      updateCoreAbility('innateAbilities', updated)
    } else {
      updateCoreAbility(editingField.field, ability)
    }
    setEditingField(null)
    setEditingAbility(null)
  }

  const handleCancel = () => {
    setEditingField(null)
    setEditingAbility(null)
  }

  const removeInnate = (id: string) => {
    updateCoreAbility(
      'innateAbilities',
      innateAbilities.filter((a) => a.id !== id),
    )
  }

  const hasContent = innateDescription !== '' || innateAbilities.length > 0

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
            <MarkdownText className="core-innate__text">
              {innateDescription}
            </MarkdownText>
          )}
        </div>
      )}

      <div className="ability-grid ability-grid--core">
        {innateAbilities.map((ability) =>
          isEdit ? (
            <div className="ability-card-wrap" key={ability.id}>
              <AbilityBlockCard
                ability={ability}
                mode={mode}
                actions={
                  isEdit ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--ghost ability-card__action-btn"
                        onClick={() =>
                          openCoreEdit({ field: 'innateAbility', id: ability.id })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
                        onClick={() => removeInnate(ability.id)}
                      >
                        Remove
                      </button>
                    </>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <AbilityActivation key={ability.id} ability={ability} />
          ),
        )}

        {isEdit && (
          <button
            type="button"
            className="btn btn--ghost section-add-btn"
            onClick={() => openCoreEdit({ field: 'innateAbility', id: '' })}
          >
            + Add Innate Ability
          </button>
        )}

        {isEdit ? (
          <div className="ability-card-wrap">
            <AbilityBlockCard
              ability={basicAttack}
              mode={mode}
              actions={
                isEdit ? (
                  <button
                    type="button"
                    className="btn btn--ghost ability-card__action-btn"
                    onClick={() => openCoreEdit({ field: 'basicAttack' })}
                  >
                    Edit
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <AbilityActivation ability={basicAttack} />
        )}

        {isEdit ? (
          <div className="ability-card-wrap">
            <AbilityBlockCard
              ability={fatebreaker}
              mode={mode}
              actions={
                isEdit ? (
                  <button
                    type="button"
                    className="btn btn--ghost ability-card__action-btn"
                    onClick={() => openCoreEdit({ field: 'fatebreaker' })}
                  >
                    Edit
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <AbilityActivation ability={fatebreaker} />
        )}
      </div>

      <AbilityEditorModal
        ability={editingAbility}
        open={editingField !== null}
        onSave={handleSave}
        onClose={handleCancel}
      />
    </section>
  )
}
