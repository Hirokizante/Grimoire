/**
 * NpcAbilitiesDndContext — the drag-and-drop context for an NPC's ability list.
 *
 * An NPC has exactly **one** ability list, so this context only reorders: the
 * dragged card and the card it is dropped on are looked up in `abilities`, and
 * the new index is handed back through `onReorder` for the section to persist
 * onto whichever record owns the list (the store's current NPC on a standalone
 * sheet, the attached NPC record inside a player sheet's custom tab).
 *
 * Everything the player sheet's {@link AbilitiesDndContext} does around a drag
 * is mirrored here so the two feel identical: a 6px pointer activation
 * constraint (a click on the card's buttons still reads as a click), the
 * keyboard sensor with sortable coordinates, `closestCorners` collision
 * detection, the same insertion indicator resolved from the same list maths,
 * and a drag overlay rendering the same card — with the uses steppers
 * neutralised in CSS (`.sortable-ability--overlay`), because the ghost is a
 * picture rather than a control.
 *
 * It deliberately lives **inside** {@link NPCAbilitiesSection}: an NPC section
 * embedded in a custom tab sits within the tab's own {@link CustomTabDndContext},
 * and a nested `DndContext` keeps the two apart — an NPC card can only be
 * dropped inside its own list, never onto a custom ability section (which the
 * tab context already refuses to do in the other direction). The nested
 * {@link AbilityDropHintContext} keeps the two contexts' drop hints apart for
 * the same reason: the NPC list registers itself here, so a tab-level drag can
 * never make it draw an indicator, and vice versa. Only edit mode mounts it; a
 * view-mode section renders plain cards with no drag handles.
 *
 * **The list must be a child of this component, not a sibling.** Everything the
 * preview needs — the insertion line, the card translations, the hovered frame —
 * is read back out of the hint store published here, and the list registers its
 * resolver with the *nearest* provider above it. The section therefore renders
 * {@link NpcAbilityList} (which calls `useAbilityListDnd`) inside this context;
 * a registration made beside it would land in the surrounding tab's store, or in
 * no store at all on the standalone NPC sheet, leaving this context unable to
 * resolve a drop while its `onDragEnd` fallback still reordered the list.
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

  // An NPC has one list, so every card belongs to the same destination and the
  // narration only has to name the card.
  const announcements = useMemo(
    () =>
      createAbilityDragAnnouncements({
        abilityName: (id) => abilities.find((a) => a.id === String(id))?.name,
        listName: () => 'the ability list',
      }),
    [abilities],
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    lastHintRef.current = null
    setActiveAbility(abilities.find((a) => a.id === id) ?? null)
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
    const fromIndex = abilities.findIndex((a) => a.id === activeId)
    // The destination the indicator promised. Dropping on the list container
    // itself means the end of the list; the fallback below covers a drop that
    // resolved no move event.
    const toIndex =
      hint?.section === NPC_ABILITIES_SECTION_ID
        ? hint.index
        : overId === NPC_ABILITIES_SECTION_ID
          ? abilities.length
          : abilities.findIndex((a) => a.id === overId)

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    onReorder(fromIndex, Math.min(toIndex, abilities.length - 1))
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
              <AbilityCardFrame
                ability={activeAbility}
                mode="edit"
                showHandle
                character={owner}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </AbilityDropHintContext.Provider>
  )
}
