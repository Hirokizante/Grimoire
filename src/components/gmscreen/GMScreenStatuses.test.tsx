/**
 * Component tests for the GM Screen's status tracker.
 *
 * Covers what the feature promises: an "Add Status" button on BOTH panel
 * kinds opening the compendium picker, the five duration labels, pills that
 * render the status's icon/name/duration inline with the HP number, the
 * per-status stack stepper (which turns into an explicit remove at one stack),
 * and the pill's reference behaviour — clicking it opens the condition's
 * description in the global status modal and hovering/focusing it shows the
 * same card a sheet's inline status reference shows.
 *
 * jsdom applies no stylesheets, so the layout guarantees (one line, no taller
 * panel, horizontal scroll) and the card's portal placement are asserted in the
 * browser suite instead — see `e2e/gm-screen.spec.ts`.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'

import CharacterPanel from '@/components/gmscreen/CharacterPanel'
import NpcInstancePanel from '@/components/gmscreen/NpcInstancePanel'
import StatusModal from '@/components/status/StatusModal'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter, createDefaultNPC } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useStatusStore } from '@/store/statusStore'
import { STATUS_DURATIONS } from '@/constants/statusDurations'
import type { Character, PanelStatusDuration, StatusCondition } from '@/types'

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

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

const SCREEN_ID = 'screen-1'
const PANEL_ID = 'panel-1'

/** A compendium status record with a predictable id. */
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
const PRONE = makeStatus('st-prone', 'Prone')

const PLAYER: Character = { ...createDefaultCharacter(), id: 'pc-1', name: 'Vex' }
const NPC: Character = {
  ...createDefaultNPC(),
  id: 'npc-1',
  name: 'Bandit',
  npcStats: { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20, mortalWounds: 0 },
}

/** Seed an open screen holding one panel of the given kind. */
function seed(kind: 'character' | 'npc') {
  useCharacterStore.setState({ characters: [PLAYER, NPC], currentCharacter: null })
  useStatusStore.setState({
    statuses: [POISONED, PRONE],
    isLoaded: true,
    modal: { statusId: null, startInEdit: false },
  })
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [
          kind === 'character'
            ? {
                kind: 'character',
                id: PANEL_ID,
                characterId: PLAYER.id,
                density: 'compact',
                statuses: [],
              }
            : {
                kind: 'npc-instance',
                id: PANEL_ID,
                baseNpcId: NPC.id,
                label: 'Bandit',
                density: 'compact',
                statuses: [],
                state: { currentHP: 20, tempHP: 0, condition: 'active' },
              },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    currentScreenId: SCREEN_ID,
    isLoaded: true,
    isSaving: false,
    loadError: null,
  })
}

/**
 * Render the seeded panel the way `GMScreenPage` does — subscribed to the
 * store, so store mutations re-render it with the fresh panel (the panels
 * themselves are plain props and would otherwise go stale in the test).
 */
function renderPanel(kind: 'character' | 'npc' = 'npc') {
  seed(kind)
  const panel = useGMScreenStore.getState().screens[0].panels[0]

  function Harness() {
    const live = useGMScreenStore((s) => s.screens[0]?.panels[0])
    if (!live) return null
    return live.kind === 'character' ? (
      <CharacterPanel
        panel={live}
        character={PLAYER}
        screenId={SCREEN_ID}
        onOpenSheet={() => {}}
        onRemove={() => {}}
      />
    ) : (
      <NpcInstancePanel
        panel={live}
        base={NPC}
        screenId={SCREEN_ID}
        subtitle={null}
        onOpenBase={() => {}}
        onRemove={() => {}}
      />
    )
  }

  const result = render(
    <NotificationProvider>
      <Harness />
      {/* Mounted app-wide (App.tsx) so a pill's click reaches the same global
          detail modal a sheet's inline status reference opens. */}
      <StatusModal />
    </NotificationProvider>,
  )
  // The harness resolves the same panel the store was seeded with.
  expect(panel.id).toBe(PANEL_ID)
  return result
}

/** Tracked statuses of the seeded panel. */
function tracked() {
  return useGMScreenStore.getState().screens[0].panels[0].statuses
}

/** Add a status through the picker UI, choosing the given duration. */
function addViaPicker(statusName: string, duration: PanelStatusDuration) {
  fireEvent.click(screen.getByRole('button', { name: /^Add status to/ }))
  const chip = screen.getByRole('group', { name: `Duration for ${statusName}` })
  const label = STATUS_DURATIONS.find((d) => d.value === duration)!.label
  fireEvent.click(within(chip).getByRole('button', { name: label }))
}

beforeEach(() => {
  dbMap.clear()
  localStorage.clear()
  useCharacterStore.setState({ characters: [], currentCharacter: null })
  useStatusStore.setState({
    statuses: [],
    isLoaded: true,
    modal: { statusId: null, startInEdit: false },
  })
  useGMScreenStore.setState({
    screens: [],
    currentScreenId: null,
    isLoaded: true,
    isSaving: false,
    loadError: null,
  })
})

