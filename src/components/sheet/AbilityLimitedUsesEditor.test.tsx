/**
 * Component tests for the limited-uses controls in the Ability Block editor.
 *
 * The editor is a pure form: these tests drive it and assert what it hands to
 * `onSave` — the toggle seeding a budget, the max-uses input clamping, the
 * "spends a use on activate" opt-in, and the key being dropped entirely when
 * the ability is switched back to unlimited.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import AbilityBlockEditor, {
  blankAbility,
} from '@/components/sheet/AbilityBlockEditor'
import type { AbilityBlock } from '@/types'

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ currentCharacter: { customResourceBars: [] } }),
}))

vi.mock('@/store/statusStore', () => ({
  useStatusStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ statuses: [], openStatus: vi.fn(), closeStatus: vi.fn() }),
}))

function renderEditor(ability: AbilityBlock = blankAbility()) {
  const onSave = vi.fn()
  render(
    <AbilityBlockEditor ability={ability} onSave={onSave} onCancel={vi.fn()} />,
  )
  return onSave
}

/** Save the form and return the ability the editor handed to `onSave`. */
function save(onSave: ReturnType<typeof vi.fn>): AbilityBlock {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledTimes(1)
  return onSave.mock.calls[0][0] as AbilityBlock
}

const limitedToggle = () => screen.getByRole('checkbox', { name: 'Limited uses' })
const maxUsesInput = () => screen.getByLabelText('Max uses')
const expendToggle = () =>
  screen.getByRole('checkbox', { name: 'Spends one use when activated' })

test('an unlimited ability saves without a uses budget', () => {
  const onSave = renderEditor()

  expect(limitedToggle()).not.toBeChecked()
  expect(screen.queryByLabelText('Max uses')).toBeNull()

  expect(save(onSave).uses).toBeUndefined()
})

test('toggling Limited uses on seeds a budget and reveals the controls', () => {
  const onSave = renderEditor()

  fireEvent.click(limitedToggle())

  expect(limitedToggle()).toBeChecked()
  expect(maxUsesInput()).toHaveValue(3)
  expect(expendToggle()).toBeChecked()

  expect(save(onSave).uses).toEqual({
    max: 3,
    current: 3,
    expendOnActivate: true,
  })
})

test('setting the max-uses redefines the whole budget', () => {
  const onSave = renderEditor()

  fireEvent.click(limitedToggle())
  fireEvent.change(maxUsesInput(), { target: { value: '8' } })

  // The authored maximum is the budget: a fresh ability starts full at whatever
  // number the author lands on, rather than keeping the seeded 3 in hand.
  expect(save(onSave).uses).toEqual({
    max: 8,
    current: 8,
    expendOnActivate: true,
  })
})

test('a cleared max-uses input keeps the last valid value', () => {
  const onSave = renderEditor()

  fireEvent.click(limitedToggle())
  fireEvent.change(maxUsesInput(), { target: { value: '' } })
  fireEvent.change(maxUsesInput(), { target: { value: '4' } })

  expect(save(onSave).uses?.max).toBe(4)
})

test('the max is clamped to at least 1 and at most the ceiling', () => {
  const onSave = renderEditor()

  fireEvent.click(limitedToggle())
  fireEvent.change(maxUsesInput(), { target: { value: '0' } })
  expect(save(onSave).uses?.max).toBe(1)

  onSave.mockClear()
  fireEvent.change(maxUsesInput(), { target: { value: '500' } })
  expect(save(onSave).uses?.max).toBe(99)
})

test('unchecking the spends-a-use box is saved', () => {
  const onSave = renderEditor()

  fireEvent.click(limitedToggle())
  fireEvent.click(expendToggle())

  expect(save(onSave).uses).toEqual({
    max: 3,
    current: 3,
    expendOnActivate: false,
  })
})

test('an edited ability keeps its remaining uses when other fields change', () => {
  const ability: AbilityBlock = {
    ...blankAbility(),
    name: 'Frost Nova',
    uses: { max: 5, current: 2, expendOnActivate: true },
  }
  const onSave = renderEditor(ability)

  expect(maxUsesInput()).toHaveValue(5)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Frost Nova II' } })

  const saved = save(onSave)
  expect(saved.name).toBe('Frost Nova II')
  expect(saved.uses).toEqual({ max: 5, current: 2, expendOnActivate: true })
})

test('lowering the max pulls the remaining uses down with it', () => {
  const ability: AbilityBlock = {
    ...blankAbility(),
    uses: { max: 5, current: 1, expendOnActivate: true },
  }
  const onSave = renderEditor(ability)

  // A budget can never be smaller than the uses still in hand, so the meter
  // can't read "3 of 2".
  fireEvent.change(maxUsesInput(), { target: { value: '2' } })
  expect(save(onSave).uses?.current).toBe(2)

  onSave.mockClear()
  // Going the other way re-budgets the ability: the author's number is the cap.
  expect(ability.uses).toEqual({ max: 5, current: 1, expendOnActivate: true })
})

test('toggling Limited uses back off drops the budget', () => {
  const ability: AbilityBlock = {
    ...blankAbility(),
    uses: { max: 4, current: 1, expendOnActivate: true },
  }
  const onSave = renderEditor(ability)

  fireEvent.click(limitedToggle())

  const saved = save(onSave)
  expect(saved.uses).toBeUndefined()
  expect('uses' in saved).toBe(false)
})
