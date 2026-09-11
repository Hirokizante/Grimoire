/**
 * Component tests for limited-use abilities.
 *
 * Covers the user-facing contract: the uses readout on an ability card (tokens
 * for 5 or fewer uses, a number above), the Activate button spending a use and
 * refusing to activate at 0, the "don't expend on activate" opt-out, and the
 * full restore refilling the budget.
 *
 * The real character store runs here (with IndexedDB mocked, as in
 * characterStore.test.ts) so activation is exercised end to end; the card's
 * dice/status dependencies are the same stubs the other sheet card tests use.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import AbilityActivation from '@/components/sheet/AbilityActivation'
import AbilityBlockCard from '@/components/sheet/AbilityBlockCard'
import { NotificationProvider } from '@/context/NotificationContext'
import { createDefaultCharacter } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import { abilityUsesRemaining } from '@/lib/abilityUses'
import type { AbilityBlock, Character } from '@/types'

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

vi.mock('@/lib/db', () => ({
  getAllCharacters: vi.fn(async () => Array.from(dbMap.values())),
  getCharacter: vi.fn(async (id: string) => dbMap.get(id) ?? null),
  putCharacter: vi.fn(async (char: Character) => {
    dbMap.set(char.id, char)
  }),
  deleteCharacter: vi.fn(async () => {}),
  putVersionSnapshot: vi.fn(async () => {}),
  getVersionHistory: vi.fn(async () => []),
  deleteVersionSnapshot: vi.fn(async () => {}),
  getAllVersionSnapshots: vi.fn(async () => []),
  putRollLogEntry: vi.fn(async () => {}),
  getRollLogForCharacter: vi.fn(async () => []),
  getAllRollLogEntries: vi.fn(async () => []),
  deleteRollLogEntry: vi.fn(async () => {}),
  clearRollLogForCharacter: vi.fn(async () => {}),
  normalizeCharacter: (char: Character) => char,
  stripLabels: ({ labels: _labels, ...rest }: Character) => rest as Character,
  getAllStatuses: vi.fn(async () => []),
  getStatus: vi.fn(async () => null),
  putStatus: vi.fn(async () => {}),
  deleteStatus: vi.fn(async () => {}),
  normalizeStatus: (s: unknown) => s,
  replaceAllData: vi.fn(async () => {}),
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

/** A limited ability with `max` uses, `current` left, and an Activate button. */
function limitedAbility(
  current: number,
  max: number,
  overrides: Partial<AbilityBlock> = {},
): AbilityBlock {
  return {
    id: 'ability-1',
    name: 'Frost Nova',
    traits: [],
    cost: { ap: 1 },
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
    uses: { max, current, expendOnActivate: true },
    ...overrides,
  }
}

/**
 * Install a character holding the given limited ability as the store's current
 * character and return that character (its slotted ability is what the card
 * renders and mutates).
 */
function setupCharacter(overrides: Partial<AbilityBlock> = {}): Character {
  const char: Character = {
    ...createDefaultCharacter(),
    currentAP: 3,
    slottedAbilities: [limitedAbility(3, 3, overrides)],
  }
  dbMap.set(char.id, char)
  useCharacterStore.setState({ currentCharacter: char, characters: [char] })
  return char
}

/** The character's slotted ability, for asserting its remaining uses. */
function slottedUses(character: Character | null): number {
  return abilityUsesRemaining(character?.slottedAbilities[0] as AbilityBlock)
}

/** The uses readout on the card (aria-label carries the count). */
function usesReadout(): HTMLElement {
  return screen.getByRole('img', { name: /uses remaining/i })
}

/** The meter wrapper around the readout, which carries the state classes. */
function usesMeter(): HTMLElement {
  return usesReadout().closest('.ability-uses') as HTMLElement
}

/** Rendered use tokens (filled first, hollow after). */
function tokens(): HTMLElement[] {
  return Array.from(
    usesMeter().querySelectorAll<HTMLElement>('.ability-uses__token'),
  )
}

/**
 * Render one activation card. The store's current character is the default
 * entity (that is how the sheet page drives it, and it lets the card re-render
 * from the store after an activation spends a use); `character` overrides it
 * for the standalone/GM-panel path.
 */
function renderActivation(ability: AbilityBlock, character?: Character) {
  return render(
    <NotificationProvider>
      <AbilityActivation ability={ability} character={character} />
    </NotificationProvider>,
  )
}

