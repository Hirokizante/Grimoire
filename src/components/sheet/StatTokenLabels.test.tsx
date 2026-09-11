/**
 * Combat Stats token labels — full names on a sheet page, shorthand on a panel.
 *
 * A GM Screen panel's token column is ~7.5rem wide, so the full stat names used
 * to render as "MILEST…", "SAVE …" and "END RE…": an ellipsis is not a stat
 * name, and a GM reading six panels mid-turn cannot be left guessing. Panels now
 * print shorthand (SHORT_STAT_LABELS) with the full name as the tooltip, while
 * the sheet page — which has the width — keeps the full names.
 *
 * The height half of the same problem is pinned here too: the Milestones
 * token's "+2 bonus" line used to be a second in-flow line, which made that
 * token (and so its whole grid row) taller than the five beside it.
 */

import { render } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

// Vitest is configured with `css: true`, so the token rules are resolvable —
// imported here rather than relying on another test file having pulled them in.
import '@/components/sheet/sheet.css'

import CharacterPanel from '@/components/gmscreen/CharacterPanel'
import PanelSheet from '@/components/gmscreen/PanelSheet'
import StatsSection from '@/components/sheet/StatsSection'
import { SHORT_STAT_LABELS } from '@/components/sheet/statTokenLabels'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter, createDefaultNPC } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import type { Character } from '@/types'

const SCREEN_ID = 'screen-1'

vi.mock('@/lib/db', () => ({
  getAllScreens: vi.fn(async () => []),
  getScreen: vi.fn(async () => null),
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

beforeEach(() => {
  useCharacterStore.setState({ characters: [], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [],
    currentScreenId: null,
    isLoaded: true,
    isSaving: false,
    loadError: null,
  })
})

function makePc(): Character {
  return { ...createDefaultCharacter(), id: 'pc-1', name: 'Vex' }
}

/** A character whose Milestones grant a bonus (every 2 milestones = +1). */
function makeMilestonedPc(): Character {
  return { ...makePc(), milestones: 5 }
}

/** Every rendered token's label text, in reading order. */
function labelsIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.stat-token__label')].map(
    (el) => el.textContent ?? '',
  )
}

/** Every rendered token's full-name tooltip, in reading order. */
function titlesIn(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll<HTMLElement>('.stat-token')].map((el) =>
    el.getAttribute('title'),
  )
}

// ---- The vocabulary itself --------------------------------------------------

test('every stat name the app abbreviates has a shorthand, and they are short', () => {
  // The stats the sheet page and the two panel rows can show.
  expect(Object.keys(SHORT_STAT_LABELS).sort()).toEqual([
    'Armor',
    'END Recovery',
    'Evasion',
    'Milestones',
    'Mortal Wounds',
    'Movement',
    'Save DC',
  ])
  for (const [full, short] of Object.entries(SHORT_STAT_LABELS)) {
    expect(short.length, `${full} → ${short}`).toBeLessThanOrEqual(8)
    // A shorthand has to be shorter than what it replaces, or it is just noise.
    expect(short.length, `${full} → ${short}`).toBeLessThan(full.length)
  }
})

test('the shorthand agrees with the GM panel chrome', () => {
  // The chrome (CharacterPanel / NpcInstancePanel) prints Eva/Arm/Move/DC for
  // the same four stats; the row of cards below it must not invent its own
  // names for them.
  expect(SHORT_STAT_LABELS.Evasion).toBe('Eva')
  expect(SHORT_STAT_LABELS.Armor).toBe('Arm')
  expect(SHORT_STAT_LABELS.Movement).toBe('Move')
  // "Save" opens the same stat the chrome calls DC.
  expect(SHORT_STAT_LABELS['Save DC'].startsWith('Save')).toBe(true)
})

// ---- Sheet page: full names ------------------------------------------------

test('a sheet page keeps full stat names — it has the width for them', () => {
  // `full` is the default, which is what the sheet page and the hero column
  // render (neither passes `tokenLabels`); only GM panels opt into shorthand.
  const pc = makePc()
  const { container } = render(
    <NotificationProvider>
      <StatsSection character={pc} variant="flat" />
    </NotificationProvider>,
  )

  expect(labelsIn(container)).toEqual([
    'Milestones',
    'Evasion',
    'Armor',
    'Movement',
    'Save DC',
    'END Recovery',
  ])
  // Nothing to expand: a full name needs no tooltip.
  expect(titlesIn(container).every((t) => t == null)).toBe(true)
})

// ---- Panels: shorthand -----------------------------------------------------

test('the panel body prints shorthand, with the full name as the tooltip', () => {
  const pc = makePc()
  const { container } = render(
    <NotificationProvider>
      <PanelSheet entity={pc} />
    </NotificationProvider>,
  )

  expect(labelsIn(container)).toEqual([
    'Miles',
    'Eva',
    'Arm',
    'Move',
    'Save',
    'END Rec',
  ])
  expect(titlesIn(container)).toEqual([
    'Milestones',
    'Evasion',
    'Armor',
    'Movement',
    'Save DC',
    'END Recovery',
  ])
})

