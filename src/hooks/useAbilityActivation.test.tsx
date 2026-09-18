/**
 * Activation tests for the shared Activate path.
 *
 * `useAbilityActivation` is the ONE activation implementation behind the player
 * sheet's cards, a nested Sub-Ability's button, and a GM Screen panel (a player
 * panel through the store, an NPC instance through its own resource adapter).
 * These tests pin what pressing Activate does beyond spending resources: the
 * automatic rolls happen, in the authored order, and land together in the dice
 * result modal — for a player sheet and for a GM panel's instance alike. A
 * blocked activation must roll nothing at all.
 */

import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import SubAbilityBlock from '@/components/sheet/SubAbilityBlock'
import DiceResultModal from '@/components/dice/DiceResultModal'
import { NotificationProvider } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { useDiceRollStore } from '@/store/diceRollStore'
import { createDefaultCharacter } from '@/constants/gameData'
import { blankAbility } from '@/components/sheet/AbilityBlockEditor'
import type { AbilityActivationResources } from '@/hooks/useAbilityActivation'
import type { AbilityBlock, Character } from '@/types'

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  getAllCharacters: vi.fn(async () => Array.from(dbMap.values())),
  getAllStatuses: vi.fn(async () => []),
  getAllScreens: vi.fn(async () => []),
  getAllVersionSnapshots: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  putCharacter: vi.fn(async () => {}),
  putRollLogEntry: vi.fn(async () => {}),
  replaceAllData: vi.fn(async () => {}),
}))

vi.mock('@/store/rollLogStore', () => ({
  useRollLogStore: { getState: () => ({ logRoll: vi.fn() }) },
}))

/** Deterministic dice, in the order the roll happens (empty = max faces). */
const rollQueue: number[] = []
vi.mock('@/lib/dice', () => ({
  rollDie: (sides: number) => rollQueue.shift() ?? sides,
}))

/** A player with known stats and plenty of resources. */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    ...createDefaultCharacter(),
    id: 'char-1',
    name: 'Vera',
    currentAP: 3,
    attributes: { MAR: 4, POW: 2, AGI: 1, VIT: 3, GRT: 0 },
    ...overrides,
  }
}

/** An ability that rolls accuracy, damage and one custom roll. */
function makeRolling(overrides: Partial<AbilityBlock> = {}): AbilityBlock {
  return {
    ...blankAbility(),
    id: 'ab-1',
    name: 'Cleave',
    cost: { ap: 1 },
    damage: '2d6',
    activationRolls: {
      accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
      damage: true,
      custom: [{ notation: '1d4', label: 'Bleed' }],
    },
    ...overrides,
  }
}

/** The activation's own live region — the toast stack shares the `status` role. */
function activationGroup(): HTMLElement {
  return screen.getByRole('status', { name: /activation rolls for/i })
}

/** The whole activation surface, plus the modal it opens. */
function renderActivation(ability: AbilityBlock, character: Character) {
  render(
    <NotificationProvider>
      <AbilityActivation ability={ability} character={character} />
      <DiceResultModal onClose={() => useDiceRollStore.getState().dismiss()} />
    </NotificationProvider>,
  )
}

beforeEach(() => {
  dbMap.clear()
  rollQueue.length = 0
  const character = makeCharacter()
  useCharacterStore.setState({
    characters: [character],
    currentCharacter: character,
  })
  useDiceRollStore.setState({
    isVisible: false,
    result: null,
    notation: '',
    source: null,
    ability: null,
    rollCharacter: null,
    activation: null,
  })
})

test('activating a player ability rolls accuracy, damage and custom together', () => {
  const character = makeCharacter()
  // d20 = 15, 2d6 = 3 + 4, 1d4 = 2.
  rollQueue.push(15, 3, 4, 2)

  renderActivation(makeRolling(), character)
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  // The cost was still spent, exactly as before this feature.
  expect(useCharacterStore.getState().currentCharacter?.currentAP).toBe(2)

  // And all three rolls are on screen at once, each with its working shown:
  // d20(15) + MAR(4) = 19, 2d6(3, 4) = 7, 1d4(2) = 2.
  const cards = within(activationGroup()).getAllByRole('article')
  expect(cards).toHaveLength(3)
  expect(within(cards[0]).getByText('d20+MAR → 15 + 4 = 19')).toBeInTheDocument()
  expect(within(cards[1]).getByText('2d6 → 3 + 4 = 7')).toBeInTheDocument()
  expect(within(cards[2]).getByText('Bleed')).toBeInTheDocument()
  expect(within(cards[2]).getByText('1d4 → 2 = 2')).toBeInTheDocument()
})

test('a fresh character’s Basic Attack rolls accuracy and damage on activation', () => {
  // Every character — player and NPC alike — is born with a Basic Attack
  // (`createDefaultBasicAttack`), and it ships configured to roll itself: the
  // Core Ability card's Activate button opens the result window like any other
  // authored attack, with the attack check and its damage together.
  const character = makeCharacter()
  useCharacterStore.setState({ characters: [character], currentCharacter: character })
  // d20 = 18 → 22, a critical hit; the damage 1d6 is rolled twice — 5 and the
  // mock's empty-queue max face (6) — and the higher 6 + MAR(4) = 10 is kept.
  rollQueue.push(18, 5)

  renderActivation(character.basicAttack, character)
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  expect(useCharacterStore.getState().currentCharacter?.currentAP).toBe(2)
  const cards = within(activationGroup()).getAllByRole('article')
  expect(cards).toHaveLength(2)
  expect(within(cards[0]).getByText('Accuracy')).toBeInTheDocument()
  expect(within(cards[0]).getByText('d20+MAR → 18 + 4 = 22')).toBeInTheDocument()
  expect(within(cards[1]).getByText('Damage')).toBeInTheDocument()
  expect(within(cards[1]).getByText('✦ CRIT')).toBeInTheDocument()
  expect(within(cards[1]).getByText('1d6 + MAR → 6 + 4 = 10')).toBeInTheDocument()
})

