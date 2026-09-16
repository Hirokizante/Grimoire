/**
 * CustomTabDndContext — wraps CustomAbilitySections within a custom tab in a
 * single dnd-kit `DndContext` so abilities can be reordered within a section
 * and moved between sections within the same tab.
 *
 * SortableContext for each section lives inside CustomAbilitySection itself,
 * and so does the section's drop resolver: the section registers it with the
 * hint store below, and this context asks every registered section "where would
 * this land?" on each move. Exactly one answers, and that answer is both drawn
 * (as the insertion indicator, via the same store) and used as the destination
 * on drop — one resolution, so the line and the landing slot cannot disagree.
 *
 * Both ends of a drag are resolved against the **tab record**, not against the
 * drag payload: the payload names only the list a card was rendered in, while
 * whether that list takes part in a tab drag is a fact about the section's
 * `kind`, which only the store holds.
 */

import { useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import AbilityCardFrame from '@/components/sheet/AbilityCardFrame'
import { createAbilityDragAnnouncements,
  ABILITY_DRAG_INSTRUCTIONS,
} from '@/components/sheet/abilityDragAnnouncements'
import {
  AbilityDropHintContext,
  useAbilityDropHintStore,
  type AbilityDropHint,
} from '@/components/sheet/AbilityDropHintContext'
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

  const hintStore = useAbilityDropHintStore()
  const [activeAbility, setActiveAbility] = useState<AbilityBlock | null>(null)
  /** The last resolved destination — the index the drop will use. */
  const lastHintRef = useRef<AbilityDropHint | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // The live region's narration: card names off the tab record, and each
  // section named the way its heading reads.
  const announcements = useMemo(
    () =>
      createAbilityDragAnnouncements({
        abilityName: (id) => {
          const char = useCharacterStore.getState().currentCharacter
          const tab = char?.customTabs.find((t: CustomTab) => t.id === tabId)
          for (const section of tab?.sections ?? []) {
            if (section.kind !== 'ability') continue
            const found = section.abilities.find((a) => a.id === String(id))
            if (found) return found.name
          }
          return undefined
        },
        listName: (id) => {
          const char = useCharacterStore.getState().currentCharacter
          const tab = char?.customTabs.find((t: CustomTab) => t.id === tabId)
          const section = tab?.sections.find((s) => s.id === id)
          return section && section.kind === 'ability' ? section.name : undefined
        },
      }),
    [tabId],
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    lastHintRef.current = null
    const char = useCharacterStore.getState().currentCharacter
    const tab = char?.customTabs.find((t: CustomTab) => t.id === tabId)
    if (!tab) return
    for (const section of tab.sections) {
      if (section.kind !== 'ability') continue
      const found = section.abilities.find((a: AbilityBlock) => a.id === id)
      if (found) {
        setActiveAbility(found)
        break
      }
    }
    hintStore.publishDragStart()
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const hint = hintStore.publishDragMove(event)
    if (hint) lastHintRef.current = hint
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const activeId = String(active.id)
    // A pointer drop always follows at least one move, but a keyboard drop can
    // end without one — fall back to resolving the end event itself, so the
    // destination is still the one the indicator showed.
    const hint = lastHintRef.current ?? hintStore.resolve(event)

    hintStore.publishDragEnd()
    lastHintRef.current = null
    setActiveAbility(null)

    if (!over) return

    const overId = String(over.id)

    // The drag payload only names the list a card was rendered in. Whether that
    // list takes part in a tab drag is a fact about the tab record, so both ends
    // are resolved there — the payload carries no `kind`, and asking it for one
    // turned every custom-tab drag into a silent no-op.
    const char = useCharacterStore.getState().currentCharacter
    if (!char) return
    const tab = char.customTabs.find((t) => t.id === tabId)
    if (!tab) return

    const fromSection = tab.sections.find(
      (s) => s.id === active.data.current?.section,
    )
    // A section's own droppable names itself; a card names only itself, so the
    // second case is looked up in the tab.
    const toSectionId = (over.data.current?.section as string | undefined) ?? overId
    const toSection = tab.sections.find((s) => s.id === toSectionId)

    // Only ability sections participate in drag-and-drop. An NPC's list is
    // reorder-only and lives in its own nested context, so a card can never be
    // lifted out of an ability section into an NPC.
    if (!fromSection || fromSection.kind !== 'ability') return
    if (!toSection || toSection.kind !== 'ability') return

    // The destination the indicator promised, falling back to the hovered card
    // (or the end of the section) when a drop resolved no move event.
    const index =
      hint?.section === toSection.id
        ? hint.index
        : overId === toSection.id
          ? toSection.abilities.length
          : toSection.abilities.findIndex((a) => a.id === overId)
    if (index === -1) return

    if (fromSection.id === toSection.id) {
      const fromIndex = fromSection.abilities.findIndex((a) => a.id === activeId)
      if (fromIndex === -1 || fromIndex === index) return
      reorderCustomAbility(tabId, fromSection.id, fromIndex, index)
      return
    }

    moveCustomAbility(tabId, fromSection.id, toSection.id, activeId, index)
  }

  const handleDragCancel = () => {
    hintStore.publishDragEnd()
    lastHintRef.current = null
    setActiveAbility(null)
  }

  return (
    <AbilityDropHintContext.Provider value={hintStore}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{
          announcements,
          screenReaderInstructions: ABILITY_DRAG_INSTRUCTIONS,
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay
          dropAnimation={{
            duration: 180,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
            sideEffects: defaultDropAnimationSideEffects({
              styles: { active: { opacity: '0' } },
            }),
          }}
        >
          {activeAbility ? (
            <div className="sortable-ability sortable-ability--overlay">
              <AbilityCardFrame ability={activeAbility} mode="edit" showHandle />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </AbilityDropHintContext.Provider>
  )
}