// ---- The Add Status control -------------------------------------------------

test.each(['character', 'npc'] as const)(
  'a %s panel offers an Add Status button',
  (kind) => {
    renderPanel(kind)
    const name = kind === 'character' ? 'Vex' : 'Bandit'
    expect(
      screen.getByRole('button', { name: `Add status to ${name}` }),
    ).toBeInTheDocument()
  },
)

test('the picker lists every compendium status with all five durations', () => {
  renderPanel('npc')

  fireEvent.click(screen.getByRole('button', { name: 'Add status to Bandit' }))

  expect(screen.getByRole('dialog', { name: 'Add status to Bandit' })).toBeInTheDocument()
  // Both statuses, sorted by name, each with the five duration chips.
  const poisoned = screen.getByRole('group', { name: 'Duration for Poisoned' })
  expect(within(poisoned).getAllByRole('button')).toHaveLength(5)
  expect(
    within(poisoned)
      .getAllByRole('button')
      .map((b) => b.textContent),
  ).toEqual(['Quick', 'Persistent', 'Countdown', 'Permanent', 'Conditional'])
  expect(screen.getByText('Prone')).toBeInTheDocument()
  // Nothing is tracked yet, so no chip is pressed.
  expect(
    within(poisoned)
      .getAllByRole('button')
      .every((b) => b.getAttribute('aria-pressed') === 'false'),
  ).toBe(true)
})

test('the picker filters by name and reports an empty search', () => {
  renderPanel('npc')
  fireEvent.click(screen.getByRole('button', { name: 'Add status to Bandit' }))

  fireEvent.change(screen.getByLabelText('Search statuses'), {
    target: { value: 'pron' },
  })
  expect(screen.getByText('Prone')).toBeInTheDocument()
  expect(screen.queryByText('Poisoned')).not.toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Search statuses'), {
    target: { value: 'zzz' },
  })
  expect(screen.getByText('No statuses match that search.')).toBeInTheDocument()
})

// ---- Applying, stacking, and removing ---------------------------------------

test('picking a duration tracks the status and renders its pill inline', () => {
  renderPanel('npc')

  addViaPicker('Poisoned', 'countdown')

  expect(tracked()).toEqual([
    { statusId: POISONED.id, duration: 'countdown', stacks: 1 },
  ])

  const strip = screen.getByRole('list', { name: 'Statuses on Bandit' })
  const pill = within(strip).getByRole('listitem')

  // Two segments: the filled one carries the icon + full name…
  const main = pill.querySelector('.gm-status-pill__main')!
  expect(within(main as HTMLElement).getByText('Poisoned')).toBeInTheDocument()
  // …and the right one holds the duration (icon only, labelled for AT) and
  // the stack stepper.
  const duration = within(pill).getByRole('img', { name: 'Duration: Countdown' })
  expect(duration.querySelector('svg.lucide-hourglass')).not.toBeNull()
  expect(duration).toHaveAttribute(
    'title',
    'Countdown: Runs for a set number of rounds — tick the stacks down each round.',
  )
  expect(within(pill).getByText('1')).toBeInTheDocument()
  // The duration label itself is not rendered — the icon saves the space.
  expect(within(pill).queryByText('Countdown')).not.toBeInTheDocument()
})

test('the picker stays open so several statuses can be applied at once', () => {
  renderPanel('npc')

  addViaPicker('Poisoned', 'quick')
  addViaPicker('Prone', 'conditional')

  expect(screen.getByRole('dialog', { name: 'Add status to Bandit' })).toBeInTheDocument()
  expect(tracked().map((s) => s.statusId)).toEqual([POISONED.id, PRONE.id])
})

test('re-picking a duration edits the tracked status instead of duplicating it', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'countdown')

  // The chip for the applied duration is the pressed one.
  const chips = screen.getByRole('group', { name: 'Duration for Poisoned' })
  expect(
    within(chips).getByRole('button', { name: 'Countdown' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(within(chips).getByRole('button', { name: 'Quick' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  // …and the row is flagged as tracked.
  expect(screen.getByText('on panel')).toBeInTheDocument()

  fireEvent.click(within(chips).getByRole('button', { name: 'Permanent' }))

  expect(tracked()).toEqual([
    { statusId: POISONED.id, duration: 'permanent', stacks: 1 },
  ])
})

test('the pill stepper increments and decrements stacks', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'countdown')

  fireEvent.click(
    screen.getByRole('button', { name: 'Add a stack of Poisoned to Bandit' }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Add a stack of Poisoned to Bandit' }),
  )
  expect(tracked()[0].stacks).toBe(3)

  fireEvent.click(
    screen.getByRole('button', { name: 'Remove one stack of Poisoned from Bandit' }),
  )
  expect(tracked()[0].stacks).toBe(2)
})

test('at one stack the decrement becomes an explicit remove', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'quick')

  // No "remove one stack" control at one stack — the pill offers a real ✕ …
  expect(
    screen.queryByRole('button', {
      name: 'Remove one stack of Poisoned from Bandit',
    }),
  ).not.toBeInTheDocument()
  // …so a status can never vanish from a mis-click on a decrement.
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Poisoned from Bandit' }),
  )

  expect(tracked()).toEqual([])
  expect(
    screen.queryByRole('list', { name: 'Statuses on Bandit' }),
  ).not.toBeInTheDocument()
})

