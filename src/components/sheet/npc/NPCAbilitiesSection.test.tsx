/**
 * The standalone NPC sheet is a **static reference**: it never offers an
 * Activate button, never tracks Action Points, and never shows Recharge
 * cooldowns. Live play belongs to a GM Screen instance, which owns its own turn
 * (see NpcInstancePanel / useNpcInstanceActivation).
 *
 * These tests pin that side of the contract — the GM panel's own behavior is
 * covered in components/gmscreen/GMScreenPanels.test.tsx — plus the section's
 * two other jobs: it lays the list out identically for the standalone sheet and
 * an NPC embedded in a player sheet's custom tab, and it reorders that list by
 * drag in edit mode (the same grip-and-drop the player sheet's Slotted
 * Abilities offers).
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import NPCAbilitiesSection from '@/components/sheet/npc/NPCAbilitiesSection'
import {
  AbilityDropHintContext,
  type AbilityDropHintStore,
} from '@/components/sheet/AbilityDropHintContext'
import { useAbilityClipboardStore } from '@/store/abilityClipboardStore'
import { useCharacterStore } from '@/store/characterStore'
import { createDefaultNPC } from '@/constants/gameData'
import type { AbilityBlock, Character } from '@/types'

/**
 * The real DndContext needs measured rects (which jsdom does not provide), so
 * the drag result is driven straight into the section's `onDragEnd`. dnd-kit's
 * own sensors and collision detection are exercised by the Playwright spec
 * (e2e/npc-abilities.spec.ts), which drags a real card with a real pointer.
 */
const { dragEndRef, dbMap, npcRegistrations } = vi.hoisted(() => ({
  dragEndRef: {
    current: null as null | ((event: { active: { id: string }; over: { id: string } | null }) => void),
  },
  dbMap: new Map<string, unknown>(),
  /**
   * Every list registration that reached the **NPC's own** hint store — the one
   * `NpcAbilitiesDndContext` publishes. Captured by wrapping the store hook, so
   * a test can tell "registered with the context that runs the drag" apart from
   * "registered with whatever happens to wrap the section".
   */
  npcRegistrations: {
    current: [] as { id: string; items: readonly { id: string }[]; resolver: unknown }[],
  },
}))

vi.mock('@/components/sheet/AbilityDropHintContext', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/components/sheet/AbilityDropHintContext')>()
  const React = await import('react')
  return {
    ...actual,
    // The store itself stays real — only its `register` is watched, so the
    // rendered section still works exactly as it does in the app.
    useAbilityDropHintStore: () => {
      const store = actual.useAbilityDropHintStore()
      return React.useMemo(
        () => ({
          ...store,
          register: (registration: {
            id: string
            items: readonly { id: string }[]
            resolver: unknown
          }) => {
            npcRegistrations.current.push(registration)
            return store.register(
              registration as Parameters<typeof store.register>[0],
            )
          },
        }),
        [store],
      )
    },
  }
})

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  const React = await import('react')
  return {
    ...actual,
    DndContext: (props: {
      children: React.ReactNode
      onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void
    }) => {
      dragEndRef.current = props.onDragEnd ?? null
      return React.createElement(React.Fragment, null, props.children)
    },
  }
})