test('an NPC panel abbreviates Mortal Wounds and leaves HP as it is', () => {
  const npc = { ...createDefaultNPC(), id: 'npc-1', name: 'Bandit' }
  const { container } = render(
    <NotificationProvider>
      <PanelSheet entity={npc} />
    </NotificationProvider>,
  )

  expect(labelsIn(container)).toEqual([
    'Eva',
    'Arm',
    'Move',
    'Save',
    'HP',
    'Wounds',
  ])
  // HP is already a shorthand — it gets no tooltip.
  expect(titlesIn(container)).toEqual([
    'Evasion',
    'Armor',
    'Movement',
    'Save DC',
    null,
    'Mortal Wounds',
  ])
})

test('an expanded GM panel body renders the shorthand too', () => {
  const pc = makePc()
  useCharacterStore.setState({ characters: [pc], currentCharacter: null })
  useGMScreenStore.setState({
    screens: [
      {
        id: SCREEN_ID,
        name: 'Session 4',
        panels: [
          {
            kind: 'character',
            id: 'panel-1',
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

  // The chrome and the body now share one vocabulary ("Eva" both places).
  expect(labelsIn(container)).toContain('Eva')
  const body = container.querySelector('.gm-panel__sheet')
  if (!body) throw new Error('expanded panel body not rendered')
  expect(labelsIn(body as HTMLElement)).toEqual([
    'Miles',
    'Eva',
    'Arm',
    'Move',
    'Save',
    'END Rec',
  ])
})

test('shorthand keeps the edit-mode stat input working', () => {
  const npc = { ...createDefaultNPC(), id: 'npc-1', name: 'Bandit' }
  const { container } = render(<PanelSheet entity={npc} mode="edit" />)

  // One editable input per token, and the shorthand label sits beside it.
  expect(container.querySelectorAll('.stat-token__input')).toHaveLength(6)
  expect(labelsIn(container)).toEqual([
    'Eva',
    'Arm',
    'Move',
    'Save',
    'HP',
    'Wounds',
  ])
})

// ---- Uniform token heights -------------------------------------------------

test('a token is ONE line — the milestone bonus shares the label line', () => {
  // The bonus used to be a second line ("+2 bonus" under the label), which made
  // the Milestones token taller than the five beside it; reserving that line on
  // every token to keep the row uniform then cost the row ~13px of slack. The
  // fix is the bonus inline with the label, so the row has nothing to reserve.
  const pc = makeMilestonedPc()
  const { container } = render(
    <NotificationProvider>
      <StatsSection character={pc} variant="flat" tokenLabels="short" />
    </NotificationProvider>,
  )

  const tokens = [...container.querySelectorAll<HTMLElement>('.stat-token')]
  expect(tokens).toHaveLength(6)
  // One shared height, and no second line to reserve anywhere: the height is
  // the value line plus the padding, on every token of every row and sheet.
  const heights = [...new Set(tokens.map((t) => getComputedStyle(t).minHeight))]
  expect(heights).toEqual(['calc(var(--stat-token-line-h) + 0.8rem + 2px)'])

  // The bonus is inside the label's own line ("Miles  +2"), not a line below it,
  // and it is its own element so the label's ellipsis can never eat the number.
  const line = container.querySelector('.stat-token__line')
  expect(line?.querySelector('.stat-token__label')?.textContent).toBe('Miles')
  // 5 milestones = a +2 bonus, and the bonus is BARE: no "bonus" wording.
  expect(line?.querySelector('.stat-token__bonus')?.textContent).toBe('+2')
  // Exactly one token carries a bonus (Milestones), the other five do not.
  expect(container.querySelectorAll('.stat-token__bonus')).toHaveLength(1)
  // Nothing prints the old two-line wording anywhere.
  expect(container.textContent).not.toContain('bonus')
})

test('a stat with no bonus prints no badge', () => {
  // 0-1 milestones grant nothing, so the token is just "Miles" — no "+0".
  const { container } = render(
    <NotificationProvider>
      <StatsSection character={makePc()} variant="flat" />
    </NotificationProvider>,
  )

  expect(container.querySelectorAll('.stat-token__bonus')).toHaveLength(0)
  expect(container.textContent).not.toContain('+0')
})

test('the sheet page prints the same one-line milestone, at full name', () => {
  const { container } = render(
    <NotificationProvider>
      <StatsSection character={makeMilestonedPc()} variant="flat" />
    </NotificationProvider>,
  )

  const line = container.querySelector('.stat-token__line')
  expect(line?.querySelector('.stat-token__label')?.textContent).toBe('Milestones')
  expect(line?.querySelector('.stat-token__bonus')?.textContent).toBe('+2')
})
