/**
 * Where a dragged ability card lands.
 *
 * The DOM half of this — which box dnd-kit measured, which card the pointer is
 * over — needs layout, so it is exercised for real in
 * `e2e/custom-sections.spec.ts`. What is pinned here is the arithmetic in
 * between, because a drop landing one slot away from the line the user was
 * shown is a one-character bug that no type checker can catch.
 *
 * **The answer is a paste index**, the same one the store's actions take: they
 * splice the card out and then splice it back in at that index. It doubles as
 * the coordinate the drop indicator draws in, because the reflowed list the user
 * is looking at while dragging *is* the list with the card removed — gap N of
 * the remaining cards sits exactly where the Nth indicator line is drawn.
 * `arrayMove` is deliberately not used to model it: it performs its own
 * translation and would hide a double conversion.
 *
 * Expectations are written as the order the user ends up looking at, since that
 * is the thing a person can check; the numbers on their own are only meaningful
 * against the implementation.
 */

import { describe, expect, test } from 'vitest'

import {
  destinationIndexFor,
  dropAxisForLayout,
  dropLineTarget,
  insertionIndexForPosition,
  isPointerPastCardMidpoint,
  pointerFromDragEvent,
  previewOffsets,
  type SlotPoint,
} from '@/lib/abilityDropTarget'

const box = (left: number, top: number, width = 100, height = 80) => ({
  left,
  top,
  width,
  height,
})

/** Drop within one list: lift the card out, then put it back at `toIndex`. */
function afterDrag<T>(list: T[], activeIndex: number, toIndex: number): T[] {
  const remaining = list.filter((_, i) => i !== activeIndex)
  remaining.splice(toIndex, 0, list[activeIndex])
  return remaining
}

/** Drop from another list: insert the card, nothing is removed. */
function afterMoveIn<T>(list: T[], card: T, toIndex: number): T[] {
  const next = [...list]
  next.splice(toIndex, 0, card)
  return next
}

/** Where the card ends up, dragging `activeIndex` onto `overIndex`. */
function drop(
  list: string[],
  activeIndex: number,
  overIndex: number,
  past: boolean,
): string[] {
  return afterDrag(
    list,
    activeIndex,
    insertionIndexForPosition(overIndex, past, activeIndex),
  )
}

const ABC = ['A', 'B', 'C']

