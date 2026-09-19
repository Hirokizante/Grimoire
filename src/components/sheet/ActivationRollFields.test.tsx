/**
 * Component tests for the "Roll Dice on Activation" section of the Ability
 * Block editor.
 *
 * The editor is a pure form, so these tests drive it and assert what it hands
 * to `onSave`: the feature toggle seeding an accuracy roll, the attribute and
 * custom-attribute pickers, the damage opt-in, the custom roll rows, and the
 * key being dropped entirely when the feature is switched back off.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import AbilityBlockEditor, {
  blankAbility,
} from '@/components/sheet/AbilityBlockEditor'
import { createDefaultCharacter } from '@/constants/gameData'
import type { AbilityBlock, Character } from '@/types'

/**
 * The sheet the editor reads its Attributes and custom attributes from.
 * Hoisted because the store mock below is, and mutable because some tests need
 * a sheet with no custom attributes at all.
 */
const { state } = vi.hoisted(() => ({
  state: {
    character: null as unknown as Character,
  },
}))

/** The sheet the editor reads its Attributes and custom attributes from. */
const owner: Character = {
  ...createDefaultCharacter(),
  id: 'char-1',
  name: 'Vera',
  kind: 'character',
  attributes: { MAR: 4, POW: 2, AGI: 1, VIT: 3, GRT: 0 },
  customAttributes: [
    {
      id: 'attr-san',
      name: 'Sanity',
      shorthand: 'SAN',
      value: 7,
      showSteppers: false,
    },
  ],
}

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ currentCharacter: state.character }),
}))

vi.mock('@/store/statusStore', () => ({
  useStatusStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ statuses: [], openStatus: vi.fn(), closeStatus: vi.fn() }),
}))

beforeEach(() => {
  state.character = owner
})

function renderEditor(
  ability: AbilityBlock = blankAbility(),
  opts: { npcMode?: boolean; character?: Character } = {},
) {
  const onSave = vi.fn()
  render(
    <AbilityBlockEditor
      ability={ability}
      onSave={onSave}
      onCancel={vi.fn()}
      character={opts.character ?? owner}
      npcMode={opts.npcMode}
    />,
  )
  return onSave
}

/** Save the form and return the ability the editor handed to `onSave`. */
function save(onSave: ReturnType<typeof vi.fn>): AbilityBlock {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledTimes(1)
  return onSave.mock.calls[0][0] as AbilityBlock
}

const featureToggle = () =>
  screen.getByRole('checkbox', { name: 'Roll Dice on Activation' })
const accuracyToggle = () => screen.getByRole('checkbox', { name: 'Roll accuracy' })
const damageToggle = () => screen.getByRole('checkbox', { name: 'Roll damage' })
const accuracyPicker = () =>
  screen.getByRole('button', { name: /accuracy attribute/i })

test('an ability that rolls nothing on activation saves without the key', () => {
  const onSave = renderEditor()

  expect(featureToggle()).not.toBeChecked()
  expect(screen.queryByRole('checkbox', { name: 'Roll accuracy' })).toBeNull()

  const saved = save(onSave)
  expect(saved.activationRolls).toBeUndefined()
  expect('activationRolls' in saved).toBe(false)
})

test('toggling the feature on seeds an accuracy roll', () => {
  const onSave = renderEditor()

  fireEvent.click(featureToggle())

  expect(accuracyToggle()).toBeChecked()
  expect(accuracyPicker()).toHaveTextContent(/d20 \+ MAR/i)
  // The sheet's own value is spelled out, so the author sees what will be added.
  expect(screen.getByText(/adds \+4 from MAR/i)).toBeInTheDocument()

  expect(save(onSave).activationRolls).toEqual({
    accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
  })
})

test('the accuracy attribute can be changed to another Attribute', () => {
  const onSave = renderEditor()
  fireEvent.click(featureToggle())

  fireEvent.click(accuracyPicker())
  fireEvent.click(screen.getByRole('button', { name: 'Power (POW)' }))

  expect(accuracyPicker()).toHaveTextContent(/d20 \+ POW/i)
  expect(save(onSave).activationRolls?.accuracy?.modifier).toEqual({
    kind: 'attribute',
    key: 'POW',
  })
})

