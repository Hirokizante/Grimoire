/**
 * CustomTabDndContext — the drag contract between a tab's ability sections.
 *
 * jsdom has no layout, so a real drag cannot resolve a drop target here. What
 * this suite pins instead is the payload a drag hands the handler: the two ends
 * of a drag are section ids, and everything else about them (their kind, their
 * card order) is read from the character record. Each event below is therefore
 * replayed from what the real cards and sections register with dnd-kit —
 * `useSortable` and `useDroppable` are mocked to record it — rather than from a
 * hand-written shape, so a payload that stops carrying its section id fails
 * here instead of quietly turning every custom-tab drag into a no-op.
 *
 * The pointer path itself — sensors, collision detection, sortable transforms
 * — is covered end to end by `e2e/custom-sections.spec.ts`.
 */

import { act, render } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import CustomAbilitySection from '@/components/sheet/CustomAbilitySection'
import CustomTabDndContext from '@/components/sheet/CustomTabDndContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter } from '@/constants/gameData'
import type {
  AbilityBlock,
  Character,
  CustomAbilitySection as CustomAbilitySectionType,
  CustomTab,
} from '@/types'

type Box = { left: number; top: number; width: number; height: number }

type DragPayload = {
  id: string
  data?: { current?: Record<string, unknown> }
  /**
   * The box dnd-kit measured for this end of the drag. Only the `over` end's
   * box is read now — the pointer comes from the activator — but both are
   * supplied so the payload stays the shape dnd-kit really sends: a card
   * carries `{ current: { initial, translated } }`, a list carries the box.
   */
  rect?:
    | { current: { initial: Box | null; translated: Box | null } }
    | Box
    | null
}

const {
  moveCustomAbility,
  reorderCustomAbility,
  characterRef,
  dragEndRef,
  sortableData,
  droppableData,
  rects,
} = vi.hoisted(() => ({
  moveCustomAbility: vi.fn(),
  reorderCustomAbility: vi.fn(),
  characterRef: { current: null as Character | null },
  // Captured from the mocked DndContext: jsdom cannot run a real drag, so the
  // test replays the handler with the payloads dnd-kit would have assembled.
  dragEndRef: {
    current: null as null | ((event: {
      active: DragPayload
      over: DragPayload | null
      activatorEvent?: Event
      delta?: { x: number; y: number }
    }) => void),
  },
  // What each sortable card / droppable list registered with dnd-kit, keyed by
  // id — the honest source for a synthetic drag payload.
  sortableData: { current: {} as Record<string, Record<string, unknown>> },
  droppableData: { current: {} as Record<string, Record<string, unknown>> },
  /**
   * Measured boxes per card id, fed to the drop resolver. jsdom lays nothing
   * out, so the resolver's before/after decision — which reads the pointer's
   * own box against the hovered card's box — needs them supplied here. Absent
   * entries stand in for "not measured", which the resolver treats as "not
   * past" (the drop lands before the hovered card).
   */
  rects: {
    current: {} as Record<
      string,
      { left: number; top: number; width: number; height: number } | undefined
    >,
  },
}))

vi.mock('@/store/characterStore', () => {
  const state = () => ({
    currentCharacter: characterRef.current,
    characters: [],
    addCustomAbility: vi.fn(),
    updateCustomAbility: vi.fn(),
    renameCustomSection: vi.fn(),
    removeCustomSection: vi.fn(),
    setAbilityUsesRemaining: vi.fn(),
    setAbilityModifiersActive: vi.fn(),
    moveCustomAbility,
    reorderCustomAbility,
  })
  const useCharacterStore = (
    selector: (s: Record<string, unknown>) => unknown,
  ) => selector(state())
  useCharacterStore.getState = state
  return { useCharacterStore }
})

vi.mock('@/store/statusStore', () => ({
  useStatusStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      statuses: [],
      isLoaded: true,
      modal: { statusId: null, startInEdit: false },
      openStatus: vi.fn(),
      closeStatus: vi.fn(),
    }),
}))

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  const React = await import('react')
  return {
    ...actual,
    DndContext: (props: {
      children: React.ReactNode
      onDragEnd?: (event: {
        active: DragPayload
        over: DragPayload | null
        activatorEvent?: Event
        delta?: { x: number; y: number }
      }) => void
    }) => {
      dragEndRef.current = props.onDragEnd ?? null
      return React.createElement(React.Fragment, null, props.children)
    },
    useDroppable: (args: { id: string; data?: Record<string, unknown> }) => {
      droppableData.current[args.id] = args.data ?? {}
      return { setNodeRef: vi.fn(), isOver: false }
    },
  }
})

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>()
  return {
    ...actual,
    useSortable: (args: { id: string; data?: Record<string, unknown> }) => {
      sortableData.current[args.id] = args.data ?? {}
      const rect = rects.current[args.id]
      return {
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        setActivatorNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: false,
        // dnd-kit measures the node; only the box matters to the resolver.
        rect: { current: rect ? { initial: rect, translated: rect } : null },
      }
    },
  }
})

