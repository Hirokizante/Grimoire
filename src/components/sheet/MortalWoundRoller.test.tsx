/**
 * Manual Mortal Wounds on a player's sheet — the player's half of "record a
 * specific wound, no D20".
 *
 * `MortalWoundRoller` used to appear only once a wound existed, which made the
 * block invisible exactly when a player needed to record the first one. These
 * tests pin the current contract: view mode always shows the block — its
 * `n / max` counter and its "Add Mortal Wound…" included — the two manual
 * actions share one row of peer-sized buttons, the picked entry lands in the
 * oldest slot that can take a name, and a full track offers nothing to click.
 * An untouched track prints **no** empty slot squircles (the counter replaced
 * them), and edit mode renders the same track read-only: the cards, no
 * controls. Building a sheet is not playing it.
 *
 * The last test in the shared-action group is a cross-check with the block
 * directly above it: the Death Save roll wears the same
 * `sheet-action-btn` shape as the wound row's buttons.
 */

import { render, screen, fireEvent, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

// Vitest runs with `css: true`; the sheet's wound rules are imported here rather
// than relying on another test file having pulled them in.
import '@/components/sheet/sheet.css'

import StatsSection from '@/components/sheet/StatsSection'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter } from '@/constants/gameData'
import {
  CRITICAL_CONDITION_MESSAGE,
  KNOCKED_OUT_MESSAGE,
} from '@/lib/mortalWounds'
import { useCharacterStore } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import type { Character } from '@/types'

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

function makePc(overrides: Partial<Character> = {}): Character {
  return {
    ...createDefaultCharacter(),
    id: 'pc-1',
    name: 'Vex',
    mortalWounds: [null, null],
    ...overrides,
  }
}

/**
 * Subscribe to the character list the way the sheet page does, so a live-play
 * write re-renders with the fresh record instead of a stale prop.
 */
function StatsHarness({
  characterId,
  mode,
}: {
  characterId: string
  mode: 'view' | 'edit'
}) {
  const character = useCharacterStore((s) =>
    s.characters.find((c) => c.id === characterId),
  )
  if (!character) return null
  return <StatsSection character={character} mode={mode} />
}

/** Render the sheet's stat section (view mode is the live-play surface). */
function renderStats(character: Character, mode: 'view' | 'edit' = 'view') {
  useCharacterStore.setState({ characters: [character] })
  return render(
    <NotificationProvider>
      <StatsHarness characterId={character.id} mode={mode} />
    </NotificationProvider>,
  )
}

/** The character record after a store write. */
function stored(): Character {
  const character = useCharacterStore.getState().characters[0]
  if (!character) throw new Error('expected the character to still exist')
  return character
}

/** Open the manual-add dialog from the sheet's wound block. */
function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: /Add Mortal Wound/ }))
  return screen.getByRole('dialog', { name: 'Add Mortal Wound to Vex' })
}

test('the sheet shows the wound read-out in view mode even with no wounds', () => {
  const { container } = renderStats(makePc())

  // The block reads its counter from the start — and the manual add has to be
  // reachable before the first wound lands, which is the whole point.
  expect(container.querySelector('.stat-mortals')).not.toBeNull()
  expect(container.querySelector('.mw-head')?.textContent).toContain('Mortal Wounds')
  expect(container.querySelector('.mw-head__count')?.textContent).toBe('0 / 2')
  // No empty slot squircles: the counter is the read-out for an empty track.
  expect(container.querySelector('.mortal-wound-slot')).toBeNull()
  expect(container.querySelectorAll('.mw-card')).toHaveLength(0)
  expect(screen.getByRole('button', { name: /Add Mortal Wound/ })).toBeInTheDocument()
})

test('both wound actions are peer-sized buttons in one row', () => {
  const { container } = renderStats(makePc({ mortalWounds: ['Sprain', null] }))

  // One action row — never one full-width bar stacked under another.
  const rows = container.querySelectorAll('.mw-actions')
  expect(rows).toHaveLength(1)
  const buttons = Array.from(rows[0].querySelectorAll('button'))
  expect(buttons.map((b) => b.textContent?.trim())).toEqual([
    'Add Mortal Wound…',
    'Rest (Full Restore)',
  ])
  // Visually uniform: one shared action-button class, and an icon on each.
  expect(new Set(buttons.map((b) => b.className)).size).toBe(1)
  for (const button of buttons) {
    expect(button).toHaveClass('sheet-action-btn')
    expect(button.querySelector('svg')).not.toBeNull()
  }
  // The counter follows the wound onto the track.
  expect(container.querySelector('.mw-head__count')?.textContent).toBe('1 / 2')
})

