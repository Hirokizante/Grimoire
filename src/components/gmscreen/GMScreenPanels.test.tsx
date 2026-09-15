/**
 * Component tests for the GM Screen's NPC-instance flow.
 *
 * The generalized DamageDialog is the shared dialog for BOTH player sheets
 * and NPC instances — these tests pin the instance branch: armor and max HP
 * come from the base record's `npcStats`, temp HP from the instance state,
 * and reaching 0 HP downs the instance instead of inflicting mortal wounds.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { act, cleanup, render, screen, fireEvent, within } from '@testing-library/react'

import DamageDialog from '@/components/sheet/DamageDialog'
import CharacterPanel from '@/components/gmscreen/CharacterPanel'
import NpcInstancePanel from '@/components/gmscreen/NpcInstancePanel'
import CharacterSheet from '@/components/sheet/CharacterSheet'
import StatsSection from '@/components/sheet/StatsSection'
import DiceRollOverlay from '@/components/dice/DiceRollOverlay'
import { NotificationProvider } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useRollLogStore } from '@/store/rollLogStore'
import { createDefaultNPC, createDefaultCharacter, DEFAULT_SHEET_COLORS, MAX_AP } from '@/constants/gameData'
import { appThemeSheetColors, appThemeStatColors } from '@/lib/themeUtils'
import { SHORT_STAT_LABELS } from '@/components/sheet/statTokenLabels'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useGmPanelThemeStore } from '@/store/gmPanelThemeStore'
import type { AbilityBlock, Character } from '@/types'

const { dbMap, dieQueue } = vi.hoisted(() => ({
  dbMap: new Map<string, unknown>(),
  /** Queued die faces for the tests that need exact rolls; empty = real dice. */
  dieQueue: [] as number[],
}))

// Dice go through this one function, so a test can queue the exact faces it
// wants to reason about without touching the RNG everyone else uses (Recharge
// Die, Mortal Wounds, armor reduction). An empty queue falls through to a real
// roll, so every other test keeps its randomness.
vi.mock('@/lib/dice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dice')>()
  return {
    rollDie: (sides: number) => dieQueue.shift() ?? actual.rollDie(sides),
  }
})

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

/** Base bandit: 20 max HP, 0 armor unless overridden. */
function makeBase(overrides: Partial<Character> = {}): Character {
  return {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    npcStats: { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20, mortalWounds: 0 },
    ...overrides,
  }
}

const SCREEN_ID = 'screen-1'
const PANEL_ID = 'panel-1'

/** Seed a screen with one NPC-instance panel and return the panel. */
function seedScreenFor(
  base: Character,
  state?: Partial<{
    currentHP: number
    tempHP: number
    abilityUses: Record<string, number>
    abilityModifiers: Record<string, boolean>
  }>,
) {
  useCharacterStore.setState({ characters: [base], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [
          {
            kind: 'npc-instance',
            id: PANEL_ID,
            baseNpcId: base.id,
            label: 'Bandit',
            density: 'compact',
            statuses: [],
            state: {
              currentHP: state?.currentHP ?? 20,
              tempHP: state?.tempHP ?? 0,
              condition: 'active',
              currentAP: MAX_AP,
              cooldowns: [],
              mortalWounds: [],
              abilityUses: state?.abilityUses ?? {},
              abilityModifiers: state?.abilityModifiers ?? {},
            },
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    currentScreenId: SCREEN_ID,
    isLoaded: true,
    isSaving: false,
  })
}

/** The panel's live state after a store mutation. */
function panelState() {
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  if (panel.kind !== 'npc-instance') throw new Error('expected an npc-instance panel')
  return panel.state
}

beforeEach(() => {
  dbMap.clear()
  localStorage.clear()
  // `localStorage.clear()` does not reset already-hydrated store state, so the
  // panel-theme switch is reset explicitly (it is off by default).
  useGmPanelThemeStore.setState({ matchAppTheme: false })
  useCharacterStore.setState({ characters: [], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [],
    currentScreenId: null,
    isLoaded: true,
    isSaving: false,
    loadError: null,
  })
})

function renderDialog(base: Character, currentHP = 20, tempHP = 0) {
  return render(
    <NotificationProvider>
      <DamageDialog
        npcInstance={{
          screenId: SCREEN_ID,
          panelId: PANEL_ID,
          label: 'Bandit',
          base,
          currentHP,
          tempHP,
        }}
        onClose={() => {}}
      />
    </NotificationProvider>,
  )
}

// ---- DamageDialog against an NPC instance ----------------------------------

test('DamageDialog: titles itself with the instance label and base armor', () => {
  const base = makeBase({ npcStats: { evasion: 10, armor: 3, movement: 5, saveDC: 10, hp: 20, mortalWounds: 0 } })
  seedScreenFor(base)
  renderDialog(base)

  expect(screen.getByText('Apply Damage — Bandit')).toBeInTheDocument()
  // Armor comes from npcStats, not the character's VIT-derived armor.
  expect(screen.getByText('Apply Armor (3d6 reduction)')).toBeInTheDocument()
})

test('DamageDialog: applying damage reduces the instance HP, not any character', () => {
  const base = makeBase()
  seedScreenFor(base)
  renderDialog(base)

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })
  // Armor off so the result is deterministic.
  fireEvent.click(screen.getByLabelText(/Apply Armor/))
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }))

  expect(panelState().currentHP).toBe(13)
  expect(panelState().condition).toBe('active')
})

test('DamageDialog: damage to 0 downs the instance instead of a mortal wound', () => {
  const base = makeBase()
  seedScreenFor(base)
  renderDialog(base)

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '999' } })
  fireEvent.click(screen.getByLabelText(/Apply Armor/))
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }))

  expect(panelState().currentHP).toBe(0)
  expect(panelState().condition).toBe('downed')
  // A base that allows no Mortal Wounds never rolls for one.
  expect(panelState().mortalWounds).toEqual([])
  expect(screen.queryByText(/Mortal Wound\(s\) incurred/)).not.toBeInTheDocument()
})

test('DamageDialog: an NPC that allows wounds rolls one automatically and reports it', () => {
  const base = makeWoundNpc(2)
  seedScreenFor(base)
  const { container } = renderDialog(base)
  mockMortalWoundRoll(14)

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }))

  // The roll happened in the store — no "Pending Roll" step for the GM.
  expect(panelState().mortalWounds).toEqual([{ roll: 14, name: 'Fracture' }])
  expect(panelState().currentHP).toBe(15)
  expect(panelState().condition).toBe('active')
  // …and the dialog names the wound it rolled (its own text is split across
  // nodes by the JSX expression, so assert on the line as a whole).
  const alert = container.querySelector('.damage-result__alert')
  expect(alert?.textContent).toContain('rolled automatically')
  expect(alert?.textContent).toContain('Fracture (d20 14)')
  expect(alert?.textContent).toContain('HP reset to 15')
  // The toast says the same thing for a GM who is not looking at the dialog.
  expect(screen.getByRole('alert').textContent).toContain(
    'Bandit takes a Mortal Wound: Fracture (d20 14) — HP reset to 15.',
  )
})

test('DamageDialog: a knockout on an NPC that allows wounds reports both', () => {
  const base = makeWoundNpc(1)
  seedScreenFor(base)
  renderDialog(base)
  mockMortalWoundRoll(9)

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }))
  // One wound allowed: 20 − 25 → wound, HP reset to 20 with 5 spilling over.
  expect(panelState().currentHP).toBe(15)

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }))

  expect(panelState().currentHP).toBe(0)
  expect(panelState().condition).toBe('downed')
  expect(panelState().mortalWounds).toEqual([{ roll: 9, name: 'Exhaustion' }])
})

test('DamageDialog: instance temp HP absorbs damage before HP', () => {
  const base = makeBase()
  seedScreenFor(base, { currentHP: 20, tempHP: 5 })
  renderDialog(base, 20, 5)

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8' } })
  fireEvent.click(screen.getByLabelText(/Apply Armor/))
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }))

  expect(panelState().tempHP).toBe(0)
  expect(panelState().currentHP).toBe(17)
})

test('DamageDialog: Heal revives a downed instance and caps at the base max HP', () => {
  const base = makeBase()
  seedScreenFor(base, { currentHP: 0 })
  useGMScreenStore.getState().setInstanceCondition(SCREEN_ID, PANEL_ID, 'downed')
  renderDialog(base, 0)

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } })
  fireEvent.click(screen.getByRole('button', { name: 'Heal' }))

  expect(panelState().currentHP).toBe(20)
  expect(panelState().condition).toBe('active')
})

test('DamageDialog: Set Temp HP keeps the strongest instance', () => {
  const base = makeBase()
  seedScreenFor(base, { tempHP: 6 })
  renderDialog(base, 20, 6)

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Set Temp HP' }))

  expect(panelState().tempHP).toBe(6)
})

// ---- NpcInstancePanel rendering --------------------------------------------

function renderPanel(density: 'compact' | 'expanded') {
  const base = makeBase()
  seedScreenFor(base)
  useGMScreenStore.getState().setPanelDensity(SCREEN_ID, PANEL_ID, density)
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  if (panel.kind !== 'npc-instance') throw new Error('expected an npc-instance panel')

  return render(
    <NotificationProvider>
      <NpcInstancePanel
        panel={panel}
        base={base}
        screenId={SCREEN_ID}
        subtitle={null}
        onOpenBase={() => {}}
        onRemove={() => {}}
      />
    </NotificationProvider>,
  )
}

test('NpcInstancePanel: compact shows the HP value, max, and base tokens', () => {
  renderPanel('compact')

  expect(screen.getByText('Bandit')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '20 of 20 hit points' })).toBeInTheDocument()
  expect(screen.getByText('Active')).toBeInTheDocument()
  // Base tokens: Evasion 10, Armor 0, Movement 5, Save DC 10.
  expect(screen.getByText('Eva')).toBeInTheDocument()
  expect(screen.getByText('DC')).toBeInTheDocument()
})

