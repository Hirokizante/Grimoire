/**
 * Component tests for the ability modifier switch on ability cards.
 *
 * Covers the user-facing contract: the switch only appears when an ability
 * declares modifiers, reflects/updates the switched state, is independent from
 * the Activate button, and follows the same writer contract as the use steppers
 * — interactive only where something can persist the flip (the store's current
 * player character, or a writer a surface like a GM Screen instance supplies),
 * visible but inert everywhere else.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import { blankAbility } from '@/components/sheet/AbilityBlockEditor'
import { createDefaultCharacter, createDefaultNPC } from '@/constants/gameData'
import type { AbilityBlock, Character } from '@/types'

const { setAbilityModifiersActive, roll, storeRef } = vi.hoisted(() => ({
  setAbilityModifiersActive: vi.fn(),
  roll: vi.fn(),
  /** The mock store's `currentCharacter`, per test. */
  storeRef: { current: null as Character | null },
}))

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (
    selector: (state: Record<string, unknown>) => unknown,
  ) =>
    selector({
      currentCharacter: storeRef.current,
      setAbilityModifiersActive,
      spendAbilityUse: vi.fn(() => false),
    }),
}))

vi.mock('@/store/diceRollStore', () => ({
  useDiceRollStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ roll }),
}))

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

function ability(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return {
    ...blankAbility(),
    name: 'Battle Focus',
    ...overrides,
  }
}

beforeEach(() => {
  setAbilityModifiersActive.mockReset()
  storeRef.current = null
})

test('renders no modifier switch for an ability without modifiers', () => {
  render(<AbilityBlockCard ability={ability()} mode="view" />)
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  expect(screen.queryByText(/modifier/i)).not.toBeInTheDocument()
})

test('renders a switch and the modifier chips when modifiers exist', () => {
  storeRef.current = createDefaultCharacter()
  render(
    <AbilityBlockCard
      ability={ability({
        modifiers: [
          { target: 'evasion', value: 2 },
          { target: 'AGI', value: -1 },
        ],
      })}
      mode="view"
    />,
  )

  const toggle = screen.getByRole('switch', { name: /apply battle focus modifiers/i })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(toggle).toBeEnabled()
  expect(screen.getByText('+2 Evasion')).toBeInTheDocument()
  expect(screen.getByText('-1 AGI')).toBeInTheDocument()
})

test('switching on flips the toggle without touching the Activate flow', () => {
  storeRef.current = createDefaultCharacter()
  render(
    <AbilityBlockCard
      ability={ability({
        modifiers: [{ target: 'evasion', value: 2 }],
        modifiersActive: true,
      })}
      mode="view"
    />,
  )

  const toggle = screen.getByRole('switch')
  expect(toggle).toHaveAttribute('aria-checked', 'true')

  fireEvent.click(toggle)
  expect(setAbilityModifiersActive).toHaveBeenCalledWith(expect.any(String), false)
})

test('an explicit onToggle handler wins over the store (GM panels)', () => {
  storeRef.current = createDefaultCharacter()
  const onToggle = vi.fn()
  render(
    <AbilityBlockCard
      ability={ability({ modifiers: [{ target: 'armor', value: 1 }] })}
      mode="view"
      onToggleModifiers={onToggle}
    />,
  )

  fireEvent.click(screen.getByRole('switch'))
  expect(onToggle).toHaveBeenCalledWith(expect.any(String), true)
  expect(setAbilityModifiersActive).not.toHaveBeenCalled()
})

test('a card that is not the current character renders the switch inert', () => {
  // The store action switches the ability on `currentCharacter`, so a card
  // belonging to anybody else has no writer — the switch must not pretend.
  storeRef.current = createDefaultCharacter()
  const other: Character = { ...createDefaultCharacter(), id: 'someone-else' }
  render(
    <AbilityBlockCard
      ability={ability({ modifiers: [{ target: 'evasion', value: 2 }] })}
      mode="view"
      character={other}
    />,
  )

  const toggle = screen.getByRole('switch')
  expect(toggle).toBeDisabled()
  expect(toggle).toHaveAttribute('title', expect.stringMatching(/in play/i))
  fireEvent.click(toggle)
  expect(setAbilityModifiersActive).not.toHaveBeenCalled()
})

test('an NPC base record keeps its switch visible but inert', () => {
  // A base NPC sheet is a static reference the GM Screen spawns instances from,
  // so its switches are template data: the modifier list and the switch state
  // read, nothing here may flip them — not even though this record is the
  // store's current character (which is what makes a player sheet interactive).
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
  }
  storeRef.current = npc
  render(
    <AbilityBlockCard
      ability={ability({ modifiers: [{ target: 'evasion', value: 2 }] })}
      mode="view"
      character={npc}
    />,
  )

  const toggle = screen.getByRole('switch')
  expect(toggle).toBeDisabled()
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(toggle).toHaveAttribute(
    'title',
    expect.stringMatching(/static references/i),
  )
  expect(screen.getByText('+2 Evasion')).toBeInTheDocument()

  fireEvent.click(toggle)
  expect(setAbilityModifiersActive).not.toHaveBeenCalled()
})

test('edit mode lists the modifiers without a switch', () => {
  render(
    <AbilityBlockCard
      ability={ability({ modifiers: [{ target: 'saveDC', value: 3 }] })}
      mode="edit"
    />,
  )

  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  expect(screen.getByText('+3 Save DC')).toBeInTheDocument()
})