test('a full track marks the counter and warns about the next 0 HP', () => {
  const { container } = renderStats(
    makePc({ mortalWounds: ['Sprain', 'Exhaustion'] }),
  )

  expect(container.querySelector('.mw-head__count--full')?.textContent).toBe('2 / 2')
  expect(container.querySelector('.mw-warn')?.textContent).toContain(
    'Knocked Out',
  )
  // Nothing left to add, so the row is the Rest button alone.
  expect(
    Array.from(container.querySelectorAll('.mw-actions .sheet-action-btn')).map(
      (b) => b.textContent?.trim(),
    ),
  ).toEqual(['Rest (Full Restore)'])
})

test('the Death Save roll is the same compact action button as the wound row', () => {
  // Both trackers sit at the end of the same block and both ask for a D20, so
  // they offer the same control: the wound row's buttons and the death save
  // roll all carry `sheet-action-btn` (and its icon), none of them a
  // full-width bar.
  const { container } = renderStats(
    makePc({ currentHP: 0, mortalWounds: ['Sprain', 'Exhaustion'] }),
  )

  const deathSaveRoll = screen.getByRole('button', { name: 'Roll Death Save (d20)' })
  expect(deathSaveRoll).toHaveClass('btn--primary', 'sheet-action-btn')
  expect(deathSaveRoll.querySelector('svg')).not.toBeNull()

  // The wound row's own buttons are the same shape, one emphasis step down.
  const woundButtons = container.querySelectorAll('.mw-actions .sheet-action-btn')
  expect(woundButtons.length).toBeGreaterThan(0)
  for (const button of woundButtons) {
    expect(button).toHaveClass('btn--ghost', 'sheet-action-btn')
  }
})

test('edit mode renders the same track read-only', () => {
  // The wound is still there to read; its controls are not. Edit mode used to
  // draw its own squircle track, which gave one wound two different faces.
  const { container } = renderStats(makePc({ mortalWounds: ['Sprain', null] }), 'edit')

  expect(container.querySelector('.mw-head__count')?.textContent).toBe('1 / 2')
  expect(container.querySelector('.mw-card__name')?.textContent).toBe('Sprain')
  expect(container.querySelector('.mw-actions')).toBeNull()
  expect(container.querySelector('.mw-card__clear')).toBeNull()
  expect(screen.queryByRole('button', { name: /Add Mortal Wound/ })).toBeNull()
})

test('edit mode leaves a clean track hidden', () => {
  // Building a sheet is not playing it: no cards, no add button, no block.
  const { container } = renderStats(makePc(), 'edit')

  expect(container.querySelector('.stat-mortals')).toBeNull()
  expect(screen.queryByRole('button', { name: /Add Mortal Wound/ })).toBeNull()
})

// ---- What the track announces ----------------------------------------------

/** Every toast currently on screen. */
function toasts(): string[] {
  return Array.from(document.querySelectorAll('.notification')).map(
    (n) => n.textContent ?? '',
  )
}

test('rolling the second wound raises the Critical Condition, not a knock-out', () => {
  // The state a hit leaves behind at 25 HP: the second slot is pending, the
  // character is standing. Naming it fills the track — which is one 0 HP away
  // from a knock-out, not a knock-out (it used to announce one).
  renderStats(makePc({ currentHP: 25, mortalWounds: ['Sprain', 'Pending Roll'] }))

  fireEvent.click(screen.getByRole('button', { name: 'Roll Mortal Wound (d20)' }))

  expect(toasts()).toContain(CRITICAL_CONDITION_MESSAGE)
  expect(toasts()).not.toContain(KNOCKED_OUT_MESSAGE)
  // The warning is on the block too, and the counter is full.
  expect(document.querySelector('.mw-warn')?.textContent).toBe(
    CRITICAL_CONDITION_MESSAGE,
  )
  expect(document.querySelector('.mw-head__count')?.textContent).toBe('2 / 2')
})

test('rolling a wound at 0 HP with no slot left is the knock-out', () => {
  // Overkill burned through both slots and left the character at 0 HP, so
  // resolving the last one is the moment the knock-out is reached.
  renderStats(makePc({ currentHP: 0, mortalWounds: ['Sprain', 'Pending Roll'] }))

  fireEvent.click(screen.getByRole('button', { name: 'Roll Mortal Wound (d20)' }))

  expect(toasts()).toContain(KNOCKED_OUT_MESSAGE)
  expect(toasts()).not.toContain(CRITICAL_CONDITION_MESSAGE)
})

