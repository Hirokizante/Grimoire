/**
 * The standalone NPC sheet is a **static reference**: it never offers an
 * Activate button, never tracks Action Points, and never shows Recharge
 * cooldowns. Live play belongs to a GM Screen instance, which owns its own turn
 * (see NpcInstancePanel / useNpcInstanceActivation).
 *
 * These tests pin that side of the contract — the GM panel's own behavior is
 * covered in components/gmscreen/GMScreenPanels.test.tsx.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import NPCAbilitiesSection from '@/components/sheet/npc/NPCAbilitiesSection'
import { useCharacterStore } from '@/store/characterStore'
import { createDefaultNPC } from '@/constants/gameData'
import type { AbilityBlock, Character } from '@/types'

const { dbMap } = vi.hoisted(() => ({ dbMap: new Map<string, unknown>() }))

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
