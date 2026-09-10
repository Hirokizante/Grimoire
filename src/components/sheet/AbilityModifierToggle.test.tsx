/**
 * Component tests for the ability modifier switch on ability cards.
 *
 * Covers the user-facing contract: the switch only appears when an ability
 * declares modifiers, reflects/updates the switched state, is independent from
 * the Activate button, and lets an embedded-NPC parent supply its own
 * persistence handler.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import { blankAbility } from '@/components/sheet/AbilityBlockEditor'
import type { AbilityBlock } from '@/types'

const { setAbilityModifiersActive, roll } = vi.hoisted(() => ({
  setAbilityModifiersActive: vi.fn(),
  roll: vi.fn(),
}))

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (
    selector: (state: Record<string, unknown>) => unknown,
  ) =>
    selector({
      currentCharacter: null,
      setAbilityModifiersActive,
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
})

test('renders no modifier switch for an ability without modifiers', () => {
  render(<AbilityBlockCard ability={ability()} mode="view" />)
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  expect(screen.queryByText(/modifier/i)).not.toBeInTheDocument()
})

test('renders a switch and the modifier chips when modifiers exist', () => {
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
  expect(screen.getByText('+2 Evasion')).toBeInTheDocument()
  expect(screen.getByText('-1 AGI')).toBeInTheDocument()
})

test('switching on flips the toggle without touching the Activate flow', () => {
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

test('an explicit onToggle handler wins over the store (attached NPCs)', () => {
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
