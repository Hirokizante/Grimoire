/**
 * Tests for `useHorizontalWheelScroll` — the hook that lets the GM panels'
 * scrollbar-less status and Mortal Wound strips answer a mouse wheel.
 *
 * jsdom does no layout, so the hook's inputs (`scrollWidth` / `clientWidth` /
 * `scrollHeight` / `clientHeight`) and outputs (`scrollLeft` / `scrollTop`) are
 * stubbed per node here; the browser suite proves the same behaviour against
 * real layout in `e2e/gm-screen.spec.ts`. What these tests pin is the DECISION
 * the hook makes for each gesture: translate a vertical wheel into the strip,
 * hand it to the page when the strip is done with it, and leave everything else
 * exactly as it was.
 */

import { test, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll'

/** A bare strip: the hook is the only behaviour under test. */
function Strip() {
  const setNode = useHorizontalWheelScroll<HTMLDivElement>()
  return <div data-testid="strip" ref={setNode} />
}

/** Declare geometry jsdom cannot compute. */
function measure(node: HTMLElement, size: number, client: number, axis: 'x' | 'y') {
  Object.defineProperty(node, axis === 'x' ? 'scrollWidth' : 'scrollHeight', {
    configurable: true,
    value: size,
  })
  Object.defineProperty(node, axis === 'x' ? 'clientWidth' : 'clientHeight', {
    configurable: true,
    value: client,
  })
}

/**
 * Render a strip, optionally inside a page-like ancestor that scrolls
 * vertically, and give every box the geometry jsdom will not.
 */
function renderStrip({
  scrollWidth = 400,
  clientWidth = 200,
  page,
}: {
  scrollWidth?: number
  clientWidth?: number
  /** A vertically scrollable ancestor: `[scrollHeight, clientHeight]`. */
  page?: [number, number]
} = {}) {
  render(
    page ? (
      <div data-testid="page" style={{ overflowY: 'auto' }}>
        <Strip />
      </div>
    ) : (
      <Strip />
    ),
  )
  const strip = screen.getByTestId('strip')
  measure(strip, scrollWidth, clientWidth, 'x')
  if (page) measure(screen.getByTestId('page'), page[0], page[1], 'y')
  return strip
}

/** Dispatch a cancellable wheel event — `defaultPrevented` is the assertion. */
function wheel(strip: HTMLElement, init: WheelEventInit) {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  strip.dispatchEvent(event)
  return event
}

test('a vertical wheel scrolls an overflowing strip sideways', () => {
  const strip = renderStrip()

  const event = wheel(strip, { deltaY: 120 })

  expect(strip.scrollLeft).toBe(120)
  // Consumed: the strip moved, so the page behind it must not scroll too.
  expect(event.defaultPrevented).toBe(true)

  // Wheel up goes back the other way, and both directions move by the delta
  // the browser reported.
  wheel(strip, { deltaY: -50 })
  expect(strip.scrollLeft).toBe(70)
})

test('at its edge the strip hands the wheel to the page', () => {
  const strip = renderStrip({ page: [2000, 800] })
  const page = screen.getByTestId('page')

  // Nothing to the left yet, and the page is already at its top: neither can
  // move, so the event is left exactly as it was.
  const up = wheel(strip, { deltaY: -120 })
  expect(up.defaultPrevented).toBe(false)
  expect(strip.scrollLeft).toBe(0)
  expect(page.scrollTop).toBe(0)

  // Wheel down past the end: the strip stops at the end, and the notch that it
  // could not use scrolls the page instead — never a dead wheel.
  wheel(strip, { deltaY: 5000 })
  expect(strip.scrollLeft).toBe(200)
  const atEnd = wheel(strip, { deltaY: 120 })
  expect(atEnd.defaultPrevented).toBe(true)
  expect(strip.scrollLeft).toBe(200)
  expect(page.scrollTop).toBe(120)
})

test('a strip that does not overflow is left to the page', () => {
  const strip = renderStrip({ scrollWidth: 200, clientWidth: 200, page: [2000, 800] })

  const event = wheel(strip, { deltaY: 120 })

  expect(strip.scrollLeft).toBe(0)
  expect(screen.getByTestId('page').scrollTop).toBe(120)
  expect(event.defaultPrevented).toBe(true)
})

test('with nothing left to scroll the event is left alone', () => {
  // No scrollable ancestor and jsdom's document does not scroll either, so the
  // hook must not swallow the gesture pretending it did something.
  const strip = renderStrip()

  const event = wheel(strip, { deltaY: -120 })

  expect(event.defaultPrevented).toBe(false)
  expect(strip.scrollLeft).toBe(0)
})

test('a sideways gesture keeps its native scrolling (trackpad parity)', () => {
  const strip = renderStrip({ page: [2000, 800] })

  // A two-finger swipe reports deltaX and the browser already scrolls the
  // container natively, momentum included — the hook must not take it over.
  const swipe = wheel(strip, { deltaX: 90 })
  expect(swipe.defaultPrevented).toBe(false)
  expect(strip.scrollLeft).toBe(0)
  expect(screen.getByTestId('page').scrollTop).toBe(0)

  // Even a diagonal gesture whose dominant axis is horizontal.
  const diagonal = wheel(strip, { deltaX: 40, deltaY: 12 })
  expect(diagonal.defaultPrevented).toBe(false)
  expect(strip.scrollLeft).toBe(0)
  expect(screen.getByTestId('page').scrollTop).toBe(0)
})

test('modified wheels stay with the browser', () => {
  const strip = renderStrip({ page: [2000, 800] })

  // Ctrl+wheel is zoom (and a trackpad pinch); shift+wheel is the browser's
  // own "scroll this sideways" gesture on a mouse.
  expect(wheel(strip, { deltaY: 120, ctrlKey: true }).defaultPrevented).toBe(false)
  expect(wheel(strip, { deltaY: 120, shiftKey: true }).defaultPrevented).toBe(false)
  expect(strip.scrollLeft).toBe(0)
  expect(screen.getByTestId('page').scrollTop).toBe(0)
})

test('line and page deltas are converted to pixels', () => {
  // Firefox reports lines; a page-mode wheel reports pages.
  const lines = renderStrip()
  wheel(lines, { deltaY: 3, deltaMode: 1 })
  expect(lines.scrollLeft).toBe(48)

  cleanup()

  const pages = renderStrip({ scrollWidth: 900, clientWidth: 200 })
  wheel(pages, { deltaY: 1, deltaMode: 2 })
  expect(pages.scrollLeft).toBe(200)
})

test('the listener is detached when the strip unmounts', () => {
  const strip = renderStrip()
  cleanup()

  const event = wheel(strip, { deltaY: 120 })

  expect(event.defaultPrevented).toBe(false)
  expect(strip.scrollLeft).toBe(0)
})
