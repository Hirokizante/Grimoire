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
import type { AbilityBlock } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

/** Which ability list a sortable card belongs to. */
export type AbilitySectionId = 'slottedAbilities' | 'abilityPool'

export interface SortableAbilityCardProps {
  ability: AbilityBlock
  section: AbilitySectionId
  mode?: SheetMode
  /** Optional action buttons rendered below the card (Edit, Move, Remove). */
  actions?: React.ReactNode
}

export default function SortableAbilityCard({
  ability,
  section,
  mode = 'view',
  actions,
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

      <AbilityBlockCard ability={ability} mode={mode} actions={actions} />
    </div>
  )
}