describe('insertionIndexForPosition', () => {
  test('a card from another list lands where it was dropped', () => {
    // Nothing is lifted out of the target, so the pointer is the whole answer:
    // the gap in front of the hovered card, or behind it once past its midline.
    const before = insertionIndexForPosition(0, false, -1)
    expect(afterMoveIn(ABC, 'X', before)).toEqual(['X', 'A', 'B', 'C'])

    const after = insertionIndexForPosition(1, true, -1)
    expect(afterMoveIn(ABC, 'X', after)).toEqual(['A', 'B', 'X', 'C'])

    const atEnd = insertionIndexForPosition(2, true, -1)
    expect(afterMoveIn(ABC, 'X', atEnd)).toEqual(['A', 'B', 'C', 'X'])
  })

  test('a card dragged forward swaps with the card the pointer passed', () => {
    // [A, B, C] dragging A right. B has slid up into the hole, so the pointer is
    // read against it: near side is still A's own place, far side is the swap.
    expect(drop(ABC, 0, 1, false)).toEqual(['A', 'B', 'C'])
    expect(drop(ABC, 0, 1, true)).toEqual(['B', 'A', 'C'])
    // Past the last card there is nothing left to vacate, so A appends.
    expect(drop(ABC, 0, 2, true)).toEqual(['B', 'C', 'A'])
  })

  test('a card dragged backward swaps with the card the pointer passed', () => {
    // [A, B, C] dragging C left. Neither A nor B moves, so the pointer's side of
    // each names a real gap: in front of the card, or behind it.
    expect(drop(ABC, 2, 1, false)).toEqual(['A', 'C', 'B'])
    expect(drop(ABC, 2, 1, true)).toEqual(['A', 'B', 'C'])
    expect(drop(ABC, 2, 0, false)).toEqual(['C', 'A', 'B'])
    expect(drop(ABC, 2, 0, true)).toEqual(['A', 'C', 'B'])
  })

  test('hovering a card that precedes the dragged one moves it in front', () => {
    // [A, B, C] dragging B left onto A. A did not move when B was lifted, so
    // both sides of its middle name a gap in front of it — the gap in front of A
    // is 0, and the gap behind it is 1, which is where B already is.
    expect(drop(ABC, 1, 0, false)).toEqual(['B', 'A', 'C'])
    expect(drop(ABC, 1, 0, true)).toEqual(['A', 'B', 'C'])
  })

  test('dragging is symmetric: a card ends up where its pointer points', () => {
    // The control that keeps the off-by-one honest. Dragging right past a card
    // and dragging that card left past this one must land in the same order.
    expect(drop(ABC, 0, 1, true)).toEqual(['B', 'A', 'C'])
    expect(drop(ABC, 2, 1, false)).toEqual(['A', 'C', 'B'])
    // And dragging across two cards lands at the far end, not the middle.
    expect(drop(ABC, 0, 2, true)).toEqual(['B', 'C', 'A'])
    expect(drop(ABC, 2, 0, false)).toEqual(['C', 'A', 'B'])
  })

  test('a one-place drag moves the card exactly one place', () => {
    // The invariant behind the off-by-one: dragging across n cards moves the
    // card exactly n places, in either direction.
    const list = ['A', 'B', 'C', 'D', 'E']
    expect(drop(list, 0, 3, true)).toEqual(['B', 'C', 'D', 'A', 'E'])
    expect(drop(list, 4, 1, true)).toEqual(['A', 'B', 'E', 'C', 'D'])
    expect(drop(list, 2, 4, true)).toEqual(['A', 'B', 'D', 'E', 'C'])
    expect(drop(list, 2, 0, true)).toEqual(['A', 'C', 'B', 'D', 'E'])
  })

  test('the four-card cases the index rule was derived from', () => {
    // Dragging B out of [A, B, C, D], so the hovered card has slid up only for
    // C and D.
    const list = ['A', 'B', 'C', 'D']
    const drag = (overIndex: number, past: boolean) =>
      drop(list, 1, overIndex, past)

    // C took B's place: its near side is the no-op, its far side is the slot C
    // is vacating.
    expect(drag(2, false)).toEqual(['A', 'B', 'C', 'D'])
    expect(drag(2, true)).toEqual(['A', 'C', 'B', 'D'])
    // Past the last card, B appends.
    expect(drag(3, true)).toEqual(['A', 'C', 'D', 'B'])
    // Dragging B back over A: the gap in front of A is 0, which moves B past it,
    // and the gap behind A is 1 — where B already is, so releasing there is the
    // no-op the reflow showed rather than a phantom swap.
    expect(drag(0, false)).toEqual(['B', 'A', 'C', 'D'])
    expect(drag(0, true)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('a card released over itself does not move', () => {
    for (const past of [false, true]) {
      expect(drop(ABC, 1, 1, past)).toEqual(['A', 'B', 'C'])
    }
  })

  test('an unknown hovered card reports -1 so the caller can bail', () => {
    expect(insertionIndexForPosition(-1, false, 0)).toBe(-1)
    expect(insertionIndexForPosition(-1, true, 0)).toBe(-1)
  })

  test('every drag within a list lands somewhere valid', () => {
    const list = ['A', 'B', 'C', 'D']
    for (let activeIndex = 0; activeIndex < list.length; activeIndex++) {
      for (let overIndex = 0; overIndex < list.length; overIndex++) {
        for (const past of [false, true]) {
          const toIndex = insertionIndexForPosition(overIndex, past, activeIndex)
          expect(toIndex).toBeGreaterThanOrEqual(0)
          expect(toIndex).toBeLessThan(list.length)
          // Nothing is lost or duplicated, and a release over the dragged card
          // itself can only be a no-op.
          const next = afterDrag(list, activeIndex, toIndex)
          expect(next).toHaveLength(list.length)
          expect([...next].sort()).toEqual([...list].sort())
          if (overIndex === activeIndex) expect(next).toEqual(list)
        }
      }
    }
  })

  test('every drop from another list lands somewhere valid', () => {
    const list = ['A', 'B', 'C']
    for (let overIndex = 0; overIndex < list.length; overIndex++) {
      for (const past of [false, true]) {
        const toIndex = insertionIndexForPosition(overIndex, past, -1)
        expect(toIndex).toBeGreaterThanOrEqual(0)
        expect(toIndex).toBeLessThanOrEqual(list.length)
        expect(afterMoveIn(list, 'X', toIndex)).toHaveLength(list.length + 1)
      }
    }
  })
})

describe('isPointerPastCardMidpoint', () => {
  const point = (x: number, y: number) => ({ x, y })

  test('the grid measures left/right against the hovered card', () => {
    // The card spans x 300–400, so its middle is 350.
    const card = box(300, 0)
    expect(isPointerPastCardMidpoint(point(310, 40), card, 'horizontal')).toBe(false)
    expect(isPointerPastCardMidpoint(point(390, 40), card, 'horizontal')).toBe(true)
    // Exactly on the middle counts as not yet past, so a card settles in the gap
    // it was dragged into rather than flickering across it.
    expect(isPointerPastCardMidpoint(point(350, 40), card, 'horizontal')).toBe(false)
    // The vertical position is irrelevant on the horizontal axis.
    expect(isPointerPastCardMidpoint(point(390, 9999), card, 'horizontal')).toBe(true)
  })

  test('a list measures top/bottom against the hovered card', () => {
    const card = box(0, 200)
    expect(isPointerPastCardMidpoint(point(10, 210), card, 'vertical')).toBe(false)
    expect(isPointerPastCardMidpoint(point(10, 290), card, 'vertical')).toBe(true)
    expect(isPointerPastCardMidpoint(point(9999, 210), card, 'vertical')).toBe(false)
  })

  test('the axis follows the layout, not the section', () => {
    expect(dropAxisForLayout('cards')).toBe('horizontal')
    expect(dropAxisForLayout('list')).toBe('vertical')
    // An unset layout is the card grid, which is what every section defaults to.
    expect(dropAxisForLayout(undefined)).toBe('horizontal')
  })

  test('a pointer that cannot be read is never "past"', () => {
    expect(isPointerPastCardMidpoint(null, box(0, 0), 'horizontal')).toBe(false)
    expect(isPointerPastCardMidpoint(undefined, box(0, 0), 'vertical')).toBe(false)
    // An unmeasured card cannot answer either, so the drop keeps its place.
    expect(isPointerPastCardMidpoint(point(500, 500), null, 'horizontal')).toBe(false)
  })
})

describe('pointerFromDragEvent', () => {
  test('adds the distance travelled to where the drag started', () => {
    expect(
      pointerFromDragEvent({
        activatorEvent: new PointerEvent('pointerdown', { clientX: 100, clientY: 50 }),
        delta: { x: 30, y: -10 },
      }),
    ).toEqual({ x: 130, y: 40 })
  })

  test('reads a touch drag’s starting point off the touch list', () => {
    const touch = { clientX: 200, clientY: 80 }
    const event = { touches: [touch] } as unknown as Event
    expect(pointerFromDragEvent({ activatorEvent: event, delta: { x: 5, y: 5 } })).toEqual(
      { x: 205, y: 85 },
    )
  })

  test('a keyboard drag has no pointer, and says so', () => {
    expect(
      pointerFromDragEvent({
        activatorEvent: new KeyboardEvent('keydown'),
        delta: { x: 0, y: 10 },
      }),
    ).toBeNull()
  })
})

/* ---- The preview ---------------------------------------------------------- */

const ids = (...names: string[]) => names.map((name) => ({ id: name }))

/** A three-column grid, one 100×80 card per slot, in reading order. */
function slotMap(names: readonly string[]): Map<string, SlotPoint> {
  const slots = new Map<string, SlotPoint>()
  names.forEach((name, index) => {
    slots.set(name, { left: (index % 3) * 120, top: Math.floor(index / 3) * 100 })
  })
  return slots
}

/** Where a card is drawn once its offset is applied. */
function drawnSlot(slot: SlotPoint, offset: SlotPoint | undefined): SlotPoint {
  return { left: slot.left + (offset?.left ?? 0), top: slot.top + (offset?.top ?? 0) }
}

/**
 * The order the preview draws: every card's drawn box, read back in slot order.
 * This is what the user sees, so it is the thing the expectations are written
 * against.
 */
function previewOrder(
  names: readonly string[],
  slots: ReadonlyMap<string, SlotPoint>,
  offsets: ReadonlyMap<string, SlotPoint>,
): string[] {
  return names
    .map((name) => ({ name, at: drawnSlot(slots.get(name)!, offsets.get(name)) }))
    .sort((a, b) => a.at.top - b.at.top || a.at.left - b.at.left)
    .map((card) => card.name)
}

/** The slot index a card is drawn in. */
function drawnSlotIndex(
  names: readonly string[],
  slots: ReadonlyMap<string, SlotPoint>,
  offsets: ReadonlyMap<string, SlotPoint>,
  name: string,
): number {
  return previewOrder(names, slots, offsets).indexOf(name)
}

describe('previewOffsets', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F']
  const slots = slotMap(names)

  const offsetsFor = (activeId: string, gapIndex: number) =>
    previewOffsets({ items: ids(...names), slots, activeId, gapIndex })

  test('the lifted card is drawn in the slot it is about to take', () => {
    // [A, B, C, D] dragging A onto the gap in front of C: A takes C's slot, and
    // B and C each slide up one to close the hole A left behind.
    const offsets = offsetsFor('A', 2)
    expect(drawnSlot(slots.get('A')!, offsets.get('A'))).toEqual({ left: 240, top: 0 })
    expect(drawnSlot(slots.get('B')!, offsets.get('B'))).toEqual({ left: 0, top: 0 })
    expect(drawnSlot(slots.get('C')!, offsets.get('C'))).toEqual({ left: 120, top: 0 })
    expect(offsets.get('D')).toBeUndefined()
  })

  test('a card dragged backward takes the slot it was dropped in', () => {
    // [A, B, C, D] dragging D back in front of B: B and C each step back one
    // slot to open the gap.
    const offsets = offsetsFor('D', 1)
    expect(drawnSlot(slots.get('D')!, offsets.get('D'))).toEqual({ left: 120, top: 0 })
    expect(drawnSlot(slots.get('B')!, offsets.get('B'))).toEqual({ left: 240, top: 0 })
    expect(drawnSlot(slots.get('C')!, offsets.get('C'))).toEqual({ left: 0, top: 100 })
    expect(offsets.get('A')).toBeUndefined()
    expect(offsets.get('E')).toBeUndefined()
  })

  test('nothing moves when the drop is where the card already is', () => {
    expect(offsetsFor('B', 1).size).toBe(0)
  })

  test('a drop past the end of the list previews as the last slot', () => {
    // "Below the last card" is a gap one past the end; the move clamps there, the
    // same way the store's splice does, so the card previews as the new last one.
    const offsets = offsetsFor('A', names.length)
    expect(offsets.get('A')).toEqual({ left: 240, top: 100 })
    expect(offsets.get('F')).toEqual({ left: -120, top: 0 })
  })

  test('a card arriving from another list moves nothing', () => {
    // It vacates no slot here, so the list it is joining stays exactly as it is
    // and the destination line is the whole preview.
    expect(offsetsFor('X', 2).size).toBe(0)
  })

  test('an unmeasured list has no preview rather than a wrong one', () => {
    expect(
      previewOffsets({ items: ids(...names), slots: null, activeId: 'A', gapIndex: 2 }).size,
    ).toBe(0)
    expect(
      previewOffsets({ items: ids(...names), slots, activeId: null, gapIndex: 2 }).size,
    ).toBe(0)
  })

  test('every card is drawn in the order the drop will leave the list', () => {
    // The invariant that keeps the preview and the drop from ever disagreeing:
    // reading the drawn boxes back in slot order has to be the reordered list.
    for (let activeIndex = 0; activeIndex < names.length; activeIndex += 1) {
      for (let gapIndex = 0; gapIndex <= names.length; gapIndex += 1) {
        const offsets = previewOffsets({
          items: ids(...names),
          slots,
          activeId: names[activeIndex],
          gapIndex,
        })
        expect(previewOrder(names, slots, offsets)).toEqual(
          afterDrag(names, activeIndex, gapIndex),
        )
      }
    }
  })

  test('the preview is a permutation of the slots — nothing is stacked or lost', () => {
    for (let activeIndex = 0; activeIndex < names.length; activeIndex += 1) {
      for (let gapIndex = 0; gapIndex <= names.length; gapIndex += 1) {
        const offsets = previewOffsets({
          items: ids(...names),
          slots,
          activeId: names[activeIndex],
          gapIndex,
        })
        const drawn = names.map((name) =>
          JSON.stringify(drawnSlot(slots.get(name)!, offsets.get(name))),
        )
        expect(new Set(drawn).size).toBe(names.length)
      }
    }
  })

  test('a card that does not move is left alone', () => {
    // Only the cards between the lift and the drop are translated; everything
    // else keeps `undefined`, so the card is not re-rendered with a no-op
    // transform that could restart its transition.
    const offsets = offsetsFor('A', 1)
    expect([...offsets.keys()].sort()).toEqual(['A', 'B'])
  })

  test('destinationIndexFor is the inverse of where each card came from', () => {
    // Each slot receives exactly one card, and the card in it is the one the
    // order puts there.
    for (let activeIndex = 0; activeIndex < names.length; activeIndex += 1) {
      for (let gapIndex = 0; gapIndex < names.length; gapIndex += 1) {
        const filled = names.map((_, index) => destinationIndexFor(index, activeIndex, gapIndex))
        expect([...filled].sort((a, b) => a - b)).toEqual(
          names.map((_, index) => index),
        )
      }
    }
  })
})

describe('dropLineTarget', () => {
  const names = ['A', 'B', 'C', 'D']

  test('the line for a lifted card marks the slot it is taking', () => {
    // Reordered inside its own list, the card is previewed in its destination
    // slot, so the line belongs on that slot's leading edge — the slot of the
    // card at the destination index.
    expect(dropLineTarget(ids(...names), 'A', 2)).toEqual({ id: 'C', edge: 'before' })
    expect(dropLineTarget(ids(...names), 'C', 0)).toEqual({ id: 'A', edge: 'before' })
  })

  test('the line a lifted card draws sits on the slot the drop uses', () => {
    const slots = slotMap(names)
    for (let activeIndex = 0; activeIndex < names.length; activeIndex += 1) {
      for (let gapIndex = 0; gapIndex <= names.length; gapIndex += 1) {
        const offsets = previewOffsets({
          items: ids(...names),
          slots,
          activeId: names[activeIndex],
          gapIndex,
        })
        const target = dropLineTarget(ids(...names), names[activeIndex], gapIndex)!
        const clampedGap = Math.min(gapIndex, names.length - 1)
        // The line is drawn on the slot the lifted card is previewed in — the
        // slot at the destination index, which is the box of the card that was
        // sitting there.
        expect(names.indexOf(target.id)).toBe(clampedGap)
        expect(drawnSlotIndex(names, slots, offsets, names[activeIndex])).toBe(clampedGap)
      }
    }
  })

  test('a card arriving from another list is marked in the gap it lands in', () => {
    // Nothing moved, so the gap is still in front of the card at that index.
    expect(dropLineTarget(ids(...names), 'X', 0)).toEqual({ id: 'A', edge: 'before' })
    expect(dropLineTarget(ids(...names), 'X', 2)).toEqual({ id: 'C', edge: 'before' })
  })

  test('a drop past the end of the list is marked under the last card', () => {
    expect(dropLineTarget(ids(...names), 'X', names.length)).toEqual({
      id: 'D',
      edge: 'after',
    })
    // The lifted card's own append is previewed in the last slot instead, so its
    // line stays on that slot's leading edge.
    expect(dropLineTarget(ids(...names), 'A', names.length)).toEqual({
      id: 'D',
      edge: 'before',
    })
  })

  test('an empty list has no slot to mark', () => {
    expect(dropLineTarget([], 'X', 0)).toBeNull()
    expect(dropLineTarget([], null, 0)).toBeNull()
  })

  test('the card it names is always one of the list’s own', () => {
    for (const activeId of [...names, 'X', null, undefined]) {
      for (let gapIndex = -1; gapIndex <= names.length + 1; gapIndex += 1) {
        const target = dropLineTarget(ids(...names), activeId, gapIndex)
        expect(names).toContain(target!.id)
      }
    }
  })
})
