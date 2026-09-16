/**
 * Screen-reader narration for ability-card drags.
 *
 * dnd-kit reports every step of a drag through a live region, but its defaults
 * describe an abstract list item ("Draggable item 3f2c… was moved over droppable
 * area slottedAbilities"). These announcements replace that with the card's own
 * name and the destination the user is choosing — and they are built by a
 * factory so all three ability drag contexts sound the same, each supplying
 * only its own names for its own lists.
 *
 * The drop line reports *where* the card landed, not just that it did: the
 * indicator line is visual, so without it a screen-reader user has no way to
 * tell which position a drag settled in.
 */

import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core'

/** One end of a drag, as dnd-kit hands it over. */
type DragEnd = {
  id: UniqueIdentifier
  data?: { current?: Record<string, unknown> }
}

export interface AbilityDragAnnouncementOptions {
  /** The card's display name, or undefined when the id is not a known card. */
  abilityName: (id: UniqueIdentifier) => string | undefined
  /** A human name for a list id — "the Ability Pool", "Offense" — or undefined. */
  listName: (id: string) => string | undefined
}

/** The card's display name, falling back to the same label its editor uses. */
function nameOf(end: DragEnd, abilityName: AbilityDragAnnouncementOptions['abilityName']): string {
  return abilityName(end.id)?.trim() || `Untitled ability ${String(end.id)}`
}

/**
 * What a keyboard user is told when a drag begins, before dnd-kit starts
 * narrating positions. The lists here are masonry columns as often as they are
 * plain stacks, so the instruction says what the arrow keys do rather than
 * promising "up and down moves it one place".
 */
export const ABILITY_DRAG_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'To move this ability, press space or enter to pick it up, use the arrow ' +
    'keys to choose a position, then press space or enter again to drop it. ' +
    'Press escape to cancel.',
}

export function createAbilityDragAnnouncements({
  abilityName,
  listName,
}: AbilityDragAnnouncementOptions): Announcements {
  const list = (end: DragEnd | null) => {
    if (!end) return undefined
    const fromPayload = end.data?.current?.section
    const id = typeof fromPayload === 'string' ? fromPayload : String(end.id)
    return listName(id) ?? id
  }

  return {
    onDragStart({ active }) {
      return (
        `Picked up ${nameOf(active, abilityName)}. ` +
        `Move it with the arrow keys and press space to drop, or escape to cancel.`
      )
    },
    onDragOver({ active, over }) {
      const name = nameOf(active, abilityName)
      const target = list(over)
      return target ? `${name} is over ${target}.` : `${name} is not over a list.`
    },
    onDragEnd({ active, over }) {
      const name = nameOf(active, abilityName)
      const target = list(over)
      return target ? `${name} was dropped into ${target}.` : `${name} was dropped.`
    },
    onDragCancel({ active }) {
      return `Moving ${nameOf(active, abilityName)} was cancelled.`
    },
  }
}
