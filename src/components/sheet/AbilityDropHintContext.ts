/**
 * AbilityDropHintContext — where the ability card currently being dragged
 * would land, shared with the sections rendering it.
 *
 * Every ability section renders its own cards, but only the `DndContext` above
 * them sees the drag. Letting each card work the drop out for itself would mean
 * every card in every section reacting to every pointer move; instead the drag
 * context resolves **one** answer per move — `{ section, index, activeId,
 * valid }` — and publishes it here. A section matches that against its own id
 * and rows, so a new index re-renders only the cards that need to move or draw
 * an indicator.
 *
 * The hint is `null` whenever no card is being dragged, which is what makes the
 * indicator (and every other drag-only affordance) disappear the instant a drag
 * ends or is cancelled.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { DropHintList, DropHintResolver } from '@/hooks/useAbilityDropHintResolver'
import type { DragMoveEvent } from '@dnd-kit/core'

export interface AbilityDropHint {
  /** Id of the section/list the card would land in. */
  section: string
  /**
   * Index the card would be inserted at — an index into that section's list as
   * it stands now, which is exactly what the store's move/reorder actions take.
   */
  index: number
  /**
   * The card in the air. A section matches it against its own rows to tell a
   * card being **reordered inside it** — which vacates a slot, so the list
   * previews the move — from one **arriving from another list**, which vacates
   * nothing and only needs the destination line. See {@link previewOffsets}.
   */
  activeId: string
  /**
   * Whether the drop would actually be allowed. False marks a destination that
   * will be refused (a full Slotted Abilities section), so the indicator can
   * read as "not here" instead of promising a move that then snaps back.
   */
  valid: boolean
}

/**
 * The drag context's view of the sections taking part in a drag: it resolves a
 * hint against their resolvers and publishes the result, while the sections
 * read the published hint back out.
 */
export interface AbilityDropHintStore {
  /**
   * Published hint, or `null` while no card is in the air. A hint identical to
   * the published one does not re-render the sections, so the drag context can
   * update on every pointer move cheaply.
   */
  hint: AbilityDropHint | null
  /** True while a card is in the air — the sections' "drag in progress" flag. */
  isDragging: boolean
  /**
   * Registers a section, returning an unsubscribe function. Called from an
   * effect by {@link useAbilityListDnd}, so registration tracks the section's
   * lifetime — a deleted tab's resolver disappears with it.
   *
   * Re-registering the same id replaces the previous entry rather than adding a
   * second one. That matters for the two sections the app genuinely renders
   * twice with one id — an NPC's ability list, which appears on the standalone
   * sheet and inside a player's custom tab — where two live entries would let
   * one of them answer for the other.
   */
  register: (registration: AbilityDropRegistration) => () => void
}

export const AbilityDropHintContext = createContext<AbilityDropHintStore | null>(
  null,
)

/**
 * The slot budget, published to the sections by the player sheet's drag
 * context.
 *
 * The budget belongs to Slotted Abilities, but it is the *pool's* drag that has
 * to respect it, and only the drag context sees both. Publishing one function
 * means the section that draws "you can't drop this here" and the context that
 * refuses the drop are answering from the same rule rather than each deriving
 * it.
 */
export const AbilitySlotBudgetContext = createContext<
  ((abilityId: string) => boolean) | null
>(null)

/** Whether the surrounding context has room for one more of these abilities. */
export function useAbilitySlotBudget(): ((abilityId: string) => boolean) | null {
  return useContext(AbilitySlotBudgetContext)
}

/** The drag state for the surrounding ability sections, or `null` outside one. */
export function useAbilityDropRegistry(): AbilityDropHintStore | null {
  return useContext(AbilityDropHintContext)
}

/**
 * The published hint, but only when it applies to `sectionId` — so a section
 * never draws an indicator for a drop aimed somewhere else.
 */
export function useAbilityDropHint(sectionId: string): AbilityDropHint | null {
  const registry = useAbilityDropRegistry()
  const hint = registry?.hint ?? null
  return hint && hint.section === sectionId ? hint : null
}