vi.mock('@/lib/db', () => ({
  getAllScreens: vi.fn(async () => []),
  getScreen: vi.fn(async () => null),
  putScreen: vi.fn(async () => {}),
  deleteScreen: vi.fn(async () => {}),
  normalizeScreen: (s: unknown) => s,
  getAllCharacters: vi.fn(async () => Array.from(dbMap.values())),
  getCharacter: vi.fn(async (id: string) => dbMap.get(id) ?? null),
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

/** A costed ability carrying the Recharge trait — the most "activatable" shape. */
function rechargeAbility(): AbilityBlock {
  return {
    id: 'a1',
    name: 'Fire Breath',
    traits: ['Action', 'Recharge (5)'],
    cost: { ap: 2 },
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: true,
    subAbilitiesUnderDescription: [
      {
        id: 'sub-1',
        name: 'Cinder',
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
      },
    ],
    subAbilitiesUnderOvercharge: [],
  }
}

/** An NPC holding that ability as its store current character. */
function seedNpc(): Character {
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    slottedAbilities: [rechargeAbility()],
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })
  return npc
}

beforeEach(() => {
  dbMap.clear()
  npcRegistrations.current = []
  useAbilityClipboardStore.setState({ copied: null })
  useCharacterStore.setState({ characters: [], currentCharacter: null })
})

test('standalone NPC abilities never render an Activate button', () => {
  const npc = seedNpc()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
    />,
  )

  // Neither the ability nor its sub-ability can be activated on the sheet…
  expect(screen.queryAllByRole('button', { name: 'Activate' })).toHaveLength(0)
  // …and nothing live-play leaks in either: no cooldown badge, no AP meter.
  expect(document.querySelector('.gm-recharge')).toBeNull()
  expect(document.querySelector('.gm-ap')).toBeNull()
  // The card itself still renders (static reference).
  expect(screen.getByText('Fire Breath')).toBeInTheDocument()
})

test('standalone NPC limited uses render read-only — no ± steppers', () => {
  // A base NPC record is a static reference the GM Screen spawns instances
  // from, so its use counts are template data: the budget still *reads* on the
  // card, but nothing here may move it — not even though this NPC is the
  // store's current character, which is exactly what gives a player sheet its
  // steppers.
  const limited: AbilityBlock = {
    ...plainAbility('limited-1', 'Cleave'),
    cost: { ap: 1 },
    showActivate: true,
    uses: { max: 3, current: 2, expendOnActivate: true },
    subAbilitiesUnderDescription: [
      {
        ...plainAbility('sub-1', 'Riposte'),
        uses: { max: 2, current: 2, expendOnActivate: true },
      },
    ],
  }
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    slottedAbilities: [limited],
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })

  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
    />,
  )

  // The counts are visible (the parent's and its sub-ability's)…
  expect(
    screen.getByRole('img', { name: '2 of 3 uses remaining' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('img', { name: '2 of 2 uses remaining' }),
  ).toBeInTheDocument()
  // …but there is no control to move either of them.
  expect(screen.queryAllByRole('button', { name: /one use of/i })).toHaveLength(0)
  // The record keeps its authored count, untouched.
  expect(
    useCharacterStore.getState().characters[0].slottedAbilities[0].uses?.current,
  ).toBe(2)
})

test('standalone NPC modifier switches are visible but inert', () => {
  // The modifier list and the switch state read on the base sheet, but a base
  // NPC record is a static reference the GM Screen spawns instances from — the
  // switch exists for parity with a player sheet and is deliberately disabled.
  // The store's own fallback is what a player sheet uses here, so this pins the
  // rule even though the NPC *is* the store's current character.
  const rage: AbilityBlock = {
    ...plainAbility('mod-1', 'Rage'),
    modifiers: [{ target: 'evasion', value: 2 }],
  }
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    slottedAbilities: [rage],
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })

  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
    />,
  )

  const toggle = screen.getByRole('switch', { name: /Apply Rage modifiers/i })
  expect(toggle).toBeDisabled()
  expect(toggle).toHaveAttribute(
    'title',
    expect.stringMatching(/static references/i),
  )
  expect(screen.getByText('+2 Evasion')).toBeInTheDocument()

  fireEvent.click(toggle)
  expect(
    useCharacterStore.getState().characters[0].slottedAbilities[0].modifiersActive,
  ).toBeUndefined()
})

