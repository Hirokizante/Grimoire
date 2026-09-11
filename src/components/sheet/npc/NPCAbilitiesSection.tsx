/**
 * NPCAbilitiesSection — a container for AbilityBlockCards on an NPC sheet.
 *
 * Similar to the CharacterSheet's SlottedAbilitiesSection but simpler:
 *   - No slot tracking (NPCs have no slot limit)
 *   - No drag-and-drop reordering (static reference, not encounter management)
 *   - No "Move to Pool" button
 *   - On the NPC **sheet pages** the Activate button is never rendered — NPC
 *     sheets are static references, not active participants in turn-based
 *     combat. The GM Screen passes an `activation` resolver instead, and only
 *     the abilities that resolver returns an override for (any ability with a
 *     cost, plus anything on Recharge cooldown) get a working Activate button
 *     backed by the panel's own AP. See hooks/useNpcInstanceActivation.
 *
 * In edit mode, an "Add Ability" button opens the AbilityEditorModal, and
 * each card gains Edit and Remove buttons.
 *
 * In view mode, cards render as static AbilityBlockCards with clickable dice
 * notation in the damage field (DiceHighlighter works because the NPC is the
 * store's currentCharacter, so variable substitution uses the NPC's
 * attributes/skills).
 */

import { useState, useCallback } from 'react'
import { LayoutGrid, List } from 'lucide-react'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import { useCharacterStore } from '@/store/characterStore'
import { useSubAbilityEditor } from '@/hooks/useSubAbilityEditor'
import {
  NO_ACTIVATION,
  type AbilityActivationOverrideResolver,
} from '@/hooks/useAbilityActivation'
import type { AbilityBlock } from '@/types'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface NPCAbilitiesSectionProps {
  abilities: AbilityBlock[]
  /**
   * The NPC these abilities belong to. Defaults to the store's
   * `currentCharacter`; the GM Screen passes the panel's own entity so edits
   * target the right record.
   */
  ownerId?: string
  /**
   * The NPC entity itself, so its ability cards resolve dice notation against
   * the NPC's own stats (the GM Screen has no `currentCharacter` to fall back
   * on). Optional: the sheet pages already have the store's current NPC.
   */
  owner?: Character
  mode?: SheetMode
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  /**
   * GM Screen live-play resolver. When supplied (view mode only), every ability
   * it returns an override for renders through {@link AbilityActivation} — a
   * real Activate button spending the **panel instance's** AP, gated on its
   * Recharge cooldowns. Omitted on the NPC sheet pages, where abilities stay
   * static reference cards.
   */
  activation?: AbilityActivationOverrideResolver
}

export default function NPCAbilitiesSection({
  abilities,
  ownerId,
  owner,
  mode = 'view',
  viewMode = 'grid',
  onViewModeChange,
  activation,
}: NPCAbilitiesSectionProps) {
  const isEdit = mode === 'edit'
  const isListView = viewMode === 'list'
  // A resolver is always supplied — the GM panel's, or the "nothing activates"
  // one for the sheet pages. An NPC sheet is a **static reference**, so a sheet
  // page must pass NO_ACTIVATION rather than nothing at all: a resolver is the
  // last word on activation, so no card below it can fall back to its own
  // `showActivate` flag and grow a button that would spend the *base* record's
  // AP — sub-abilities included.
  const activateOverride = activation ?? NO_ACTIVATION
  const updateCharacter = useCharacterStore((s) => s.updateCharacter)
  const storeOwnerId = useCharacterStore((s) => s.currentCharacter?.id)
  const targetId = ownerId ?? storeOwnerId ?? ''
  // Memoized so handleUpdateParent's dependency array is honest.
  const updateCurrentCharacter = useCallback(
    (updater: (c: Character) => Character) => {
      updateCharacter(targetId, updater)
    },
    [targetId, updateCharacter],
  )

  const [editing, setEditing] = useState<AbilityBlock | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [abilityToRemove, setAbilityToRemove] = useState<{ id: string; name: string } | null>(null)

  const handleUpdateParent = useCallback(
    (parent: AbilityBlock) => {
      updateCurrentCharacter((char) => ({
        ...char,
        slottedAbilities: char.slottedAbilities.map((a) =>
          a.id === parent.id ? parent : a,
        ),
      }))
    },
    [updateCurrentCharacter],
  )

  const { subAbilityActions, subAbilityEditorModal } = useSubAbilityEditor({
    onUpdateParent: handleUpdateParent,
    // The sub-ability editor matches this section's own ability editor: an NPC
    // outside a GM Screen never renders an Activate button, so it offers no
    // "Show Activate button" toggle (nor the character-only END/FP costs).
    npcMode: true,
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
          {abilities.map((ability) => {
            // A GM panel resolves an override per ability: one with a cost (or
            // on Recharge cooldown) activates, the rest stay reference cards.
            const override = isEdit ? null : activateOverride(ability)
            if (override) {
              return (
                <AbilityActivation
                  key={ability.id}
                  ability={ability}
                  character={owner}
                  activateOverride={activateOverride}
                />
              )
            }
            return (
              <AbilityBlockCard
                key={ability.id}
                ability={ability}
                character={owner}
                mode={mode}
                subAbilityActions={isEdit ? subAbilityActions : undefined}
                // The parent is not activatable here, but its sub-abilities may
                // be — the resolver travels with the card either way.
                activateOverride={activateOverride}
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
            )
          })}
        </div>
      )}

      <AbilityEditorModal
        ability={editing}
        open={showEditor}
        onSave={handleSave}
        onClose={handleCancel}
        npcMode
      />

      {subAbilityEditorModal}

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
