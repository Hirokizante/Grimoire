/**
 * Custom attributes on a player's sheet — the strip in the hero section, its
 * add/edit/delete flow, and the view-mode steppers.
 *
 * What these tests pin:
 *   - the strip is a horizontal, centered box row (`.custom-attr-strip` with
 *     the shared `.attr-box` shape) sitting between the resource bars and the
 *     Mortal Wounds block,
 *   - "+ Add Attribute" sits in the same edit-mode row as "+ Add Resource Bar",
 *     and the modal captures name / value / shorthand / steppers,
 *   - a box rolls `d20 + value` in view mode (the built-in attribute boxes'
 *     behavior), while its − / + steppers adjust the stored value and never
 *     roll,
 *   - steppers are opt-in per attribute,
 *   - editing and deleting go through the prefill modal and the shared
 *     confirmation path.
 */

import { render, screen, fireEvent, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

// Vitest runs with `css: true`; the strip's rules are imported here rather than
// relying on another test file having pulled them in.
import '@/components/sheet/sheet.css'

import StatsSection from '@/components/sheet/StatsSection'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter } from '@/constants/gameData'
import {
  MAX_CUSTOM_ATTRIBUTE_VALUE,
  MIN_CUSTOM_ATTRIBUTE_VALUE,
} from '@/lib/customAttributes'
import { useCharacterStore } from '@/store/characterStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import type { Character, CustomAttribute } from '@/types'

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
  useDiceRollStore.setState({
    isVisible: false,
    result: null,
    notation: '',
    source: null,
    ability: null,
    rollCharacter: null,
  })
})

function makeAttribute(overrides: Partial<CustomAttribute> = {}): CustomAttribute {
  return {
    id: 'ca-1',
    name: 'Martial',
    value: 3,
    shorthand: 'MAR',
    showSteppers: false,
    ...overrides,
  }
}

function makePc(overrides: Partial<Character> = {}): Character {
  return {
    ...createDefaultCharacter(),
    id: 'pc-1',
    name: 'Vex',
    ...overrides,
  }
}

