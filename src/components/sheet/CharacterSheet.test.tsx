/**
 * Component tests for CharacterSheet's "Match app theme" mode.
 *
 * Settings → Character Sheets → *Match app theme* turns a player sheet into
 * the presentation an NPC sheet always uses: the app theme's palette, the
 * default sheet card background and fonts, no custom CSS, no flat-section
 * layout override, no page background image (see CharacterSheetPage), and no
 * Customize button. It is cosmetic and read-only — the character's config is
 * only read, so turning the switch back off restores every custom value.
 */

import { test, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import CharacterSheet from '@/components/sheet/CharacterSheet'
import { NotificationProvider } from '@/context/NotificationContext'
import { useCharacterStore } from '@/store/characterStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { useCharacterSheetThemeStore } from '@/store/characterSheetThemeStore'
import {
  createDefaultCharacter,
  DEFAULT_SHEET_COLORS,
  DEFAULT_SHEET_CONFIG,
} from '@/constants/gameData'
import {
  appThemeSheetColors,
  appThemeSheetVars,
  appThemeStatColors,
} from '@/lib/themeUtils'
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

/** A player whose every customization is impossible to miss. */
function makeCustomizedPc(): Character {
  const base = createDefaultCharacter()
  return {
    ...base,
    id: 'pc-1',
    name: 'Vex',
    config: {
      ...base.config,
      backgroundColor: '#123123',
      pageBackgroundColor: '#321321',
      sectionHeadingFontFamily: 'Playfair Display',
      labelFontFamily: 'Cinzel',
      textFontFamily: 'Georgia',
      helperTextFontFamily: 'monospace',
      hideSectionBackground: true,
      customCss: '.character-sheet { outline: 3px solid red; }',
      importedFonts: [
        {
          id: 'imported-1',
          family: 'Playfair Display',
          apiParams: 'family=Playfair+Display',
          category: 'display',
        },
      ],
      colors: {
        ...DEFAULT_SHEET_COLORS,
        bgBase: '#010203',
        accent: '#ff00ff',
        hpBar: '#00ff00',
        tokenMilestone: '#ff00ff',
        tokenEvasion: '#00ff00',
        tokenArmor: '#ff0000',
        tokenMovement: '#0000ff',
        tokenSaveDC: '#ffff00',
        tokenEndRecovery: '#00ffff',
      },
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  // `localStorage.clear()` does not reset already-hydrated store state, so the
  // sheet-theme switch is reset explicitly (it is off by default).
  useCharacterSheetThemeStore.setState({ matchAppTheme: false })
  useAppThemeStore.setState({ theme: 'midnight' })
  useCharacterStore.setState({ characters: [], currentCharacter: null })
})

/** Render the sheet with the switch in the given state. */
function renderSheet(matchAppTheme: boolean, onCustomizeToggle?: () => void) {
  useCharacterSheetThemeStore.setState({ matchAppTheme })
  const pc = makeCustomizedPc()
  useCharacterStore.setState({ characters: [pc], currentCharacter: pc })

  const utils = render(
    <NotificationProvider>
      <CharacterSheet character={pc} onCustomizeToggle={onCustomizeToggle} />
    </NotificationProvider>,
  )
  const sheet = utils.container.querySelector('.character-sheet')
  if (!sheet) throw new Error('character sheet not rendered')
  return { pc, sheet: sheet as HTMLElement }
}

/** The Combat Stats accents the sheet's own row rendered, by full label. */
function statTokenColors(sheet: HTMLElement): Record<string, string> {
  const tokens = sheet.querySelectorAll<HTMLElement>('.stat-token')
  return Object.fromEntries(
    [...tokens].map((el) => [
      el.querySelector('.stat-token__label')?.textContent ?? '',
      el.style.getPropertyValue('--token-color'),
    ]),
  )
}

const GARISH = ['#ff00ff', '#00ff00', '#010203', '#123123', '#321321']

test('default: the sheet keeps its custom palette, fonts, CSS, and Customize button', () => {
  const { sheet } = renderSheet(false, () => {})

  expect(sheet.style.getPropertyValue('--accent-violet')).toBe('#ff00ff')
  expect(sheet.style.getPropertyValue('--bg-base')).toBe('#010203')
  expect(sheet.style.getPropertyValue('--sheet-bg')).toBe('#123123')
  expect(sheet.style.getPropertyValue('--sheet-heading-font')).toBe(
    'Playfair Display',
  )
  expect(sheet.className).toContain('character-sheet--flat')
  expect(sheet.querySelector('style')?.innerHTML).toContain('outline: 3px solid red')
  expect(screen.getByRole('button', { name: 'Customize' })).toBeInTheDocument()
  // The imported font is wired into <head>.
  expect(
    document.head.querySelector('link[data-grimoire-fonts="font-imported-1"]'),
  ).not.toBeNull()
})

test('Match app theme: the sheet renders the app theme and nothing per-sheet', () => {
  useAppThemeStore.setState({ theme: 'parchment' })
  const { pc, sheet } = renderSheet(true, () => {})

  const theme = appThemeSheetColors('parchment')
  expect(sheet.style.getPropertyValue('--accent-violet')).toBe(theme.accent)
  expect(sheet.style.getPropertyValue('--bg-base')).toBe(theme.bgBase)
  expect(sheet.style.getPropertyValue('--hp-bar-color')).toBe(theme.hpBar)
  expect(sheet.style.getPropertyValue('--sheet-bg')).toBe(theme.bgSurface)
  // No fonts either: the sheet inherits the app chrome's type — the font
  // every other menu renders in — exactly like an NPC sheet and a matched GM
  // panel body.
  expect(sheet.style.getPropertyValue('--sheet-heading-font')).toBe('')
  expect(sheet.style.getPropertyValue('--sheet-text-font')).toBe('')

  // No flat-section override, no custom CSS, no imported fonts, no Customize
  // button — an NPC sheet has none of them either.
  expect(sheet.className).not.toContain('character-sheet--flat')
  expect(sheet.querySelector('style')).toBeNull()
  expect(
    document.head.querySelector('link[data-grimoire-fonts]'),
  ).toBeNull()
  expect(screen.queryByRole('button', { name: 'Customize' })).toBeNull()

  // Not one per-sheet value survives on the element.
  for (const garish of GARISH) {
    expect(sheet.getAttribute('style')).not.toContain(garish)
  }

  // Combat Stats read the app theme's shared palette, like an NPC row.
  const stats = appThemeStatColors('parchment')
  const row = statTokenColors(sheet)
  expect(row.Milestones).toBe(stats.milestone)
  expect(row.Evasion).toBe(stats.evasion)
  expect(row.Armor).toBe(stats.armor)
  expect(row.Movement).toBe(stats.movement)
  expect(row['Save DC']).toBe(stats.saveDC)
  expect(row['END Recovery']).toBe(stats.endRecovery)

  // Read-only: the record was only read, never rewritten.
  expect(pc.config.colors.accent).toBe('#ff00ff')
  expect(pc.config.backgroundColor).toBe('#123123')
  expect(pc.config.customCss).toBe(
    '.character-sheet { outline: 3px solid red; }',
  )
})

test('Match app theme: midnight drops the card background to the default too', () => {
  // Midnight is the one theme whose sheet card background is a config value
  // (the historical look) rather than the palette's surface — and with the
  // switch on it is the DEFAULT config's value, never the player's.
  const { sheet } = renderSheet(true)

  expect(sheet.style.getPropertyValue('--sheet-bg')).toBe(
    DEFAULT_SHEET_CONFIG.backgroundColor,
  )
  expect(sheet.style.getPropertyValue('--accent-violet')).toBe(
    DEFAULT_SHEET_COLORS.accent,
  )
})

test('Match app theme: the whole style matches the NPC reference exactly', () => {
  // Same helper, same default config: the two standalone sheet bodies cannot
  // drift apart.
  useAppThemeStore.setState({ theme: 'mikami' })
  const { sheet } = renderSheet(true)

  const reference = appThemeSheetVars('mikami') as Record<string, string>
  for (const [name, value] of Object.entries(reference)) {
    expect(sheet.style.getPropertyValue(name), name).toBe(value)
  }
})
