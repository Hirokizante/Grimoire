/**
 * useViewportClampedPanel — keep an absolutely-positioned dropdown panel
 * inside the viewport.
 *
 * The list pages' FilterDropdown / SortDropdown panels are anchored to their
 * trigger button (`right: 0`) and carry a `min-width` far wider than the
 * button itself, so whichever way the button's edge lands, the panel runs off
 * that side of the screen. On a phone the Character/NPC list head wraps its
 * actions to a right-aligned second line: the Filter button ends up a
 * button's width from the LEFT gutter, and a 16rem panel anchored to its right
 * edge starts ~108px off-screen at 360px — the panel (and its first column of
 * options, plus the header's title) is simply cut off, with no way to scroll
 * it back. The `@media (max-width: 400px)` fallback in App.css could only
 * shrink the panel; it could not move it.
 *
 * CSS cannot know where the trigger landed, so on open (and on viewport
 * resize) the panel's natural width is measured and its horizontal offset is
 * clamped to `[gutter, viewportWidth - width - gutter]`. Right-aligned panels
 * keep hugging the trigger's right edge while there is room — the clamp only
 * bites at the edges.
 *
 * The panel stays absolutely positioned inside its own container: it keeps
 * scrolling with the page it belongs to and needs no portal, so the
 * click-outside check on the container is unaffected.
 *
 * Placement can only decide WHERE a panel sits, so a panel wider than the
 * viewport itself is still out of scope — every such panel carries a
 * `max-width: min(20rem, calc(100vw - 2rem))` (plus a `min-width` that stays
 * under it on phones), which is what keeps it narrower than the screen.
 *
 * `align` is which trigger edge the panel prefers to hug: `'end'` for the
 * Filter/Sort trigger (their CSS is `right: 0`), `'start'` for the in-sheet
 * SelectDropdown (`left: 0`).
 */

import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Gap kept between the panel and the viewport edge, in px. */
const VIEWPORT_GUTTER = 8

export function useViewportClampedPanel(
  /** Whether the panel is currently mounted. */
  open: boolean,
  /** The panel's `position: relative` container — the anchor's own box. */
  anchorRef: RefObject<HTMLElement | null>,
  /** Trigger edge the panel hugs when there is room. */
  align: 'start' | 'end' = 'end',
): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const anchor = anchorRef.current
    if (!panel || !anchor) return

    const place = () => {
      // Measure the panel's natural (CSS-authored) width first: a previous
      // placement left an inline width behind, and re-measuring with it
      // applied would keep a stale box across a rotation/resize.
      panel.style.left = ''
      panel.style.right = ''
      panel.style.width = ''
      const width = panel.getBoundingClientRect().width
      // No layout yet (jsdom, or the panel is not rendered): nothing to place.
      if (!width) return

      const box = anchor.getBoundingClientRect()
      const viewport = document.documentElement.clientWidth || window.innerWidth
      const preferred = align === 'end' ? box.right - width : box.left
      const left = Math.max(
        VIEWPORT_GUTTER,
        Math.min(preferred, viewport - width - VIEWPORT_GUTTER),
      )

      // Pin the measured width as well: an absolutely-positioned box with
      // `left` set and `right: auto` shrink-to-fits against its container,
      // which is only as wide as the trigger button.
      panel.style.width = `${width}px`
      panel.style.left = `${left - box.left}px`
      panel.style.right = 'auto'
    }

    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, anchorRef, align])

  return panelRef
}

export default useViewportClampedPanel