function ability(id: string, name: string): AbilityBlock {
  return {
    id,
    name,
    traits: [],
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
  }
}

/** Two ability sections to drag between, plus an NPC section to refuse. */
const tab: CustomTab = {
  id: 'tab-1',
  name: 'New Tab',
  sections: [
    {
      kind: 'ability',
      id: 'section-a',
      name: 'Offense',
      abilities: [ability('a1', 'Cleave'), ability('a2', 'Rush')],
    },
    {
      kind: 'ability',
      id: 'section-b',
      name: 'Defense',
      abilities: [ability('b1', 'Bulwark')],
    },
    { kind: 'npc', id: 'section-npc', name: 'Goblin', npcId: 'npc-1' },
  ],
}

/**
 * Render the tab's two ability sections from the *character record* rather than
 * from the module fixture, so a test that installs a different tab (three cards
 * instead of two) actually sees it — the sections take their list as a prop, and
 * a fixture read here would silently keep rendering the old one.
 */
function renderTab() {
  const sections = characterRef.current?.customTabs.find((t) => t.id === 'tab-1')
    ?.sections as CustomAbilitySectionType[]
  return render(
    <NotificationProvider>
      <CustomTabDndContext tabId="tab-1">
        <CustomAbilitySection tabId="tab-1" section={sections[0]} mode="edit" />
        <CustomAbilitySection tabId="tab-1" section={sections[1]} mode="edit" />
      </CustomTabDndContext>
    </NotificationProvider>,
  )
}

/**
 * Replay a drag the way dnd-kit would deliver it: the active end is the dragged
 * card's own registered sortable data plus the box it was measured with, and
 * `over` is whatever the drop target registered plus its measured box.
 *
 * The `over` box is the part jsdom cannot produce. The resolver reads it, with
 * the pointer, to decide which side of the hovered card the drop belongs on —
 * the same comparison that draws the indicator — so the test supplies it from
 * the same per-card table the boxes came from. `pointerX` stands in for where
 * the cursor is, which dnd-kit reports as an activator event plus a delta.
 */
function drag(
  activeId: string,
  overId: string,
  overData?: Record<string, unknown>,
  pointerX?: number,
) {
  const current =
    overData ?? sortableData.current[overId] ?? droppableData.current[overId]
  const activeRect = rects.current[activeId] ?? null
  const overRect = rects.current[overId] ?? null
  const startX = pointerX ?? overRect?.left ?? 0
  act(() => {
    dragEndRef.current?.({
      active: {
        id: activeId,
        data: { current: sortableData.current[activeId] },
        rect: { current: { initial: activeRect, translated: activeRect } },
      },
      over: {
        id: overId,
        data: { current },
        rect: overRect,
      },
      activatorEvent: new PointerEvent('pointerdown', { clientX: startX, clientY: 0 }),
      delta: { x: 0, y: 0 },
    })
  })
}

/** A pointer aimed at the left or right part of the card at `overId`. */
function pointerOn(overId: string, side: 'near' | 'far'): number {
  const rect = rects.current[overId]
  if (!rect) throw new Error(`no box placed for ${overId}`)
  return side === 'near' ? rect.left + rect.width * 0.2 : rect.left + rect.width * 0.8
}

beforeEach(() => {
  moveCustomAbility.mockReset()
  reorderCustomAbility.mockReset()
  dragEndRef.current = null
  sortableData.current = {}
  droppableData.current = {}
  rects.current = {}
  characterRef.current = {
    ...createDefaultCharacter(),
    id: 'char-1',
    customTabs: [tab],
  }
})

/**
 * Two cards side by side, the shape the masonry grid lays out: `left` is where
 * a card sits, and a card the pointer has not reached is dropped *before* the
 * one it hovers.
 */
function placeCards(...boxes: [string, number][]) {
  for (const [id, left] of boxes) {
    rects.current[id] = { left, top: 0, width: 100, height: 80 }
  }
}

test('a card dragged onto the near side of a card elsewhere lands in front of it', () => {
  renderTab()
  placeCards(['a1', 0], ['b1', 300])

  drag('a1', 'b1', undefined, pointerOn('b1', 'near'))

  expect(moveCustomAbility).toHaveBeenCalledWith(
    'tab-1',
    'section-a',
    'section-b',
    'a1',
    0,
  )
  expect(reorderCustomAbility).not.toHaveBeenCalled()
})

