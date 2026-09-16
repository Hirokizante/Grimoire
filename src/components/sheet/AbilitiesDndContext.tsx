/**
 * AbilitiesDndContext — wraps the Slotted Abilities and Ability Pool sections
 * in a single dnd-kit `DndContext` so abilities can be dragged within a list
 * (reorder) and across lists (move between slotted and pool).
 *
 * The two sections each use their own `SortableContext` so dnd-kit handles the
 * reordering animation, and each registers a drop resolver with the hint store.
 * On every move the context asks the sections "where would this land?" —
 * exactly one answers, and that answer is used twice:
 *
 *   - published to the sections, so the card drawing the indicator knows which
 *     edge to draw it on (see {@link AbilityDropHintContext}); and
 *   - held for `onDragEnd`, which uses the same index as the destination.
 *
 * Resolving the drop once per move and reusing it on drop is what keeps the
 * line the user sees and the slot the card lands in from ever disagreeing.
 *
 * Slot validation happens **while the card hovers**: a move into Slotted
 * Abilities is checked against `canSlot` from {@link slotLogic}, so a full
 * section reads as unavailable (its indicator turns red) instead of accepting a
 * drop and then silently discarding it.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
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
  AbilitySlotBudgetContext,
  useAbilityDropHintStore,
  type AbilityDropHint,
} from '@/components/sheet/AbilityDropHintContext'
import { useCharacterStore } from '@/store/characterStore'
import { canAcceptIntoSlots } from '@/lib/slotLogic'
import type { AbilityBlock, Character } from '@/types'

export interface AbilitiesDndContextProps {
  /** Max slotted ability slots — used to validate drops into the slotted section. */
  maxSlots: number
  /** Current slotted abilities (for slot validation). */
  slottedAbilities: AbilityBlock[]
  children: React.ReactNode
}

type SectionId = 'slottedAbilities' | 'abilityPool'

/** The drag ghost eases into the slot it lands in rather than snapping there. */
const DROP_ANIMATION = {
  duration: 180,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    // The source card keeps its slot for the whole drag and is faded by its own
    // class; without this the ghost lands on top of it and the swap flashes.
    styles: { active: { opacity: '0' } },
  }),
}

export default function AbilitiesDndContext({
  maxSlots,
  slottedAbilities,
  children,
}: AbilitiesDndContextProps) {
  const moveAbility = useCharacterStore((s) => s.moveAbility)
  const reorderAbility = useCharacterStore((s) => s.reorderAbility)

  const hintStore = useAbilityDropHintStore()
  const [activeAbility, setActiveAbility] = useState<AbilityBlock | null>(null)
  /** The last resolved destination — the index the drop will use. */
  const lastHintRef = useRef<AbilityDropHint | null>(null)

  /**
   * Whether one more ability fits in the slotted section. A card already in it
   * keeps its own slot, so it never counts against itself. This is the
   * `canAccept` the slotted section publishes, which is what turns "this drop
   * would overflow the slots" into a red indicator *before* the drop.
   */
  const canSlotAbility = useCallback(
    (abilityId: string) => {
      const char = useCharacterStore.getState().currentCharacter
      return canAcceptIntoSlots(
        abilityId,
        slottedAbilities,
        maxSlots,
        char?.abilityPool.find((a) => a.id === abilityId) ??
          char?.slottedAbilities.find((a) => a.id === abilityId),
      )
    },
    [slottedAbilities, maxSlots],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // The live region's narration. Card names are read off the character so a
  // screen reader hears "Cleave", not an id, and the two lists are named the way
  // the sheet titles them.
  const announcements = useMemo(
    () =>
      createAbilityDragAnnouncements({
        abilityName: (id) => {
          const char = useCharacterStore.getState().currentCharacter
          const key = String(id)
          return (
            char?.slottedAbilities.find((a) => a.id === key)?.name ??
            char?.abilityPool.find((a) => a.id === key)?.name
          )
        },
        listName: (id) =>
          id === 'slottedAbilities'
            ? 'Slotted Abilities'
            : id === 'abilityPool'
              ? 'the Ability Pool'
              : undefined,
      }),
    [],
  )

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    lastHintRef.current = null
    const all = useCharacterStore.getState()
    setActiveAbility(
      all.currentCharacter?.slottedAbilities.find((a) => a.id === id) ??
        all.currentCharacter?.abilityPool.find((a) => a.id === id) ??
        null,
    )
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

    const char = useCharacterStore.getState().currentCharacter
    const fromSection = sectionOf(char, activeId)
    const overId = String(over.id)
    // Where the card was dropped: a section's own droppable names itself, a card
    // names only itself, so the second case is resolved through the lists.
    const toSection =
      (over.data.current?.section as SectionId | undefined) ?? sectionOf(char, overId)
    if (!fromSection || !toSection) return

    // The destination the indicator promised. The fallbacks cover a drop that
    // resolved no move event: the hovered card's own index, or the end of the
    // list when the list itself was the target.
    const list = listFor(char, toSection)
    const index =
      hint?.section === toSection
        ? hint.index
        : overId === toSection
          ? list.length
          : list.findIndex((a) => a.id === overId)
    if (index === -1) return

    if (fromSection === toSection) {
      const fromIndex = list.findIndex((a) => a.id === activeId)
      if (fromIndex === -1 || fromIndex === index) return
      reorderAbility(fromSection, fromIndex, index)
      return
    }

    // Crossing sections: re-check the slot budget, in case the list changed
    // while the card was in the air.
    if (toSection === 'slottedAbilities' && !canSlotAbility(activeId)) return
    moveAbility(activeId, fromSection, toSection, index)
  }

  const handleDragCancel = () => {
    hintStore.publishDragEnd()
    lastHintRef.current = null
    setActiveAbility(null)
  }

  return (
    <AbilityDropHintContext.Provider value={hintStore}>
      <AbilitySlotBudgetContext.Provider value={canSlotAbility}>
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
          <DragOverlay dropAnimation={DROP_ANIMATION}>
            {activeAbility ? (
              <div className="sortable-ability sortable-ability--overlay">
                <AbilityCardFrame ability={activeAbility} mode="edit" showHandle />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </AbilitySlotBudgetContext.Provider>
    </AbilityDropHintContext.Provider>
  )
}

/** Which section a card currently lives in, or `undefined` if neither. */
function sectionOf(
  char: Character | null | undefined,
  abilityId: string,
): SectionId | undefined {
  if (!char) return undefined
  if (char.slottedAbilities.some((a) => a.id === abilityId)) return 'slottedAbilities'
  if (char.abilityPool.some((a) => a.id === abilityId)) return 'abilityPool'
  return undefined
}

function listFor(
  char: Character | null | undefined,
  section: SectionId,
): AbilityBlock[] {
  return (
    (section === 'slottedAbilities' ? char?.slottedAbilities : char?.abilityPool) ?? []
  )
}
