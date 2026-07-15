/**
 * CustomTabDndContext — wraps CustomAbilitySections within a custom tab in a
 * single dnd-kit `DndContext` so abilities can be reordered within a section
 * and moved between sections within the same tab.
 *
 * SortableContext for each section lives inside CustomAbilitySection itself.
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
import type { AbilityBlock, CustomTab } from '@/types'

export interface CustomTabDndContextProps {
  tabId: string
  children: React.ReactNode
}

export default function CustomTabDndContext({
  tabId,
  children,
}: CustomTabDndContextProps) {
  const reorderCustomAbility = useCharacterStore((s) => s.reorderCustomAbility)
  const moveCustomAbility = useCharacterStore((s) => s.moveCustomAbility)

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
    const char = useCharacterStore.getState().currentCharacter
    if (!char) return
    const tab = char.customTabs.find((t: CustomTab) => t.id === tabId)
    if (!tab) return
    for (const section of tab.sections) {
      const found = section.abilities.find((a: AbilityBlock) => a.id === id)
      if (found) {
        setActiveAbility(found)
        return
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveAbility(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const fromSection = active.data.current?.section as string | undefined
    const overSection = (over.data.current?.section as string | undefined) ??
      (typeof overId === 'string' ? overId : undefined)

    if (!fromSection || !overSection) return

    const char = useCharacterStore.getState().currentCharacter
    if (!char) return
    const tab = char.customTabs.find((t) => t.id === tabId)
    if (!tab) return

    if (fromSection === overSection) {
      const section = tab.sections.find((s) => s.id === fromSection)
      if (!section) return
      const fromIndex = section.abilities.findIndex((a) => a.id === activeId)
      const toIndex =
        overId === section.id
          ? section.abilities.length - 1
          : section.abilities.findIndex((a) => a.id === overId)
      if (fromIndex === -1 || toIndex === -1) return
      reorderCustomAbility(tabId, fromSection, fromIndex, toIndex)
    } else {
      moveCustomAbility(tabId, fromSection, overSection, activeId)
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