test('NpcInstancePanel: HP steppers target this instance', () => {
  // The subscribed harness, so the panel re-renders after each write — the
  // steppers disable at their own end of the pool (full HP has nothing to heal).
  renderNpcPanel(makeBase(), 'compact')

  fireEvent.click(screen.getByRole('button', { name: 'Deal 1 damage to Bandit' }))
  expect(panelState().currentHP).toBe(19)

  expect(screen.getByRole('button', { name: 'Heal Bandit 1 HP' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Heal Bandit 1 HP' }))
  expect(panelState().currentHP).toBe(20)
})

test('NpcInstancePanel: a downed instance is labelled and struck through', () => {
  const base = makeBase()
  seedScreenFor(base)
  useGMScreenStore.getState().setInstanceCondition(SCREEN_ID, PANEL_ID, 'downed')
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  if (panel.kind !== 'npc-instance') throw new Error('expected an npc-instance panel')

  const { container } = render(
    <NotificationProvider>
      <NpcInstancePanel
        panel={panel}
        base={base}
        screenId={SCREEN_ID}
        subtitle={null}
        onOpenBase={() => {}}
        onRemove={() => {}}
      />
    </NotificationProvider>,
  )

  expect(screen.getByText('Downed')).toBeInTheDocument()
  expect(container.querySelector('.gm-panel__name--dimmed')).not.toBeNull()
  expect(container.querySelector('.gm-panel--downed')).not.toBeNull()
})

// ---- Instance Mortal Wounds ------------------------------------------------

/** A bandit that can sustain `allowance` Mortal Wounds before it goes down. */
function makeWoundNpc(allowance: number): Character {
  return makeBase({
    npcStats: { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20, mortalWounds: allowance },
  })
}

/** Pin the Mortal Wounds D20 to a known face (14 → Fracture). */
function mockMortalWoundRoll(face: number) {
  vi.restoreAllMocks()
  vi.spyOn(Math, 'random').mockReturnValue((face - 0.5) / 20)
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('NpcInstancePanel: an NPC whose base allows no wounds renders no wound track', () => {
  // The mook case: `npcStats.mortalWounds: 0` must leave the panel exactly as
  // it was — no row, no extra height.
  const { container } = renderNpcPanel(makeBase(), 'compact')

  expect(container.querySelector('.gm-mw')).toBeNull()
})

test('NpcInstancePanel: the base allowance shows as an empty wound track', () => {
  const { container } = renderNpcPanel(makeWoundNpc(2), 'compact')

  const row = container.querySelector('.gm-mw')
  expect(row).not.toBeNull()
  expect(row?.textContent).toContain('Wounds')
  expect(row?.textContent).toContain('0/2')
  // Nothing rolled yet, and there is still a wound to take.
  expect(container.querySelector('.gm-mw__chip')).toBeNull()
  expect(container.querySelector('.gm-mw__warn')).toBeNull()
})

test('NpcInstancePanel: an auto-rolled wound is marked on the panel with its d20', () => {
  const base = makeWoundNpc(2)
  renderNpcPanel(base, 'compact')
  mockMortalWoundRoll(14)

  // 20 HP − 25 damage: the wound is rolled for the GM and 5 spills over.
  act(() => {
    useGMScreenStore.getState().damageInstance(SCREEN_ID, PANEL_ID, 25)
  })

  const row = document.querySelector('.gm-mw')
  expect(screen.getByText('Fracture')).toBeInTheDocument()
  expect(screen.getByText('14')).toBeInTheDocument()
  expect(row?.textContent).toContain('1/2')
  expect(panelState().currentHP).toBe(15)
  // The track is not full, so the instance is still standing.
  expect(panelState().condition).toBe('active')

  // Clearing the wound is explicit and per wound.
  fireEvent.click(screen.getByRole('button', { name: 'Clear Fracture from Bandit' }))
  expect(panelState().mortalWounds).toEqual([])
})

test('NpcInstancePanel: a full wound track warns that 0 HP now downs the instance', () => {
  renderNpcPanel(makeWoundNpc(1), 'compact')
  mockMortalWoundRoll(8)

  act(() => {
    useGMScreenStore.getState().damageInstance(SCREEN_ID, PANEL_ID, 25)
  })

  expect(screen.getByText('Damaged Throat')).toBeInTheDocument()
  expect(document.querySelector('.gm-mw')?.textContent).toContain('1/1')
  expect(screen.getByText('Next 0 HP: Downed')).toBeInTheDocument()
})

test('NpcInstancePanel: the panel menu clears the whole wound track', () => {
  renderNpcPanel(makeWoundNpc(2), 'compact')
  mockMortalWoundRoll(12)
  act(() => {
    useGMScreenStore.getState().damageInstance(SCREEN_ID, PANEL_ID, 25)
  })
  expect(panelState().mortalWounds).toHaveLength(1)

  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Clear mortal wounds' }))

  expect(panelState().mortalWounds).toEqual([])
})

test('NpcInstancePanel: the menu offers no wound clearing when there are none', () => {
  renderPanel('compact')

  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))

  expect(
    screen.queryByRole('menuitem', { name: 'Clear mortal wounds' }),
  ).not.toBeInTheDocument()
})

test('NpcInstancePanel: the menu applies a specific wound without rolling', () => {
  const { container } = renderNpcPanel(makeWoundNpc(2), 'compact')

  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add mortal wound…' }))

  // The same table picker the sheet opens, targeted at this instance.
  expect(
    screen.getByRole('dialog', { name: 'Add Mortal Wound to Bandit' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add Damaged Throat' }))

  // The instance's own track, in the rolled shape — the entry's D20 included,
  // so the chip reads exactly like an auto-rolled one.
  expect(panelState().mortalWounds).toEqual([
    { roll: 8, name: 'Damaged Throat' },
  ])
  const chip = container.querySelector('.gm-mw__chip')
  expect(chip?.textContent).toContain('Damaged Throat')
  expect(chip?.textContent).toContain('8')
  // Hand-adding a wound is bookkeeping, not damage: HP is untouched.
  expect(panelState().currentHP).toBe(20)
})

test('NpcInstancePanel: the manual add locks itself at the base’s allowance', () => {
  const base = makeWoundNpc(1)
  renderNpcPanel(base, 'compact')

  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add mortal wound…' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add Fracture' }))
  expect(panelState().mortalWounds).toEqual([{ roll: 14, name: 'Fracture' }])

  // The track is full, so the still-open dialog says why nothing can be picked
  // (the row is really disabled — no dead click).
  const dialog = screen.getByRole('dialog', { name: 'Add Mortal Wound to Bandit' })
  expect(
    within(dialog).getByText(/No Mortal Wound slots left on Bandit/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add Hemorrhage' })).toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))
  expect(
    screen.queryByRole('menuitem', { name: 'Add mortal wound…' }),
  ).not.toBeInTheDocument()
})

test('NpcInstancePanel: a mook that allows no wounds is offered no manual add', () => {
  // `mortalWounds: 0` renders no track at all, so it must offer no add either:
  // a wound on a panel that has no wound row could never be read back.
  renderPanel('compact')

  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))

  expect(
    screen.queryByRole('menuitem', { name: 'Add mortal wound…' }),
  ).not.toBeInTheDocument()
})

test('the manual-add picker portals out of the dead panel that opened it', () => {
  // A panel's dead state is `opacity` on the panel itself, which would both
  // fade an in-place dialog and make the panel the containing block for its
  // `position: fixed` overlay (see AddStatusModal). The picker mounts on
  // `document.body`, so no panel state can reach it.
  renderNpcPanel(makeWoundNpc(2), 'compact')
  act(() => {
    useGMScreenStore.getState().setInstanceCondition(SCREEN_ID, PANEL_ID, 'dead')
  })

  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add mortal wound…' }))

  const dialog = screen.getByRole('dialog', { name: 'Add Mortal Wound to Bandit' })
  const overlay = dialog.parentElement
  expect(overlay?.classList.contains('modal-overlay')).toBe(true)
  expect(overlay?.parentElement).toBe(document.body)
  expect(document.querySelector('.gm-panel--dead')?.contains(dialog)).toBe(false)
})

test('NpcInstancePanel: expanded renders the condensed shared body, not the full NPC sheet', () => {
  const { container } = renderPanel('expanded')

  // The same condensed PanelSheet a player panel uses.
  expect(container.querySelector('.character-sheet')).not.toBeNull()
  expect(screen.getByText('Combat Stats')).toBeInTheDocument()
  expect(screen.getByText('Attributes')).toBeInTheDocument()
  expect(screen.getByText('Abilities')).toBeInTheDocument()
  expect(screen.getByText('Skills')).toBeInTheDocument()
  // The old implementation rendered the whole NPCSheet, which also carried
  // "Slotted Abilities" and the NPC hero section.
  expect(screen.queryByText('Slotted Abilities')).not.toBeInTheDocument()
  // NPCs have no core abilities — the fields only hold generated defaults, so
  // the section is omitted entirely.
  expect(screen.queryByText('Core Ability')).not.toBeInTheDocument()
  // Reference material, omitted from panels on both panel kinds.
  expect(screen.queryByText('Description')).not.toBeInTheDocument()
})

test('NpcInstancePanel: the panel menu offers duplicate, open base, and remove', () => {
  renderPanel('compact')

  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))

  expect(screen.getByRole('menuitem', { name: 'Duplicate instance' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Open base sheet' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Mark dead' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Remove panel' })).toBeInTheDocument()
})

test('NpcInstancePanel: Mark dead flags the instance without touching its HP', () => {
  renderPanel('compact')

  fireEvent.click(screen.getByRole('button', { name: 'Bandit options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Mark dead' }))

  expect(panelState().condition).toBe('dead')
  expect(panelState().currentHP).toBe(20)
})

// ---- Panel chrome follows the app theme, not the sheet palette --------------

/** Read a token's resolved color from the rendered panel. */
function tokenColor(container: HTMLElement, label: string): string {
  const token = Array.from(container.querySelectorAll('.gm-token')).find(
    (el) => el.querySelector('.gm-token__label')?.textContent === label,
  )
  if (!token) throw new Error(`no token labelled ${label}`)
  return (token as HTMLElement).style.getPropertyValue('--token-color')
}

test('CharacterPanel: stat tokens use the app theme, never the sheet palette', () => {
  // Pin the app theme to Parchment while the sheet keeps the Midnight-default
  // palette, so the two palettes genuinely differ — otherwise this assertion
  // would pass even if the panel still read the sheet's colors.
  useAppThemeStore.setState({ theme: 'parchment' })
  const base = makeBase()
  // A character with a deliberately garish custom palette. None of these may
  // leak into the panel chrome — the GM Screen shows many sheets at once and
  // per-sheet token colors would make every panel read differently.
  const pc: Character = {
    ...createDefaultCharacter(),
    id: 'pc-1',
    name: 'Vex',
    config: {
      ...createDefaultCharacter().config,
      colors: {
        ...DEFAULT_SHEET_COLORS,
        tokenEvasion: '#ff00ff',
        tokenArmor: '#00ff00',
        apBar: '#ff0000',
        endBar: '#0000ff',
        fpBar: '#ffff00',
      },
    },
  }
  seedScreenFor(base)
  useCharacterStore.setState({ characters: [pc], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [
          {
            kind: 'character',
            id: PANEL_ID,
            characterId: pc.id,
            density: 'compact',
            statuses: [],
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
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  if (panel.kind !== 'character') throw new Error('expected a character panel')

  const { container } = render(
    <NotificationProvider>
      <CharacterPanel
        panel={panel}
        character={pc}
        screenId={SCREEN_ID}
        onOpenSheet={() => {}}
        onRemove={() => {}}
      />
    </NotificationProvider>,
  )

  const theme = appThemeSheetColors('parchment')
  const defaultTheme = appThemeSheetColors('midnight')
  const stats = appThemeStatColors('parchment')
  // Eva/Arm are combat stats: they take the theme's shared stat palette, the
  // same one the body's Combat Stats row and an NPC panel use. END/FP are pools
  // and keep the resource-bar colors.
  expect(tokenColor(container, 'Eva')).toBe(stats.evasion)
  expect(tokenColor(container, 'Arm')).toBe(stats.armor)
  expect(tokenColor(container, 'END')).toBe(theme.endBar)
  expect(tokenColor(container, 'FP')).toBe(theme.fpBar)
  // AP has no token at all any more: the meter under the HP bar carries it
  // (and colors its own accent from the same app theme).
  expect(
    Array.from(container.querySelectorAll('.gm-token__label')).map(
      (l) => l.textContent,
    ),
  ).not.toContain('AP')
  // The app theme really is a different palette from the sheet's defaults, so
  // the assertions above are meaningful rather than coincidental.
  expect(stats.evasion).not.toBe(defaultTheme.tokenEvasion)
  expect(theme.endBar).not.toBe(defaultTheme.endBar)
  expect(theme.tokenEvasion).not.toBe(defaultTheme.tokenEvasion)

  // And none of the sheet's custom colors leaked through.
  const rendered = ['Eva', 'Arm', 'END', 'FP'].map((l) => tokenColor(container, l))
  for (const garish of ['#ff00ff', '#00ff00', '#ff0000', '#0000ff', '#ffff00']) {
    expect(rendered).not.toContain(garish)
  }
})

test('NpcInstancePanel: stat tokens use the same app-theme source', () => {
  useAppThemeStore.setState({ theme: 'parchment' })
  const base = makeBase()
  seedScreenFor(base)
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  if (panel.kind !== 'npc-instance') throw new Error('expected an npc-instance panel')

  const { container } = render(
    <NotificationProvider>
      <NpcInstancePanel
        panel={panel}
        base={base}
        screenId={SCREEN_ID}
        subtitle={null}
        onOpenBase={() => {}}
        onRemove={() => {}}
      />
    </NotificationProvider>,
  )

  const stats = appThemeStatColors('parchment')
  expect(tokenColor(container, 'Eva')).toBe(stats.evasion)
  expect(tokenColor(container, 'Arm')).toBe(stats.armor)
  expect(tokenColor(container, 'Move')).toBe(stats.movement)
  expect(tokenColor(container, 'DC')).toBe(stats.saveDC)
})

test('shared stats read the same color on both panel types', () => {
  // Eva / Arm appear on both panels: they must not differ between them.
  const base = makeBase()
  seedScreenFor(base)
  const npcPanel = useGMScreenStore.getState().screens[0].panels[0]
  if (npcPanel.kind !== 'npc-instance') throw new Error('expected an npc-instance panel')

  const npcRender = render(
    <NotificationProvider>
      <NpcInstancePanel
        panel={npcPanel}
        base={base}
        screenId={SCREEN_ID}
        subtitle={null}
        onOpenBase={() => {}}
        onRemove={() => {}}
      />
    </NotificationProvider>,
  )
  const npcEva = tokenColor(npcRender.container, 'Eva')
  const npcArm = tokenColor(npcRender.container, 'Arm')
  npcRender.unmount()

  const pc: Character = { ...createDefaultCharacter(), id: 'pc-1', name: 'Vex' }
  useCharacterStore.setState({ characters: [pc, base], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [
          {
            kind: 'character',
            id: 'pc-panel',
            characterId: pc.id,
            density: 'compact',
            statuses: [],
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
  const pcPanel = useGMScreenStore.getState().screens[0].panels[0]
  if (pcPanel.kind !== 'character') throw new Error('expected a character panel')

  const pcRender = render(
    <NotificationProvider>
      <CharacterPanel
        panel={pcPanel}
        character={pc}
        screenId={SCREEN_ID}
        onOpenSheet={() => {}}
        onRemove={() => {}}
      />
    </NotificationProvider>,
  )

  expect(tokenColor(pcRender.container, 'Eva')).toBe(npcEva)
  expect(tokenColor(pcRender.container, 'Arm')).toBe(npcArm)
})

// ---- The expanded body: the sheet's palette vs the app theme ---------------

/** A player character whose sheet customization is impossible to miss. */
function makeCustomizedPc(): Character {
  const base = createDefaultCharacter()
  return {
    ...base,
    id: 'pc-1',
    name: 'Vex',
    // 5 milestones = a +2 bonus, so the row carries the inline bonus badge the
    // milestone test below asserts on.
    milestones: 5,
    config: {
      ...base.config,
      backgroundColor: '#123123',
      sectionHeadingFontFamily: 'Playfair Display',
      labelFontFamily: 'Cinzel',
      textFontFamily: 'Georgia',
      helperTextFontFamily: 'monospace',
      hideSectionBackground: true,
      colors: {
        ...DEFAULT_SHEET_COLORS,
        bgBase: '#010203',
        accent: '#ff00ff',
        hpBar: '#00ff00',
        // Garish Combat Stats accents too: a panel must never paint its row
        // with these (see the row tests below).
        tokenMilestone: '#ff00ff',
        tokenEvasion: '#ff00ff',
        tokenArmor: '#00ff00',
        tokenMovement: '#ff0000',
        tokenSaveDC: '#0000ff',
        tokenEndRecovery: '#ffff00',
      },
    },
  }
}

/** Read the Combat Stats accents an expanded panel body rendered. */
function bodyTokenColors(panel: HTMLElement): Record<string, string> {
  const tokens = panel.querySelectorAll<HTMLElement>(
    '.gm-panel__sheet .stat-token',
  )
  return Object.fromEntries(
    [...tokens].map((el) => [
      el.querySelector('.stat-token__label')?.textContent ?? '',
      el.style.getPropertyValue('--token-color'),
    ]),
  )
}

/** Seed one EXPANDED player panel over `pc`, render it, return the body div. */
function renderExpandedPlayerPanel(pc: Character): HTMLElement {
  useCharacterStore.setState({ characters: [pc], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [
          {
            kind: 'character',
            id: PANEL_ID,
            characterId: pc.id,
            density: 'expanded',
            statuses: [],
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
  const panel = useGMScreenStore.getState().screens[0].panels[0]
  if (panel.kind !== 'character') throw new Error('expected a character panel')

  const { container } = render(
    <NotificationProvider>
      <CharacterPanel
        panel={panel}
        character={pc}
        screenId={SCREEN_ID}
        onOpenSheet={() => {}}
        onRemove={() => {}}
      />
    </NotificationProvider>,
  )

  const body = container.querySelector('.gm-panel__sheet')
  if (!body) throw new Error('expanded panel body not rendered')
  return body as HTMLElement
}

test('CharacterPanel: the expanded body keeps the sheet palette by default', () => {
  useAppThemeStore.setState({ theme: 'parchment' })
  const body = renderExpandedPlayerPanel(makeCustomizedPc())

  // Per-sheet customization on a panel is the historical behaviour and the
  // default: the switch is opt-in.
  expect(body.style.getPropertyValue('--accent-violet')).toBe('#ff00ff')
  expect(body.style.getPropertyValue('--bg-base')).toBe('#010203')
  expect(body.style.getPropertyValue('--sheet-bg')).toBe('#123123')
  expect(body.style.getPropertyValue('--sheet-heading-font')).toBe(
    'Playfair Display',
  )
  expect(body.className).toContain('character-sheet--flat')
})

test('CharacterPanel: Match app theme strips the sheet palette from the body', () => {
  // Parchment app theme against the character's own (garish) palette, so the
  // two genuinely differ and the assertions cannot pass by coincidence.
  useAppThemeStore.setState({ theme: 'parchment' })
  useGmPanelThemeStore.setState({ matchAppTheme: true })
  const body = renderExpandedPlayerPanel(makeCustomizedPc())

  const theme = appThemeSheetColors('parchment')
  expect(theme.accent).not.toBe('#ff00ff')
  expect(body.style.getPropertyValue('--accent-violet')).toBe(theme.accent)
  expect(body.style.getPropertyValue('--bg-base')).toBe(theme.bgBase)
  expect(body.style.getPropertyValue('--hp-bar-color')).toBe(theme.hpBar)

  // Nothing per-sheet survives: no custom card background, no custom fonts,
  // no flat-section layout override.
  expect(body.style.getPropertyValue('--sheet-bg')).toBe('')
  expect(body.style.getPropertyValue('--sheet-heading-font')).toBe('')
  expect(body.style.getPropertyValue('--sheet-text-font')).toBe('')
  expect(body.className).not.toContain('character-sheet--flat')
  for (const garish of ['#ff00ff', '#00ff00', '#010203', '#123123']) {
    expect(body.getAttribute('style')).not.toContain(garish)
  }
})

test('CharacterPanel: Match app theme renders the body exactly like an NPC panel', () => {
  useAppThemeStore.setState({ theme: 'parchment' })
  useGmPanelThemeStore.setState({ matchAppTheme: true })
  const playerBody = renderExpandedPlayerPanel(makeCustomizedPc())

  // NPC panels match the app theme unconditionally, so theirs is the reference.
  // Seeded inside `act` because the player panel above is still mounted and
  // re-renders off the same stores.
  let npc: ReturnType<typeof expandedHeadings>
  act(() => {
    npc = expandedHeadings('npc')
  })
  const npcBody = npc!.container.querySelector('.gm-panel__sheet')
  if (!npcBody) throw new Error('expanded NPC panel body not rendered')

  expect(playerBody.className).toBe(npcBody.className)
  expect(playerBody.getAttribute('style')).toBe(npcBody.getAttribute('style'))
})

test('Match app theme is cosmetic: the character sheet page keeps its palette', () => {
  // The switch must never reach the sheet the player actually owns — it is a
  // display option for GM panels only.
  useAppThemeStore.setState({ theme: 'parchment' })
  useGmPanelThemeStore.setState({ matchAppTheme: true })
  const pc = makeCustomizedPc()
  useCharacterStore.setState({ characters: [pc], currentCharacter: pc })

  const { container } = render(
    <NotificationProvider>
      <CharacterSheet character={pc} />
    </NotificationProvider>,
  )
  const sheet = container.querySelector('.character-sheet')
  if (!sheet) throw new Error('character sheet not rendered')

  expect((sheet as HTMLElement).style.getPropertyValue('--accent-violet')).toBe(
    '#ff00ff',
  )
  expect((sheet as HTMLElement).style.getPropertyValue('--sheet-bg')).toBe(
    '#123123',
  )
  expect(sheet.className).toContain('character-sheet--flat')
  // And the record itself was only read, never written.
  expect(pc.config.colors.accent).toBe('#ff00ff')
  expect(pc.config.backgroundColor).toBe('#123123')
})

// ---- Combat Stats: one set of accents for both panel kinds -----------------

test('expanded panels color every shared Combat Stats token identically', () => {
  // Parchment, so the app theme's stat palette genuinely differs from the
  // character's own token colors.
  useAppThemeStore.setState({ theme: 'parchment' })
  const playerBody = renderExpandedPlayerPanel(makeCustomizedPc())

  // Seeded inside `act` because the player panel above is still mounted.
  let npc: ReturnType<typeof expandedHeadings>
  act(() => {
    npc = expandedHeadings('npc')
  })
  const npcBody = npc!.container.querySelector('.gm-panel__sheet')
  if (!npcBody) throw new Error('expanded NPC panel body not rendered')

  const player = bodyTokenColors(playerBody.closest('.gm-panel') as HTMLElement)
  const npcRow = bodyTokenColors(
    (npcBody as HTMLElement).closest('.gm-panel') as HTMLElement,
  )
  const stats = appThemeStatColors('parchment')

  // A panel's tokens read in shorthand (see SHORT_STAT_LABELS) — the row is
  // only ~7.5rem wide per token, so the full names ellipsised there.
  const short = SHORT_STAT_LABELS

  // The four stats both rows show: same color, whichever kind of panel.
  for (const [label, key] of [
    [short.Evasion, 'evasion'],
    [short.Armor, 'armor'],
    [short.Movement, 'movement'],
    [short['Save DC'], 'saveDC'],
  ] as const) {
    expect(player[label], `player ${label}`).toBe(stats[key])
    expect(npcRow[label], `npc ${label}`).toBe(stats[key])
    expect(player[label], `${label} across panels`).toBe(npcRow[label])
  }

  // The row-specific stats still get their own tuned accents.
  expect(player[short.Milestones]).toBe(stats.milestone)
  expect(player[short['END Recovery']]).toBe(stats.endRecovery)
  expect(npcRow.HP).toBe(stats.hp)
  expect(npcRow[short['Mortal Wounds']]).toBe(stats.mortalWounds)
})

test('an expanded panel prints shorthand labels, never a truncated one', () => {
  // The bug this pins: at panel width every long stat name was ELLIPSISED
  // ("MILEST…", "SAVE …", "END RE…"), which tells a GM nothing mid-turn. A
  // shorthand that fits is the fix — so no panel token may be cut off, and the
  // full stat name has to remain reachable (the tooltip).
  useAppThemeStore.setState({ theme: 'midnight' })
  const playerBody = renderExpandedPlayerPanel(makeCustomizedPc())

  let npc: ReturnType<typeof expandedHeadings>
  act(() => {
    npc = expandedHeadings('npc')
  })
  const npcBody = npc!.container.querySelector('.gm-panel__sheet')
  if (!npcBody) throw new Error('expanded NPC panel body not rendered')

  const names: Record<string, string> = {
    [SHORT_STAT_LABELS.Milestones]: 'Milestones',
    [SHORT_STAT_LABELS.Evasion]: 'Evasion',
    [SHORT_STAT_LABELS.Armor]: 'Armor',
    [SHORT_STAT_LABELS.Movement]: 'Movement',
    [SHORT_STAT_LABELS['Save DC']]: 'Save DC',
    [SHORT_STAT_LABELS['END Recovery']]: 'END Recovery',
    [SHORT_STAT_LABELS['Mortal Wounds']]: 'Mortal Wounds',
    // Already short enough to print as-is: no shorthand, no tooltip needed.
    HP: 'HP',
  }

  for (const body of [playerBody, npcBody as HTMLElement]) {
    const tokens = [...body.querySelectorAll<HTMLElement>('.stat-token')]
    expect(tokens).toHaveLength(6)
    for (const token of tokens) {
      const label = token.querySelector('.stat-token__label')?.textContent ?? ''
      expect(label.length, `${label} is shorthand`).toBeLessThanOrEqual(8)
      // The panel chrome labels the same stats Eva/Arm/Move/DC, so the row
      // below it has to agree; anything else is drift between the two.
      expect(Object.keys(names), `${label} is a known shorthand`).toContain(label)
      // "HP" is the only label with nothing to expand.
      expect(token.getAttribute('title')).toBe(
        label === 'HP' ? null : names[label],
      )
    }
  }
})

test('a panel keeps the milestone bonus, inline in its label line', () => {
  // The bonus is not a hover-only detail: it is printed, beside the label
  // ("Miles +2"), so the token stays one line and the row needs no reserved
  // second line. The rendered geometry is asserted in e2e/gm-screen.spec.ts.
  useAppThemeStore.setState({ theme: 'midnight' })
  const body = renderExpandedPlayerPanel(makeCustomizedPc())

  const milestone = [...body.querySelectorAll<HTMLElement>('.stat-token')].find(
    (el) =>
      el.querySelector('.stat-token__label')?.textContent ===
      SHORT_STAT_LABELS.Milestones,
  )
  if (!milestone) throw new Error('no Milestones token rendered')

  const line = milestone.querySelector('.stat-token__line')
  expect(line?.querySelector('.stat-token__bonus')?.textContent).toMatch(
    /^\+\d+$/,
  )
  // One height, and it is the single-line one: no second line is reserved.
  expect(getComputedStyle(milestone).minHeight).toContain('--stat-token-line-h')
})

test('a panel paints its Combat Stats row with the app theme, not the sheet', () => {
  useAppThemeStore.setState({ theme: 'parchment' })
  const stats = appThemeStatColors('parchment')
  const garish = [
    '#ff00ff', '#00ff00', '#ff0000', '#0000ff', '#ffff00',
  ]

  // The row is app chrome, so it looks the same whether or not the body around
  // it is matching the app theme.
  for (const matchAppTheme of [false, true]) {
    useGmPanelThemeStore.setState({ matchAppTheme })
    const body = renderExpandedPlayerPanel(makeCustomizedPc())
    const row = bodyTokenColors(body.closest('.gm-panel') as HTMLElement)

    expect(row[SHORT_STAT_LABELS.Milestones]).toBe(stats.milestone)
    expect(row[SHORT_STAT_LABELS.Evasion]).toBe(stats.evasion)
    expect(row[SHORT_STAT_LABELS.Armor]).toBe(stats.armor)
    expect(row[SHORT_STAT_LABELS.Movement]).toBe(stats.movement)
    expect(row[SHORT_STAT_LABELS['Save DC']]).toBe(stats.saveDC)
    expect(row[SHORT_STAT_LABELS['END Recovery']]).toBe(stats.endRecovery)
    for (const color of garish) {
      expect(Object.values(row)).not.toContain(color)
    }
    // Unmount before the next pass re-seeds the stores the panel reads.
    cleanup()
  }
})

test('a panel chrome token and its body token are the same color', () => {
  // The chrome and the expanded row call the same stat by the same name — that
  // is why the shorthand vocabulary is shared (SHORT_STAT_LABELS).
  useAppThemeStore.setState({ theme: 'parchment' })
  const body = renderExpandedPlayerPanel(makeCustomizedPc())
  const panel = body.closest('.gm-panel') as HTMLElement
  const row = bodyTokenColors(panel)

  expect(tokenColor(panel, 'Eva')).toBe(row[SHORT_STAT_LABELS.Evasion])
  expect(tokenColor(panel, 'Arm')).toBe(row[SHORT_STAT_LABELS.Armor])
})


// ---- Expanded panel body (PanelSheet) --------------------------------------

/** Expand a panel of the given kind and return its rendered section headings. */
function expandedHeadings(kind: 'character' | 'npc') {
  const base = makeBase()
  seedScreenFor(base)
  const pc: Character = { ...createDefaultCharacter(), id: 'pc-1', name: 'Vex' }
  useCharacterStore.setState({ characters: [pc, base], currentCharacter: null })
  const panelId = kind === 'character' ? 'pc-panel' : PANEL_ID
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [
          kind === 'character'
            ? {
                kind: 'character',
                id: panelId,
                characterId: pc.id,
                density: 'expanded',
                statuses: [],
              }
            : {
                kind: 'npc-instance',
                id: panelId,
                baseNpcId: base.id,
                label: 'Bandit',
                density: 'expanded',
                statuses: [],
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
  const panel = useGMScreenStore.getState().screens[0].panels[0]

  const { container } =
    kind === 'character'
      ? render(
          <NotificationProvider>
            <CharacterPanel
              panel={panel as Extract<typeof panel, { kind: 'character' }>}
              character={pc}
              screenId={SCREEN_ID}
              onOpenSheet={() => {}}
              onRemove={() => {}}
            />
          </NotificationProvider>,
        )
      : render(
          <NotificationProvider>
            <NpcInstancePanel
              panel={panel as Extract<typeof panel, { kind: 'npc-instance' }>}
              base={base}
              screenId={SCREEN_ID}
              subtitle={null}
              onOpenBase={() => {}}
              onRemove={() => {}}
            />
          </NotificationProvider>,
        )

  return { container, headings: Array.from(container.querySelectorAll('h3')).map((h) => h.textContent) }
}

test('expanded player and NPC panels match in layout, section for section', () => {
  const player = expandedHeadings('character')
  const npc = expandedHeadings('npc')

  // Same sections in the same order; the NPC panel drops Core Ability (NPCs
  // have none) and both drop the bio sections.
  expect(player.headings).toEqual([
    'Combat Stats',
    'Attributes',
    'Core Ability',
    'Slotted Abilities',
    'Skills',
  ])
  expect(npc.headings).toEqual([
    'Combat Stats',
    'Attributes',
    'Abilities',
    'Skills',
  ])
  // Bookends line up exactly; the middle differs only by the ability section's
  // label and the NPC's missing Core Ability.
  expect(player.headings[0]).toBe(npc.headings[0]) // Combat Stats
  expect(player.headings[1]).toBe(npc.headings[1]) // Attributes
  expect(player.headings.at(-1)).toBe(npc.headings.at(-1)) // Skills
})

test('expanded panels never offer a grid/list toggle for abilities', () => {
  for (const kind of ['character', 'npc'] as const) {
    const { container } = expandedHeadings(kind)
    // No toggle anywhere in the body: grid view is unreadable at panel width,
    // so it is not offered rather than merely defaulted away from.
    expect(container.querySelectorAll('.mode-toggle')).toHaveLength(0)
    expect(container.querySelectorAll('.ability-grid--cards')).toHaveLength(0)
  }
})

test('expanded player panel shows Slotted Abilities but never the Ability Pool', () => {
  const { headings } = expandedHeadings('character')
  expect(headings).toContain('Slotted Abilities')
  expect(headings).not.toContain('Ability Pool')
})


test('expanded player panel hides the bars its own chrome already shows', () => {
  const { container } = expandedHeadings('character')
  const labels = Array.from(container.querySelectorAll('.resource-bar__label')).map(
    (l) => l.textContent?.trim(),
  )
  // HP and AP both live in the panel chrome, directly above the sheet body
  // (`.gm-hp` / `.gm-ap`), so the body must not print a second copy of either.
  expect(labels).not.toContain('HP')
  expect(labels).not.toContain('Action Points')
  // The rest of the live-play resources are still there.
  expect(labels).toContain('Fate Points')
  expect(labels).toContain('Endurance')
})

test('expanded panel attributes keep the shorthand and their full names in the DOM', () => {
  for (const kind of ['character', 'npc'] as const) {
    const { container } = expandedHeadings(kind)
    const boxes = Array.from(container.querySelectorAll('.attr-box'))
    expect(boxes).toHaveLength(5)
    expect(boxes.map((b) => b.querySelector('.attr-box__abbr')?.textContent)).toEqual([
      'MAR',
      'POW',
      'AGI',
      'VIT',
      'GRT',
    ])
    // The full name stays in the markup for the sheet pages and for `title`
    // tooltips — the PANEL hides it via CSS (asserted in the browser suite,
    // since jsdom does not apply stylesheets).
    for (const box of boxes) {
      expect(box.querySelector('.attr-box__name')).not.toBeNull()
    }
  }
})

// ---- NPC live play: Action Points & Recharge --------------------------------

/** A slotted ability for an NPC base, with sensible defaults per test. */
function makeAbility(
  overrides: Partial<AbilityBlock> & { id: string; name: string },
): AbilityBlock {
  return {
    traits: [],
    cost: { ap: 1 },
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
    ...overrides,
  }
}

/** A base NPC carrying the given slotted abilities. */
function makeBaseWith(abilities: AbilityBlock[], overrides: Partial<Character> = {}) {
  // The base keeps its OWN live-play AP at 3 so a test can prove the panel
  // never spends it: the instance owns its turn, the base stays a template.
  return makeBase({ slottedAbilities: abilities, currentAP: 3, ...overrides })
}

/**
 * Render the seeded panel the way GMScreenPage does — subscribed to the screen,
 * so a store write re-renders it with the fresh panel object. `panelIndex`
 * picks which panel of the screen to render (0 unless a test spawns siblings).
 */
function NpcPanelHarness({
  base,
  panelIndex = 0,
}: {
  base: Character
  panelIndex?: number
}) {
  const panel = useGMScreenStore((s) =>
    s.screens.find((screen) => screen.id === SCREEN_ID)?.panels[panelIndex],
  )
  if (!panel || panel.kind !== 'npc-instance') return null
  return (
    <NpcInstancePanel
      panel={panel}
      base={base}
      screenId={SCREEN_ID}
      subtitle={null}
      onOpenBase={() => {}}
      onRemove={() => {}}
    />
  )
}

/** Seed one panel over `base` and render it (expanded unless told otherwise). */
function renderNpcPanel(base: Character, density: 'compact' | 'expanded' = 'expanded') {
  seedScreenFor(base)
  useGMScreenStore.getState().setPanelDensity(SCREEN_ID, PANEL_ID, density)
  return render(
    <NotificationProvider>
      <NpcPanelHarness base={base} />
      {/* The app mounts this next to the page (App.tsx), so the panel's
        * activation rolls have somewhere to land on the GM screen. */}
      <DiceRollOverlay />
    </NotificationProvider>,
  )
}

/** The single Activate button on screen (there is one per activatable ability). */
function activateButtons(): HTMLElement[] {
  return screen.queryAllByRole('button', { name: 'Activate' })
}

/** Force the next Recharge Die to land on `value` (1–6). */
function mockRechargeRoll(value: number) {
  vi.spyOn(Math, 'random').mockReturnValue((value - 0.5) / 6)
}

beforeEach(() => {
  // The recharge turn logs its roll; start every test from an empty log.
  useRollLogStore.setState({ entries: [], isLoaded: true })
  // …and from an empty die queue, so a test that queued faces it never used
  // cannot leak them into the next one.
  dieQueue.length = 0
})

/**
 * A player character with a known END pool, so an end-of-turn gain is visible.
 */
function makePlayer(overrides: Partial<Character> = {}) {
  return {
    ...createDefaultCharacter(),
    id: 'pc-1',
    name: 'Vex',
    currentAP: 3,
    currentEND: 4,
    attributes: { MAR: 0, POW: 0, AGI: 0, VIT: 0, GRT: 0 },
    ...overrides,
  }
}

/**
 * Subscribe to BOTH stores like GMScreenPage does — the panel from the screen,
 * the entity from the character list — so a live-play write re-renders with the
 * fresh character (a character panel's HP/AP live on the sheet record, not on
 * the panel).
 */
function PlayerPanelHarness({ characterId }: { characterId: string }) {
  const panel = useGMScreenStore((s) =>
    s.screens.find((screen) => screen.id === SCREEN_ID)?.panels[0],
  )
  const character = useCharacterStore((s) =>
    s.characters.find((c) => c.id === characterId),
  )
  if (!panel || panel.kind !== 'character' || !character) return null
  return (
    <CharacterPanel
      panel={panel}
      character={character}
      screenId={SCREEN_ID}
      onOpenSheet={() => {}}
      onRemove={() => {}}
    />
  )
}

/** Seed one character panel over `character` and render it. */
function renderPlayerPanel(
  character: Character,
  density: 'compact' | 'expanded' = 'compact',
) {
  useCharacterStore.setState({ characters: [character], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [
          {
            kind: 'character',
            id: PANEL_ID,
            characterId: character.id,
            density,
            statuses: [],
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
  return render(
    <NotificationProvider>
      <PlayerPanelHarness characterId={character.id} />
    </NotificationProvider>,
  )
}

/** The character as the store currently holds it. */
function storedPlayer(id: string) {
  const character = useCharacterStore.getState().characters.find((c) => c.id === id)
  if (!character) throw new Error('expected the character to still exist')
  return character
}

test('every stat token on both panel kinds leads with an icon', () => {
  /** The token strip as `{ label, hasIcon }` entries (the pencil is not a token). */
  const tokens = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.gm-token'))
      .map((token) => ({
        label: token.querySelector('.gm-token__label')?.textContent ?? null,
        icon: token.querySelector('svg') != null,
      }))
      .filter((token) => token.label != null)

  const player = renderPlayerPanel(makePlayer())
  // END and FP are the pools with no chrome bar, and both share AP's violet in
  // most themes — their icons are what tell them apart.
  expect(tokens(player.container)).toEqual([
    { label: 'Eva', icon: true },
    { label: 'Arm', icon: true },
    { label: 'END', icon: true },
    { label: 'FP', icon: true },
  ])
  player.unmount()

  const npc = renderNpcPanel(makeBase(), 'compact')
  expect(tokens(npc.container)).toEqual([
    { label: 'Eva', icon: true },
    { label: 'Arm', icon: true },
    { label: 'Move', icon: true },
    { label: 'DC', icon: true },
  ])
})

test('a panel with no AP left dims, keeping its AP block (and the way back) bright', () => {
  const pc = makePlayer()
  const player = renderPlayerPanel(pc)
  const panelEl = () => player.container.querySelector('.gm-panel')

  // A full turn: nothing is dimmed.
  expect(panelEl()).not.toHaveClass('gm-panel--no-ap')

  // Spent: the panel takes the dim class, and the AP block that holds the `+`
  // stepper and the turn button is NOT one of the regions it dims.
  act(() => {
    useCharacterStore.getState().spendAP(pc.id, 3)
  })
  expect(panelEl()).toHaveClass('gm-panel--no-ap')
  expect(panelEl()!.querySelector('.gm-panel--no-ap .gm-ap')).not.toBeNull()
  expect(panelEl()!.querySelectorAll('.gm-panel--no-ap .gm-hp')).toHaveLength(1)
  expect(player.container.querySelector('.gm-panel--no-ap .gm-tokens')).not.toBeNull()
  // Still interactive — dimming is a coat of paint, never `pointer-events`.
  expect(screen.getByRole('button', { name: 'Start new turn' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Deal 1 damage to Vex' })).toBeEnabled()

  // Handing AP back by hand clears the whole state.
  act(() => {
    useCharacterStore.getState().restoreAP(pc.id, 1)
  })
  expect(panelEl()).not.toHaveClass('gm-panel--no-ap')
  player.unmount()

  // Same rule on an NPC instance panel.
  const npc = renderNpcPanel(makeBase(), 'compact')
  const npcPanel = () => npc.container.querySelector('.gm-panel')
  expect(npcPanel()).not.toHaveClass('gm-panel--no-ap')
  act(() => {
    useGMScreenStore.getState().spendInstanceAP(SCREEN_ID, PANEL_ID, 3)
  })
  expect(npcPanel()).toHaveClass('gm-panel--no-ap')
  expect(screen.getByRole('button', { name: 'Start new turn' })).toBeEnabled()
})

test('player panel: the AP meter sits under the HP bar, matching an NPC panel', () => {
  const pc = makePlayer()
  const { container } = renderPlayerPanel(pc)

  const hp = container.querySelector('.gm-hp')
  const ap = container.querySelector('.gm-ap')
  expect(hp).not.toBeNull()
  expect(ap).not.toBeNull()
  // Directly below the HP bar, in the panel chrome (not inside the sheet body,
  // which is collapsed by default and would hide it).
  expect(hp!.compareDocumentPosition(ap!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(container.querySelector('.gm-panel__sheet .gm-ap')).toBeNull()

  expect(ap!.querySelector('.gm-bar__label')?.textContent).toBe('Action Points')
  expect(ap!.querySelector('.gm-bar__value')?.textContent).toContain('3')

  // Same `[−] track [+]` row and the same stepper control as an NPC panel.
  const controls = Array.from(ap!.querySelector('.gm-bar__controls')!.children)
  expect(controls[0]).toHaveClass('gm-step')
  expect(controls[1]).toHaveClass('gm-ap__track')
  expect(controls[2]).toHaveClass('gm-step')
  // No Recharge cooldown pill: players do not track Recharge.
  expect(ap!.querySelector('.gm-ap__cooling')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Spend Action Points' }))
  expect(storedPlayer(pc.id).currentAP).toBe(2)
  fireEvent.click(screen.getByRole('button', { name: 'Restore Action Points' }))
  expect(storedPlayer(pc.id).currentAP).toBe(3)
})

test('player panel: at 0 AP the turn button runs the sheet’s End Turn', () => {
  const pc = makePlayer()
  renderPlayerPanel(pc)

  expect(screen.queryByRole('button', { name: 'Start new turn' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Spend Action Points' }))
  fireEvent.click(screen.getByRole('button', { name: 'Spend Action Points' }))
  fireEvent.click(screen.getByRole('button', { name: 'Spend Action Points' }))
  expect(storedPlayer(pc.id).currentAP).toBe(0)

  const turn = screen.getByRole('button', { name: 'Start new turn' })
  fireEvent.click(turn)

  // Identical to the sheet's End Turn: AP refilled, END Recovery applied
  // (GRT 0 → 1 END), and the GM told about it.
  expect(storedPlayer(pc.id).currentAP).toBe(3)
  expect(storedPlayer(pc.id).currentEND).toBe(5)
  expect(
    screen.getByText("Vex's turn — AP restored · +1 END"),
  ).toBeInTheDocument()
})

test('player panel: the menu can end the turn early, like an NPC panel', () => {
  const pc = makePlayer({ currentAP: 2, currentEND: 9 })
  renderPlayerPanel(pc)

  fireEvent.click(screen.getByRole('button', { name: 'Vex options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Start new turn' }))

  // Unspent AP converts to END 1:1 (9 + 2), plus 1 END Recovery, capped at 10.
  expect(storedPlayer(pc.id).currentAP).toBe(3)
  expect(storedPlayer(pc.id).currentEND).toBe(10)
})

// ---- Player-panel Mortal Wounds (the player sheet's track, in the chrome) ---

test('player panel: the Mortal Wound track sits under the HP bar, like an NPC panel', () => {
  const pc = makePlayer()
  const { container } = renderPlayerPanel(pc)

  const row = container.querySelector('.gm-mw')
  expect(row).not.toBeNull()
  expect(row?.textContent).toContain('Wounds')
  expect(row?.textContent).toContain('0/2')
  // Nothing rolled yet, and there is still a wound to take.
  expect(container.querySelector('.gm-mw__chip')).toBeNull()
  expect(container.querySelector('.gm-mw__warn')).toBeNull()

  // Directly below the HP bar, in the panel chrome — not in the sheet body.
  const hp = container.querySelector('.gm-hp')!
  expect(hp.compareDocumentPosition(row!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(container.querySelector('.gm-panel__sheet .gm-mw')).toBeNull()

  // Byte-for-byte the same row an NPC panel renders for a target that allows
  // wounds: same segments, in the same order.
  const segments = (el: Element | null) =>
    Array.from(el!.children).map((child) => child.className)
  let npc: ReturnType<typeof renderNpcPanel> | null = null
  act(() => {
    npc = renderNpcPanel(makeWoundNpc(2), 'compact')
  })
  expect(segments(row)).toEqual(
    segments(npc!.container.querySelector('.gm-mw')),
  )
})

test('a mouse wheel scrolls the Mortal Wound strip, not just a trackpad swipe', () => {
  const pc = makePlayer({ mortalWounds: ['Sprain', 'Exhaustion'] })
  const { container } = renderPlayerPanel(pc)

  const strip = container.querySelector('.gm-mw__strip') as HTMLElement
  // jsdom does no layout, so the overflow the hook reacts to is declared here;
  // the browser suite moves the same strip under a real wheel and measures it
  // (see `e2e/gm-screen.spec.ts`). What this pins is the WIRING: both panel
  // kinds render this one component, so one wiring test covers both.
  Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 400 })
  Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 200 })

  const event = new WheelEvent('wheel', { deltaY: 90, bubbles: true, cancelable: true })
  strip.dispatchEvent(event)

  expect(strip.scrollLeft).toBe(90)
  // Consumed: the strip moved, so the page behind it must not scroll too.
  expect(event.defaultPrevented).toBe(true)
})

test('player panel: damage from the panel rolls the wound and marks the track', () => {
  const pc = makePlayer({ currentHP: 1 })
  const { container } = renderPlayerPanel(pc)
  mockMortalWoundRoll(7) // → Hemorrhage

  // The panel's `−` stepper runs the whole pipeline, Mortal Wound included.
  fireEvent.click(screen.getByRole('button', { name: 'Deal 1 damage to Vex' }))

  expect(storedPlayer(pc.id).mortalWounds).toEqual(['Hemorrhage', null])
  // HP was reset to max (20) with no excess left to spill over.
  expect(storedPlayer(pc.id).currentHP).toBe(20)
  expect(container.querySelector('.gm-mw')?.textContent).toContain('1/2')
  expect(screen.getByText('Hemorrhage')).toBeInTheDocument()
  expect(screen.getByText('7')).toBeInTheDocument()
  // No "Pending Roll" step for the GM, and the outcome is announced (a wound
  // refills the bar, which would otherwise look like nothing happened).
  expect(screen.queryByText('Pending Roll')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain(
    'Vex takes a Mortal Wound: Hemorrhage (d20 7) — HP reset to 20.',
  )

  // Clearing is explicit and per wound.
  fireEvent.click(screen.getByRole('button', { name: 'Clear Hemorrhage from Vex' }))
  expect(storedPlayer(pc.id).mortalWounds).toEqual([null, null])
})

test('player panel: a chip clears the slot it belongs to, not its position', () => {
  // Slot 0 is empty and slot 1 is filled: a chip that cleared by list position
  // would clear the empty slot and leave the wound in place.
  const pc = makePlayer({ mortalWounds: [null, 'Exhaustion'] })
  renderPlayerPanel(pc)

  fireEvent.click(screen.getByRole('button', { name: 'Clear Exhaustion from Vex' }))
  expect(storedPlayer(pc.id).mortalWounds).toEqual([null, null])
})

test('player panel: a full track warns that 0 HP now knocks the character out', () => {
  const pc = makePlayer({ mortalWounds: ['Sprain', 'Exhaustion'] })
  const { container } = renderPlayerPanel(pc)

  expect(container.querySelector('.gm-mw')?.textContent).toContain('2/2')
  // The character's own word for it (the sheet's "Critical Condition"), not an
  // NPC's "Downed": the next 0 HP starts Death Saves.
  expect(screen.getByText('Next 0 HP: Knocked Out')).toBeInTheDocument()
})

test('player panel: the panel menu clears the whole wound track', () => {
  const pc = makePlayer({ mortalWounds: ['Sprain', 'Exhaustion'] })
  renderPlayerPanel(pc)

  fireEvent.click(screen.getByRole('button', { name: 'Vex options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Clear mortal wounds' }))

  expect(storedPlayer(pc.id).mortalWounds).toEqual([null, null])
})

test('player panel: the menu offers no wound clearing when there are none', () => {
  renderPlayerPanel(makePlayer())

  fireEvent.click(screen.getByRole('button', { name: 'Vex options' }))

  expect(
    screen.queryByRole('menuitem', { name: 'Clear mortal wounds' }),
  ).toBeNull()
})

test('player panel: a wound the sheet left pending shows as pending and can be rolled from the menu', () => {
  // Only the player's own sheet can leave a slot pending — the panel's damage
  // always rolls. The row must say so rather than inventing a D20, and the roll
  // lives in the ⋯ menu so the row keeps the NPC row's shape (and its one line
  // at phone widths).
  const pc = makePlayer({ mortalWounds: ['Pending Roll', null] })
  renderPlayerPanel(pc)

  expect(screen.getByText('Pending Roll')).toBeInTheDocument()
  const chip = document.querySelector('.gm-mw__chip')
  expect(chip).toHaveClass('gm-mw__chip--pending')
  expect(chip?.querySelector('.gm-mw__roll')?.textContent).toBe('?')
  // Nothing in the row itself: it is the same row an NPC panel renders.
  expect(document.querySelector('.gm-mw button:not(.gm-mw__clear)')).toBeNull()

  mockMortalWoundRoll(7) // → Hemorrhage
  fireEvent.click(screen.getByRole('button', { name: 'Vex options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Roll Mortal Wound (d20)' }))

  expect(storedPlayer(pc.id).mortalWounds).toEqual(['Hemorrhage', null])
  expect(document.querySelector('.gm-mw__chip--pending')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain(
    'Vex takes a Mortal Wound: Hemorrhage (d20 7).',
  )
})

test('player panel: the menu offers no roll when nothing is pending', () => {
  renderPlayerPanel(makePlayer({ mortalWounds: ['Sprain', null] }))

  fireEvent.click(screen.getByRole('button', { name: 'Vex options' }))

  expect(
    screen.queryByRole('menuitem', { name: 'Roll Mortal Wound (d20)' }),
  ).toBeNull()
})

test('player panel: the menu applies a specific wound to the character’s own slots', () => {
  const pc = makePlayer({ name: 'Vex', mortalWounds: [null, null] })
  const { container } = renderPlayerPanel(pc)

  fireEvent.click(screen.getByRole('button', { name: 'Vex options' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add mortal wound…' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add Damaged Throat' }))

  // The panel writes the character's real record, so the player's own sheet
  // shows the wound at once — and the chip carries the table's D20.
  expect(storedPlayer(pc.id).mortalWounds).toEqual(['Damaged Throat', null])
  const chip = container.querySelector('.gm-mw__chip')
  expect(chip?.textContent).toContain('Damaged Throat')
  expect(chip?.textContent).toContain('8')
})

test('player panel: a pending slot can be named by hand instead of rolled', () => {
  const pc = makePlayer({ name: 'Vex', mortalWounds: ['Pending Roll', null] })
  const { container } = renderPlayerPanel(pc)

  fireEvent.click(screen.getByRole('button', { name: 'Vex options' }))
  expect(
    screen.getByRole('menuitem', { name: 'Roll Mortal Wound (d20)' }),
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('menuitem', { name: 'Add mortal wound…' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add Hemorrhage' }))

  // Naming it resolves the slot the player had not rolled: no second wound, no
  // dashed pending chip left behind.
  expect(storedPlayer(pc.id).mortalWounds).toEqual(['Hemorrhage', null])
  expect(container.querySelector('.gm-mw__chip--pending')).toBeNull()
})

test('player panel: a full track offers no manual add', () => {
  renderPlayerPanel(makePlayer({ mortalWounds: ['Sprain', 'Exhaustion'] }))

  fireEvent.click(screen.getByRole('button', { name: 'Vex options' }))

  expect(
    screen.queryByRole('menuitem', { name: 'Add mortal wound…' }),
  ).toBeNull()
})

test('player panel: the Damage dialog resolves the wound instead of pending it', () => {
  const pc = makePlayer({ currentHP: 5, name: 'Vex' })
  const { container } = renderPlayerPanel(pc)
  mockMortalWoundRoll(7) // → Hemorrhage

  fireEvent.click(screen.getByRole('button', { name: 'Damage…' }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '15' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }))

  // 20 max HP, 5 current, 15 damage: the wound takes the hit, 10 spills over.
  expect(storedPlayer(pc.id).currentHP).toBe(10)
  expect(storedPlayer(pc.id).mortalWounds).toEqual(['Hemorrhage', null])
  const alert = container.querySelector('.damage-result__alert')
  expect(alert?.textContent).toContain('rolled automatically')
  expect(alert?.textContent).toContain('Hemorrhage (d20 7)')
  expect(alert?.textContent).toContain('HP reset to 10')
})

test('player panel: the expanded body prints the track once, not twice', () => {
  const pc = makePlayer({ mortalWounds: ['Sprain', null] })
  const { container } = renderPlayerPanel(pc, 'expanded')

  expect(container.querySelectorAll('.gm-mw')).toHaveLength(1)
  // The sheet body's own wound block (cards + roll + Rest) is suppressed in a
  // panel, exactly as its HP and AP blocks are.
  expect(container.querySelector('.gm-panel__sheet .stat-mortals')).toBeNull()
})

test('a player sheet outside the GM Screen keeps its own wound card and roll', () => {
  // The suppression is panel-scoped: the sheet page still renders the wound
  // block, its "Pending Roll" card and its roll button, because a player rolling
  // their own wound is the sheet's flow (only a panel rolls it for the GM).
  const pc = makePlayer({ mortalWounds: ['Pending Roll', 'Exhaustion'] })
  const { container } = render(
    <NotificationProvider>
      <StatsSection character={pc} mode="view" />
    </NotificationProvider>,
  )

  expect(container.querySelector('.stat-mortals')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Roll Mortal Wound (d20)' })).toBeInTheDocument()
})

test('NPC panel: each instance carries a 3 AP turn meter with steppers', () => {
  const base = makeBase({ currentAP: 3 })
  const { container } = renderNpcPanel(base, 'compact')

  const meter = container.querySelector('.gm-ap')
  expect(meter?.querySelector('.gm-bar__label')?.textContent).toBe(
    'Action Points',
  )
  expect(meter?.querySelector('.gm-bar__value')?.textContent).toContain('3')

  fireEvent.click(screen.getByRole('button', { name: 'Spend Action Points' }))
  expect(panelState().currentAP).toBe(2)
  fireEvent.click(screen.getByRole('button', { name: 'Restore Action Points' }))
  expect(panelState().currentAP).toBe(3)

  // The base record's own AP is a different thing entirely and never moves.
  expect(base.currentAP).toBe(3)
})

test('NPC panel: the HP and AP bars are the same bar, steppers and all', () => {
  const base = makeBase()
  const { container } = renderNpcPanel(base, 'compact')

  /** The bar's `[−][track][+]` triple, in DOM order. */
  const controlsOf = (selector: string) => {
    const block = container.querySelector(selector)
    expect(block, selector).not.toBeNull()
    const children = Array.from(
      block!.querySelector('.gm-bar__controls')!.children,
    )
    return {
      spend: children[0] as HTMLElement,
      track: children[1] as HTMLElement,
      restore: children[2] as HTMLElement,
    }
  }
  const hp = controlsOf('.gm-hp')
  const ap = controlsOf('.gm-ap')

  for (const [kind, bar] of Object.entries({ hp, ap })) {
    // − left of the track, + right of it — the same order on both bars.
    expect(bar.spend.tagName, kind).toBe('BUTTON')
    expect(bar.track.className, kind).toMatch(/_+track/)
    expect(bar.restore.tagName, kind).toBe('BUTTON')
    expect(bar.spend.className).toContain('gm-step')
    expect(bar.restore.className).toContain('gm-step')
    // Vector glyphs, never typed "+"/"−": a text glyph's ink sits wherever the
    // font puts it and was visibly off-centre in the old AP steppers.
    expect(bar.spend.querySelector('svg'), `${kind} spend`).not.toBeNull()
    expect(bar.restore.querySelector('svg'), `${kind} restore`).not.toBeNull()
  }

  // Identical icons on both bars: same component, same glyph.
  const glyph = (el: HTMLElement) => el.querySelector('svg')!.outerHTML
  expect(glyph(ap.spend)).toBe(glyph(hp.spend))
  expect(glyph(ap.restore)).toBe(glyph(hp.restore))

  // Every stepper disables at its own end of its pool, on both bars: HP is
  // full (nothing to heal), AP is full (nothing to restore).
  expect(hp.spend).toBeEnabled()
  expect(hp.restore).toBeDisabled()
  expect(ap.spend).toBeEnabled()
  expect(ap.restore).toBeDisabled()

  act(() => {
    useGMScreenStore.getState().spendInstanceAP(SCREEN_ID, PANEL_ID, 3)
    useGMScreenStore.getState().adjustInstanceHP(SCREEN_ID, PANEL_ID, -20)
  })
  expect(ap.spend).toBeDisabled()
  expect(ap.restore).toBeEnabled()
  expect(hp.spend).toBeDisabled()
  expect(hp.restore).toBeEnabled()
})

test('NPC panel: every ability with a cost gets a working Activate button', () => {
  const base = makeBaseWith([
    makeAbility({ id: 'a1', name: 'Cleave', cost: { ap: 2 } }),
    makeAbility({ id: 'a2', name: 'Shrug Off', cost: {} }),
  ])
  renderNpcPanel(base)

  // Only the costed ability is activatable; the free one stays a reference card.
  expect(activateButtons()).toHaveLength(1)

  fireEvent.click(activateButtons()[0])
  // AP comes off the INSTANCE (2 of its 3), never off the base record.
  expect(panelState().currentAP).toBe(1)
  expect(base.currentAP).toBe(3)
  expect(screen.getByText(/Activated Cleave/)).toBeInTheDocument()
})

test('NPC panel: activating an ability with automatic rolls opens them together', () => {
  // The instance rolls with ITS OWN entity: the base's MAR is 2 and the panel
  // is what the notation resolves against — the base record is never written to.
  const base = makeBaseWith(
    [
      makeAbility({
        id: 'a1',
        name: 'Cleave',
        cost: { ap: 1 },
        damage: '2d6',
        activationRolls: {
          accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
          damage: true,
          custom: [{ notation: '1d4', label: 'Bleed' }],
        },
      }),
    ],
    { attributes: { MAR: 2, POW: 0, AGI: 0, VIT: 0, GRT: 0 } },
  )
  renderNpcPanel(base)

  // d20 = 10 → 10 + MAR(2) = 12; 2d6 = 1 + 1; 1d4 = 3.
  dieQueue.push(10, 1, 1, 3)

  fireEvent.click(activateButtons()[0])

  // The instance paid for it…
  expect(panelState().currentAP).toBe(2)
  expect(base.currentAP).toBe(3)
  // …and every roll is shown at once, in the result window the ability names.
  const modal = screen.getByRole('dialog', { name: 'Cleave' })
  const cards = within(
    within(modal).getByRole('status', { name: /activation rolls for/i }),
  ).getAllByRole('article')
  expect(cards).toHaveLength(3)
  // The breakdown proves which entity resolved the notation: the instance's
  // MAR(2), not the store's player character.
  expect(within(cards[0]).getByText('d20+MAR → 10 + 2 = 12')).toBeInTheDocument()
  expect(within(cards[1]).getByText('2d6 → 1 + 1 = 2')).toBeInTheDocument()
  expect(within(cards[2]).getByText('Bleed')).toBeInTheDocument()
  expect(within(cards[2]).getByText('1d4 → 3 = 3')).toBeInTheDocument()
})

test('NPC panel: the Activate button is automatic — showActivate does not gate it', () => {
  const base = makeBaseWith([
    makeAbility({ id: 'a1', name: 'Cleave', cost: { ap: 1 }, showActivate: false }),
  ])
  renderNpcPanel(base)

  // The flag is not even offered in the NPC editor, and a GM panel activates
  // every ability that costs something.
  expect(activateButtons()).toHaveLength(1)
  fireEvent.click(activateButtons()[0])
  expect(panelState().currentAP).toBe(2)
})

test('NPC panel: a cost-free Recharge ability still activates (it can cool down)', () => {
  const base = makeBaseWith([
    makeAbility({ id: 'a1', name: 'Howl', cost: {}, traits: ['Recharge (3)'] }),
  ])
  renderNpcPanel(base)

  expect(activateButtons()).toHaveLength(1)
  fireEvent.click(activateButtons()[0])
  // Nothing to spend, but the cooldown is the point.
  expect(panelState().currentAP).toBe(3)
  expect(panelState().cooldowns).toEqual(['a1'])
  expect(screen.getByText('On cooldown — Recharge 3')).toBeInTheDocument()
})

test('NPC panel: the collapsed panel shows how many abilities are cooling', () => {
  const base = makeBaseWith([
    makeAbility({ id: 'a1', name: 'Fire Breath', traits: ['Recharge (5)'] }),
    makeAbility({ id: 'a2', name: 'Bite', traits: ['Recharge (2)'] }),
  ])
  renderNpcPanel(base, 'compact')
  expect(screen.queryByText(/on cooldown/)).toBeNull()

  act(() => {
    const store = useGMScreenStore.getState()
    store.markAbilityCooldown(SCREEN_ID, PANEL_ID, 'a1')
    store.markAbilityCooldown(SCREEN_ID, PANEL_ID, 'a2')
  })

  expect(screen.getByText('2 on cooldown')).toBeInTheDocument()
})

test('NPC panel: the Recharge badge replaces the trait chip instead of duplicating it', () => {
  const base = makeBaseWith([
    makeAbility({
      id: 'a1',
      name: 'High-Impact Rounds',
      traits: ['Action', 'Range (12)', 'Recharge (4)'],
    }),
  ])
  const { container } = renderNpcPanel(base)

  // The authored chip is replaced in place: its slot now carries the live
  // badge, under the ability name, with no second "Recharge 4" anywhere.
  const chips = Array.from(
    container.querySelectorAll('.ability-card__trait'),
  ).map((chip) => chip.textContent)
  expect(chips).toEqual(['Action', 'Range (12)', 'Recharge 4'])
  expect(
    container.querySelectorAll('.ability-card__head .gm-recharge'),
  ).toHaveLength(1)
  expect(screen.getAllByText('Recharge 4')).toHaveLength(1)
  // …and nothing sits between the card and its Activate button.
  expect(container.querySelector('.ability-activation > .gm-recharge')).toBeNull()

  // Cooling state reads through the same chip, which also carries the state
  // class the stylesheet tints.
  fireEvent.click(activateButtons()[0])
  const cooling = container.querySelector('.ability-card__trait .gm-recharge')
  expect(cooling).toHaveClass('gm-recharge--cooling')
  expect(cooling?.textContent).toBe('On cooldown — Recharge 4')
})

test('NPC panel: a Recharge sub-ability badges its own trait chip', () => {
  const base = makeBaseWith([
    makeAbility({
      id: 'a1',
      name: 'Storm Call',
      cost: {},
      subAbilitiesUnderDescription: [
        makeAbility({
          id: 'sub',
          name: 'Lightning Lash',
          cost: { ap: 1 },
          traits: ['Recharge (2)'],
        }),
      ],
    }),
  ])
  const { container } = renderNpcPanel(base)

  const chip = container.querySelector('.sub-ability-block__trait')
  expect(chip?.textContent).toBe('Recharge 2')
  expect(chip?.querySelector('.gm-recharge')).not.toBeNull()
})

// ---- NPC live play: limited-use abilities -----------------------------------

/** A limited 3-use ability for a panel test. */
function limitedAbility(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return makeAbility({
    id: 'a1',
    name: 'Cleave',
    cost: { ap: 1 },
    uses: { max: 3, current: 3, expendOnActivate: true },
    ...overrides,
  })
}

/** The uses readout on the panel's ability card. */
function usesReadout(name: string | RegExp = /uses remaining/i): HTMLElement {
  return screen.getByRole('img', { name })
}

/** The base record as the store holds it (a panel must never write to it). */
function storedBaseAbility(id = 'a1'): AbilityBlock {
  const base = useCharacterStore
    .getState()
    .characters.find((c) => c.id === 'npc-1')
  const ability = base?.slottedAbilities.find((a) => a.id === id)
  if (!ability) throw new Error(`no base ability ${id}`)
  return ability
}

test('NPC panel: a limited ability starts at the ability’s full budget', () => {
  // The base is a template whose own count is spent down (legacy data, or a
  // base that was stepped by hand before this rule). An instance never inherits
  // it: it starts full and tracks its own uses from there.
  const base = makeBaseWith([
    limitedAbility({ uses: { max: 3, current: 1, expendOnActivate: true } }),
  ])
  renderNpcPanel(base)

  expect(usesReadout('3 of 3 uses remaining')).toBeInTheDocument()
  expect(activateButtons()[0]).toBeEnabled()
  expect(panelState().abilityUses).toEqual({})
})

test('NPC panel: activating a limited ability spends one of the instance’s uses', () => {
  const base = makeBaseWith([limitedAbility()])
  renderNpcPanel(base)

  fireEvent.click(activateButtons()[0])

  expect(panelState().currentAP).toBe(2)
  expect(panelState().abilityUses).toEqual({ a1: 2 })
  expect(usesReadout('2 of 3 uses remaining')).toBeInTheDocument()
  expect(screen.getByText(/Activated Cleave \(1 use spent\)/)).toBeInTheDocument()
  // The shared base record keeps its full budget — the instance spent its own.
  expect(storedBaseAbility().uses).toEqual({
    max: 3,
    current: 3,
    expendOnActivate: true,
  })
})

test('NPC panel: a limited ability is refused once the instance’s uses run out', () => {
  const base = makeBaseWith([limitedAbility()])
  seedScreenFor(base, { abilityUses: { a1: 0 } })
  useGMScreenStore.getState().setPanelDensity(SCREEN_ID, PANEL_ID, 'expanded')
  render(
    <NotificationProvider>
      <NpcPanelHarness base={base} />
    </NotificationProvider>,
  )

  const button = activateButtons()[0]
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('title', expect.stringContaining('No uses'))
  expect(panelState().currentAP).toBe(3)

  // A disabled button swallows the click; the plan guards too.
  fireEvent.click(button)
  expect(panelState().currentAP).toBe(3)
  expect(panelState().abilityUses).toEqual({ a1: 0 })
})

test('NPC panel: the ± steppers move the instance’s count without spending AP', () => {
  const base = makeBaseWith([limitedAbility()])
  renderNpcPanel(base)

  fireEvent.click(screen.getByRole('button', { name: /spend one use of Cleave/i }))
  expect(panelState().abilityUses).toEqual({ a1: 2 })
  expect(panelState().currentAP).toBe(3)
  expect(usesReadout('2 of 3 uses remaining')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /restore one use of Cleave/i }))
  // Back to full: the entry goes away rather than pinning today's maximum.
  expect(panelState().abilityUses).toEqual({})
  expect(panelState().currentAP).toBe(3)
  expect(storedBaseAbility().uses?.current).toBe(3)
})

test('NPC panel: the steppers write the panel even when the base is the current character', () => {
  // The GM usually reaches the screen straight from the NPC's sheet page, which
  // leaves the base record as `currentCharacter` — the instance's cards must
  // still write the panel, never the (shared) base.
  const base = makeBaseWith([limitedAbility()])
  renderNpcPanel(base)
  act(() => {
    useCharacterStore.setState({ currentCharacter: base })
  })

  fireEvent.click(screen.getByRole('button', { name: /spend one use of Cleave/i }))

  expect(panelState().abilityUses).toEqual({ a1: 2 })
  expect(storedBaseAbility().uses?.current).toBe(3)
})

test('NPC panel: each instance spends its own uses', () => {
  const base = makeBaseWith([limitedAbility()])
  seedScreenFor(base)
  useGMScreenStore.getState().setPanelDensity(SCREEN_ID, PANEL_ID, 'expanded')
  useGMScreenStore.getState().duplicatePanel(SCREEN_ID, PANEL_ID)

  const { container } = render(
    <NotificationProvider>
      <NpcPanelHarness base={base} />
      <NpcPanelHarness base={base} panelIndex={1} />
    </NotificationProvider>,
  )
  // Both panels render the same card; the first one activates.
  const buttons = activateButtons()
  expect(buttons).toHaveLength(2)
  fireEvent.click(buttons[0])

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(panels[0].kind === 'npc-instance' && panels[0].state.abilityUses).toEqual({ a1: 2 })
  expect(panels[1].kind === 'npc-instance' && panels[1].state.abilityUses).toEqual({})

  const readouts = Array.from(
    container.querySelectorAll('.ability-uses__value'),
  ).map((el) => el.getAttribute('aria-label'))
  expect(readouts).toEqual(['2 of 3 uses remaining', '3 of 3 uses remaining'])
})

test('NPC panel: expendOnActivate off keeps the budget (and the steppers)', () => {
  const base = makeBaseWith([
    limitedAbility({ uses: { max: 2, current: 2, expendOnActivate: false } }),
  ])
  renderNpcPanel(base)

  fireEvent.click(activateButtons()[0])

  expect(panelState().currentAP).toBe(2)
  expect(panelState().abilityUses).toEqual({})
  // The counter is still adjustable by hand.
  fireEvent.click(screen.getByRole('button', { name: /spend one use of Cleave/i }))
  expect(panelState().abilityUses).toEqual({ a1: 1 })
})

test('NPC panel: a limited sub-ability spends the instance’s own use', () => {
  const base = makeBaseWith([
    makeAbility({
      id: 'a1',
      name: 'Storm Call',
      cost: {},
      subAbilitiesUnderDescription: [
        limitedAbility({ id: 'sub', name: 'Lightning Lash', cost: { ap: 1 } }),
      ],
    }),
  ])
  renderNpcPanel(base)

  fireEvent.click(activateButtons()[0])

  expect(panelState().abilityUses).toEqual({ sub: 2 })
  expect(usesReadout('2 of 3 uses remaining')).toBeInTheDocument()
})

// ---- NPC live play: ability modifier switches -------------------------------

/** A base ability carrying one stat/attribute modifier. */
function modifierAbility(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return makeAbility({
    id: 'a1',
    name: 'Rage',
    modifiers: [{ target: 'evasion', value: 2 }],
    ...overrides,
  })
}

/** The value one of the panel chrome's stat tokens prints. */
function tokenValue(container: HTMLElement, label: string): string {
  const token = Array.from(container.querySelectorAll('.gm-token')).find(
    (el) => el.querySelector('.gm-token__label')?.textContent === label,
  )
  if (!token) throw new Error(`no token labelled ${label}`)
  return token.querySelector('.gm-token__value')?.textContent ?? ''
}

test('NPC panel: the modifier switch moves the instance’s effective stats', () => {
  const base = makeBaseWith([modifierAbility()])
  const { container } = renderNpcPanel(base)

  const toggle = screen.getByRole('switch', { name: /Apply Rage modifiers/i })
  expect(toggle).toBeEnabled()
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(tokenValue(container, 'Eva')).toBe('10')

  fireEvent.click(toggle)

  // The instance carries the switch, the chrome token and the body's Combat
  // Stats row both read the projected entity, and the base record is untouched.
  expect(panelState().abilityModifiers).toEqual({ a1: true })
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  expect(tokenValue(container, 'Eva')).toBe('12')
  expect(
    container.querySelector('.gm-panel__sheet .stat-token--modified .stat-token__delta')
      ?.textContent,
  ).toBe('+2')
  expect(storedBaseAbility().modifiersActive).toBeUndefined()

  fireEvent.click(toggle)
  expect(panelState().abilityModifiers).toEqual({})
  expect(tokenValue(container, 'Eva')).toBe('10')
})

test('NPC panel: an active Max HP modifier raises the HP bar’s cap', () => {
  const base = makeBaseWith([
    modifierAbility({
      id: 'a1',
      name: 'Colossus',
      modifiers: [{ target: 'maxHP', value: 10 }],
    }),
  ])
  const { container } = renderNpcPanel(base)

  fireEvent.click(screen.getByRole('switch', { name: /Apply Colossus modifiers/i }))

  expect(container.querySelector('.gm-hp .gm-bar__max')?.textContent).toContain('30')
})

test('NPC panel: each instance switches its own modifiers', () => {
  const base = makeBaseWith([modifierAbility()])
  seedScreenFor(base)
  useGMScreenStore.getState().setPanelDensity(SCREEN_ID, PANEL_ID, 'expanded')
  useGMScreenStore.getState().duplicatePanel(SCREEN_ID, PANEL_ID)

  const { container } = render(
    <NotificationProvider>
      <NpcPanelHarness base={base} />
      <NpcPanelHarness base={base} panelIndex={1} />
    </NotificationProvider>,
  )
  const switches = screen.getAllByRole('switch')
  expect(switches).toHaveLength(2)
  fireEvent.click(switches[0])

  const panels = useGMScreenStore.getState().screens[0].panels
  expect(
    panels[0].kind === 'npc-instance' && panels[0].state.abilityModifiers,
  ).toEqual({ a1: true })
  expect(
    panels[1].kind === 'npc-instance' && panels[1].state.abilityModifiers,
  ).toEqual({})
  expect(tokenValue(container, 'Eva')).toBe('12')
  // The sibling panel still reads its own (unmodified) stats.
  const evas = Array.from(container.querySelectorAll('.gm-token'))
    .filter((el) => el.querySelector('.gm-token__label')?.textContent === 'Eva')
    .map((el) => el.querySelector('.gm-token__value')?.textContent)
  expect(evas).toEqual(['12', '10'])
})

test('NPC panel: the switch writes the panel even when the base is the current character', () => {
  const base = makeBaseWith([modifierAbility()])
  renderNpcPanel(base)
  act(() => {
    useCharacterStore.setState({ currentCharacter: base })
  })

  fireEvent.click(screen.getByRole('switch', { name: /Apply Rage modifiers/i }))

  expect(panelState().abilityModifiers).toEqual({ a1: true })
  expect(storedBaseAbility().modifiersActive).toBeUndefined()
})

test('NPC panel: an active Armor modifier reaches the Damage dialog', () => {
  const base = makeBaseWith([
    modifierAbility({
      id: 'a1',
      name: 'Bulwark',
      modifiers: [{ target: 'armor', value: 3 }],
    }),
  ])
  renderNpcPanel(base)

  fireEvent.click(screen.getByRole('switch', { name: /Apply Bulwark modifiers/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Damage…' }))

  // The dialog's armor preview has to be the instance's, or the reduction the
  // GM is told about would not be the one the store rolls.
  expect(screen.getByText('Apply Armor (3d6 reduction)')).toBeInTheDocument()
})

test('NPC panel: a Recharge ability cools down when used and is disabled', () => {
  const base = makeBaseWith([
    makeAbility({ id: 'a1', name: 'Fire Breath', traits: ['Action', 'Recharge (5)'] }),
  ])
  renderNpcPanel(base)

  // Idle: the badge warns that using it starts a cooldown.
  expect(screen.getByText('Recharge 5')).toBeInTheDocument()

  fireEvent.click(activateButtons()[0])

  expect(panelState().cooldowns).toEqual(['a1'])
  expect(screen.getByText('On cooldown — Recharge 5')).toBeInTheDocument()
  expect(activateButtons()[0]).toBeDisabled()
  expect(screen.getByText(/Activated Fire Breath.*on cooldown/)).toBeInTheDocument()
})

test('NPC panel: an ability without the trait never goes on cooldown', () => {
  const base = makeBaseWith([makeAbility({ id: 'a1', name: 'Cleave' })])
  renderNpcPanel(base)

  fireEvent.click(activateButtons()[0])

  expect(panelState().cooldowns).toEqual([])
  expect(document.querySelector('.gm-recharge')).toBeNull()
})

test('NPC panel: sub-abilities with a cost activate too', () => {
  const base = makeBaseWith([
    makeAbility({
      id: 'a1',
      name: 'Storm Call',
      cost: {},
      subAbilitiesUnderDescription: [
        makeAbility({ id: 'sub', name: 'Lightning Lash', cost: { ap: 1 } }),
      ],
    }),
  ])
  renderNpcPanel(base)

  // The parent has no cost (no button); its sub-ability does.
  expect(activateButtons()).toHaveLength(1)
  fireEvent.click(activateButtons()[0])
  expect(panelState().currentAP).toBe(2)
  expect(screen.getByText(/Activated Lightning Lash/)).toBeInTheDocument()
})

test('NPC panel: the turn button appears only once AP reaches 0', () => {
  const base = makeBase()
  renderNpcPanel(base, 'compact')

  expect(screen.queryByRole('button', { name: /Start new turn/ })).toBeNull()

  act(() => {
    useGMScreenStore.getState().spendInstanceAP(SCREEN_ID, PANEL_ID, 3)
  })
  expect(screen.getByRole('button', { name: /Start new turn/ })).toBeInTheDocument()
})

test('NPC panel: starting a new turn refills AP, rolls the Recharge Die, notifies and logs', () => {
  const base = makeBaseWith([
    makeAbility({ id: 'a1', name: 'Fire Breath', traits: ['Recharge (5)'] }),
    makeAbility({ id: 'a2', name: 'Bite', traits: ['Recharge (2)'] }),
  ])
  renderNpcPanel(base, 'compact')

  // Both used, and the turn's AP spent: the NPC's turn is over.
  act(() => {
    const store = useGMScreenStore.getState()
    store.spendInstanceAP(SCREEN_ID, PANEL_ID, 3)
    store.markAbilityCooldown(SCREEN_ID, PANEL_ID, 'a1')
    store.markAbilityCooldown(SCREEN_ID, PANEL_ID, 'a2')
  })

  mockRechargeRoll(5)
  fireEvent.click(screen.getByRole('button', { name: /Start new turn/ }))

  // AP is back to a full turn, and only the abilities the roll covered returned.
  expect(panelState().currentAP).toBe(3)
  expect(panelState().cooldowns).toEqual([])
  expect(
    screen.getByText("Bandit's turn — Recharge Die: 5 · recharged: Fire Breath, Bite"),
  ).toBeInTheDocument()

  // The roll is in the persistent log, tagged with the instance and its turn.
  const entries = useRollLogStore.getState().entries
  expect(entries).toHaveLength(1)
  expect(entries[0]).toMatchObject({
    notation: '1d6',
    characterId: base.id,
    characterName: 'Bandit',
    source: {
      type: 'recharge',
      npcName: 'Bandit',
      recharged: ['Fire Breath', 'Bite'],
    },
  })
  expect(entries[0].result.total).toBe(5)
})

test('NPC panel: a low Recharge Die leaves high-value abilities cooling', () => {
  const base = makeBaseWith([
    makeAbility({ id: 'a1', name: 'Fire Breath', traits: ['Recharge (5)'] }),
    makeAbility({ id: 'a2', name: 'Bite', traits: ['Recharge (2)'] }),
  ])
  renderNpcPanel(base, 'compact')
  act(() => {
    const store = useGMScreenStore.getState()
    store.spendInstanceAP(SCREEN_ID, PANEL_ID, 3)
    store.markAbilityCooldown(SCREEN_ID, PANEL_ID, 'a1')
    store.markAbilityCooldown(SCREEN_ID, PANEL_ID, 'a2')
  })

  mockRechargeRoll(2)
  fireEvent.click(screen.getByRole('button', { name: /Start new turn/ }))

  expect(panelState().cooldowns).toEqual(['a1'])
  expect(
    screen.getByText("Bandit's turn — Recharge Die: 2 · recharged: Bite"),
  ).toBeInTheDocument()
})

test('NPC panel: the panel menu can start a turn early', () => {
  const base = makeBase()
  renderNpcPanel(base, 'compact')
  act(() => {
    useGMScreenStore.getState().spendInstanceAP(SCREEN_ID, PANEL_ID, 2)
  })

  fireEvent.click(screen.getByRole('button', { name: /Bandit options/ }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Start new turn' }))

  expect(panelState().currentAP).toBe(3)
  expect(useRollLogStore.getState().entries).toHaveLength(1)
})
