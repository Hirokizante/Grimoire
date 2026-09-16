/**
 * AbilityCardPointerSensor — drag from anywhere on an ability card, while its
 * buttons stay buttons.
 *
 * dnd-kit's stock `PointerSensor` starts a drag on any primary pointer down, so
 * a card whose whole body is draggable would swallow clicks on the controls
 * inside it (Edit / Remove / Activate, the modifier switch, the uses stepper).
 * The usual escape hatch is to attach the drag listeners to a small grip and
 * leave the body inert — but then the card, which *looks* like the thing being
 * moved, cannot be grabbed anywhere except a 20px strip.
 *
 * This sensor keeps the card as the drag surface and declines the drag when the
 * press lands on something interactive, so a click on a button is still a click
 * and the card is grabbable from its name, its text, or the space around them —
 * the way a physical card behaves.
 *
 * The grip handle opts *back in* with `data-drag-activator`: it is a real
 * `<button>` (so it is focusable and shows up in the accessibility tree), which
 * the guard below would otherwise read as "interactive, don't drag". Anything
 * else a card grows later — an input, a link, a nested draggable — is excluded
 * automatically rather than needing to be remembered here.
 */

import { PointerSensor, type PointerSensorOptions } from '@dnd-kit/core'
import type { PointerEvent } from 'react'

/** Controls a drag must never start from, so they keep working mid-edit. */
const INTERACTIVE_SELECTORS = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="textbox"]',
  '[role="spinbutton"]',
] as const

/** Marks the one control that is also a drag surface (the card's grip). */
export const DRAG_ACTIVATOR_ATTRIBUTE = 'data-drag-activator'

/**
 * The nearest element enclosing `target` that a drag should leave alone, or
 * `null` when the press landed on draggable card surface.
 *
 * Walks outwards so a click on a `<span>` inside a button is still a click on
 * that button. An explicit `data-drag-activator` anywhere on the way out wins
 * over an interactive ancestor, which is what lets the grip handle (a button
 * wrapping a span) act as a drag surface.
 */
export function findInteractiveAncestor(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.hasAttribute(DRAG_ACTIVATOR_ATTRIBUTE)) return null
    for (const selector of INTERACTIVE_SELECTORS) {
      if (el.matches(selector)) return el
    }
  }
  return null
}

/**
 * `PointerSensor` with the interactive-element guard bolted on. The primary
 * button / `isPrimary` checks mirror dnd-kit's own activator exactly; only the
 * final decision is ours.
 */
export class AbilityCardPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler(
        { nativeEvent: event }: PointerEvent,
        { onActivation }: PointerSensorOptions,
      ): boolean {
        if (!event.isPrimary || event.button !== 0) return false
        if (findInteractiveAncestor(event.target)) return false
        onActivation?.({ event })
        return true
      },
    },
  ]
}