test('the sub-ability editor hides the Show Activate toggle on an NPC sheet', () => {
  const npc = seedNpc()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  // Edit the nested sub-ability straight from the card…
  const sub = document.querySelector('.sub-ability-block') as HTMLElement
  fireEvent.click(within(sub).getByRole('button', { name: 'Edit' }))

  // …and the editor offers exactly what the main NPC ability editor offers:
  // AP cost, and none of the character-only controls. An NPC outside a GM
  // panel never renders an Activate button, so a flag for one is noise.
  expect(
    screen.getByRole('dialog', { name: 'Edit Sub-Ability' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('AP Cost')).toBeInTheDocument()
  expect(screen.queryByLabelText('Show Activate button')).toBeNull()
  expect(screen.queryByLabelText('END Cost')).toBeNull()
  expect(screen.queryByLabelText('FP Cost')).toBeNull()
})

// ---- Drag and drop ---------------------------------------------------------

/** A minimal ability with nothing but an id and a name. */
function plainAbility(id: string, name: string): AbilityBlock {
  return {
    id,
    name,
    traits: [],
    cost: {},
    damage: '',
    description: '',
    overcharge: '',
    flavorText: '',
    isMinor: false,
    showActivate: false,
    subAbilitiesUnderDescription: [],
    subAbilitiesUnderOvercharge: [],
  }
}

/** An NPC whose list holds three plain abilities. */
function seedNpcWithThree(): Character {
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    slottedAbilities: [
      plainAbility('a1', 'Claw'),
      plainAbility('a2', 'Bite'),
      plainAbility('a3', 'Howl'),
    ],
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })
  return npc
}

/** The ability order currently persisted on the store's NPC record. */
function storedAbilityIds(): string[] {
  return (
    useCharacterStore.getState().characters.find((c) => c.id === 'npc-1')
      ?.slottedAbilities ?? []
  ).map((a) => a.id)
}

test('edit mode gives every NPC ability card a drag handle', () => {
  const npc = seedNpcWithThree()
  const { container } = render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  expect(container.querySelectorAll('.drag-handle')).toHaveLength(3)
  expect(container.querySelectorAll('.ability-card')).toHaveLength(3)
  // Edit mode still offers the per-card Edit / Remove buttons.
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3)
  expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(3)
})

test('view mode renders no drag handles — a static reference is not draggable', () => {
  const npc = seedNpcWithThree()
  const { container } = render(
    <NPCAbilitiesSection abilities={npc.slottedAbilities} ownerId={npc.id} owner={npc} />,
  )

  expect(container.querySelectorAll('.drag-handle')).toHaveLength(0)
  expect(container.querySelectorAll('.ability-card')).toHaveLength(3)
})

test('dropping a card on another reorders the NPC ability list', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  // Drag "Howl" (last) onto "Claw" (first) — the same move the player sheet's
  // Slotted Abilities performs on a drop.
  act(() => dragEndRef.current?.({ active: { id: 'a3' }, over: { id: 'a1' } }))

  expect(storedAbilityIds()).toEqual(['a3', 'a1', 'a2'])
})

test('dropping a card on the list itself sends it to the end', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  act(() => dragEndRef.current?.({ active: { id: 'a1' }, over: { id: 'npcAbilities' } }))

  expect(storedAbilityIds()).toEqual(['a2', 'a3', 'a1'])
})

test('a cancelled drag (no drop target) leaves the list alone', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  act(() => dragEndRef.current?.({ active: { id: 'a1' }, over: null }))

  expect(storedAbilityIds()).toEqual(['a1', 'a2', 'a3'])
})