test('the accuracy picker lists the sheet’s custom attributes beside the Attributes', () => {
  const twoAttributes = {
    ...owner,
    customAttributes: [
      { id: 'attr-san', name: 'Sanity', shorthand: 'SAN', value: 7, showSteppers: false },
      { id: 'attr-luck', name: 'Luck', shorthand: 'LCK', value: 2, showSteppers: false },
    ],
  }
  const onSave = renderEditor(blankAbility(), { character: twoAttributes })
  fireEvent.click(featureToggle())

  fireEvent.click(accuracyPicker())
  const panel = screen.getByRole('dialog', { name: 'Add which attribute?' })

  // Both lists are in the one picker: the five Attributes, then the sheet's own.
  expect(within(panel).getByRole('button', { name: 'Martial (MAR)' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Sanity (SAN)' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Luck (LCK)' })).toBeInTheDocument()

  fireEvent.click(within(panel).getByRole('button', { name: 'Sanity (SAN)' }))

  // The trigger and the roll follow the pick — a custom attribute chosen from
  // the same list the Attributes live in, with no dead "Custom attribute…" stop
  // in between.
  expect(accuracyPicker()).toHaveTextContent(/d20 \+ SAN/i)
  expect(screen.getByText(/adds \+7 from SAN/i)).toBeInTheDocument()
  expect(save(onSave).activationRolls?.accuracy?.modifier).toEqual({
    kind: 'custom',
    id: 'attr-san',
    token: 'SAN',
  })
})

test('a sheet with no custom attributes offers only the five Attributes', () => {
  const plain = { ...owner, customAttributes: [] }
  const onSave = renderEditor(blankAbility(), { character: plain })
  fireEvent.click(featureToggle())

  fireEvent.click(accuracyPicker())
  const panel = screen.getByRole('dialog', { name: 'Add which attribute?' })

  expect(within(panel).getAllByRole('listitem')).toHaveLength(5)
  expect(
    within(panel).queryByRole('button', { name: 'Custom attribute…' }),
  ).toBeNull()

  fireEvent.click(within(panel).getByRole('button', { name: 'Agility (AGI)' }))
  expect(save(onSave).activationRolls?.accuracy?.modifier).toEqual({
    kind: 'attribute',
    key: 'AGI',
  })
})

test('an NPC ability editor offers the five Attributes and no custom attribute option', () => {
  const onSave = renderEditor(blankAbility(), { npcMode: true })
  fireEvent.click(featureToggle())

  fireEvent.click(accuracyPicker())

  const panel = screen.getByRole('dialog', { name: 'Add which attribute?' })
  expect(within(panel).getByRole('button', { name: 'Martial (MAR)' })).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: 'Grit (GRT)' })).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Sanity (SAN)' })).toBeNull()
  expect(
    within(panel).queryByRole('button', { name: 'Custom attribute…' }),
  ).toBeNull()
  // No mention of a feature NPCs do not have.
  expect(screen.queryByText(/custom attribute/i)).toBeNull()

  fireEvent.click(within(panel).getByRole('button', { name: 'Power (POW)' }))
  expect(save(onSave).activationRolls?.accuracy?.modifier).toEqual({
    kind: 'attribute',
    key: 'POW',
  })
})

test('an NPC ability that references a custom attribute says so', () => {
  renderEditor(
    {
      ...blankAbility(),
      activationRolls: {
        accuracy: { modifier: { kind: 'custom', id: 'attr-san', token: 'SAN' } },
      },
    },
    { npcMode: true },
  )

  expect(screen.getByText(/NPCs have none/i)).toBeInTheDocument()
})

test('an extra accuracy bonus is stored and included', () => {
  const onSave = renderEditor()
  fireEvent.click(featureToggle())

  fireEvent.change(screen.getByLabelText('Extra accuracy bonus'), {
    target: { value: '+2' },
  })

  expect(save(onSave).activationRolls?.accuracy?.bonus).toBe('+2')
})

test('unchecking accuracy keeps the rest of the config', () => {
  const onSave = renderEditor({
    ...blankAbility(),
    activationRolls: {
      accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
      damage: true,
    },
    damage: '1d6',
  })

  fireEvent.click(accuracyToggle())

  expect(save(onSave).activationRolls).toEqual({ damage: true })
})

test('the damage toggle is offered only once the ability has damage', () => {
  const onSave = renderEditor()
  fireEvent.click(featureToggle())

  // Nothing to roll yet — the box is disabled rather than silently useless.
  expect(damageToggle()).toBeDisabled()
  expect(screen.getByText(/write a Damage expression above/i)).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Damage'), {
    target: { value: '2d6+POW' },
  })

  expect(damageToggle()).toBeEnabled()
  fireEvent.click(damageToggle())
  expect(screen.getByText(/rolls the Damage field: 2d6\+POW/i)).toBeInTheDocument()
  expect(save(onSave).activationRolls?.damage).toBe(true)
})

