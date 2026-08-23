import { test, expect } from 'vitest'
import {
  appThemeSheetCardBackground,
  appThemeSheetColors,
  appThemeColorVars,
  appThemeSheetPageBackground,
  colorVars,
} from '@/lib/themeUtils'
import {
  DEFAULT_SHEET_COLORS,
  MIKAMI_SHEET_COLORS,
  PARCHMENT_SHEET_COLORS,
  PITCH_BLACK_SHEET_COLORS,
} from '@/constants/gameData'
import type { SheetConfig } from '@/types'

test('appThemeSheetColors: midnight returns the built-in default palette', () => {
  expect(appThemeSheetColors('midnight')).toEqual(DEFAULT_SHEET_COLORS)
})

test('appThemeSheetColors: parchment returns the warm parchment palette', () => {
  expect(appThemeSheetColors('parchment')).toEqual(PARCHMENT_SHEET_COLORS)
})

test('appThemeSheetColors: mikami returns the Nord palette', () => {
  expect(appThemeSheetColors('mikami')).toEqual(MIKAMI_SHEET_COLORS)
})

test('appThemeSheetColors: pitch-black returns the pure black palette', () => {
  expect(appThemeSheetColors('pitch-black')).toEqual(PITCH_BLACK_SHEET_COLORS)
})

test('parchment palette honors the app theme anchors', () => {
  expect(PARCHMENT_SHEET_COLORS.bgBase).toBe('#262626')
  expect(PARCHMENT_SHEET_COLORS.accentSoft).toBe('#c5b8a0')
})

test('mikami palette honors the Ghostty Mikami anchors', () => {
  expect(MIKAMI_SHEET_COLORS.bgBase).toBe('#141414')
  expect(MIKAMI_SHEET_COLORS.textPrimary).toBe('#ffffff')
  expect(MIKAMI_SHEET_COLORS.accent).toBe('#81a1c1')
  expect(MIKAMI_SHEET_COLORS.danger).toBe('#bf616a')
})

test('pitch-black palette honors the Ghostty Pitch Black anchors', () => {
  expect(PITCH_BLACK_SHEET_COLORS.bgBase).toBe('#000000')
  expect(PITCH_BLACK_SHEET_COLORS.textPrimary).toBe('#c1c1c1')
  expect(PITCH_BLACK_SHEET_COLORS.accent).toBe('#f3ecd4')
})

test('colorVars maps the parchment palette onto the shared sheet variables', () => {
  const vars = colorVars(appThemeSheetColors('parchment'))
  expect(vars['--bg-base']).toBe('#262626')
  expect(vars['--accent-violet-soft']).toBe('#c5b8a0')
  expect(vars['--accent-blush']).toBe(PARCHMENT_SHEET_COLORS.hpBar)
})

test('appThemeColorVars matches colorVars of the theme palette', () => {
  for (const theme of ['midnight', 'parchment', 'mikami', 'pitch-black'] as const) {
    expect(appThemeColorVars(theme)).toEqual(colorVars(appThemeSheetColors(theme)))
  }
})

test('sheet card/page backgrounds follow the theme except in midnight', () => {
  const config = {
    backgroundColor: '#123123',
    pageBackgroundColor: '#321321',
  } as SheetConfig

  // Midnight keeps the character's own colors.
  expect(appThemeSheetCardBackground('midnight', config)).toBe('#123123')
  expect(appThemeSheetPageBackground('midnight', config)).toBe('#321321')

  // Every other theme uses its own palette.
  for (const theme of ['parchment', 'mikami', 'pitch-black'] as const) {
    const colors = appThemeSheetColors(theme)
    expect(appThemeSheetCardBackground(theme, config)).toBe(colors.bgSurface)
    expect(appThemeSheetPageBackground(theme, config)).toBe(colors.bgBase)
  }
})
