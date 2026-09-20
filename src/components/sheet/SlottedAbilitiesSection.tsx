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
 * The card grid is an {@link AbilityBlockList}: it registers this section as a
 * drop target for abilities dragged out of the pool and reports the index a
 * drop resolved to, which is what the parent {@link AbilitiesDndContext} uses
 * as the destination. It also publishes `canAccept` — "does one more ability
 * fit?" — so a drag over a full section reads as unavailable while the card is
 * still in the air, rather than being refused on release.
 */

import { useState, useCallback } from 'react'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityBlockList from '@/components/sheet/AbilityBlockList'
import AbilityEditorModal from '@/components/sheet/AbilityEditorModal'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import PasteAbilityButton from '@/components/sheet/PasteAbilityButton'
import SectionViewToggle from '@/components/sheet/SectionViewToggle'
import { useAbilitySlotBudget } from '@/components/sheet/AbilityDropHintContext'
import { useAbilityListDnd } from '@/hooks/useAbilityListDnd'
import { useAbilityClipboard } from '@/hooks/useAbilityClipboard'
import { useSubAbilityEditor } from '@/hooks/useSubAbilityEditor'
import { useCharacterStore } from '@/store/characterStore'
import { cloneAbilityBlock } from '@/lib/abilityClone'
import { formatSlots, isOverflowed, slotsUsed } from '@/lib/slotLogic'
import type { AbilityBlock, Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

const SECTION = 'slottedAbilities'

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
  const addAbilityBlock = useCharacterStore((s) => s.addAbilityBlock)
  const updateAbilityBlock = useCharacterStore((s) => s.updateAbilityBlock)
  const removeAbilityBlock = useCharacterStore((s) => s.removeAbilityBlock)
  const moveAbility = useCharacterStore((s) => s.moveAbility)
  const { copyAbility } = useAbilityClipboard()

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

  // The drag context publishes the slot budget; this section is the one that
  // applies it, so a card dragged in from the pool over a full section shows a
  // refused indicator rather than being turned away on release.
  const canAccept = useAbilitySlotBudget() ?? undefined

  const { setDroppableRef, isOver } = useAbilityListDnd({
    id: SECTION,
    items: abilities,
    layout: viewMode === 'list' ? 'list' : 'cards',
    canAccept,
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

  /** A fresh copy of `ability`, landing directly after it. */
  const duplicateAbility = (ability: AbilityBlock) => {
    const index = abilities.findIndex((a) => a.id === ability.id)
    addAbilityBlock(
      SECTION,
      cloneAbilityBlock(ability),
      index < 0 ? undefined : index + 1,
    )
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
        <div className="section-add-row">
          <button
            type="button"
            className="btn btn--ghost section-add-btn"
            onClick={openNew}
          >
            + Add Ability
          </button>
          <PasteAbilityButton
            onPaste={(ability) => addAbilityBlock(SECTION, ability)}
          />
        </div>
      )}

      {isView ? (
        abilities.length === 0 ? (
          <p className="sheet-section__empty muted">
            No abilities slotted for this encounter.
          </p>
        ) : (
          <div
            className={
              viewMode === 'list'
                ? 'ability-grid ability-grid--list'
                : 'ability-grid ability-grid--cards'
            }
          >
            {abilities.map((ability) => (
              <AbilityActivation key={ability.id} ability={ability} character={owner} />
            ))}
          </div>
        )
      ) : (
        <AbilityBlockList
          section={SECTION}
          abilities={abilities}
          layout={viewMode === 'list' ? 'list' : 'cards'}
          droppableRef={setDroppableRef}
          isOver={isOver}
          subAbilityActions={subAbilityActions}
          emptyMessage={
            <>No abilities slotted — click “Add Ability” or drag one in.</>
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
                onClick={() => duplicateAbility(ability)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="btn btn--ghost ability-card__action-btn"
                onClick={() => copyAbility(ability)}
              >
                Copy
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
