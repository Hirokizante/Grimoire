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

type DragPayload = { id: string; data?: { current?: Record<string, unknown> } }

const {
  moveCustomAbility,
  reorderCustomAbility,
  characterRef,
  dragEndRef,
  sortableData,
  droppableData,
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
    }) => void),
  },
  // What each sortable card / droppable list registered with dnd-kit, keyed by
  // id — the honest source for a synthetic drag payload.
  sortableData: { current: {} as Record<string, Record<string, unknown>> },
  droppableData: { current: {} as Record<string, Record<string, unknown>> },
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
      return {
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        setActivatorNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: false,
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

function renderTab() {
  return render(
    <NotificationProvider>
      <CustomTabDndContext tabId="tab-1">
        <CustomAbilitySection
          tabId="tab-1"
          section={tab.sections[0] as CustomAbilitySectionType}
          mode="edit"
        />
        <CustomAbilitySection
          tabId="tab-1"
          section={tab.sections[1] as CustomAbilitySectionType}
          mode="edit"
        />
      </CustomTabDndContext>
    </NotificationProvider>,
  )
}

/**
 * Replay a drag the way dnd-kit would deliver it: the active end is the
 * dragged card's own registered sortable data, and `over` defaults to whatever
 * the drop target registered (a card, or a section's droppable list).
 */
function drag(
  activeId: string,
  overId: string,
  overData?: Record<string, unknown>,
) {
  const current =
    overData ?? sortableData.current[overId] ?? droppableData.current[overId]
  act(() => {
    dragEndRef.current?.({
      active: {
        id: activeId,
        data: { current: sortableData.current[activeId] },
      },
      over: { id: overId, data: { current } },
    })
  })
}

beforeEach(() => {
  moveCustomAbility.mockReset()
  reorderCustomAbility.mockReset()
  dragEndRef.current = null
  sortableData.current = {}
  droppableData.current = {}
  characterRef.current = {
    ...createDefaultCharacter(),
    id: 'char-1',
    customTabs: [tab],
  }
})

test('a card dragged onto a card in another section moves to that section', () => {
  renderTab()

  drag('a1', 'b1')

  expect(moveCustomAbility).toHaveBeenCalledWith(
    'tab-1',
    'section-a',
    'section-b',
    'a1',
  )
  expect(reorderCustomAbility).not.toHaveBeenCalled()
})

test('a card dropped on the target section itself moves to that section', () => {
  renderTab()

  drag('a1', 'section-b')

  expect(moveCustomAbility).toHaveBeenCalledWith(
    'tab-1',
    'section-a',
    'section-b',
    'a1',
  )
})

test('a card dropped inside its own section reorders there', () => {
  renderTab()

  drag('a1', 'a2')

  expect(reorderCustomAbility).toHaveBeenCalledWith('tab-1', 'section-a', 0, 1)
  expect(moveCustomAbility).not.toHaveBeenCalled()
})

test('a card dropped past its own section’s last card lands at the end', () => {
  renderTab()

  drag('a1', 'section-a')

  expect(reorderCustomAbility).toHaveBeenCalledWith('tab-1', 'section-a', 0, 1)
})

test('an NPC section refuses an ability card', () => {
  renderTab()

  drag('a1', 'section-npc', { section: 'section-npc', sectionKind: 'npc' })

  expect(moveCustomAbility).not.toHaveBeenCalled()
  expect(reorderCustomAbility).not.toHaveBeenCalled()
})