test('a card dragged onto the far side of a card elsewhere lands behind it', () => {
  renderTab()
  placeCards(['a1', 0], ['b1', 300])

  drag('a1', 'b1', undefined, pointerOn('b1', 'far'))

  expect(moveCustomAbility).toHaveBeenCalledWith(
    'tab-1',
    'section-a',
    'section-b',
    'a1',
    1,
  )
})

test('a card dropped on the target section itself moves to that section', () => {
  renderTab()

  drag('a1', 'section-b')

  // The list container is never "past": dropping on its padding means the end.
  expect(moveCustomAbility).toHaveBeenCalledWith(
    'tab-1',
    'section-a',
    'section-b',
    'a1',
    1,
  )
})

test('a card hovered over its own next card is left where it is', () => {
  renderTab()
  placeCards(['a1', 0], ['a2', 300])

  drag('a1', 'a2', undefined, pointerOn('a2', 'near'))

  // a2 has slid up into a1's vacated place, so the gap in front of a2 is where
  // a1 already is. Releasing there is the no-op the reflow showed.
  expect(reorderCustomAbility).not.toHaveBeenCalled()
  expect(moveCustomAbility).not.toHaveBeenCalled()
})

test('a card dragged past its own next card swaps with it', () => {
  renderTab()
  placeCards(['a1', 0], ['a2', 300])

  drag('a1', 'a2', undefined, pointerOn('a2', 'far'))

  expect(reorderCustomAbility).toHaveBeenCalledWith('tab-1', 'section-a', 0, 1)
  expect(moveCustomAbility).not.toHaveBeenCalled()
})

test('a card dropped on its own section’s padding lands at the end', () => {
  renderTab()

  drag('a1', 'section-a')

  expect(reorderCustomAbility).toHaveBeenCalledWith('tab-1', 'section-a', 0, 2)
})

test('a drag lands where the pointer points, not merely on the card it is over', () => {
  // The regression this file exists to catch: the same hovered card must produce
  // different destinations from the two halves of it.
  renderTab()
  placeCards(['a1', 0], ['a2', 300])

  drag('a1', 'a2', undefined, pointerOn('a2', 'near'))
  expect(reorderCustomAbility).not.toHaveBeenCalled()

  renderTab()
  drag('a1', 'a2', undefined, pointerOn('a2', 'far'))
  expect(reorderCustomAbility).toHaveBeenCalledWith('tab-1', 'section-a', 0, 1)
})

test('an unmeasured card falls back to the gap in front of it', () => {
  // jsdom measures nothing, and neither does a drag that has not moved yet: the
  // pointer's side cannot be decided, so the drop keeps the card in front of the
  // card it is over rather than reading a box that is not there.
  renderTab()

  drag('a1', 'a2')

  expect(reorderCustomAbility).not.toHaveBeenCalled()
})

test('a card dropped further down its own section still moves', () => {
  // The control for the case above: with three cards the same near-side release
  // over the *last* card is a real move, so "no-op" is not simply the answer
  // this context always gives.
  characterRef.current = {
    ...createDefaultCharacter(),
    id: 'char-1',
    customTabs: [
      {
        ...tab,
        sections: [
          {
            ...(tab.sections[0] as CustomAbilitySectionType),
            abilities: [
              ability('a1', 'Cleave'),
              ability('a2', 'Rush'),
              ability('a3', 'Feint'),
            ],
          },
          tab.sections[1],
        ],
      },
    ],
  }

  renderTab()
  drag('a1', 'a3')

  // The gap in front of a3, once a1 is lifted out of the list.
  expect(reorderCustomAbility).toHaveBeenCalledWith('tab-1', 'section-a', 0, 1)
})

test('a card dragged past the last card of a three-card section lands after it', () => {
  characterRef.current = {
    ...createDefaultCharacter(),
    id: 'char-1',
    customTabs: [
      {
        ...tab,
        sections: [
          {
            ...(tab.sections[0] as CustomAbilitySectionType),
            abilities: [
              ability('a1', 'Cleave'),
              ability('a2', 'Rush'),
              ability('a3', 'Feint'),
            ],
          },
          tab.sections[1],
        ],
      },
    ],
  }

  renderTab()
  placeCards(['a1', 0], ['a3', 600])
  drag('a1', 'a3', undefined, pointerOn('a3', 'far'))

  expect(reorderCustomAbility).toHaveBeenCalledWith('tab-1', 'section-a', 0, 2)
})

test('an NPC section refuses an ability card', () => {
  renderTab()

  drag('a1', 'section-npc', { section: 'section-npc', sectionKind: 'npc' })

  expect(moveCustomAbility).not.toHaveBeenCalled()
  expect(reorderCustomAbility).not.toHaveBeenCalled()
})