test('the list registers its drop resolver with the NPC’s own drag context', () => {
  const npc = seedNpcWithThree()
  // Stands in for a context wrapping the section — a custom tab's drag context
  // when the NPC is embedded in a player sheet. The list must NOT register here:
  // a resolver in this store answers for a drag this section does not run.
  const outerRegister = vi.fn(() => () => {})
  const outerStore: AbilityDropHintStore = {
    hint: null,
    isDragging: false,
    register: outerRegister,
  }

  render(
    <AbilityDropHintContext.Provider value={outerStore}>
      <NPCAbilitiesSection
        abilities={npc.slottedAbilities}
        ownerId={npc.id}
        owner={npc}
        mode="edit"
      />
    </AbilityDropHintContext.Provider>,
  )

  // One resolver, in the NPC's own store, naming the NPC's list…
  expect(npcRegistrations.current.map((r) => r.id)).toEqual(['npcAbilities'])
  expect(npcRegistrations.current[0].items.map((i) => i.id)).toEqual([
    'a1',
    'a2',
    'a3',
  ])
  // …and nothing registered with the context above the section. That is what
  // makes the drop preview possible at all: the drag context resolves a hint by
  // asking *its own* registered sections, so a resolver filed anywhere else
  // leaves it unable to answer "where would this land?" — no insertion
  // indicator, no card translations, no hover frame — while `onDragEnd`'s
  // fallback still reorders the list.
  expect(outerRegister).not.toHaveBeenCalled()

  // The registered resolver is live: hovering the list itself means "the end of
  // the list", which is the answer the indicator and the drop both use.
  const resolver = npcRegistrations.current[0].resolver as {
    resolve: (
      event: { active: { id: string }; over: { id: string } },
      list: { id: string; items: readonly { id: string }[] },
    ) => { section: string; index: number } | null
  }
  expect(
    resolver.resolve(
      { active: { id: 'a1' }, over: { id: 'npcAbilities' } },
      { id: 'npcAbilities', items: npc.slottedAbilities },
    ),
  ).toMatchObject({ section: 'npcAbilities', index: 3 })
})

// ---- Layout parity between the two mount points -----------------------------

test('the embedded variant lays the list out exactly like the standalone section', () => {
  const npc = seedNpcWithThree()
  const props = {
    abilities: npc.slottedAbilities,
    ownerId: npc.id,
    owner: npc,
    mode: 'edit' as const,
    viewMode: 'grid' as const,
    onViewModeChange: () => {},
  }

  const { container, rerender } = render(<NPCAbilitiesSection {...props} />)
  const standalone = {
    grid: container.querySelector('.ability-grid')?.className,
    heading: screen.getByRole('heading', { name: 'Abilities' }).tagName,
    handles: container.querySelectorAll('.drag-handle').length,
    shell: container.querySelector('.sheet-section--slotted') !== null,
    embeddedShell: container.querySelector('.npc-abilities-section--embedded') !== null,
  }

  rerender(<NPCAbilitiesSection {...props} variant="embedded" />)
  const embedded = {
    grid: container.querySelector('.ability-grid')?.className,
    heading: screen.getByRole('heading', { name: 'Abilities' }).tagName,
    handles: container.querySelectorAll('.drag-handle').length,
    shell: container.querySelector('.sheet-section--slotted') !== null,
    embeddedShell: container.querySelector('.npc-abilities-section--embedded') !== null,
  }

  // Same card grid, same drag handles, same toggle, same add button — only the
  // shell and the heading level differ (the embedded NPC's name is the section
  // heading, so its blocks use the compact h5 label).
  expect(embedded.grid).toBe(standalone.grid)
  expect(embedded.handles).toBe(standalone.handles)
  expect(standalone.heading).toBe('H3')
  expect(embedded.heading).toBe('H5')
  expect(standalone.shell).toBe(true)
  expect(embedded.shell).toBe(false)
  expect(standalone.embeddedShell).toBe(false)
  expect(embedded.embeddedShell).toBe(true)
  expect(
    screen.getAllByRole('tablist', { name: 'Abilities view' }),
  ).toHaveLength(1)
  expect(
    screen.getByRole('button', { name: '+ Add Ability' }),
  ).toBeInTheDocument()
  // The old embedded-only grid is gone: an NPC's abilities are one layout now.
  expect(container.querySelector('.custom-npc-section__abilities')).toBeNull()
})

test('the view toggle is not rendered when the surface fixes its view mode', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="view"
      viewMode="list"
    />,
  )

  // A GM panel passes no `onViewModeChange`, so it keeps its fixed list view.
  expect(screen.queryByRole('tablist', { name: 'Abilities view' })).toBeNull()
})

// ---- The pinned Basic Attack ------------------------------------------------