beforeEach(() => {
  dbMap.clear()
  useCharacterStore.setState({
    characters: [],
    currentCharacter: null,
    isLoaded: true,
    isSaving: false,
    versionHistory: null,
    isRestoring: false,
    view: 'home',
  })
})

// ---- display ---------------------------------------------------------------

test('an unlimited ability shows no uses readout', () => {
  const { container } = renderActivation(
    setupCharacter({ uses: undefined }).slottedAbilities[0],
  )
  expect(container.querySelector('.ability-uses')).toBeNull()
  expect(screen.queryByRole('img', { name: /uses remaining/i })).toBeNull()
})

test('5 or fewer uses render one token per use, filled while available', () => {
  renderActivation(setupCharacter({ uses: { max: 5, current: 3, expendOnActivate: true } }).slottedAbilities[0])

  expect(usesReadout()).toHaveAccessibleName('3 of 5 uses remaining')
  const dots = tokens()
  expect(dots).toHaveLength(5)
  expect(dots.filter((d) => d.classList.contains('ability-uses__token--filled'))).toHaveLength(3)
})

test('a fully available ability fills every token', () => {
  renderActivation(setupCharacter({ uses: { max: 5, current: 5, expendOnActivate: true } }).slottedAbilities[0])
  const dots = tokens()
  expect(dots.filter((d) => d.classList.contains('ability-uses__token--filled'))).toHaveLength(5)
})

test('an exhausted ability shows hollow tokens and flags the card', () => {
  renderActivation(setupCharacter({ uses: { max: 3, current: 0, expendOnActivate: true } }).slottedAbilities[0])

  expect(usesReadout()).toHaveAccessibleName('0 of 3 uses remaining')
  expect(usesMeter().classList.contains('ability-uses--depleted')).toBe(true)
  expect(tokens().filter((d) => d.classList.contains('ability-uses__token--filled'))).toHaveLength(0)
})

test('6 or more uses render a number instead of tokens', () => {
  renderActivation(setupCharacter({ uses: { max: 12, current: 4, expendOnActivate: true } }).slottedAbilities[0])

  expect(usesReadout()).toHaveAccessibleName('4 of 12 uses remaining')
  expect(tokens()).toHaveLength(0)
  const count = usesReadout().querySelector('.ability-uses__count')
  expect(count?.textContent).toBe('4/12')
})

// ---- activation ------------------------------------------------------------

test('activating spends one use and deducts the cost', () => {
  const char = setupCharacter()
  renderActivation(char.slottedAbilities[0])

  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  const updated = useCharacterStore.getState().currentCharacter
  expect(updated?.currentAP).toBe(2)
  expect(slottedUses(updated)).toBe(2)
  expect(screen.getByText(/1 use spent/i)).toBeInTheDocument()
})

test('activation updates the card’s readout through the sheet', () => {
  const char = setupCharacter({ uses: { max: 3, current: 2, expendOnActivate: true } })
  const { rerender } = renderActivation(char.slottedAbilities[0])

  expect(usesReadout()).toHaveAccessibleName('2 of 3 uses remaining')
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  // The sheet page re-renders its sections from the store, which is what the
  // card reads after an activation spent a use.
  const updated = useCharacterStore.getState().currentCharacter as Character
  rerender(
    <NotificationProvider>
      <AbilityActivation ability={updated.slottedAbilities[0]} character={updated} />
    </NotificationProvider>,
  )

  expect(usesReadout()).toHaveAccessibleName('1 of 3 uses remaining')
})

test('expendOnActivate=false activates without spending a use', () => {
  const char = setupCharacter({
    uses: { max: 3, current: 3, expendOnActivate: false },
  })
  renderActivation(char.slottedAbilities[0])

  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  const updated = useCharacterStore.getState().currentCharacter
  expect(updated?.currentAP).toBe(2)
  expect(slottedUses(updated)).toBe(3)
})