test('custom rolls can be added, named, hidden and removed', () => {
  const onSave = renderEditor()
  fireEvent.click(featureToggle())

  fireEvent.click(screen.getByRole('button', { name: /add custom roll/i }))
  fireEvent.change(screen.getByLabelText('Custom roll 1 notation'), {
    target: { value: '2d6+POW' },
  })
  fireEvent.change(screen.getByLabelText('Custom roll 1 name'), {
    target: { value: 'Burn' },
  })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Hide result' }))

  fireEvent.click(screen.getByRole('button', { name: /add custom roll/i }))
  fireEvent.change(screen.getByLabelText('Custom roll 2 notation'), {
    target: { value: '1d4' },
  })

  expect(save(onSave).activationRolls?.custom).toEqual([
    { notation: '2d6+POW', label: 'Burn', hidden: true },
    { notation: '1d4' },
  ])

  onSave.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'Remove custom roll 1' }))
  expect(save(onSave).activationRolls?.custom).toEqual([{ notation: '1d4' }])
})

test('removing the last custom roll drops the custom list', () => {
  const onSave = renderEditor()
  fireEvent.click(featureToggle())
  fireEvent.click(screen.getByRole('button', { name: /add custom roll/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove custom roll 1' }))

  expect(save(onSave).activationRolls?.custom).toBeUndefined()
})

test('toggling the feature back off drops the whole config', () => {
  const ability: AbilityBlock = {
    ...blankAbility(),
    damage: '1d6',
    activationRolls: {
      accuracy: { modifier: { kind: 'attribute', key: 'POW' } },
      damage: true,
      custom: [{ notation: '1d4', label: 'Bleed' }],
    },
  }
  const onSave = renderEditor(ability)

  expect(featureToggle()).toBeChecked()
  fireEvent.click(featureToggle())

  const saved = save(onSave)
  expect(saved.activationRolls).toBeUndefined()
  expect('activationRolls' in saved).toBe(false)
})

test('a saved config is re-opened with its rolls intact', () => {
  renderEditor({
    ...blankAbility(),
    damage: '2d6',
    activationRolls: {
      accuracy: { modifier: { kind: 'custom', id: 'attr-san', token: 'SAN' }, bonus: '+1' },
      damage: true,
      custom: [{ notation: '1d4', label: 'Bleed', hidden: true }],
    },
  })

  expect(featureToggle()).toBeChecked()
  expect(accuracyPicker()).toHaveTextContent(/d20 \+ SAN/i)
  expect(screen.getByLabelText('Extra accuracy bonus')).toHaveValue('+1')
  expect(damageToggle()).toBeChecked()
  expect(screen.getByLabelText('Custom roll 1 notation')).toHaveValue('1d4')
  expect(screen.getByLabelText('Custom roll 1 name')).toHaveValue('Bleed')
  expect(screen.getByRole('checkbox', { name: 'Hide result' })).toBeChecked()
})

test('a sub-ability editor offers the same rolls', () => {
  const onSave = vi.fn()
  render(
    <AbilityBlockEditor
      ability={blankAbility()}
      onSave={onSave}
      onCancel={vi.fn()}
      isSubAbility
      character={owner}
    />,
  )

  fireEvent.click(featureToggle())
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Follow-up' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  const saved = onSave.mock.calls[0][0] as AbilityBlock
  expect(saved.name).toBe('Follow-up')
  expect(saved.activationRolls).toEqual({
    accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
  })
})

test('an NPC ability editor offers the rolls too, and never mentions custom attributes', () => {
  // The owner here is a *player* sheet with a custom attribute, so the only
  // reason the NPC editor hides it is the NPC rule itself — an NPC sheet has no
  // custom attributes of its own.
  const npc = {
    ...createDefaultCharacter(),
    id: 'npc-1',
    name: 'Bandit',
    kind: 'npc' as const,
    attributes: { MAR: 4, POW: 2, AGI: 1, VIT: 3, GRT: 0 },
  }
  const onSave = vi.fn()
  render(
    <AbilityBlockEditor
      ability={blankAbility()}
      onSave={onSave}
      onCancel={vi.fn()}
      npcMode
      character={npc}
    />,
  )

  fireEvent.click(featureToggle())

  // The whole editor — not just the picker — is free of the feature.
  expect(screen.queryByText(/custom attribute/i)).toBeNull()
  fireEvent.click(accuracyPicker())
  const panel = screen.getByRole('dialog', { name: 'Add which attribute?' })
  expect(within(panel).queryByRole('button', { name: 'Sanity (SAN)' })).toBeNull()
  fireEvent.click(within(panel).getByRole('button', { name: 'Vitality (VIT)' }))

  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  const saved = onSave.mock.calls[0][0] as AbilityBlock
  expect(saved.activationRolls).toEqual({
    accuracy: { modifier: { kind: 'attribute', key: 'VIT' } },
  })
})

test('the roll rows are offered in the order they roll', () => {
  renderEditor()
  fireEvent.click(featureToggle())

  // Accuracy first, damage second, then the author's own list.
  const order = screen
    .getAllByRole('checkbox')
    .map((box) => box.closest('label')?.textContent ?? '')
    .filter((text) => /roll (accuracy|damage)/i.test(text))
  expect(order).toHaveLength(2)
  expect(order[0]).toMatch(/roll accuracy/i)
  expect(order[1]).toMatch(/roll damage/i)

  // No custom rolls yet — the list is empty and the add button is the whole UI.
  expect(screen.queryByRole('list')).toBeNull()
  expect(
    screen.getByRole('button', { name: /add custom roll/i }),
  ).toBeInTheDocument()
})

// ---- Advantage / Disadvantage -----------------------------------------------

test('an accuracy roll can carry Advantage and Disadvantage', () => {
  const onSave = renderEditor()
  fireEvent.click(featureToggle())

  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Accuracy advantage' }),
    { target: { value: '2' } },
  )
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Accuracy disadvantage' }),
    { target: { value: '1' } },
  )

  expect(save(onSave).activationRolls).toEqual({
    accuracy: {
      modifier: { kind: 'attribute', key: 'MAR' },
      advantage: 2,
      disadvantage: 1,
    },
  })
})

test('an accuracy roll with cleared advantage drops the fields again', () => {
  const onSave = renderEditor({
    ...blankAbility(),
    activationRolls: {
      accuracy: {
        modifier: { kind: 'attribute', key: 'MAR' },
        advantage: 3,
        disadvantage: 1,
      },
    },
  })

  expect(
    screen.getByRole('spinbutton', { name: 'Accuracy advantage' }),
  ).toHaveValue(3)

  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Accuracy advantage' }),
    { target: { value: '' } },
  )
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Accuracy disadvantage' }),
    { target: { value: '' } },
  )

  expect(save(onSave).activationRolls).toEqual({
    accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
  })
})

