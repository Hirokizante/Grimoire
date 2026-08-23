/**
 * NPCAbilitiesSection — a container for AbilityBlockCards on an NPC sheet.
 *
 * Similar to the CharacterSheet's SlottedAbilitiesSection but simpler:
 *   - No slot tracking (NPCs have no slot limit)
 *   - No drag-and-drop reordering (static reference, not encounter management)
 *   - No "Move to Pool" button
 *   - The Activate button on AbilityBlockCards is ALWAYS disabled/hidden —
 *     NPCs are static references, not active participants in turn-based combat
 *
 * In edit mode, an "Add Ability" button opens the AbilityEditorModal, and
 * each card gains Edit and Remove buttons.
 *
 * In view mode, cards render as static AbilityBlockCards with clickable dice
 * notation in the damage field (DiceHighlighter works because the NPC is the
 * store's currentCharacter, so variable substitution uses the NPC's
 * attributes/skills).
 */

import { useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import { useCharacterStore } from '@/store/characterStore'
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface NPCAbilitiesSectionProps {
  abilities: AbilityBlock[]
  mode?: SheetMode
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
}

export default function NPCAbilitiesSection({
  abilities,
  mode = 'view',
  viewMode = 'grid',
  onViewModeChange,
}: NPCAbilitiesSectionProps) {
  const isEdit = mode === 'edit'
  const isListView = viewMode === 'list'
  const updateCurrentCharacter = useCharacterStore((s) => s.updateCurrentCharacter)

  const [editing, setEditing] = useState<AbilityBlock | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [abilityToRemove, setAbilityToRemove] = useState<{ id: string; name: string } | null>(null)

  const openNew = () => {
    setEditing(null)
    setShowEditor(true)
  }
  const openEdit = (ability: AbilityBlock) => {
    setEditing(ability)
    setShowEditor(true)
  }
  const handleSave = (ability: AbilityBlock) => {
    updateCurrentCharacter((char) => {
      const existing = char.slottedAbilities
      if (editing && existing.some((a) => a.id === editing.id)) {
        return {
          ...char,
          slottedAbilities: existing.map((a) => (a.id === editing.id ? ability : a)),
        }
      }
      return {
        ...char,
        slottedAbilities: [...existing, ability],
      }
    })
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
    updateCurrentCharacter((char) => ({
      ...char,
      slottedAbilities: char.slottedAbilities.filter((a) => a.id !== abilityToRemove.id),
    }))
    setAbilityToRemove(null)
  }

  return (
    <section className="sheet-section sheet-section--slotted">
      <div className="sheet-section__heading-row">
        <h3 className="sheet-section__heading">Abilities</h3>
        <div className="sheet-section__heading-row-right">
          {onViewModeChange && (
            <div
              className="mode-toggle mode-toggle--compact"
              role="tablist"
              aria-label="Abilities view"
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
          No abilities defined for this NPC.
        </p>
      ) : abilities.length === 0 ? (
        <p className="sheet-section__empty muted">
          No abilities yet — click "Add Ability" to create one.
        </p>
      ) : (
        <div
          className={
            isListView
              ? 'ability-grid ability-grid--list'
              : 'ability-grid ability-grid--cards'
          }
        >
          {abilities.map((ability) => (
            <AbilityBlockCard
              key={ability.id}
              ability={ability}
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
                      className="btn btn--ghost ability-card__action-btn ability-card__action-btn--danger"
                      onClick={() => handleRemoveRequest(ability.id)}
                    >
                      Remove
                    </button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <AbilityEditorModal
        ability={editing}
        open={showEditor}
        onSave={handleSave}
        onClose={handleCancel}
        npcMode
      />

      {abilityToRemove && (
        <ConfirmModal
          title="Remove Ability?"
          message={
            <>
              Are you sure you want to remove{' '}
              <strong>{abilityToRemove.name || 'Untitled Ability'}</strong> from
              this NPC? This cannot be undone.
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
