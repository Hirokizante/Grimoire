/**
 * useHorizontalWheelScroll — let a sideways-scrolling strip answer the wheel.
 *
 * The GM panels' status strip and Mortal Wound strip are each ONE line that
 * scrolls sideways rather than wrapping (`.gm-statuses__strip` /
 * `.gm-mw__strip`), and both hide their scrollbar, so the cut edge of the last
 * pill/chip is the only scroll affordance. That works for a trackpad — a
 * two-finger sideways swipe reports `deltaX` and the browser scrolls the strip
 * natively — but a mouse wheel only ever reports `deltaY`, and an `overflow-x`
 * container never consumes a vertical delta: the wheel chained straight past
 * the strip to the page and the strip could not be moved with a mouse at all.
 *
 * This hook attaches a **non-passive** `wheel` listener and translates a
 * vertical wheel into `scrollLeft`. It has to be a native listener: React
 * registers `onWheel` passively at the root container, so `preventDefault()`
 * inside a React wheel handler is a no-op (and warns).
 *
 * The wheel is never trapped. Once the strip is at its edge in the wheel's
 * direction there is nothing left for it to do, and the gesture must go on to
 * the page — so the hook hands the delta to the nearest vertically scrollable
 * ancestor (or the document) itself and consumes it there. Doing that by hand
 * rather than simply returning is deliberate: Chromium stops the compositor
 * from chaining a wheel that a non-passive listener has seen, so "let it
 * bubble" silently dropped the gesture and the GM's page stopped scrolling
 * whenever the pointer rested on a full strip (measured in
 * `e2e/gm-screen.spec.ts`). The hand-off only runs when the strip cannot use
 * the delta, and only consumes the event when the page actually moved, so a
 * page that is itself at its end keeps whatever the browser would have done.
 *
 * What it deliberately does NOT do:
 *   - **Never take a gesture it cannot use.** A horizontal gesture (`|deltaX|`
 *     wins — trackpad swipes already work and keep their momentum) and a
 *     modified wheel (`ctrl` is browser/pinch zoom, `shift` is the browser's own
 *     sideways scroll) fall straight through untouched.
 *   - **Never animate.** `scrollLeft` is assigned directly, so one notch moves
 *     the strip by the pixels the browser reported and a burst of notches
 *     cannot queue up a laggy smooth-scroll.
 *
 * Usage: hand the returned callback ref to the scrolling element. The node is
 * also written to `externalRef` when one is passed, for callers that measure it
 * (as `PanelStatuses` does to bring a newly added pill into view).
 */

import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * `WheelEvent.deltaMode` values, named here so the arithmetic below reads
 * without a trip to the spec.
 */
const DELTA_MODE_LINE = 1
const DELTA_MODE_PAGE = 2

/** What one "line" of wheel travel is worth in pixels (Firefox reports lines). */
const LINE_PIXELS = 16

/** The wheel's travel in pixels, whatever unit the browser reported it in. */
function wheelPixels(event: WheelEvent, node: HTMLElement): number {
  if (event.deltaMode === DELTA_MODE_LINE) return event.deltaY * LINE_PIXELS
  if (event.deltaMode === DELTA_MODE_PAGE) return event.deltaY * node.clientWidth
  return event.deltaY
}

/** Move `node` by `delta` pixels if it can; report whether anything moved. */
function scrollByPixels(node: Element, delta: number): boolean {
  const max = node.scrollHeight - node.clientHeight
  if (max <= 0) return false
  const before = node.scrollTop
  const next = Math.max(0, Math.min(max, before + delta))
  if (next === before) return false
  node.scrollTop = next
  return true
}

/**
 * Give the wheel to the page: the nearest ancestor that scrolls vertically, or
 * the document itself. Returns false when nothing could move — the very top or
 * bottom of the page — so the caller leaves the event alone.
 */
function scrollPageVertically(node: HTMLElement, delta: number): boolean {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent)
    if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') {
      continue
    }
    if (scrollByPixels(parent, delta)) return true
  }
  const root = document.scrollingElement
  return root ? scrollByPixels(root, delta) : false
}

export function useHorizontalWheelScroll<T extends HTMLElement>(
  /** Also kept up to date with the node, for callers that measure it. */
  externalRef?: RefObject<T | null>,
) {
  const detachRef = useRef<(() => void) | null>(null)

  const setNode = useCallback(
    (node: T | null) => {
      detachRef.current?.()
      detachRef.current = null
      if (externalRef) externalRef.current = node
      if (!node) return

      const onWheel = (event: WheelEvent) => {
        // Ctrl+wheel is the browser's zoom (and a trackpad pinch); shift+wheel
        // is its own sideways scroll. Neither is ours to take over.
        if (event.ctrlKey || event.shiftKey) return
        // A sideways gesture already scrolls this container natively, momentum
        // included — translating it here would only make it worse.
        if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return

        const delta = wheelPixels(event, node)
        const max = node.scrollWidth - node.clientWidth

        if (max > 0) {
          const left = Math.max(0, Math.min(max, node.scrollLeft + delta))
          // The strip still has room: it takes the notch, the page does not.
          if (left !== node.scrollLeft) {
            node.scrollLeft = left
            event.preventDefault()
            return
          }
        }

        // The strip is at its edge (or has nothing to scroll): the wheel
        // belongs to the page now.
        if (scrollPageVertically(node, delta)) event.preventDefault()
      }

      node.addEventListener('wheel', onWheel, { passive: false })
      detachRef.current = () => node.removeEventListener('wheel', onWheel)
    },
    [externalRef],
  )

  // Safety net only: React also calls a callback ref with `null` when the
  // element unmounts, which is the normal detach path.
  useEffect(
    () => () => {
      detachRef.current?.()
      detachRef.current = null
    },
    [],
  )

  return setNode
}

export default useHorizontalWheelScroll
