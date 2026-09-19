/**
 * AbilityBlockCard tests for the capture control.
 *
 * Every ability block (and each nested sub-ability) can be snapshotted, but
 * only in view mode — an edit-mode card's footer is authoring chrome, not part
 * of the ability — and each button targets its own block, never an ancestor.
 */

import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (
    selector: (state: Record<string, unknown>) => unknown,
  ) =>
    selector({
      currentCharacter: null,
      setAbilityModifiersActive: vi.fn(),
      setAbilityUsesRemaining: vi.fn(),
    }),
}))

vi.mock('@/store/diceRollStore', () => ({
  useDiceRollStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ roll: vi.fn() }),
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

import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import SubAbilityBlock from '@/components/sheet/SubAbilityBlock'
import { blankAbility } from '@/components/sheet/AbilityBlockEditor'
import { CAPTURE_HIDE_ATTRIBUTE } from '@/lib/elementCapture'
import type { AbilityBlock } from '@/types'

function ability(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return { ...blankAbility(), name: 'Battle Focus', ...overrides }
}

test('a view-mode ability card offers a capture button for the card itself', () => {
  render(<AbilityBlockCard ability={ability()} mode="view" />)

  const button = screen.getByRole('button', { name: 'Copy ability image' })
  expect(button).toHaveAttribute(CAPTURE_HIDE_ATTRIBUTE)
  expect(button.closest('.ability-card')).not.toBeNull()
})

test('an edit-mode ability card has no capture button', () => {
  render(<AbilityBlockCard ability={ability()} mode="edit" />)

  expect(screen.queryByRole('button', { name: 'Copy ability image' })).toBeNull()
})

test('a sub-ability gets its own capture button, targeting the sub-block', () => {
  const sub = { ...ability({ name: 'Follow Through' }), id: 'sub-1' }
  render(
    <AbilityBlockCard
      ability={ability({ subAbilitiesUnderDescription: [sub] })}
      mode="view"
    />,
  )

  const button = screen.getByRole('button', { name: 'Copy sub-ability image' })
  expect(button.closest('.sub-ability-block')).not.toBeNull()
})

test('a sub-ability in edit mode has no capture button of its own', () => {
  const sub = { ...ability({ name: 'Follow Through' }), id: 'sub-1' }
  render(<SubAbilityBlock ability={sub} mode="edit" />)

  expect(screen.queryByRole('button', { name: 'Copy sub-ability image' })).toBeNull()
})
