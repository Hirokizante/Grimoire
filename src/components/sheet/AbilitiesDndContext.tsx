/**
 * AbilitiesDndContext — wraps the Slotted Abilities and Ability Pool sections
 * in a single dnd-kit `DndContext` so abilities can be dragged within a list
 * (reorder) and across lists (move between slotted and pool).
 *
 * The two sections each use their own `SortableContext` (horizontal/vertical)
 * so dnd-kit handles the reordering animation. This parent context intercepts
 * the `onDragEnd` event and determines whether the drag was a reorder (same
 * section) or a cross-section move, then calls the appropriate store action.
 *
 * Slot validation: when dragging into the slotted section, the `canSlot` check
 * from {@link slotLogic} prevents overfilling. If the ability would exceed the
 * slot cap it snaps back (the move is cancelled).
 */

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import { useCharacterStore } from '@/store/characterStore'
import { canSlot } from '@/lib/slotLogic'
import type { AbilityBlock } from '@/types'

export interface AbilitiesDndContextProps {
  /** Max slotted ability slots — used to validate drops into the slotted section. */
  maxSlots: number
  /** Current slotted abilities (for slot validation). */
  slottedAbilities: AbilityBlock[]
  children: React.ReactNode
}

type SectionId = 'slottedAbilities' | 'abilityPool'

export default function AbilitiesDndContext({
  maxSlots,
  slottedAbilities,
  children,
}: AbilitiesDndContextProps) {
  const moveAbility = useCharacterStore((s) => s.moveAbility)
  const reorderAbility = useCharacterStore((s) => s.reorderAbility)

  const [activeAbility, setActiveAbility] = useState<AbilityBlock | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string
    // Find the ability from either section to render in the drag overlay.
    const all = useCharacterStore.getState()
    const found =
      all.currentCharacter?.slottedAbilities.find((a) => a.id === id) ??
      all.currentCharacter?.abilityPool.find((a) => a.id === id) ??
      null
    setActiveAbility(found)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveAbility(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const fromSection = active.data.current?.section as SectionId | undefined
    // The `over` might be a droppable container (section id) or another sortable item.
    const overSection = (over.data.current?.section as SectionId | undefined) ??
      (overId === 'slottedAbilities' || overId === 'abilityPool'
        ? (overId as SectionId)
        : fromSection)

    if (!fromSection || !overSection) return

    if (fromSection === overSection) {
      // Reorder within the same section.
      const section = fromSection
      const list =
        section === 'slottedAbilities'
          ? useCharacterStore.getState().currentCharacter?.slottedAbilities ?? []
          : useCharacterStore.getState().currentCharacter?.abilityPool ?? []

      const fromIndex = list.findIndex((a) => a.id === activeId)
      // If over.id is the section container itself, drop at the end.
      const toIndex =
        overId === 'slottedAbilities' || overId === 'abilityPool'
          ? list.length - 1
          : list.findIndex((a) => a.id === overId)

      if (fromIndex === -1 || toIndex === -1) return
      reorderAbility(section, fromIndex, toIndex)
    } else {
      // Cross-section move.
      const ability =
        fromSection === 'slottedAbilities'
          ? useCharacterStore.getState().currentCharacter?.slottedAbilities.find((a) => a.id === activeId)
          : useCharacterStore.getState().currentCharacter?.abilityPool.find((a) => a.id === activeId)

      if (!ability) return

      // Validate slot capacity when moving INTO slotted.
      if (overSection === 'slottedAbilities') {
        // Remove the ability from the current slotted list (if it was there) for the check.
        const currentSlotted = slottedAbilities.filter((a) => a.id !== activeId)
        if (!canSlot(currentSlotted, maxSlots, ability)) return
      }

      moveAbility(activeId, fromSection, overSection)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {activeAbility ? (
          <div className="sortable-ability sortable-ability--overlay">
            <AbilityBlockCard ability={activeAbility} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