/**
 * A section's registration: which list it is, what is in it right now, and the
 * resolver that can answer for it. The rows travel with the registration so the
 * drag context always reads them as they are at the moment of the event, rather
 * than as they were when the section first mounted.
 */
export interface AbilityDropRegistration {
  id: string
  items: readonly { id: string }[]
  resolver: DropHintResolver
}

/** `true` when two hints describe the same destination. */
function sameHint(a: AbilityDropHint | null, b: AbilityDropHint | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.section === b.section &&
    a.index === b.index &&
    a.valid === b.valid &&
    a.activeId === b.activeId
  )
}

/**
 * The drag context's side of the contract: the registry of drop resolvers plus
 * the published hint.
 *
 * The drag context re-renders on every pointer move (dnd-kit reports the drag
 * through React state), and so does everything under it. Two things keep that
 * from being expensive: a hint identical to the published one does not
 * re-render the sections at all, and `isDragging` is held separately from
 * `hint` so a drag that only moves *within* one card's slot never re-renders
 * either.
 *
 * Deliberately not a hook that lives in the sections: one store instance is
 * shared by the drag context and every section below it.
 */
export interface AbilityDropHintState extends AbilityDropHintStore {
  /**
   * The hint for whichever list owns the event's `over` target, or `null` when
   * it belongs to no participating section. Pure in the event: it reads the
   * sections' current rows and does not publish, which is what lets a drag
   * context resolve the destination as it happens and again on release.
   */
  resolve: (event: DragMoveEvent) => AbilityDropHint | null
  /** Called on drag start; also arms the sections' drag-only affordances. */
  publishDragStart: () => void
  /** Resolves the hint for a move and publishes it, returning what it resolved. */
  publishDragMove: (event: DragMoveEvent) => AbilityDropHint | null
  /** Clears the hint at the end of a drag. */
  publishDragEnd: () => void
}

export function useAbilityDropHintStore(): AbilityDropHintState {
  const [hint, setHintState] = useState<AbilityDropHint | null>(null)
  const [isDragging, setDraggingState] = useState(false)

  // Keyed by list id, so two mounts of one list cannot both answer. Read at
  // resolve time rather than captured, so a section that mounts or unmounts
  // mid-session (a deleted tab) is picked up without re-creating the value.
  const registrationsRef = useRef(new Map<string, AbilityDropRegistration>())

  const setHint = useCallback((next: AbilityDropHint | null) => {
    // The same destination arrives many times per second; dropping the repeat
    // is what keeps a drag from re-rendering every card on the sheet.
    setHintState((prev) => (sameHint(prev, next) ? prev : next))
  }, [])

  /**
   * Resolves the event against every registered section. Exactly one can answer
   * — the one whose rows contain the event's `over` target — which is also how a
   * section knows to draw the indicator and the drag context knows where to put
   * the card.
   */
  const resolve = useCallback((event: DragMoveEvent): AbilityDropHint | null => {
    for (const registration of registrationsRef.current.values()) {
      const list: DropHintList = { id: registration.id, items: registration.items }
      const hint = registration.resolver.resolve(event, list)
      if (hint) return hint
    }
    return null
  }, [])

  const publishDragMove = useCallback(
    (event: DragMoveEvent) => {
      const next = resolve(event)
      setHint(next)
      return next
    },
    [resolve, setHint],
  )

  const register = useCallback((registration: AbilityDropRegistration) => {
    const { id } = registration
    registrationsRef.current.set(id, registration)
    return () => {
      // Only the registration that is still installed may remove itself: a
      // re-register installs a new object under the same id, and the old
      // effect's cleanup must not evict its successor.
      if (registrationsRef.current.get(id) === registration) {
        registrationsRef.current.delete(id)
      }
    }
  }, [])

  return useMemo(
    () => ({
      hint,
      isDragging,
      register,
      resolve: publishDragMove,
      publishDragStart: () => setDraggingState(true),
      publishDragMove,
      publishDragEnd: () => {
        setDraggingState(false)
        setHint(null)
      },
    }),
    [hint, isDragging, publishDragMove, register],
  )
}