test('the damage roll offers no Advantage/Disadvantage', () => {
  const onSave = renderEditor({ ...blankAbility(), damage: '2d6' })
  fireEvent.click(featureToggle())
  fireEvent.click(damageToggle())

  expect(screen.queryByRole('spinbutton', { name: 'Damage advantage' })).toBeNull()
  expect(screen.queryByRole('spinbutton', { name: 'Damage disadvantage' })).toBeNull()

  expect(save(onSave).activationRolls?.damage).toBe(true)
})

test('a custom roll can carry Disadvantage', () => {
  const onSave = renderEditor()
  fireEvent.click(featureToggle())
  fireEvent.click(screen.getByRole('button', { name: /add custom roll/i }))

  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Custom roll 1 disadvantage' }),
    { target: { value: '2' } },
  )

  expect(save(onSave).activationRolls?.custom).toEqual([
    { notation: '1d20', disadvantage: 2 },
  ])
})

test('a saved advantage config re-opens with its values intact', () => {
  renderEditor({
    ...blankAbility(),
    damage: '1d6',
    activationRolls: {
      accuracy: {
        modifier: { kind: 'attribute', key: 'MAR' },
        advantage: 2,
        disadvantage: 1,
      },
      damage: true,
      custom: [{ notation: '1d4', advantage: 1 }],
    },
  })

  expect(
    screen.getByRole('spinbutton', { name: 'Accuracy advantage' }),
  ).toHaveValue(2)
  expect(
    screen.getByRole('spinbutton', { name: 'Accuracy disadvantage' }),
  ).toHaveValue(1)
  expect(damageToggle()).toBeChecked()
  expect(
    screen.getByRole('spinbutton', { name: 'Custom roll 1 advantage' }),
  ).toHaveValue(1)
})
