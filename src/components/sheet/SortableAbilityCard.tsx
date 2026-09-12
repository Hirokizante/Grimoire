/**
 * SortableAbilityCard — wraps an {@link AbilityBlockCard} with dnd-kit's
 * `useSortable` hook so it can be dragged and reordered within a list, or
 * dragged across to the other ability section (pool ↔ slotted).
 *
 * The drag handle is a small grip element above the card so the card body
 * itself remains clickable (for edit/remove buttons). When not in edit mode
 * the drag handle is not rendered — dragging is an edit-mode-only feature.
 *
 * Props include the `section` identifier so the parent DnD context knows
 * which list this card belongs to when computing drag results.
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import type { AbilityActivationOverrideResolver } from '@/hooks/useAbilityActivation'
import type { AbilityBlock, Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

/** Which ability list a sortable card belongs to. */
export type AbilitySectionId = 'slottedAbilities' | 'abilityPool' | string

export interface SortableAbilityCardProps {
  ability: AbilityBlock
  section: AbilitySectionId
  mode?: SheetMode
  /**
   * Entity the card belongs to, so its dice notation resolves against the
   * right stats. Omitted on the player sheet (the store's `currentCharacter`
   * is the owner there); an NPC section embedded in a player sheet passes the
   * NPC, which is not the current character.
   */
  character?: Character
  /**
   * Persist the modifier switch / manual use adjustment for an ability that
   * does not live on the store's current character (an NPC attached to a
   * character sheet tab). Omitted where the card's own character is the
   * current character — the store action is the writer there.
   */
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  onSetUses?: (abilityId: string, remaining: number) => void
  /** Optional action buttons rendered below the card (Edit, Move, Remove). */
  actions?: React.ReactNode
  /**
   * Optional render function for sub-ability action buttons (edit-mode only).
   * Passed through to AbilityBlockCard.
   */
  subAbilityActions?: (sub: AbilityBlock, parent: AbilityBlock) => React.ReactNode
  /**
   * Per-ability activation override, passed through to AbilityBlockCard (and so
   * to the sub-abilities nested in the card). A section that activates nothing
   * — the Ability Pool — passes a resolver that always says "no", so no card
   * below can fall back to its own `showActivate` flag.
   */
  activateOverride?: AbilityActivationOverrideResolver
}

export default function SortableAbilityCard({
  ability,
  section,
  mode = 'view',
  character,
  onToggleModifiers,
  onSetUses,
  actions,
  subAbilityActions,
  activateOverride,
}: SortableAbilityCardProps) {
  const isEdit = mode === 'edit'

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ability.id,
    data: { section, isMinor: ability.isMinor },
    disabled: !isEdit,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={'ability-card-wrap sortable-ability' + (isDragging ? ' sortable-ability--dragging' : '')}
      data-section={section}
    >
      {isEdit && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="drag-handle"
          aria-label="Drag ability"
          {...attributes}
          {...listeners}
        >
          <span className="drag-handle__grip" aria-hidden="true">⋮⋮</span>
        </button>
      )}

      <AbilityBlockCard
        ability={ability}
        mode={mode}
        character={character}
        onToggleModifiers={onToggleModifiers}
        onSetUses={onSetUses}
        actions={actions}
        subAbilityActions={subAbilityActions}
        activateOverride={activateOverride}
      />
    </div>
  )
}
