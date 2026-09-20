/**
 * Component tests for CharacterSheetPage's page canvas under the
 * "Match app theme" character-sheet setting: the page background follows the
 * app theme like an NPC sheet page, and the character's background-image
 * layers (image, darken, blur) are dropped with the rest of the sheet's
 * customization.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import CharacterSheetPage from '@/pages/CharacterSheetPage'
import { NotificationProvider } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useCharacterSheetThemeStore } from '@/store/characterSheetThemeStore'
import { createDefaultCharacter, DEFAULT_SHEET_CONFIG } from '@/constants/gameData'
import { appThemeSheetPageBackground } from '@/lib/themeUtils'
import type { Character } from '@/types'

vi.mock('@/lib/db', () => ({
  getAllScreens: vi.fn(async () => []),
  getScreen: vi.fn(async () => null),
  putScreen: vi.fn(async () => {}),
  deleteScreen: vi.fn(async () => {}),
  normalizeScreen: (s: unknown) => s,
  getAllCharacters: vi.fn(async () => []),
  getCharacter: vi.fn(async () => null),
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

/** A player with a page background and a background image configured. */
function makePcWithBackground(): Character {
  const base = createDefaultCharacter()
  return {
    ...base,
    id: 'pc-1',
    name: 'Vex',
    config: {
      ...base.config,
      pageBackgroundColor: '#321321',
      backgroundImage: 'data:image/png;base64,AAAA',
      backgroundImageDarken: 0.8,
      backgroundImageBlur: 6,
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  useCharacterSheetThemeStore.setState({ matchAppTheme: false })
  useAppThemeStore.setState({ theme: 'midnight' })
  useCharacterStore.setState({ characters: [], currentCharacter: null })
})

function renderPage(matchAppTheme: boolean, theme: 'midnight' | 'parchment') {
  useCharacterSheetThemeStore.setState({ matchAppTheme })
  useAppThemeStore.setState({ theme })
  const pc = makePcWithBackground()
  useCharacterStore.setState({ characters: [pc], currentCharacter: pc })

  const utils = render(
    <NotificationProvider>
      <CharacterSheetPage />
    </NotificationProvider>,
  )
  const page = utils.container.querySelector('.sheet-page')
  if (!page) throw new Error('character sheet page not rendered')
  return { pc, page: page as HTMLElement }
}

test('default: the page canvas and background image are the character’s own', () => {
  const { page } = renderPage(false, 'parchment')

  expect(page.className).toContain('sheet-page--has-bg')
  expect(page.querySelector('.sheet-page__bg-image')).not.toBeNull()
  expect(page.querySelector('.sheet-page__bg-color')).toHaveStyle({
    backgroundColor: '#321321',
  })
  expect(screen.getByRole('button', { name: 'Customize' })).toBeInTheDocument()
})

test('Match app theme: the page canvas follows the app theme and drops the image', () => {
  const { pc, page } = renderPage(true, 'parchment')

  expect(page.className).not.toContain('sheet-page--has-bg')
  expect(page.querySelector('.sheet-page__bg-image')).toBeNull()
  expect(page.querySelector('.sheet-page__bg-color')).toHaveStyle({
    backgroundColor: appThemeSheetPageBackground(
      'parchment',
      DEFAULT_SHEET_CONFIG,
    ),
  })
  // No customization UI left to open, and the record is untouched.
  expect(screen.queryByRole('button', { name: 'Customize' })).toBeNull()
  expect(pc.config.backgroundImage).toBe('data:image/png;base64,AAAA')
})

test('Match app theme: midnight uses the default page canvas, not the custom one', () => {
  const { page } = renderPage(true, 'midnight')

  // Midnight is the one theme whose page background comes from the config
  // (the historical look) — and with the switch on that is the DEFAULT config,
  // never the player's.
  expect(page.querySelector('.sheet-page__bg-color')).toHaveStyle({
    backgroundColor: DEFAULT_SHEET_CONFIG.pageBackgroundColor,
  })
})
