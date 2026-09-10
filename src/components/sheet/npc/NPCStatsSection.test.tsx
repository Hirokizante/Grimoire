/**
 * NPCStatsSection renders the Combat Stats token row of a standalone NPC
 * sheet. These tests pin the two behaviors that regressed with the Mortal
 * Wounds stat: every token must carry an accent (a missing one renders the
 * token with no stripe and no icon color), and the accents must come from the
 * app theme's NPC palette rather than the record's own stored sheet colors
 * (which predate the Mortal Wounds color key and duplicate each other).
 */

import { render } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import NPCStatsSection from '@/components/sheet/npc/NPCStatsSection'
import { createDefaultNPC } from '@/constants/gameData'
import { NPC_STAT_TOKEN_COLORS } from '@/lib/themeUtils'
import { APP_THEMES } from '@/store/appThemeStore'
import type { AppTheme } from '@/store/appThemeStore'
import type { Character, SheetColors } from '@/types'

const { themeRef } = vi.hoisted(() => ({
  themeRef: { current: 'midnight' as AppTheme },
}))

vi.mock('@/store/appThemeStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/appThemeStore')>()
  return {
    ...actual,
    useAppThemeStore: (selector: (state: { theme: AppTheme }) => unknown) =>
      selector({ theme: themeRef.current }),
  }
})

vi.mock('@/store/characterStore', () => ({
  useCharacterStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ updateCurrentCharacter: vi.fn() }),
}))

beforeEach(() => {
  themeRef.current = 'midnight'
})

/**
 * An NPC stored before the Mortal Wounds color existed: its own palette has no
 * tokenMortalWounds (and repeats Evasion's color on HP, as the shipped sheet
 * palettes do).
 */
function legacyNPC(): Character {
  const npc = createDefaultNPC()
  const colors: Partial<SheetColors> = { ...npc.config.colors }
  delete colors.tokenMortalWounds
  colors.tokenEvasion = colors.hpBar
  return {
    ...npc,
    id: 'npc-1',
    name: 'Goblin',
    config: { ...npc.config, colors: colors as SheetColors },
  }
}

/** Read the accent each rendered token was given. */
function tokenAccents(): Record<string, string> {
  const tokens = document.querySelectorAll<HTMLElement>('.stat-token')
  return Object.fromEntries(
    [...tokens].map((el) => [
      el.querySelector('.stat-token__label')?.textContent ?? '',
      el.style.getPropertyValue('--token-color'),
    ]),
  )
}

test('every Combat Stats token gets an accent, Mortal Wounds included', () => {
  render(<NPCStatsSection npc={legacyNPC()} />)

  const accents = tokenAccents()
  expect(Object.keys(accents)).toEqual([
    'Evasion',
    'Armor',
    'Movement',
    'Save DC',
    'HP',
    'Mortal Wounds',
  ])
  for (const [label, accent] of Object.entries(accents)) {
    expect(accent, `${label} accent`).toMatch(/^#[0-9a-f]{6}$/i)
  }
})

test('token accents follow the app theme, not the stored record palette', () => {
  const npc = legacyNPC()
  // A record palette nothing should be reading: every entry is a loud red.
  npc.config.colors = {
    ...npc.config.colors,
    tokenEvasion: '#ff0000',
    hpBar: '#ff0000',
  }

  for (const theme of APP_THEMES) {
    themeRef.current = theme
    const { unmount } = render(<NPCStatsSection npc={npc} />)
    expect(tokenAccents()).toEqual({
      Evasion: NPC_STAT_TOKEN_COLORS[theme].evasion,
      Armor: NPC_STAT_TOKEN_COLORS[theme].armor,
      Movement: NPC_STAT_TOKEN_COLORS[theme].movement,
      'Save DC': NPC_STAT_TOKEN_COLORS[theme].saveDC,
      HP: NPC_STAT_TOKEN_COLORS[theme].hp,
      'Mortal Wounds': NPC_STAT_TOKEN_COLORS[theme].mortalWounds,
    })
    unmount()
  }
})
