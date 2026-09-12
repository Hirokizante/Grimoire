/**
 * NpcAbilitiesDndContext — the drag-and-drop context for an NPC's ability list.
 *
 * An NPC has exactly **one** ability list, so this context only reorders: the
 * dragged card and the card it is dropped on are looked up in `abilities`, and
 * the new order is handed back through `onReorder` for the section to persist
 * onto whichever record owns the list (the store's current NPC on a standalone
 * sheet, the attached NPC record inside a player sheet's custom tab).
 *
 * Everything the player sheet's {@link AbilitiesDndContext} does around a drag
 * is mirrored here so the two feel identical: a 6px pointer activation
 * constraint (a click on the card's buttons still reads as a click), the
 * keyboard sensor with sortable coordinates, `closestCorners` collision
 * detection, and a drag overlay rendering the live card — with the uses
 * steppers neutralised in CSS (`.sortable-ability--overlay`), because the ghost
 * is a picture rather than a control.
 *
 * It deliberately lives **inside** {@link NPCAbilitiesSection}: an NPC section
 * embedded in a custom tab sits within the tab's own {@link CustomTabDndContext},
 * and a nested `DndContext` keeps the two apart — an NPC card can only be
 * dropped inside its own list, never onto a custom ability section (which the
 * tab context already refuses to do in the other direction). Only edit mode
 * mounts it; a view-mode section renders plain cards with no drag handles.
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
import type { AbilityBlock, Character } from '@/types'

/**
 * Droppable id for the list itself, so a card dropped past the last one (or
 * into an empty list) resolves to the end of the list instead of being
 * cancelled. Mirrors `AbilitiesDndContext`'s use of the section id.
 */
export const NPC_ABILITIES_SECTION_ID = 'npcAbilities'

export interface NpcAbilitiesDndContextProps {
  /** The list, in render order — the source of truth for both indices. */
  abilities: AbilityBlock[]
  /** Move the card at `fromIndex` to `toIndex` (both already validated). */
  onReorder: (fromIndex: number, toIndex: number) => void
  /**
   * Entity the cards belong to, so the drag ghost resolves dice notation
   * against the NPC it was lifted from rather than the store's current
   * character (an attached NPC is not the current character).
   */
  owner?: Character
  children: React.ReactNode
}

export default function NpcAbilitiesDndContext({
  abilities,
  onReorder,
  owner,
  children,
}: NpcAbilitiesDndContextProps) {
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
    const id = String(event.active.id)
    setActiveAbility(abilities.find((a) => a.id === id) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveAbility(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const fromIndex = abilities.findIndex((a) => a.id === activeId)
    // Dropping on the list container itself means "the end of the list".
    const toIndex =
      overId === NPC_ABILITIES_SECTION_ID
        ? abilities.length - 1
        : abilities.findIndex((a) => a.id === overId)

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    onReorder(fromIndex, toIndex)
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
            <AbilityBlockCard ability={activeAbility} character={owner} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