// ---- The pill is the status's reference -------------------------------------

/** The pill for the first tracked status on the seeded panel. */
function firstPill() {
  return within(
    screen.getByRole('list', { name: 'Statuses on Bandit' }),
  ).getByRole('listitem')
}

test('clicking a pill opens that status in the global detail modal', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'countdown')

  expect(useStatusStore.getState().modal.statusId).toBeNull()

  fireEvent.click(within(firstPill()).getByRole('button', { name: 'Poisoned' }))

  // The compendium record is opened by id — a panel holds no copy of its own —
  // so the GM lands in exactly the modal a sheet's inline reference opens.
  expect(useStatusStore.getState().modal.statusId).toBe(POISONED.id)
  const dialog = screen.getByRole('dialog', { name: 'Status details' })
  expect(within(dialog).getByText(POISONED.name)).toBeInTheDocument()
  expect(
    within(dialog).getByText('Poisoned does something unpleasant.'),
  ).toBeInTheDocument()
})

test("opening a status from a pill leaves the panel's tracking untouched", () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'countdown')
  fireEvent.click(
    within(firstPill()).getByRole('button', {
      name: 'Add a stack of Poisoned to Bandit',
    }),
  )
  const before = tracked()

  fireEvent.click(within(firstPill()).getByRole('button', { name: 'Poisoned' }))

  expect(tracked()).toEqual(before)
})

test('hovering a pill shows the card a sheet reference shows', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'countdown')

  // Nothing until the pointer arrives…
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

  const name = within(firstPill()).getByRole('button', { name: 'Poisoned' })
  fireEvent.mouseEnter(name)

  // …then the shared card: icon, name, and the description as plain text.
  const card = screen.getByRole('tooltip')
  expect(card).toHaveTextContent('Poisoned')
  expect(card).toHaveTextContent('Poisoned does something unpleasant.')

  fireEvent.mouseLeave(name)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

test('focusing a pill shows the card too (keyboard parity with the sheet)', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'quick')

  const name = within(firstPill()).getByRole('button', { name: 'Poisoned' })
  fireEvent.focus(name)
  expect(screen.getByRole('tooltip')).toBeInTheDocument()

  fireEvent.blur(name)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

test('a missing status pill has nothing to open and keeps a plain tooltip', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'quick')

  act(() => {
    useStatusStore.setState({ statuses: [PRONE] })
  })

  const pill = firstPill()
  expect(within(pill).getByText('Missing status')).toBeInTheDocument()
  // There is no description left to show, so the name is not a button and no
  // card can be hovered…
  expect(
    within(pill).queryByRole('button', { name: 'Missing status' }),
  ).not.toBeInTheDocument()
  fireEvent.mouseEnter(pill)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  // …it explains itself the plain way instead.
  expect(pill).toHaveAttribute(
    'title',
    expect.stringContaining('no longer in the compendium'),
  )
})

test('a status deleted from the compendium leaves a labelled placeholder pill', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'quick')

  // The GM deletes the condition from the compendium while it is tracked.
  act(() => {
    useStatusStore.setState({ statuses: [PRONE] })
  })

  const strip = screen.getByRole('list', { name: 'Statuses on Bandit' })
  expect(within(strip).getByText('Missing status')).toBeInTheDocument()
  // It stays removable rather than becoming stuck state.
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Missing status from Bandit' }),
  )
  expect(tracked()).toEqual([])
})

test('a player panel tracks statuses without touching the character record', () => {
  renderPanel('character')
  addViaPicker('Prone', 'persistent')

  expect(tracked()).toEqual([
    { statusId: PRONE.id, duration: 'persistent', stacks: 1 },
  ])
  expect(
    within(screen.getByRole('list', { name: 'Statuses on Vex' })).getByText('Prone'),
  ).toBeInTheDocument()
  // GM-screen-only state: the character the panel references is untouched, so
  // nothing about it can reach the player's own sheet.
  expect(useCharacterStore.getState().characters[0]).not.toHaveProperty('statuses')
})

test('a status the compendium has not loaded yet is not labelled missing', () => {
  renderPanel('npc')
  addViaPicker('Poisoned', 'quick')

  // Panels can render before the compendium read resolves; that is not a
  // deleted status, so it must never read as one.
  act(() => {
    useStatusStore.setState({ statuses: [], isLoaded: false })
  })
  expect(screen.queryByText('Missing status')).not.toBeInTheDocument()

  act(() => {
    useStatusStore.setState({ statuses: [POISONED], isLoaded: true })
  })
  expect(
    within(screen.getByRole('list', { name: 'Statuses on Bandit' })).getByText(
      'Poisoned',
    ),
  ).toBeInTheDocument()
})
