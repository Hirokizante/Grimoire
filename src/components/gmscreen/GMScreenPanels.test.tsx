/**
 * Component tests for the GM Screen's NPC-instance flow.
 *
 * The generalized DamageDialog is the shared dialog for BOTH player sheets
 * and NPC instances — these tests pin the instance branch: armor and max HP
 * come from the base record's `npcStats`, temp HP from the instance state,
 * and reaching 0 HP downs the instance instead of inflicting mortal wounds.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import DamageDialog from '@/components/sheet/DamageDialog'
import CharacterPanel from '@/components/gmscreen/CharacterPanel'
import NpcInstancePanel from '@/components/gmscreen/NpcInstancePanel'
import { NotificationProvider } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { createDefaultNPC, createDefaultCharacter, DEFAULT_SHEET_COLORS } from '@/constants/gameData'
import { appThemeSheetColors } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import type { Character } from '@/types'

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
function seedScreenFor(base: Character, state?: Partial<{ currentHP: number; tempHP: number }>) {
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
  // The result grid reports no mortal wounds — NPCs have no death saves.
  expect(screen.queryByText(/Mortal Wound\(s\) incurred/)).not.toBeInTheDocument()
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
  renderPanel('compact')

  fireEvent.click(screen.getByRole('button', { name: 'Deal 1 damage to Bandit' }))
  expect(panelState().currentHP).toBe(19)

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
  expect(tokenColor(container, 'Eva')).toBe(theme.tokenEvasion)
  expect(tokenColor(container, 'Arm')).toBe(theme.tokenArmor)
  expect(tokenColor(container, 'AP')).toBe(theme.apBar)
  expect(tokenColor(container, 'END')).toBe(theme.endBar)
  expect(tokenColor(container, 'FP')).toBe(theme.fpBar)
  // The app theme really is a different palette from the sheet's defaults, so
  // the assertions above are meaningful rather than coincidental.
  expect(theme.tokenEvasion).not.toBe(defaultTheme.tokenEvasion)
  expect(theme.apBar).not.toBe(defaultTheme.apBar)

  // And none of the sheet's custom colors leaked through.
  const rendered = ['Eva', 'Arm', 'AP', 'END', 'FP'].map((l) => tokenColor(container, l))
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

  const theme = appThemeSheetColors('parchment')
  expect(tokenColor(container, 'Eva')).toBe(theme.tokenEvasion)
  expect(tokenColor(container, 'Arm')).toBe(theme.tokenArmor)
  expect(tokenColor(container, 'Move')).toBe(theme.tokenMovement)
  expect(tokenColor(container, 'DC')).toBe(theme.tokenSaveDC)
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


test('expanded player panel hides the HP bar the panel header already shows', () => {
  const { container } = expandedHeadings('character')
  const labels = Array.from(container.querySelectorAll('.resource-bar__label')).map(
    (l) => l.textContent?.trim(),
  )
  expect(labels).not.toContain('HP')
  // The rest of the live-play resources are still there.
  expect(labels).toContain('Fate Points')
  expect(labels).toContain('Action Points')
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
