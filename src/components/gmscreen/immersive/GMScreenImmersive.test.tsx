/**
 * Component tests for the GM Screen's immersive list view.
 *
 * Covers the drawer's contract: every panel appears as a read-only
 * quick-reference card (name, HP, tracked statuses, stat tokens — and NO
 * panel controls), selecting a card mounts that character's encounter sheet
 * in the main area, the collapsed drawer shrinks to a portrait rail whose
 * number badges appear only for an NPC base with multiple instances, the
 * drawer reorders through the same `movePanel` action as the grid, and a
 * deleted record renders a removable placeholder rather than breaking the
 * list. The encounter sheet itself is pinned read-only with no Innate
 * narrative prose.
 *
 * jsdom cannot run a real drag (and applies no stylesheets), so — following
 * CustomTabDndContext.test.tsx — the dnd-kit seam is mocked: the drawer's
 * `onDragEnd` payload is replayed from what the real cards register, and the
 * actual pointer path is covered by `e2e/gm-screen.spec.ts`.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { useMemo } from 'react'
import { render, screen, within, fireEvent, cleanup, act } from '@testing-library/react'

import ImmersiveGMScreen from '@/components/gmscreen/immersive/ImmersiveGMScreen'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter, createDefaultNPC, MAX_AP } from '@/constants/gameData'
import { resolvePanels } from '@/lib/gmScreenUtils'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useStatusStore } from '@/store/statusStore'
import type { Character, GMScreen, StatusCondition } from '@/types'

const { dbMap, dragEndRef, sortableIds } = vi.hoisted(() => ({
  dbMap: new Map<string, unknown>(),
  /** The drawer DndContext's onDragEnd, captured at render. */
  dragEndRef: { current: null as ((event: unknown) => void) | null },
  /** Every id the drawer's sortable items registered with. */
  sortableIds: { current: new Set<string | number>() },
}))

