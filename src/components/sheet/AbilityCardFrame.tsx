/**
 * AbilityCardFrame — the visual unit that gets dragged: an ability card with
 * the grip handle above it.
 *
 * Split out of {@link SortableAbilityCard} so the drag overlay can render
 * exactly what the sortable card renders. That matters more than it looks:
 * dnd-kit measures the sortable node and gives the overlay that width and
 * height, so an overlay built from a *subset* of the card (no handle, different
 * footer) is a different size and the drop animation visibly snaps between the
 * two. One frame, used by both, cannot drift.
 *
 * The frame is a single element by design — the wrapper dnd-kit measures *is*
 * the frame, so a drag adds no DOM layer in between. It takes the ref and the
 * drag attributes/listeners that {@link SortableAbilityCard} spreads onto it;
 * the overlay passes none.
 *
 * It is presentational. In the overlay the handle carries no listeners and the
 * action buttons are inert (the overlay is `pointer-events: none`), so
 * rendering it twice is safe.
 */

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import { DRAG_ACTIVATOR_ATTRIBUTE } from '@/components/sheet/AbilityCardPointerSensor'
import type { AbilityActivationOverrideResolver } from '@/hooks/useAbilityActivation'
import type { AbilityBlock, Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface AbilityCardFrameProps {
  ability: AbilityBlock
  mode: SheetMode
  /** Renders the grip handle — the card's visible drag affordance. */
  showHandle: boolean
  /** Entity the card's dice notation and switches resolve against. */
  character?: Character
  /** Extra props for the grip handle (keyboard drag attributes + listeners). */
  handleProps?: React.ComponentPropsWithRef<'button'>
  actions?: React.ReactNode
  subAbilityActions?: (sub: AbilityBlock, parent: AbilityBlock) => React.ReactNode
  activateOverride?: AbilityActivationOverrideResolver
  onToggleModifiers?: (abilityId: string, active: boolean) => void
  onSetUses?: (abilityId: string, remaining: number) => void
}

export default function AbilityCardFrame({
  ability,
  mode,
  showHandle,
  character,
  handleProps,
  actions,
  subAbilityActions,
  activateOverride,
  onToggleModifiers,
  onSetUses,
}: AbilityCardFrameProps) {
  return (
    <>
      {showHandle && (
        <button
          type="button"
          className="drag-handle"
          aria-label={`Drag ${ability.name || 'ability'}`}
          {...handleProps}
          {...{ [DRAG_ACTIVATOR_ATTRIBUTE]: '' }}
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
    </>
  )
}
