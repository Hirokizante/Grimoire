/**
 * PanelExpand — animates an expanded GM Screen panel body open and closed.
 *
 * Panels mount and unmount their body, so a plain CSS transition has nothing
 * to interpolate from. Animating `height: auto` is not possible; animating
 * `grid-template-rows: 0fr → 1fr` is, and it needs no measurement. The body
 * stays mounted for the duration of the collapse (see the timeout below), then
 * unmounts so a collapsed screen is not carrying every sheet's DOM.
 *
 * Timing is deliberately "smooth but snappy": fast enough that a GM clicking
 * mid-turn never waits on it, with an ease-out curve so it settles rather than
 * snapping. Honours `prefers-reduced-motion`.
 */

import { useEffect, useRef, useState } from 'react'

/** Must match the transition duration in gmscreen.css. */
const DURATION_MS = 190

export interface PanelExpandProps {
  /** Whether the panel is expanded. */
  open: boolean
  /** The expanded body. Only mounted while opening/open/closing. */
  children: React.ReactNode
}

export default function PanelExpand({ open, children }: PanelExpandProps) {
  const [mounted, setMounted] = useState(open)
  /** Drives the grid row size; `false` collapses to zero height. */
  const [shown, setShown] = useState(open)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }

    if (open) {
      // A mount/unmount transition inherently needs a state flip after the
      // first paint, so the collapsed markup is committed before the row size
      // animates. There is no declarative way to say "animate from the state
      // this element had before it existed"; the alternative (keep the body
      // always mounted and hide it) would leave every sheet's DOM in a
      // collapsed screen, which is exactly what we avoid.
      // eslint-disable-next-line react/set-state-in-effect
      setMounted(true)
      // Two frames: one to commit the collapsed markup, one to start the
      // transition from it. A single frame can be coalesced by React and the
      // panel would appear fully open with no animation.
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true))
      })
      return () => cancelAnimationFrame(raf)
    }

    // Collapsing: keep the body mounted while it animates shut.
    setShown(false)
    timer.current = setTimeout(() => setMounted(false), DURATION_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }
  }, [open])

  if (!mounted) return null

  return (
    <div
      className={
        'gm-panel__expand' + (shown ? ' gm-panel__expand--open' : '')
      }
    >
      <div className="gm-panel__expand-inner">{children}</div>
    </div>
  )
}