vi.mock('@/lib/db', () => ({
  getAllScreens: vi.fn(async () => Array.from(dbMap.values())),
  getScreen: vi.fn(async (id: string) => dbMap.get(id) ?? null),
  putScreen: vi.fn(async () => {}),
  deleteScreen: vi.fn(async () => {}),
  normalizeScreen: (s: unknown) => s,
  getAllCharacters: vi.fn(async () => []),
  getCharacter: vi.fn(async () => null),
  putCharacter: vi.fn(async () => {}),
  deleteCharacter: vi.fn(async () => {}),
  putVersionSnapshot: vi.fn(async () => {}),
  getVersionHistory: vi.fn(async () => []),
  deleteVersionSnapshot: vi.fn(async () => {}),
  putRollLogEntry: vi.fn(async () => {}),
  getRollLogForCharacter: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  deleteRollLogEntry: vi.fn(async () => {}),
  clearRollLogForCharacter: vi.fn(async () => {}),
  normalizeCharacter: (c: Character) => c,
  stripLabels: ({ labels: _l, ...rest }: Character) => rest as Character,
  getAllStatuses: vi.fn(async () => []),
  getStatus: vi.fn(async () => null),
  putStatus: vi.fn(async () => {}),
  deleteStatus: vi.fn(async () => {}),
  normalizeStatus: (s: unknown) => s,
  getAllVersionSnapshots: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
}))

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  const React = await import('react')
  return {
    ...actual,
    DndContext: (props: {
      children: React.ReactNode
      onDragEnd?: (event: unknown) => void
    }) => {
      dragEndRef.current = props.onDragEnd ?? null
      return React.createElement(React.Fragment, null, props.children)
    },
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  }
})

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>()
  return {
    ...actual,
    useSortable: (args: { id: string }) => {
      sortableIds.current.add(args.id)
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

// ---- Fixtures --------------------------------------------------------------

const SCREEN_ID = 'screen-1'

function makeStatus(
  id: string,
  name: string,
  overrides: Partial<StatusCondition> = {},
): StatusCondition {
  return {
    id,
    name,
    icon: '☠️',
    iconType: 'emoji',
    description: `${name} does something unpleasant.`,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const POISONED = makeStatus('st-poisoned', 'Poisoned')

const PLAYER: Character = {
  ...createDefaultCharacter(),
  id: 'pc-1',
  name: 'Vex',
  currentHP: 14,
}

const NPC: Character = {
  ...createDefaultNPC(),
  id: 'npc-1',
  name: 'Bandit',
  npcStats: { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20, mortalWounds: 0 },
}

function makeScreen(panels: GMScreen['panels']): GMScreen {
  return {
    id: SCREEN_ID,
    name: 'Session 4',
    round: 1,
    panels,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function characterPanel(id: string): GMScreen['panels'][number] {
  return {
    kind: 'character',
    id,
    characterId: PLAYER.id,
    density: 'compact',
    statuses: [],
  }
}

function instancePanel(
  id: string,
  label: string,
  statuses: GMScreen['panels'][number]['statuses'] = [],
): GMScreen['panels'][number] {
  return {
    kind: 'npc-instance',
    id,
    baseNpcId: NPC.id,
    label,
    density: 'compact',
    statuses,
    state: {
      currentHP: 20,
      tempHP: 0,
      condition: 'active',
      currentAP: MAX_AP,
      cooldowns: [],
      mortalWounds: [],
      abilityUses: {},
      abilityModifiers: {},
    },
  }
}

/** Seed a screen with a player and two instances of one NPC base. */
function seed(panels: GMScreen['panels'] = [
  characterPanel('panel-pc'),
  instancePanel('panel-npc-1', 'Bandit'),
  instancePanel('panel-npc-2', 'Bandit 2', [
    { statusId: POISONED.id, duration: 'quick', stacks: 2 },
  ]),
]) {
  useCharacterStore.setState({ characters: [PLAYER, NPC], currentCharacter: null })
  useStatusStore.setState({
    statuses: [POISONED],
    isLoaded: true,
    modal: { statusId: null, startInEdit: false },
  })
  useGMScreenStore.setState({
    screens: [makeScreen(panels)],
    currentScreenId: SCREEN_ID,
    isLoaded: true,
    isSaving: false,
    loadError: null,
  })
}

const noop = () => {}

/** Render the immersive view the way `GMScreenPage` does — subscribed to the
 *  stores, so store mutations re-render with fresh panels. */
function renderImmersive(
  callbacks: {
    onOpenSheet?: () => void
    onAddCharacter?: () => void
    onAddNpc?: () => void
  } = {},
) {
  const onOpenSheet = callbacks.onOpenSheet ?? noop
  const onAddCharacter = callbacks.onAddCharacter ?? noop
  const onAddNpc = callbacks.onAddNpc ?? noop

  function Harness() {
    const screens = useGMScreenStore((s) => s.screens)
    const currentScreenId = useGMScreenStore((s) => s.currentScreenId)
    const characters = useCharacterStore((s) => s.characters)
    const screen = screens.find((s) => s.id === currentScreenId)
    const resolved = useMemo(
      () => resolvePanels(screen ? screen.panels : [], characters),
      [screen, characters],
    )
    if (!screen) return null
    return (
      <NotificationProvider>
        <ImmersiveGMScreen
          screen={screen}
          resolved={resolved}
          onOpenSheet={onOpenSheet}
          onAddCharacter={onAddCharacter}
          onAddNpc={onAddNpc}
        />
      </NotificationProvider>
    )
  }

  render(<Harness />)
}

/** The drawer card for one panel (matched by its remove button's label). */
function drawerCard(name: string) {
  const remove = screen.getByRole('button', {
    name: `Remove ${name} from the screen`,
  })
  return remove.closest('.gm-drawer-card') as HTMLElement
}

beforeEach(() => {
  window.localStorage.clear()
  dragEndRef.current = null
  sortableIds.current = new Set()
  cleanup()
})

// ---- Tests ----------------------------------------------------------------

test('the drawer lists every panel as a read-only quick-reference card', () => {
  seed()
  renderImmersive()

  const drawer = screen.getByLabelText('Character list')

  // All three panels present, with the glance data the spec asks for.
  // ('Bandit' matches both the first instance's name and Bandit 2's
  // subtitle — the base name shown under a renamed label.)
  expect(within(drawer).getByText('Vex')).toBeInTheDocument()
  expect(within(drawer).getAllByText('Bandit').length).toBeGreaterThanOrEqual(1)
  expect(within(drawer).getByText('Bandit 2')).toBeInTheDocument()
  // Player HP (14/…): the character's real pool, read-only.
  const vexCard = drawerCard('Vex')
  expect(vexCard.querySelector('.gm-drawer-card__hp-value')?.textContent).toContain('14')
  // The tracked status renders as a static pill (icon + full name + stacks).
  expect(within(drawer).getByText('Poisoned')).toBeInTheDocument()
  // Stat tokens are icon + value only (no text label): Eva for both kinds;
  // NPC instances carry Move/DC, the player END/FP — so a value of 10 shows
  // three times (Eva on all three cards) plus the two instances' DC.
  expect(within(drawer).getAllByText('10').length).toBeGreaterThanOrEqual(3)
  expect(within(drawer).getAllByText('5')).toHaveLength(2)
})

test('drawer cards carry no panel controls — their one interaction is selecting', () => {
  seed()
  renderImmersive()

  // The grid panel's controls must not appear in the drawer. (The main
  // area's encounter sheet legitimately carries them — that is where the
  // interactivity lives in this view.)
  const drawer = screen.getByLabelText('Character list')
  expect(
    within(drawer).queryByRole('button', { name: 'Deal 1 damage to Vex' }),
  ).not.toBeInTheDocument()
  expect(
    within(drawer).queryByRole('button', { name: 'Damage...' }),
  ).not.toBeInTheDocument()
  expect(
    within(drawer).queryByRole('button', { name: 'Add status to Vex' }),
  ).not.toBeInTheDocument()
  expect(within(drawer).queryByTitle('Panel options')).not.toBeInTheDocument()
})

test('the first panel is mounted by default and selecting a card swaps the main area', () => {
  seed()
  renderImmersive()

  // Default: the first panel (Vex) is mounted in the main area.
  expect(
    screen.getAllByRole('button', { name: 'Vex options' }).length,
  ).toBeGreaterThanOrEqual(1)

  fireEvent.click(within(drawerCard('Bandit 2')).getByText('Bandit 2'))

  // The main area now carries Bandit 2's encounter sheet: its interactive
  // chrome (panel menu, Add status) exists.
  expect(
    screen.getAllByRole('button', { name: 'Bandit 2 options' }).length,
  ).toBeGreaterThanOrEqual(1)
  expect(
    screen.getAllByRole('button', { name: 'Add status to Bandit 2' }).length,
  ).toBeGreaterThanOrEqual(1)
  // ...and the card reads as selected.
  const body = within(drawerCard('Bandit 2')).getByText('Bandit 2').closest('button')
  expect(body).toHaveAttribute('aria-pressed', 'true')
})

test('the drawer card statuses are static — no stack steppers, no reference click', () => {
  seed()
  renderImmersive()

  const card = drawerCard('Bandit 2')

  // Read-only pill: the stack count prints, but no stepper or open-reference
  // button exists anywhere in the card.
  expect(within(card).getAllByText('2').length).toBeGreaterThanOrEqual(1)
  expect(
    within(card).queryByRole('button', { name: /stack of Poisoned/ }),
  ).not.toBeInTheDocument()
  expect(
    within(card).queryByRole('button', { name: /Remove Poisoned/ }),
  ).not.toBeInTheDocument()
  expect(
    within(card).queryByRole('button', { name: 'Poisoned' }),
  ).not.toBeInTheDocument()
})

test('the encounter sheet is a read-only, encounter-ready sheet', () => {
  const player = {
    ...PLAYER,
    // Flavor text the encounter view must strip.
    innateDescription: 'Born of the void between stars.',
  }
  useCharacterStore.setState({ characters: [player, NPC], currentCharacter: null })
  seed([characterPanel('panel-pc'), instancePanel('panel-npc-1', 'Bandit')])
  renderImmersive()

  // Chrome: HP, AP and the Add Status affordance are present.
  expect(
    screen.getAllByRole('button', { name: 'Add status to Vex' }).length,
  ).toBeGreaterThanOrEqual(1)
  // The encounter sheet's own HP bar (the drawer cards carry their own
  // read-only tracks).
  expect(
    screen.getAllByRole('img', { name: /hit points/ }).length,
  ).toBeGreaterThanOrEqual(1)

  // No flavor: the Innate narrative prose is suppressed in the body.
  expect(
    screen.queryByText('Born of the void between stars.'),
  ).not.toBeInTheDocument()

  // No editing: the sheet body renders in view mode, so no Edit buttons.
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('collapsing the drawer shrinks it to a portrait rail with instance number badges', () => {
  seed()
  renderImmersive()

  fireEvent.click(
    screen.getByRole('button', { name: 'Collapse character list' }),
  )

  const rail = document.querySelector('.gm-drawer__rail') as HTMLElement
  expect(rail).not.toBeNull()

  // One rail item per panel, identified by its full-name tooltip.
  const items = within(rail).getAllByTitle(/Vex|Bandit/)
  expect(items.length).toBe(3)

  // Number badges: only the multi-instance base gets them, 1-based ordinal.
  const badges = rail.querySelectorAll('.gm-drawer-rail-item__num')
  expect(badges).toHaveLength(2)
  expect(badges[0].textContent).toBe('1')
  expect(badges[1].textContent).toBe('2')

  // The rail is still the drawer: selecting from it swaps the main area.
  fireEvent.click(within(rail).getByTitle('Bandit 2'))
  expect(
    screen.getAllByRole('button', { name: 'Bandit 2 options' }).length,
  ).toBeGreaterThanOrEqual(1)
})

test('instance number badges appear only when a base has multiple instances', () => {
  seed([characterPanel('panel-pc'), instancePanel('panel-npc-1', 'Bandit')])
  renderImmersive()

  // A lone Bandit needs no badge; the expanded cards print none.
  expect(document.querySelector('.gm-drawer-card__num')).toBeNull()
})

test('the drawer reorders through the same movePanel action as the grid', () => {
  seed()
  renderImmersive()
  expect(sortableIds.current.size).toBe(3)

  // Replay a drag: Bandit 2 (panel-npc-2) dropped onto the first position.
  act(() => {
    dragEndRef.current?.({
      active: { id: 'panel-npc-2' },
      over: { id: 'panel-pc' },
    })
  })

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(panels.map((p) => p.id)).toEqual([
    'panel-npc-2',
    'panel-pc',
    'panel-npc-1',
  ])
})

test('a no-op drag (same position, or no target) leaves the order alone', () => {
  seed()
  renderImmersive()

  act(() => {
    dragEndRef.current?.({
      active: { id: 'panel-pc' },
      over: { id: 'panel-pc' },
    })
  })
  act(() => {
    dragEndRef.current?.({ active: { id: 'panel-pc' }, over: null })
  })

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(panels.map((p) => p.id)).toEqual([
    'panel-pc',
    'panel-npc-1',
    'panel-npc-2',
  ])
})

test('the drawer footer opens the Add pickers through the page callbacks', () => {
  seed()
  const onAddCharacter = vi.fn()
  const onAddNpc = vi.fn()
  renderImmersive({ onAddCharacter, onAddNpc })

  fireEvent.click(screen.getByRole('button', { name: 'Add Character' }))
  expect(onAddCharacter).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole('button', { name: 'Add NPC' }))
  expect(onAddNpc).toHaveBeenCalledTimes(1)
})

test('a deleted record renders a removable placeholder, not a broken card', () => {
  seed()
  renderImmersive()
  // The player deletes the Bandit base; the instances remain on the screen.
  act(() => {
    useCharacterStore.setState({ characters: [PLAYER] })
  })

  const drawer = screen.getByLabelText('Character list')
  // The instance keeps its label, marked by the missing-note line.
  expect(
    within(drawer).getAllByText('Missing NPC — the base record was deleted.')
      .length,
  ).toBe(2)

  // Nothing to select, but the panel is removable from the card.
  const removeButtons = within(drawer).getAllByRole('button', {
    name: /Remove missing Bandit/,
  })
  expect(removeButtons).toHaveLength(2)

  fireEvent.click(removeButtons[0])
  expect(useGMScreenStore.getState().screens[0].panels).toHaveLength(2)
})
