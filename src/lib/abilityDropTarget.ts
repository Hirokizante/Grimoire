/**
 * abilityDropTarget — where a dragged ability card would land.
 *
 * Every ability list in the app (Slotted Abilities ↔ Ability Pool, a custom
 * tab's ability sections, an NPC's ability list) renders as one of two layouts:
 *
 *   - `cards` — a CSS multi-column masonry grid, so cards flow down a column
 *     before starting the next one and the drop axis is **horizontal**;
 *   - `list`  — a single full-width column, where the drop axis is **vertical**.
 *
 * The drop axis is therefore a property of the layout, not of the section, and
 * the pointer has to be read along it: horizontally in the grid (left/right of
 * a card's midline decides before/after), vertically in a list (above/below).
 *
 * The functions here are deliberately pure — no DOM, no dnd-kit — so the
 * decision "index 2, in front of that card" can be unit-tested directly, while
 * {@link useAbilityDropHintResolver} supplies the pointer and the measured box
 * from a real drag.
 *
 * The same file owns the other half of that decision: the **preview**, the
 * translation each card takes and the line that is drawn while the card is
 * still in the air (see {@link previewOffsets} and {@link dropLineTarget}).
 * Both are read off the one resolved index, so what the list shows and where the
 * card lands cannot disagree.
 */

import type { ClientRect } from '@dnd-kit/core'

/** How an ability list is laid out — and so which way a drop is measured. */
export type AbilityDropAxis = 'horizontal' | 'vertical'

/**
 * Where the pointer is, in viewport coordinates, pulled off a dnd-kit event.
 *
 * dnd-kit does not expose the pointer directly: it hands over the activator
 * event (the pointerdown that started the drag) and the delta the drag has
 * travelled since, and the pointer is the two added together. Both are read
 * defensively — a keyboard drag has no coordinates at all, and a drop with no
 * pointer simply falls back to "in front of the hovered card".
 */
export function pointerFromDragEvent(event: {
  activatorEvent: Event
  delta: { x: number; y: number }
}): { x: number; y: number } | null {
  const activator = event.activatorEvent as {
    clientX?: number
    clientY?: number
    touches?: ArrayLike<{ clientX: number; clientY: number }>
  }
  const touch = activator?.touches?.[0]
  const x = touch?.clientX ?? activator?.clientX
  const y = touch?.clientY ?? activator?.clientY
  if (typeof x !== 'number' || typeof y !== 'number') return null
  return { x: x + event.delta.x, y: y + event.delta.y }
}

/**
 * The axis a drop is measured along for a section's view mode. The masonry card
 * grid flows cards across columns (`horizontal`); the list view stacks them
 * (`vertical`).
 */
export function dropAxisForLayout(
  layout: 'cards' | 'list' | undefined,
): AbilityDropAxis {
  return layout === 'list' ? 'vertical' : 'horizontal'
}

/** Just the measured box a before/after decision needs. */
export interface DropRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * True when the pointer is past the middle of the card it is hovering along the
 * drop axis — i.e. the drop belongs **after** that card rather than before it.
 *
 * The pointer is the thing to test, not the box of the card being dragged.
 * dnd-kit reports that box from the drag's own collision measurements, and using
 * it here reads as authoritative while quietly disagreeing with what the user is
 * pointing at: the box lags the pointer, and a wide card's leading edge can
 * still be short of a narrow target's midline when the cursor is well past it.
 * The pointer is also what the person is actually looking at, so the indicator
 * lands where their cursor says.
 *
 * A pointer position that cannot be read counts as "not past", which keeps the
 * card in the gap in front of the hovered one — the same place a drop with no
 * hover target at all would put it.
 */
export function isPointerPastCardMidpoint(
  pointer: { x: number; y: number } | null | undefined,
  overRect: DropRect | null | undefined,
  axis: AbilityDropAxis,
): boolean {
  if (!pointer || !overRect) return false
  if (axis === 'vertical') {
    return pointer.y > overRect.top + overRect.height / 2
  }
  return pointer.x > overRect.left + overRect.width / 2
}

