/**
 * useAbilityListDnd — the drag wiring for one ability list.
 *
 * Every ability list in the app (Slotted Abilities, Ability Pool, a custom
 * tab's ability sections, an NPC's abilities) drags identically, so the wiring
 * lives here once and each section hands the results to the drag context above
 * it. The hook owns two things:
 *
 *   1. **The drop target.** The element wrapping the cards is registered as a
 *      droppable, so a card dropped on the list's padding (or on an empty list)
 *      resolves to the end of the list instead of being cancelled, and the
 *      section can highlight itself while a card hovers it.
 *
 *   2. **The insertion index.** {@link useAbilityDropHintResolver} turns each
 *      drag event into "index N" — the index the section draws its indicator at
 *      and the index the drop action uses.
 *
 *   3. **Registration.** The resolver and the current list are handed to the
 *      surrounding drag context, which is the only thing that sees the drag and
 *      so the only thing that can ask every section "where would this land?" on
 *      each move.
 *
 * The hook is deliberately unaware of *where cards come from*: a drop inside
 * this list reads as a reorder, a drop from another list as a move, and both
 * arrive at the caller as an index into this list as it stands now.
 */

import { useEffect, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'

import { useAbilityDropRegistry } from '@/components/sheet/AbilityDropHintContext'
import { useAbilityDropHintResolver } from '@/hooks/useAbilityDropHintResolver'

export interface AbilityListDndArgs {
  /** Id of the list — also the id its cards register with dnd-kit. */
  id: string
  /** The list in render order. */
  items: readonly { id: string }[]
  /** Which way the list flows, which decides the axis a drop is measured on. */
  layout?: 'cards' | 'list'
  /**
   * Whether a card dragged from elsewhere may land here. Consulted while the
   * card hovers, so a destination that would be refused (a full Slotted
   * Abilities section) reads as unavailable instead of accepting a drop it
   * then throws away.
   *
   * Keep the identity stable between renders that answer the same question (a
   * `useCallback` over the slot budget), or the section re-registers on every
   * drag event.
   */
  canAccept?: (activeId: string) => boolean
}

export interface AbilityListDnd {
  /** Attach to the element wrapping this list's cards. */
  setDroppableRef: (node: HTMLElement | null) => void
  /** True while a dragged card is over this list. */
  isOver: boolean
}

export function useAbilityListDnd({
  id,
  items,
  layout,
  canAccept,
}: AbilityListDndArgs): AbilityListDnd {
  const registry = useAbilityDropRegistry()
  const resolver = useAbilityDropHintResolver({ id, layout, canAccept })
  const { setNodeRef, isOver } = useDroppable({ id, data: { section: id } })

  // The list travels with the registration so the drag context always reads the
  // rows as they are *now*: a drop can land while another card is still in the
  // air, and the indicator has to follow the list through it.
  const registration = useMemo(() => ({ id, items, resolver }), [id, items, resolver])

  const register = registry?.register
  useEffect(() => {
    if (!register) return
    return register(registration)
  }, [register, registration])

  return useMemo(
    () => ({ setDroppableRef: setNodeRef, isOver }),
    [setNodeRef, isOver],
  )
}
