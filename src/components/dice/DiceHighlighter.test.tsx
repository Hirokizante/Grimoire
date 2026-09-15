/**
 * DiceHighlighter — a sheet's own custom attributes are part of the scanned
 * notation vocabulary.
 *
 * The feature's whole point is that a homebrew stat can drive a roll from prose:
 * `1d6+SAN` in an ability description has to highlight as one token, roll as
 * `+SAN(5)`, and leave the words after it alone. These tests pin that end to
 * end (detection → click → evaluated result), plus the unchanged behavior for
 * a sheet with no such attribute.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import DiceHighlighter from '@/components/dice/DiceHighlighter'
import { createDefaultCharacter } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import type { Character, CustomAttribute } from '@/types'

vi.mock('@/lib/db', () => ({
  getAllCharacters: vi.fn(async () => []),
  getCharacter: vi.fn(async () => null),
  putCharacter: vi.fn(async () => {}),
  deleteCharacter: vi.fn(async () => {}),
  putRollLogEntry: vi.fn(async () => {}),
  getRollLogForCharacter: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  deleteRollLogEntry: vi.fn(async () => {}),
  clearRollLogForCharacter: vi.fn(async () => {}),
  putVersionSnapshot: vi.fn(async () => {}),
  getVersionHistory: vi.fn(async () => []),
  deleteVersionSnapshot: vi.fn(async () => {}),
  normalizeCharacter: (c: Character) => c,
  stripLabels: ({ labels: _l, ...rest }: Character) => rest as Character,
  getAllStatuses: vi.fn(async () => []),
  getAllScreens: vi.fn(async () => []),
  getAllVersionSnapshots: vi.fn(async () => []),
  replaceAllData: vi.fn(async () => {}),
  normalizeStatus: (s: unknown) => s,
  normalizeScreen: (s: unknown) => s,
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

function makeCharacter(customAttributes: CustomAttribute[]): Character {
  return {
    ...createDefaultCharacter(),
    id: 'pc-1',
    name: 'Vex',
    customAttributes,
  }
}

const SANITY: CustomAttribute = {
  id: 'ca-1',
  name: 'Sanity',
  value: 5,
  shorthand: 'SAN',
  showSteppers: false,
}

test('a custom shorthand highlights as one token and rolls its own value', () => {
  const character = makeCharacter([SANITY])
  render(
    <DiceHighlighter
      text="Deal 1d6+SAN psychic damage"
      mode="view"
      character={character}
    />,
  )

  const token = screen.getByRole('button', { name: '1d6+SAN' })
  fireEvent.click(token)

  const roll = useDiceRollStore.getState()
  expect(roll.notation).toBe('1d6+SAN')
  // The token resolved through the sheet's custom attribute, not as an unknown
  // variable (which would read `+SAN(?)` and count 0).
  const variable = roll.result!.terms[1]
  expect(variable.label).toBe('+SAN(5)')
  expect(variable.value).toBe(5)
  expect(roll.result!.total).toBe(roll.result!.terms[0].value + 5)
})

test('a custom attribute resolves by its full name too', () => {
  const character = makeCharacter([{ ...SANITY, shorthand: '' }])
  render(
    <DiceHighlighter text="1d6+Sanity" mode="view" character={character} />,
  )

  fireEvent.click(screen.getByRole('button', { name: '1d6+Sanity' }))

  expect(useDiceRollStore.getState().result!.terms[1].label).toBe('+Sanity(5)')
})

test('the token ends before trailing prose', () => {
  const character = makeCharacter([SANITY])
  render(
    <DiceHighlighter
      text="Deal 1d6+SAN psychic damage"
      mode="view"
      character={character}
    />,
  )

  expect(screen.queryByRole('button', { name: /psychic/ })).toBeNull()
  expect(screen.getByText(/psychic damage/)).toBeInTheDocument()
})

test('a sheet without the attribute keeps the old free-form match', () => {
  render(
    <DiceHighlighter
      text="Deal 1d6+SAN psychic damage"
      mode="view"
      character={makeCharacter([])}
    />,
  )

  // With no vocabulary to stop at, the permissive word branch takes the whole
  // run as one unknown variable (its value counts as 0) — the pre-feature
  // behavior, unchanged for sheets that define no custom attributes.
  fireEvent.click(screen.getByRole('button', { name: /^1d6\+SAN/ }))
  expect(useDiceRollStore.getState().result!.terms[1].label).toBe(
    'SAN psychic damage(?)',
  )
})

test('a built-in attribute roll is unaffected', () => {
  const character = makeCharacter([SANITY])
  render(
    <DiceHighlighter text="Roll 1d6+POW now" mode="view" character={character} />,
  )

  fireEvent.click(screen.getByRole('button', { name: '1d6+POW' }))
  expect(useDiceRollStore.getState().result!.terms[1].label).toBe(
    `+POW(${character.attributes.POW})`,
  )
})