/**
 * Subscribe to the character list the way the sheet page does, so a store write
 * re-renders with the fresh record instead of a stale prop.
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
  return (
    <StatsSection
      character={character}
      mode={mode}
      variant="flat"
      showCustomAttributes
    />
  )
}

/** Render the hero's stat block (view mode is the live-play surface). */
function renderStats(character: Character, mode: 'view' | 'edit' = 'view') {
  useCharacterStore.setState({
    characters: [character],
    currentCharacter: character,
  })
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

// ---- Placement and shape ---------------------------------------------------

test('the strip sits below the turn actions and above the Mortal Wounds block', () => {
  const stripIndex = (block: Element) =>
    [
      ...block.querySelectorAll(
        '.stat-bars, .recover-action, .custom-attr-strip, .stat-mortals',
      ),
    ].map((el) =>
      el.classList.contains('custom-attr-strip')
        ? 'custom-attr-strip'
        : el.className.split(' ')[0],
    )

  // View mode: bars → Recover / End Turn → strip → wounds.
  const view = renderStats(makePc({ customAttributes: [makeAttribute()] }))
  const viewBlock = view.container.querySelector('.stat-block--flat')!
  expect(stripIndex(viewBlock)).toEqual([
    'stat-bars',
    'recover-action',
    'custom-attr-strip',
    'stat-mortals',
  ])
  view.unmount()

  // Edit mode: the add row (Add Resource Bar + Add Attribute) sits above the
  // strip it adds to.
  const edit = renderStats(makePc({ customAttributes: [makeAttribute()] }), 'edit')
  const editBlock = edit.container.querySelector('.stat-block--flat')!
  expect([
    ...editBlock.querySelectorAll('.stat-bars, .stat-bars-add, .custom-attr-strip'),
  ].map((el) =>
    el.classList.contains('custom-attr-strip')
      ? 'custom-attr-strip'
      : el.className.split(' ')[0],
  )).toEqual(['stat-bars', 'stat-bars-add', 'custom-attr-strip'])
})

test('the strip is a centered row of the shared attribute boxes', () => {
  const { container } = renderStats(
    makePc({
      customAttributes: [
        makeAttribute(),
        makeAttribute({ id: 'ca-2', name: 'Sanity', value: 7, shorthand: '' }),
      ],
    }),
  )

  const strip = container.querySelector('.custom-attr-strip')!
  // The same box shape the five Divergence Attributes use, in a row the CSS
  // centers (`justify-content: center` — jsdom cannot lay it out, so the
  // contract here is the shared class pair).
  expect(strip.classList.contains('attr-boxes')).toBe(true)
  const boxes = [...strip.querySelectorAll('.custom-attr-box')]
  expect(boxes).toHaveLength(2)
  boxes.forEach((box) => expect(box.classList.contains('attr-box')).toBe(true))
})

test('a box prints its shorthand, value and name; name stands in with no shorthand', () => {
  const { container } = renderStats(
    makePc({
      customAttributes: [
        makeAttribute(),
        makeAttribute({ id: 'ca-2', name: 'Sanity', value: -2, shorthand: '' }),
      ],
    }),
  )

  const boxes = [...container.querySelectorAll('.custom-attr-box')]
  expect(boxes[0].textContent).toContain('MAR')
  expect(boxes[0].textContent).toContain('+3')
  expect(boxes[0].textContent).toContain('Martial')
  // No shorthand: the name is the box's own top line, so it prints once.
  expect(boxes[1].textContent).toContain('Sanity')
  expect(boxes[1].textContent).toContain('-2')
  expect(boxes[1].querySelector('.custom-attr-box__name')).toBeNull()
})

test('no strip is rendered when the sheet has no custom attributes', () => {
  const { container } = renderStats(makePc())

  expect(container.querySelector('.custom-attr-strip')).toBeNull()
})

// ---- View mode: roll + steppers -------------------------------------------

test('clicking a box rolls d20 + value as an attribute check', () => {
  const { container } = renderStats(
    makePc({ customAttributes: [makeAttribute({ value: 3 })] }),
  )

  fireEvent.click(container.querySelector('.custom-attr-box')!)

  const roll = useDiceRollStore.getState()
  expect(roll.isVisible).toBe(true)
  expect(roll.notation).toBe('d20+3')
  expect(roll.source).toEqual({
    type: 'attribute-check',
    attributeKey: 'ca-1',
    attributeName: 'Martial',
  })
})

test('steppers are opt-in and adjust the stored value', () => {
  const { container } = renderStats(
    makePc({
      customAttributes: [makeAttribute({ showSteppers: true })],
    }),
  )

  expect(screen.queryByRole('button', { name: /Increase/ })).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Increase Martial' }))
  expect(stored().customAttributes[0].value).toBe(4)

  fireEvent.click(screen.getByRole('button', { name: 'Decrease Martial' }))
  fireEvent.click(screen.getByRole('button', { name: 'Decrease Martial' }))
  expect(stored().customAttributes[0].value).toBe(2)
  expect(container.querySelector('.custom-attr-box__value')?.textContent).toBe(
    '+2',
  )
})

test('a stepper click steps the value without rolling', () => {
  renderStats(
    makePc({ customAttributes: [makeAttribute({ showSteppers: true })] }),
  )

  fireEvent.click(screen.getByRole('button', { name: 'Increase Martial' }))

  expect(useDiceRollStore.getState().isVisible).toBe(false)
})

test('steppers stop at the value bounds instead of running away', () => {
  renderStats(
    makePc({
      customAttributes: [
        makeAttribute({ value: MAX_CUSTOM_ATTRIBUTE_VALUE, showSteppers: true }),
        makeAttribute({
          id: 'ca-2',
          name: 'Doom',
          value: MIN_CUSTOM_ATTRIBUTE_VALUE,
          showSteppers: true,
        }),
      ],
    }),
  )

  fireEvent.click(screen.getByRole('button', { name: 'Increase Martial' }))
  fireEvent.click(screen.getByRole('button', { name: 'Decrease Doom' }))

  expect(stored().customAttributes[0].value).toBe(MAX_CUSTOM_ATTRIBUTE_VALUE)
  expect(stored().customAttributes[1].value).toBe(MIN_CUSTOM_ATTRIBUTE_VALUE)
})

test('steppers do not appear without the per-attribute option', () => {
  renderStats(makePc({ customAttributes: [makeAttribute()] }))

  expect(screen.queryByRole('button', { name: /Increase/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Decrease/ })).toBeNull()
})

// ---- Edit mode: add, edit, delete -----------------------------------------

test('edit mode puts Add Attribute beside Add Resource Bar', () => {
  const { container } = renderStats(makePc(), 'edit')

  const row = container.querySelector('.stat-bars-add')!
  expect(
    within(row as HTMLElement).getByRole('button', {
      name: '+ Add Resource Bar',
    }),
  ).toBeInTheDocument()
  expect(
    within(row as HTMLElement).getByRole('button', { name: '+ Add Attribute' }),
  ).toBeInTheDocument()
})

test('the Add Attribute modal captures name, value, shorthand and steppers', () => {
  renderStats(makePc(), 'edit')

  fireEvent.click(screen.getByRole('button', { name: '+ Add Attribute' }))
  const dialog = screen.getByRole('dialog', { name: 'Add Attribute' })
  const form = within(dialog)

  fireEvent.change(form.getByLabelText('Name'), {
    target: { value: 'Sanity' },
  })
  fireEvent.change(form.getByLabelText('Value'), { target: { value: '7' } })
  fireEvent.change(form.getByLabelText(/Shorthand/), {
    target: { value: 'SAN' },
  })
  fireEvent.click(form.getByLabelText(/Show \+\/− steppers/))
  fireEvent.click(form.getByRole('button', { name: 'Add Attribute' }))

  expect(screen.queryByRole('dialog')).toBeNull()
  const attributes = stored().customAttributes
  expect(attributes).toHaveLength(1)
  expect(attributes[0]).toMatchObject({
    name: 'Sanity',
    value: 7,
    shorthand: 'SAN',
    showSteppers: true,
  })
  expect(attributes[0].id).toBeTruthy()
})

test('the modal previews the notation token a roll will use', () => {
  renderStats(makePc(), 'edit')

  fireEvent.click(screen.getByRole('button', { name: '+ Add Attribute' }))
  const dialog = screen.getByRole('dialog', { name: 'Add Attribute' })

  fireEvent.change(within(dialog).getByLabelText('Name'), {
    target: { value: 'Sanity' },
  })
  expect(dialog.textContent).toContain('2d6+Sanity')

  fireEvent.change(within(dialog).getByLabelText(/Shorthand/), {
    target: { value: 'SAN' },
  })
  expect(dialog.textContent).toContain('2d6+SAN')
})

test('a nameless attribute cannot be saved', () => {
  renderStats(makePc(), 'edit')

  fireEvent.click(screen.getByRole('button', { name: '+ Add Attribute' }))
  const dialog = screen.getByRole('dialog', { name: 'Add Attribute' })

  expect(
    within(dialog).getByRole('button', { name: 'Add Attribute' }),
  ).toBeDisabled()
})

test('the value is editable inline in edit mode', () => {
  renderStats(makePc({ customAttributes: [makeAttribute()] }), 'edit')

  const input = screen.getByLabelText('Martial value')
  fireEvent.change(input, { target: { value: '9' } })

  expect(stored().customAttributes[0].value).toBe(9)
})

test('a negative value can be typed inline, and a mid-edit empty field writes nothing', () => {
  renderStats(makePc({ customAttributes: [makeAttribute({ value: 3 })] }), 'edit')

  const input = screen.getByLabelText('Martial value')
  // A lone "-" reads as an empty number input: it must not become a 0, or the
  // "3" typed next would land as "03".
  fireEvent.change(input, { target: { value: '' } })
  expect(input).toHaveValue(null)
  expect(stored().customAttributes[0].value).toBe(3)

  fireEvent.change(input, { target: { value: '-3' } })
  expect(stored().customAttributes[0].value).toBe(-3)

  // Leaving the field drops the draft and re-reads the stored number.
  fireEvent.blur(input)
  expect(input).toHaveValue(-3)
})

test('the edit modal is prefilled and saves in place', () => {
  renderStats(
    makePc({ customAttributes: [makeAttribute({ showSteppers: true })] }),
    'edit',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Edit Martial' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit Attribute' })
  const form = within(dialog)

  expect(form.getByLabelText('Name')).toHaveValue('Martial')
  expect(form.getByLabelText('Value')).toHaveValue(3)
  expect(form.getByLabelText(/Shorthand/)).toHaveValue('MAR')
  expect(form.getByLabelText(/Show \+\/− steppers/)).toBeChecked()

  fireEvent.change(form.getByLabelText('Name'), {
    target: { value: 'Martial Arts' },
  })
  fireEvent.click(form.getByRole('button', { name: 'Save' }))

  const attributes = stored().customAttributes
  expect(attributes).toHaveLength(1)
  expect(attributes[0]).toMatchObject({
    id: 'ca-1',
    name: 'Martial Arts',
    value: 3,
  })
})

test('deleting an attribute asks for confirmation first', () => {
  renderStats(makePc({ customAttributes: [makeAttribute()] }), 'edit')

  fireEvent.click(screen.getByRole('button', { name: 'Edit Martial' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete Attribute' }))

  const confirm = screen.getByRole('dialog', { name: 'Remove Attribute?' })
  expect(confirm.textContent).toContain('Martial')
  // Nothing is removed until the confirmation is answered.
  expect(stored().customAttributes).toHaveLength(1)

  fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }))
  expect(stored().customAttributes).toHaveLength(0)
})