/**
 * The index a dragged card lands at, dropping it on the card at `overIndex`
 * with the pointer on the side `past` says.
 *
 * **The answer is a gap index**: an index into the list of *remaining* cards,
 * naming the gap by the card that follows it. That is exactly the index the drop
 * indicator draws at — the reflowed list is what the user sees while the card is
 * lifted, so gap N of the remaining cards sits where the Nth line is drawn — and
 * exactly what the store's actions take, since they splice the card out before
 * splicing it back in. One coordinate, so the line the user is shown and the
 * slot the card lands in cannot drift apart.
 *
 * `overIndex` is the hovered card's index *as rendered*, which still includes
 * the dragged card. That is the whole subtlety: with the card lifted, a hovered
 * card that follows it has slid up one place, so its rendered index is one more
 * than the gap it names. `past` therefore means "the gap behind the hovered
 * card" for a card arriving from elsewhere or being dragged backward, and "the
 * slot the hovered card is vacating" when the drag is moving forward across it —
 * which is also what makes releasing over the very next card the no-op the
 * reflow has already shown, rather than a phantom swap.
 *
 * Worked through on `[A, B, C, D]`, dragging the **second** card `B` — so
 * `activeIndex` is 1 and `forward` is true only for `C` and `D`:
 *
 *   - hovering `C`, pointer on its near side: index 1 — the no-op, since `C`
 *     has slid up into `B`'s place and the gap in front of it is where `B` is;
 *   - hovering `C`, pointer past its middle: index 2 — `[A, C, B, D]`;
 *   - hovering `D`, past its middle: index 3 — `[A, C, D, B]`;
 *   - hovering `A`, pointer on its near side: index 0 — `[B, A, C, D]`, since
 *     the gap in front of `A` is the front of the list;
 *   - hovering `A`, past its middle: index 1 — `[A, B, C, D]`. `A` never moved,
 *     so the gap behind it is one place back from its index, which is exactly
 *     where `B` already is.
 */
export function insertionIndexForPosition(
  overIndex: number,
  past: boolean,
  activeIndex: number,
): number {
  if (overIndex < 0) return overIndex
  // Released over the card it was lifted from. dnd-kit excludes the dragged
  // card from its own collision results, so this is a guard rather than a case:
  // without it the "past its middle" reading would name a gap and swap the card
  // with its neighbour.
  if (overIndex === activeIndex) return overIndex
  // A card arriving from another list: nothing was lifted out of this one, so
  // the rendered index and the gap index agree and the pointer is the whole
  // answer.
  if (activeIndex < 0) return past ? overIndex + 1 : overIndex

  // The hovered card's index is a place *among the rendered cards*, which still
  // count the lifted one; the answer is a gap *among the remaining cards*. Two
  // one-place corrections take it from one to the other, and they never both
  // apply:
  //
  //   - `past` moves the gap to the far side of the hovered card;
  //   - a hovered card that follows the lifted one has already slid up into its
  //     place, so the rendered index counts one card too many.
  const forward = overIndex > activeIndex
  return overIndex + (past ? 1 : 0) - (forward ? 1 : 0)
}