test('the HP stepper announces the knock-out it causes — and only that', () => {
  // 1 HP with both slots taken: the last point of HP has no wound to pay for
  // it, so stepping down is the knock-out, and it has to say so.
  const knockedOut = renderStats(
    makePc({ currentHP: 1, mortalWounds: ['Sprain', 'Exhaustion'] }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Spend HP' }))
  expect(toasts()).toContain(KNOCKED_OUT_MESSAGE)
  expect(screen.getByText('Death Saves')).toBeInTheDocument()
  knockedOut.unmount()

  // The same step one wound earlier takes a wound instead: HP resets to max
  // and the character is up, so there is nothing to announce.
  renderStats(makePc({ currentHP: 1, mortalWounds: ['Sprain', null] }))
  fireEvent.click(screen.getByRole('button', { name: 'Spend HP' }))
  expect(toasts()).not.toContain(KNOCKED_OUT_MESSAGE)
  expect(document.querySelector('.mw-card--pending')).not.toBeNull()
})

test('Add Mortal Wound… lists the whole table and applies the picked entry', () => {
  renderStats(makePc())
  const dialog = openPicker()

  // Twenty entries, read as the table they stand in for.
  expect(within(dialog).getAllByRole('button', { name: /^Add / })).toHaveLength(20)

  fireEvent.click(screen.getByRole('button', { name: 'Add Damaged Throat' }))

  expect(stored().mortalWounds).toEqual(['Damaged Throat', null])
  // The wound card carries the entry's own D20, exactly as a rolled one does.
  const card = document.querySelector('.mw-card')
  expect(card?.textContent).toContain('Damaged Throat')
  expect(card?.textContent).toContain('8')
  expect(card?.textContent).toContain('Unable to regain END')
})

test('the picker searches the table by name and by rules text', () => {
  renderStats(makePc())
  const dialog = openPicker()

  fireEvent.change(within(dialog).getByRole('searchbox'), {
    target: { value: 'healing' },
  })

  const rows = within(dialog).getAllByRole('button', { name: /^Add / })
  expect(rows).toHaveLength(1)
  expect(rows[0]).toHaveAccessibleName('Add Circulatory Dysfunction')
})

test('a wound already on the track is marked, and duplicates stay allowed', () => {
  renderStats(makePc({ mortalWounds: ['Sprain', null] }))
  const dialog = openPicker()

  expect(within(dialog).getAllByText('on track')).toHaveLength(1)

  // Picking it again is allowed: two wounds can share a name.
  fireEvent.click(screen.getByRole('button', { name: 'Add Sprain' }))
  expect(stored().mortalWounds).toEqual(['Sprain', 'Sprain'])
})

test('the picker stays open and locks itself once the track fills', () => {
  renderStats(makePc({ mortalWounds: ['Sprain', null] }))
  openPicker()

  fireEvent.click(screen.getByRole('button', { name: 'Add Exhaustion' }))

  expect(stored().mortalWounds).toEqual(['Sprain', 'Exhaustion'])
  // Still up (a target can take two wounds in one visit) and now explaining
  // why nothing else can be picked.
  const dialog = screen.getByRole('dialog', { name: 'Add Mortal Wound to Vex' })
  expect(
    within(dialog).getByText(/No Mortal Wound slots left on Vex/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add Hemorrhage' })).toBeDisabled()
})

test('a full track offers no manual add at all', () => {
  renderStats(makePc({ mortalWounds: ['Sprain', 'Exhaustion'] }))

  expect(screen.queryByRole('button', { name: /Add Mortal Wound/ })).toBeNull()
})

test('a pending wound is named by hand instead of rolled', () => {
  // `takeDamage` left slot 0 unresolved; naming it is what the roll would do,
  // so the card turns into a named wound and the roll button goes away.
  renderStats(makePc({ mortalWounds: ['Pending Roll', null] }))
  expect(
    screen.getByRole('button', { name: 'Roll Mortal Wound (d20)' }),
  ).toBeInTheDocument()

  openPicker()
  fireEvent.click(screen.getByRole('button', { name: 'Add Hemorrhage' }))

  expect(stored().mortalWounds).toEqual(['Hemorrhage', null])
  expect(
    screen.queryByRole('button', { name: 'Roll Mortal Wound (d20)' }),
  ).toBeNull()
})