test('an exhausted ability cannot be activated', () => {
  const char = setupCharacter({ uses: { max: 3, current: 0, expendOnActivate: true } })
  renderActivation(char.slottedAbilities[0])

  const button = screen.getByRole('button', { name: 'Activate' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('title', expect.stringMatching(/no uses/i))

  // A disabled button swallows the click, so nothing is spent (the plan also
  // guards, which is covered by the store-level spend tests in
  // src/lib/abilityUses.test.ts).
  fireEvent.click(button)
  expect(useCharacterStore.getState().currentCharacter?.currentAP).toBe(3)
  expect(slottedUses(useCharacterStore.getState().currentCharacter)).toBe(0)
})

test('the cost tooltip mentions the use it will spend', () => {
  const char = setupCharacter()
  renderActivation(char.slottedAbilities[0])

  expect(screen.getByRole('button', { name: 'Activate' })).toHaveAttribute(
    'title',
    expect.stringMatching(/spends 1 use/i),
  )
})

test('an unlimited ability still activates without a uses readout', () => {
  const char = setupCharacter({ uses: undefined })
  renderActivation(char.slottedAbilities[0])

  fireEvent.click(screen.getByRole('button', { name: 'Activate' }))

  expect(useCharacterStore.getState().currentCharacter?.currentAP).toBe(2)
  expect(screen.queryByRole('img', { name: /uses remaining/i })).toBeNull()
})

// ---- restoring -------------------------------------------------------------

test('full restore refills a spent limited ability', () => {
  const char = setupCharacter({ uses: { max: 3, current: 0, expendOnActivate: true } })
  renderActivation(char.slottedAbilities[0])

  act(() => {
    useCharacterStore.getState().fullRestore(char.id)
  })

  expect(slottedUses(useCharacterStore.getState().currentCharacter)).toBe(3)
})

// ---- manual steppers -------------------------------------------------------

/** The card's minus stepper (spends a use by hand). */
function spendStep(): HTMLElement {
  return screen.getByRole('button', { name: /spend one use of/i })
}

/** The card's plus stepper (hands a use back). */
function restoreStep(): HTMLElement {
  return screen.getByRole('button', { name: /restore one use of/i })
}

test('the stepper spends a use', () => {
  const char = setupCharacter()
  renderActivation(char.slottedAbilities[0])

  fireEvent.click(spendStep())

  expect(slottedUses(useCharacterStore.getState().currentCharacter)).toBe(2)
})

test('the stepper hands a use back without touching resources', () => {
  const char = setupCharacter({ uses: { max: 3, current: 1, expendOnActivate: true } })
  renderActivation(char.slottedAbilities[0])

  fireEvent.click(restoreStep())

  const updated = useCharacterStore.getState().currentCharacter
  expect(slottedUses(updated)).toBe(2)
  // A manual adjustment is not an activation: AP is untouched.
  expect(updated?.currentAP).toBe(3)
})

test('the sheet re-renders the meter from the adjusted value', () => {
  const char = setupCharacter()
  const { rerender } = renderActivation(char.slottedAbilities[0])

  fireEvent.click(spendStep())

  // The sheet page re-renders its sections from the store, which is what the
  // card reads after a manual adjustment.
  const updated = useCharacterStore.getState().currentCharacter as Character
  rerender(
    <NotificationProvider>
      <AbilityActivation ability={updated.slottedAbilities[0]} character={updated} />
    </NotificationProvider>,
  )

  expect(usesReadout()).toHaveAccessibleName('2 of 3 uses remaining')
  expect(
    tokens().filter((d) => d.classList.contains('ability-uses__token--filled')),
  ).toHaveLength(2)
})

test('a burst of stepper clicks never escapes the ability’s bounds', () => {
  // The stepper only *requests* a count; the store clamps every write. Even a
  // burst of clicks that outruns the re-render can't push the count below 0 or
  // above the maximum.
  const char = setupCharacter({ uses: { max: 3, current: 1, expendOnActivate: true } })
  const first = renderActivation(char.slottedAbilities[0])

  fireEvent.click(spendStep())
  fireEvent.click(spendStep())
  fireEvent.click(spendStep())
  expect(slottedUses(useCharacterStore.getState().currentCharacter)).toBe(0)

  first.unmount()
  const atZero = useCharacterStore.getState().currentCharacter as Character
  renderActivation(atZero.slottedAbilities[0])
  // Every click in the burst reads the same rendered 0, so five of them all ask
  // for 1 use — the count stays inside [0, max] rather than compounding to 5.
  for (let i = 0; i < 5; i++) fireEvent.click(restoreStep())
  expect(slottedUses(useCharacterStore.getState().currentCharacter)).toBe(1)
})

test('stepping down is disabled once the ability is exhausted', () => {
  const char = setupCharacter({ uses: { max: 3, current: 0, expendOnActivate: true } })
  renderActivation(char.slottedAbilities[0])

  expect(spendStep()).toBeDisabled()
  expect(restoreStep()).toBeEnabled()

  fireEvent.click(spendStep())
  expect(slottedUses(useCharacterStore.getState().currentCharacter)).toBe(0)
})

test('stepping up is disabled at the ability’s maximum', () => {
  const char = setupCharacter()
  renderActivation(char.slottedAbilities[0])

  expect(restoreStep()).toBeDisabled()
  expect(spendStep()).toBeEnabled()

  fireEvent.click(restoreStep())
  expect(slottedUses(useCharacterStore.getState().currentCharacter)).toBe(3)
})

test('numeric meters get the same steppers', () => {
  const char = setupCharacter({ uses: { max: 12, current: 4, expendOnActivate: true } })
  renderActivation(char.slottedAbilities[0])

  expect(tokens()).toHaveLength(0)
  expect(spendStep()).toBeEnabled()

  fireEvent.click(spendStep())
  expect(slottedUses(useCharacterStore.getState().currentCharacter)).toBe(3)
})

test('edit mode renders no steppers', () => {
  const char = setupCharacter()
  render(
    <NotificationProvider>
      <AbilityBlockCard ability={char.slottedAbilities[0]} mode="edit" />
    </NotificationProvider>,
  )

  expect(usesReadout()).toHaveAccessibleName('3 of 3 uses remaining')
  expect(screen.queryByRole('button', { name: /spend one use of/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /restore one use of/i })).toBeNull()
})

test('a limited ability with no Activate button gets no steppers', () => {
  const char = setupCharacter({ showActivate: false })
  renderActivation(char.slottedAbilities[0])

  expect(usesReadout()).toHaveAccessibleName('3 of 3 uses remaining')
  expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull()
  expect(screen.queryByRole('button', { name: /spend one use of/i })).toBeNull()
})

test('a sub-ability gets its own steppers', () => {
  const sub: AbilityBlock = {
    ...limitedAbility(3, 3),
    id: 'sub-1',
    name: 'Sub Step',
  }
  const char = setupCharacter({ subAbilitiesUnderDescription: [sub] })
  render(
    <NotificationProvider>
      <AbilityBlockCard ability={char.slottedAbilities[0]} mode="view" />
    </NotificationProvider>,
  )

  const subBlock = document.querySelector('.sub-ability-block') as HTMLElement
  expect(subBlock).not.toBeNull()

  fireEvent.click(within(subBlock).getByRole('button', { name: /spend one use of/i }))
  const updated = useCharacterStore.getState().currentCharacter as Character
  expect(
    abilityUsesRemaining(updated.slottedAbilities[0].subAbilitiesUnderDescription[0]),
  ).toBe(2)
})

test('a read-only entity keeps the readout but gets no steppers', () => {
  const char = setupCharacter()
  // A GM panel's entity is not the store's current character, and no writer is
  // supplied — so there is nothing to write to.
  const panelEntity: Character = { ...char, id: 'panel-entity' }
  renderActivation(panelEntity.slottedAbilities[0], panelEntity)

  expect(usesReadout()).toHaveAccessibleName('3 of 3 uses remaining')
  expect(screen.queryByRole('button', { name: /spend one use of/i })).toBeNull()
})

test('a supplied writer handles an ability that is not on the current character', () => {
  const onSetUses = vi.fn()
  // 2 of 3: both steppers are live, so each direction is observable.
  const ability = limitedAbility(2, 3)

  render(
    <NotificationProvider>
      <AbilityBlockCard
        ability={ability}
        mode="view"
        character={{ ...createDefaultCharacter(), id: 'attached-npc' }}
        onSetUses={onSetUses}
      />
    </NotificationProvider>,
  )

  // The meter reports the count it believes it is moving to, and the parent
  // owns the write (and any clamping) — each step is measured from the rendered
  // value, which the parent's next render replaces.
  fireEvent.click(spendStep())
  expect(onSetUses).toHaveBeenLastCalledWith(ability.id, 1)

  fireEvent.click(restoreStep())
  expect(onSetUses).toHaveBeenLastCalledWith(ability.id, 3)
})

test('an unlimited ability gets no steppers even in view mode', () => {
  const char = setupCharacter({ uses: undefined })
  renderActivation(char.slottedAbilities[0])

  expect(screen.queryByRole('button', { name: /spend one use of/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /restore one use of/i })).toBeNull()
})