/**
 * Every NPC record is born with a Basic Attack (`createDefaultBasicAttack`), and
 * the section renders it itself — pinned to the head of the list on all three
 * surfaces (the standalone sheet, an attached NPC, an expanded GM panel). The
 * callers pass it in, so these tests do the same.
 *
 * The contract is the one a player sheet's Basic Attack follows: it is always
 * there, it can be **modified**, and it can never be **deleted** — no Remove
 * button, no drag handle, and no place in the list a reorder writes to.
 */

/** An NPC carrying the generated Basic Attack plus one authored ability. */
function seedNpcWithBasicAttack(): Character {
  const npc: Character = {
    ...createDefaultNPC(),
    id: 'npc-1',
    name: 'Bandit',
    slottedAbilities: [plainAbility('a1', 'Claw')],
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })
  return npc
}

/** The card names on screen, in render order. */
function cardNames(): string[] {
  return Array.from(document.querySelectorAll('.ability-card__name')).map(
    (el) => el.textContent ?? '',
  )
}

test('the Basic Attack is the section’s card even with no authored abilities', () => {
  const npc: Character = { ...createDefaultNPC(), id: 'npc-1', name: 'Bandit' }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })

  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      basicAttack={npc.basicAttack}
      ownerId={npc.id}
      owner={npc}
    />,
  )

  // A brand-new NPC is never ability-less: its Basic Attack is the statblock's
  // fallback action, and it reads like the player sheet's copy (1 AP, its own
  // damage notation).
  expect(cardNames()).toEqual(['Basic Attack'])
  expect(screen.getByText('1d6 + MAR')).toBeInTheDocument()
  expect(screen.getByText('1 AP')).toBeInTheDocument()
  // …and nothing claims the section is empty beside a card that is plainly there.
  expect(screen.queryByText(/abilities defined for this NPC/)).toBeNull()
})

test('the empty note appears only where there is nothing to show at all', () => {
  const npc: Character = { ...createDefaultNPC(), id: 'npc-1', name: 'Bandit' }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })

  // No authored abilities *and* no Basic Attack passed in (a hand-built
  // fixture): the note is the whole section, because the section is empty.
  render(<NPCAbilitiesSection abilities={[]} ownerId={npc.id} owner={npc} />)

  expect(
    screen.getByText('No abilities defined for this NPC.'),
  ).toBeInTheDocument()
  expect(cardNames()).toEqual([])
})

test('the Basic Attack leads the list, ahead of the authored abilities', () => {
  const npc = seedNpcWithBasicAttack()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      basicAttack={npc.basicAttack}
      ownerId={npc.id}
      owner={npc}
    />,
  )

  expect(cardNames()).toEqual(['Basic Attack', 'Claw'])
})

