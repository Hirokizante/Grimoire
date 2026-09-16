/**
 * useAbilityDropHintResolver — turns one dnd-kit drag event into the index a
 * dragged ability card would land at in **this** list.
 *
 * Sections know their own lists; the drag context only sees ids. Rather than
 * duplicate the order maths in the context (where the list does not live), each
 * ability section owns one of these and registers it, and the drag context runs
 * every registered resolver on each move and publishes the single hint that came
 * back. The index the indicator shows is therefore produced by the same code,
 * reading the same list, that the drop action uses.
 *
 * A resolver borrows the list for the duration of one call rather than closing
 * over it: a drag can change the list while the card is still in the air, and
 * the indicator has to follow the list *as it is now*. Handing it in per event
 * means nothing has to be smuggled past React to keep it fresh.
 */

import { useMemo } from 'react'
import type { DragOverEvent } from '@dnd-kit/core'

import {
  dropAxisForLayout,
  dropRectOf,
  insertionIndexForPosition,
  isPointerPastCardMidpoint,
  pointerFromDragEvent,
  type AbilityDropAxis,
} from '@/lib/abilityDropTarget'
import type { AbilityDropHint } from '@/components/sheet/AbilityDropHintContext'

/** The list a resolver is answering about, in render order. */
export interface DropHintList {
  id: string
  items: readonly { id: string }[]
}

export interface DropHintResolver {
  /** Id of the list this resolver answers for. */
  id: string
  /**
   * The hint for this list, or `null` when the event's `over` target is not
   * part of it — which is how the drag context picks the one section that
   * should draw an indicator.
   */
  resolve: (event: DragOverEvent, list: DropHintList) => AbilityDropHint | null
}

export interface DropHintResolverArgs {
  /** Id of the list — also the id its cards and its droppable register with. */
  id: string
  /** Which way the list flows, which decides the axis a drop is measured on. */
  layout?: 'cards' | 'list'
  /**
   * Whether a card from another list may land here. Consulted while the card
   * hovers so a destination that would be refused (a full Slotted Abilities
   * section) reads as unavailable instead of accepting a drop it discards.
   *
   * It is folded into the resolver's identity, so it must be stable between
   * renders that answer the same question — passing a fresh closure every render
   * re-registers the section on every drag event.
   */
  canAccept?: (activeId: string) => boolean
}

export function useAbilityDropHintResolver({
  id,
  layout,
  canAccept,
}: DropHintResolverArgs): DropHintResolver {
  const axis: AbilityDropAxis = dropAxisForLayout(layout)

  return useMemo(
    () => ({
      id,
      resolve: (event: DragOverEvent, list: DropHintList): AbilityDropHint | null => {
        const { active, over } = event
        if (!over) return null

        const activeId = String(active.id)
        const overId = String(over.id)
        const valid = canAccept?.(activeId) ?? true

        // Hovering the list itself — its padding, or the empty-list drop zone —
        // means the end of the list.
        if (overId === list.id) {
          return { section: list.id, index: list.items.length, valid, activeId }
        }

        const overIndex = list.items.findIndex((item) => item.id === overId)
        if (overIndex === -1) return null

        // The dragged card keeps its slot while lifted, so when it belongs to
        // this list its index is still the one the insertion index is relative
        // to. -1 means it is arriving from another list.
        const activeIndex = list.items.findIndex((item) => item.id === activeId)

        // Which side of the hovered card's middle the pointer is on. The pointer
        // comes from the drag event (the activator plus the distance travelled);
        // the card's box comes from dnd-kit's collision measurement. Both are in
        // viewport coordinates, so they compare directly.
        const past = isPointerPastCardMidpoint(
          pointerFromDragEvent(event),
          dropRectOf(over.rect),
          axis,
        )

        return {
          section: list.id,
          index: insertionIndexForPosition(overIndex, past, activeIndex),
          valid,
          activeId,
        }
      },
    }),
    [axis, id, canAccept],
  )
}
