/**
 * useAbilityCardSlots — the list's own layout, frozen at the moment a drag
 * starts.
 *
 * The drag preview moves cards onto the slots the drop will leave them in, and
 * the drop line is drawn at the slot the card will land in (see `previewOffsets`
 * / `dropLineTarget` in `lib/abilityDropTarget`). Both are read from **this**
 * measurement — the boxes the list has right now, before any preview translation
 * is applied — so the preview is never measured back out of the DOM and cannot
 * feed back into itself.
 *
 * Measuring once per drag, on the commit that arms the drag, is what keeps the
 * slots the untouched layout. Three details are load-bearing:
 *
 *   - the boxes are **container-relative**, because that is the coordinate space
 *     the line is absolutely positioned in;
 *   - the measurement backs each element's own transform out, so a card caught
 *     mid-slide by the settle animation of the *previous* drop measures where it
 *     is laid out rather than where it is being animated from;
 *   - only direct children are measured: the sub-abilities nested inside a card
 *     are not slots in this list, and neither is anything else a card renders.
 */

import { useLayoutEffect, useState, type RefObject } from 'react'

import type { SlotRect } from '@/lib/abilityDropTarget'

/** The list's own cards — the boxes a drop can move another card into. */
const CARD_SELECTOR = ':scope > .sortable-ability[data-ability-id]'

/**
 * Where each of `containerRef`'s cards sits, keyed by ability id and measured
 * against the container, from the moment `isDragging` turns true until the drag
 * ends. `null` means "not measured" — a list with no drag in flight, or one with
 * no cards — which the preview reads as "draw nothing" rather than as a wrong
 * slot.
 */
export function useAbilityCardSlots(
  containerRef: RefObject<HTMLElement | null>,
  isDragging: boolean,
): ReadonlyMap<string, SlotRect> | null {
  const [slots, setSlots] = useState<ReadonlyMap<string, SlotRect> | null>(null)

  useLayoutEffect(() => {
    setSlots(isDragging ? measureCards(containerRef.current) : null)
  }, [containerRef, isDragging])

  return slots
}

function measureCards(container: HTMLElement | null): Map<string, SlotRect> | null {
  if (!container) return null

  const origin = container.getBoundingClientRect()
  const slots = new Map<string, SlotRect>()
  container.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((node) => {
    const id = node.dataset.abilityId
    if (!id) return
    const box = layoutBoxOf(node, origin)
    slots.set(id, box)
  })
  return slots
}

/**
 * An element's box relative to `origin`, as it is *laid out*, with any transform
 * undone — `getBoundingClientRect` reports where the card is drawn, and a card
 * still sliding into place from the previous drop would otherwise be measured
 * mid-flight and recorded at a slot it never occupies.
 */
function layoutBoxOf(node: HTMLElement, origin: DOMRect): SlotRect {
  const rect = node.getBoundingClientRect()
  const transform = getComputedStyle(node).transform
  let left = rect.left
  let top = rect.top
  if (transform && transform !== 'none' && typeof DOMMatrixReadOnly !== 'undefined') {
    const matrix = new DOMMatrixReadOnly(transform)
    left -= matrix.m41
    top -= matrix.m42
  }
  return {
    left: left - origin.left,
    top: top - origin.top,
    width: rect.width,
    height: rect.height,
  }
}
