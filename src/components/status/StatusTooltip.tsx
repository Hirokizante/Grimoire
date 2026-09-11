/**
 * StatusTooltip — the hover/focus card that explains a status condition.
 *
 * `StatusTooltipCard` is the card's *content* (icon, name, description as plain
 * text) and is shared by every surface that shows a status, so a condition
 * reads identically wherever it is hovered: an inline `[StatusName]` reference
 * in a sheet description and a tracked-status pill on a GM Screen panel.
 *
 * `StatusTooltip` is the portalled variant the GM Screen uses. A panel pill
 * cannot host an absolutely-positioned card the way `.status-ref` does: the
 * pill clips its own contents (`overflow: hidden` is what keeps the filled left
 * cap inside the rounded border) and the pill strip scrolls sideways
 * (`overflow-x: auto`), so any card rendered inside it would be sliced off. The
 * card therefore renders into `document.body` with `position: fixed`, anchored
 * to the pill's own measured rect — the pill keeps its exact geometry and the
 * card is never clipped, while staying on the same z-index rung (1000) as the
 * sheet's inline card, below the roll-log drawer, the modal layer, and the
 * sticky title bar.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import StatusIcon from '@/components/status/StatusIcon'
import { plainTextFromMarkdown } from '@/lib/markdown'
import type { StatusCondition } from '@/types'

/** Gap between the anchor and the card, matching `.status-tooltip--inline`. */
const GAP = 6
/** Closest the card may come to a viewport edge. */
const EDGE = 8

/** The card's content: status icon, name, and its description as plain text. */
export function StatusTooltipCard({ status }: { status: StatusCondition }) {
  return (
    <>
      <StatusIcon
        icon={status.icon || '§'}
        iconType={status.icon ? status.iconType : 'emoji'}
        size={18}
      />
      <span className="status-tooltip__body">
        <strong className="status-tooltip__name">
          {status.name || 'Status'}
        </strong>
        {status.description && (
          <span className="status-tooltip__desc">
            {plainTextFromMarkdown(status.description)}
          </span>
        )}
      </span>
    </>
  )
}

export interface StatusTooltipProps {
  status: StatusCondition
  /** The element the card is anchored to (the pill's name button). */
  anchor: HTMLElement | null
}

/**
 * The portalled card. Renders nothing until it knows its anchor, and places
 * itself in a layout effect so its first painted frame is already positioned —
 * no flash at the viewport origin, and no second frame where it sits over the
 * pill before flipping.
 */
export function StatusTooltip({ status, anchor }: StatusTooltipProps) {
  const cardRef = useRef<HTMLSpanElement>(null)
  const [placement, setPlacement] = useState({ top: 0, left: 0, below: false })

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!anchor || !card) return

    const place = () => {
      const rect = anchor.getBoundingClientRect()
      // Measure rather than assume: the card's width is style-driven (and capped
      // on narrow phones), so hard-coding it here would mis-centre it there.
      const half = card.offsetWidth / 2
      // Never let the card hang off either side of the viewport.
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, EDGE + half),
        Math.max(EDGE + half, window.innerWidth - EDGE - half),
      )
      // Above the pill by default; below it when the pill sits too close to the
      // top of the viewport for the card to fit (the usual case for the first
      // row of panels on a scrolled-to-top screen).
      const below = rect.top - GAP - card.offsetHeight < EDGE
      setPlacement({
        left,
        top: below ? rect.bottom + GAP : rect.top - GAP,
        below,
      })
    }

    place()
    // The page scrolls, and the status strip scrolls sideways under a cursor
    // that never moves: without re-placing, the card would stay behind while
    // its pill slides away. Capture phase catches the strip's own scroll too.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor])

  if (!anchor) return null

  return createPortal(
    <span
      ref={cardRef}
      className={
        'status-tooltip status-tooltip--portal' +
        (placement.below ? ' status-tooltip--below' : '')
      }
      role="tooltip"
      style={{ top: placement.top, left: placement.left }}
    >
      <StatusTooltipCard status={status} />
    </span>,
    document.body,
  )
}

export default StatusTooltip