/** The client rect dnd-kit measures for a list — enough for a drop decision. */
export function dropRectOf(rect: ClientRect | null | undefined): DropRect | null {
  if (!rect) return null
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

/* ---- The preview the user drags against -----------------------------------
 *
 * The drop index above says where the card lands; these say what the list looks
 * like while it is still in the air. The two are deliberately driven by the same
 * number: the preview is the drop, drawn early, so the list can never show one
 * destination and take another.
 *
 * dnd-kit ships a sorting strategy for this, and it is the wrong one here.
 * `rectSortingStrategy` moves every card onto the *box* of another card and
 * **scales** it to that box's size, so in a masonry grid — where the cards are
 * different heights — the cards the user is dragging past are squashed and
 * stretched as they slide, and the lifted card's own faded placeholder does the
 * same on its way to a slot. It also resolves the destination from the hovered
 * card alone, which is one slot away from what the pointer-side rule above
 * decides. Translating without scaling, at the index the drop itself will use,
 * is both the honest picture and the calmer one.
 */

/** A card's top-left corner, in the coordinates the list was measured in. */
export interface SlotPoint {
  left: number
  top: number
}

/**
 * A card's whole box, in the coordinates the list was measured in — the slot the
 * preview translates cards onto and the box the drop line is drawn against.
 */
export interface SlotRect extends SlotPoint {
  width: number
  height: number
}

/**
 * The slot the card at `index` takes once the card at `activeIndex` lands in
 * `gapIndex` — the array move the store performs, written as slot positions
 * rather than as a new array.
 *
 * The cards the move passes over each take the slot of the card before them,
 * which is what "the list closes the gap and opens one where the card lands"
 * looks like from a single card's point of view.
 */
export function destinationIndexFor(
  index: number,
  activeIndex: number,
  gapIndex: number,
): number {
  if (index === activeIndex) return gapIndex
  if (gapIndex > activeIndex && index > activeIndex && index <= gapIndex) {
    return index - 1
  }
  if (gapIndex < activeIndex && index >= gapIndex && index < activeIndex) {
    return index + 1
  }
  return index
}

export interface PreviewOffsetsArgs {
  /** The list in render order, as the drop index is expressed against it. */
  items: readonly { id: string }[]
  /**
   * Where each card sat in the list's own layout when the drag began, keyed by
   * ability id. `null` until the list has been measured, which reads as "no
   * preview" rather than as a wrong one.
   */
  slots: ReadonlyMap<string, SlotPoint> | null | undefined
  /** The card in the air, or `null` while none is. */
  activeId: string | null | undefined
  /** The index the drop resolved to — the same one the drop action takes. */
  gapIndex: number
}

/**
 * How far each card moves while a card is in the air, keyed by ability id.
 *
 * A card arriving from **another list** leaves nothing behind here, so nothing
 * in this list moves and the answer is empty: its preview is the line alone.
 * A card lifted out of **this** list is a real slot change, and every card takes
 * the slot the drop will leave it in — including the lifted card, which is drawn
 * in its destination slot while its ghost follows the pointer.
 *
 * "After the last card" clamps to the last slot, exactly as the store's splice
 * does, so appending previews as the list's new final card.
 */
export function previewOffsets({
  items,
  slots,
  activeId,
  gapIndex,
}: PreviewOffsetsArgs): Map<string, SlotPoint> {
  const offsets = new Map<string, SlotPoint>()
  if (!slots || !activeId || items.length < 2) return offsets

  const activeIndex = items.findIndex((item) => item.id === activeId)
  if (activeIndex === -1) return offsets

  const gap = Math.min(Math.max(gapIndex, 0), items.length - 1)
  if (gap === activeIndex) return offsets

  for (let index = 0; index < items.length; index += 1) {
    const destination = destinationIndexFor(index, activeIndex, gap)
    if (destination === index) continue
    const from = slots.get(items[index].id)
    const to = slots.get(items[destination].id)
    if (!from || !to) continue
    offsets.set(items[index].id, {
      left: to.left - from.left,
      top: to.top - from.top,
    })
  }

  return offsets
}

/** Which card's slot the drop line marks, and which of its edges the line sits on. */
export interface DropLineTarget {
  id: string
  /**
   * `before` draws in the gap on the slot's leading edge, `after` on its
   * trailing edge — the one insertion point with no card in front of it.
   */
  edge: 'before' | 'after'
}

/**
 * The card whose slot the drop line marks — the box the line is drawn on, given
 * the same resolved gap index the drop itself will use.
 *
 * A card lifted out of **this** list is previewed in the slot it is about to
 * take (see {@link previewOffsets}), so the line marks that slot's leading edge:
 * the slot of the card at the destination index, which is the index the move
 * clamps to. A card arriving from **another list** moves nothing, so the gap is
 * still on the far side of the card at that index — in front of it, or behind
 * the last card when the drop appends.
 *
 * Returns `null` for an empty list, which has no slot to mark: its empty drop
 * zone is the whole affordance.
 */
export function dropLineTarget(
  items: readonly { id: string }[],
  activeId: string | null | undefined,
  gapIndex: number,
): DropLineTarget | null {
  if (items.length === 0) return null

  if (activeId && items.some((item) => item.id === activeId)) {
    // "After the last card" clamps to the last slot, exactly as the preview and
    // the store's splice do.
    const slot = Math.min(Math.max(gapIndex, 0), items.length - 1)
    return { id: items[slot].id, edge: 'before' }
  }

  if (gapIndex >= items.length) {
    return { id: items[items.length - 1].id, edge: 'after' }
  }
  return { id: items[Math.max(gapIndex, 0)].id, edge: 'before' }
}