test('a sub-ability activates and rolls on its own', () => {
  const character = makeCharacter()
  const sub = makeRolling({ id: 'sub-1', name: 'Riposte', cost: { ap: 1 } })
  // Accuracy d20 = 11 → 11 + MAR(4) = 15; damage 2d6 = 5 + 5 = 10; 1d4 = 3.
  rollQueue.push(11, 5, 5, 3)

  render(
    <NotificationProvider>
      <SubAbilityBlock ability={sub} character={character} />
      <DiceResultModal onClose={() => useDiceRollStore.getState().dismiss()} />
    </NotificationProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  expect(useCharacterStore.getState().currentCharacter?.currentAP).toBe(2)
  const cards = within(activationGroup()).getAllByRole('article')
  expect(within(cards[0]).getByText('d20+MAR → 11 + 4 = 15')).toBeInTheDocument()
  expect(within(cards[1]).getByText('2d6 → 5 + 5 = 10')).toBeInTheDocument()
  expect(within(cards[2]).getByText('1d4 → 3 = 3')).toBeInTheDocument()
})

test('a GM panel instance rolls against its own adapter and stats', () => {
  // The instance is NOT a store character: its AP lives on the panel, so the
  // activation is handed a resource adapter. The rolls must resolve against the
  // entity the panel passes — not the store's current character.
  const player = makeCharacter()
  const bandit = makeCharacter({
    id: 'npc-1',
    kind: 'npc',
    name: 'Bandit',
    attributes: { MAR: 2, POW: 0, AGI: 0, VIT: 0, GRT: 0 },
  })
  useCharacterStore.setState({ characters: [player], currentCharacter: player })

  let ap = 3
  const resources: AbilityActivationResources = {
    ap,
    end: null,
    fp: null,
    customBars: [],
    spendAP: (amount) => {
      if (ap < amount) return false
      ap -= amount
      return true
    },
    spendEND: () => false,
    spendFP: () => false,
    spendCustom: () => false,
    spendUse: () => false,
  }

  // d20 = 10 → 12 with the instance's MAR(2); 2d6 = 1 + 1; 1d4 = 4.
  rollQueue.push(10, 1, 1, 4)

  render(
    <NotificationProvider>
      <AbilityActivation
        ability={makeRolling()}
        character={bandit}
        activateOverride={() => ({ options: { resources } })}
      />
      <DiceResultModal onClose={() => useDiceRollStore.getState().dismiss()} />
    </NotificationProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  // The instance's own AP was spent, and the player's sheet was untouched.
  expect(ap).toBe(2)
  expect(useCharacterStore.getState().currentCharacter?.currentAP).toBe(3)

  // The accuracy total proves which entity resolved the notation: 10 + 2, not
  // 10 + the player's MAR (4).
  const group = activationGroup()
  const cards = within(group).getAllByRole('article')
  expect(within(cards[0]).getByText('d20+MAR → 10 + 2 = 12')).toBeInTheDocument()
})

test('a blocked activation rolls nothing and opens no modal', () => {
  // No AP: the button is disabled, and nothing is rolled.
  const broke = makeCharacter({ currentAP: 0 })
  useCharacterStore.setState({ characters: [broke], currentCharacter: broke })

  renderActivation(makeRolling(), broke)

  expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled()
  expect(useDiceRollStore.getState().activation).toBeNull()
  expect(useDiceRollStore.getState().isVisible).toBe(false)
})

test('an ability with no rolls configured activates without opening the modal', () => {
  const character = makeCharacter()
  renderActivation(makeRolling({ activationRolls: undefined }), character)

  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  expect(useCharacterStore.getState().currentCharacter?.currentAP).toBe(2)
  expect(useDiceRollStore.getState().isVisible).toBe(false)
})

test('damage switched on with an empty damage field rolls only what exists', () => {
  const character = makeCharacter()
  rollQueue.push(7)
  const ability = makeRolling({
    damage: '',
    activationRolls: {
      accuracy: { modifier: { kind: 'attribute', key: 'MAR' } },
      damage: true,
    },
  })

  renderActivation(ability, character)
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  const cards = within(activationGroup()).getAllByRole('article')
  expect(cards).toHaveLength(1)
  expect(within(cards[0]).getByText('Accuracy')).toBeInTheDocument()
  expect(within(cards[0]).getByText('d20+MAR → 7 + 4 = 11')).toBeInTheDocument()
})

test('a limited ability spends its use AND rolls', () => {
  const ability = makeRolling({
    uses: { max: 2, current: 2, expendOnActivate: true },
  })
  // The card renders the character's own copy of the ability, so the sheet has
  // to hold it for the spent use to land anywhere.
  const character = makeCharacter({ slottedAbilities: [ability] })
  useCharacterStore.setState({ characters: [character], currentCharacter: character })
  rollQueue.push(4, 1, 1, 1)

  renderActivation(ability, character)
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  const stored = useCharacterStore.getState().currentCharacter
  expect(stored?.currentAP).toBe(2)
  expect(stored?.slottedAbilities[0].uses?.current).toBe(1)
  // …and the rolls still happened.
  expect(within(activationGroup()).getAllByRole('article')).toHaveLength(3)
})
