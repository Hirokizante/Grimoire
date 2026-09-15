/**
 * CustomTabDndContext — wraps CustomAbilitySections within a custom tab in a
 * single dnd-kit `DndContext` so abilities can be reordered within a section
 * and moved between sections within the same tab.
 *
 * SortableContext for each section lives inside CustomAbilitySection itself.
 *
 * Both ends of a drag are resolved against the **tab record**, not against the
 * drag payload: the payload names only the list a card was rendered in, while
 * whether that list takes part in a tab drag is a fact about the section's
 * `kind`, which only the store holds.
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
      if (section.kind !== 'ability') continue
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

    // The drag payload only names the list a card was rendered in. Whether
    // that list takes part in a tab drag is a fact about the tab record, so
    // both ends are resolved there — the payload carries no `kind`, and asking
    // it for one turned every custom-tab drag into a silent no-op.
    const fromSection = active.data.current?.section as string | undefined
    const overSection = (over.data.current?.section as string | undefined) ??
      (typeof overId === 'string' ? overId : undefined)
    if (!fromSection || !overSection) return

    const char = useCharacterStore.getState().currentCharacter
    if (!char) return
    const tab = char.customTabs.find((t) => t.id === tabId)
    if (!tab) return

    // Only ability sections participate in drag-and-drop. An NPC's list is
    // reorder-only and lives in its own nested context, so a card can never be
    // lifted out of an ability section into an NPC.
    const sourceSection = tab.sections.find((s) => s.id === fromSection)
    if (!sourceSection || sourceSection.kind !== 'ability') return

    const targetSection = tab.sections.find((s) => s.id === overSection)
    if (!targetSection || targetSection.kind !== 'ability') return

    if (fromSection === overSection) {
      const section = targetSection
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