test('the Basic Attack is editable, and offers no way to delete it', () => {
  const npc = seedNpcWithBasicAttack()
  const { container } = render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      basicAttack={npc.basicAttack}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  const pinned = container.querySelector(
    '.ability-card-wrap--pinned',
  ) as HTMLElement
  expect(pinned).not.toBeNull()
  // Editable…
  const edit = within(pinned).getByRole('button', { name: 'Edit' })
  // …and not removable or movable: the pinned card carries no Remove and no
  // grip, while the authored card beside it keeps both.
  expect(within(pinned).queryByRole('button', { name: 'Remove' })).toBeNull()
  expect(pinned.querySelector('.drag-handle')).toBeNull()
  expect(container.querySelectorAll('.drag-handle')).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1)

  fireEvent.click(edit)
  const dialog = screen.getByRole('dialog', { name: 'Edit Ability' })
  fireEvent.change(within(dialog).getByLabelText('Name'), {
    target: { value: 'Ol’ Reliable' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  // The edit lands on the record's own `basicAttack` field, not on a list entry.
  const stored = useCharacterStore.getState().characters[0]
  expect(stored.basicAttack.name).toBe('Ol’ Reliable')
  expect(stored.basicAttack.cost).toEqual({ ap: 1 })
  expect(stored.slottedAbilities.map((a) => a.name)).toEqual(['Claw'])
})

test('an edit inside the Basic Attack’s own card writes the same field', () => {
  // A sub-ability is edited through its parent, and the parent here is the
  // Basic Attack — a scalar field, not a list entry. The section routes by id,
  // so the write must not land on `slottedAbilities` (which would add the
  // Basic Attack to the NPC's list as a second, removable copy).
  const base = createDefaultNPC()
  const npc: Character = {
    ...base,
    id: 'npc-1',
    name: 'Bandit',
    basicAttack: {
      ...base.basicAttack,
      subAbilitiesUnderDescription: [plainAbility('sub-1', 'Slam')],
    },
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })

  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      basicAttack={npc.basicAttack}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  const sub = document.querySelector('.sub-ability-block') as HTMLElement
  fireEvent.click(within(sub).getByRole('button', { name: 'Edit' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit Sub-Ability' })
  fireEvent.change(within(dialog).getByLabelText('Name'), {
    target: { value: 'Heavy Slam' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  const stored = useCharacterStore.getState().characters[0]
  expect(
    stored.basicAttack.subAbilitiesUnderDescription.map((s) => s.name),
  ).toEqual(['Heavy Slam'])
  expect(stored.slottedAbilities).toEqual([])
})

test('a reorder never moves or touches the Basic Attack', () => {
  const base = createDefaultNPC()
  const npc: Character = {
    ...base,
    id: 'npc-1',
    name: 'Bandit',
    slottedAbilities: [
      plainAbility('a1', 'Claw'),
      plainAbility('a2', 'Bite'),
      plainAbility('a3', 'Howl'),
    ],
  }
  dbMap.set(npc.id, npc)
  useCharacterStore.setState({ currentCharacter: npc, characters: [npc] })

  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      basicAttack={npc.basicAttack}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  // The list's own drop resolver knows the authored abilities only — the pinned
  // card is not a slot a drop can resolve against.
  expect(npcRegistrations.current.map((r) => r.items.map((i) => i.id))).toEqual([
    ['a1', 'a2', 'a3'],
  ])

  act(() => dragEndRef.current?.({ active: { id: 'a3' }, over: { id: 'a1' } }))

  const stored = useCharacterStore.getState().characters[0]
  expect(stored.slottedAbilities.map((a) => a.id)).toEqual(['a3', 'a1', 'a2'])
  // The Basic Attack is still the one the record was born with, in its place.
  expect(stored.basicAttack).toEqual(npc.basicAttack)
})

// ---- Duplicate / copy / paste ----------------------------------------------

/** One card of the rendered list, by the ability name on it. */
function cardByName(name: string): HTMLElement {
  const card = screen.getByText(name).closest('.ability-card')
  expect(card).not.toBeNull()
  return card as HTMLElement
}

test('Duplicate inserts a fresh copy directly after the original', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  fireEvent.click(
    within(cardByName('Bite')).getByRole('button', { name: 'Duplicate' }),
  )

  const stored = useCharacterStore.getState().characters[0].slottedAbilities
  expect(stored.map((a) => a.name)).toEqual(['Claw', 'Bite', 'Bite', 'Howl'])
  // A new block, not the same one twice: the copy gets its own id.
  expect(stored[2].id).not.toBe(stored[1].id)
})

test('Copy arms Paste, which appends a clone to the NPC’s own list', () => {
  const npc = seedNpcWithThree()
  render(
    <NPCAbilitiesSection
      abilities={npc.slottedAbilities}
      ownerId={npc.id}
      owner={npc}
      mode="edit"
    />,
  )

  // Nothing copied yet: there is nothing to paste.
  expect(screen.queryByRole('button', { name: 'Paste' })).toBeNull()

  fireEvent.click(
    within(cardByName('Bite')).getByRole('button', { name: 'Copy' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Paste' }))

  const stored = useCharacterStore.getState().characters[0].slottedAbilities
  expect(stored.map((a) => a.name)).toEqual(['Claw', 'Bite', 'Howl', 'Bite'])
  expect(stored[3].id).not.toBe(stored[1].id)
})
