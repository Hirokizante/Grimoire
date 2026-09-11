/**
 * Component tests for the GM Screen's NPC-instance flow.
 *
 * The generalized DamageDialog is the shared dialog for BOTH player sheets
 * and NPC instances — these tests pin the instance branch: armor and max HP
 * come from the base record's `npcStats`, temp HP from the instance state,
 * and reaching 0 HP downs the instance instead of inflicting mortal wounds.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'

import DamageDialog from '@/components/sheet/DamageDialog'
import CharacterPanel from '@/components/gmscreen/CharacterPanel'
import NpcInstancePanel from '@/components/gmscreen/NpcInstancePanel'
import { NotificationProvider } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { useRollLogStore } from '@/store/rollLogStore'
import { createDefaultNPC, createDefaultCharacter, DEFAULT_SHEET_COLORS, MAX_AP } from '@/constants/gameData'
import { appThemeSheetColors } from '@/lib/themeUtils'
import { useAppThemeStore } from '@/store/appThemeStore'
import type { AbilityBlock, Character } from '@/types'

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
              currentAP: MAX_AP,
              cooldowns: [],
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
  expect(theme.tokenEvasion).not.toBe(defaultTheme.tokenEvasion)
  expect(theme.endBar).not.toBe(defaultTheme.endBar)

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
                state: {
                  currentHP: 20,
                  tempHP: 0,
                  condition: 'active',
                  currentAP: MAX_AP,
                  cooldowns: [],
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
 * so a store write re-renders it with the fresh panel object.
 */
function NpcPanelHarness({ base }: { base: Character }) {
  const panel = useGMScreenStore((s) =>
    s.screens.find((screen) => screen.id === SCREEN_ID)?.panels[0],
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

test('NPC panel: a limited ability is refused once its uses run out', () => {
  const base = makeBaseWith([
    makeAbility({
      id: 'a1',
      name: 'Cleave',
      cost: { ap: 1 },
      uses: { max: 1, current: 0, expendOnActivate: true },
    }),
  ])
  renderNpcPanel(base)

  const button = activateButtons()[0]
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('title', expect.stringContaining('No uses'))
  expect(panelState().currentAP).toBe(3)
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
