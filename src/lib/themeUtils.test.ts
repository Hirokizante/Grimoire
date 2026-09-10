import { test, expect } from 'vitest'
import {
  appThemeSheetCardBackground,
  appThemeSheetColors,
  appThemeColorVars,
  appThemeNpcStatColors,
  appThemeSheetPageBackground,
  colorVars,
  NPC_STAT_TOKEN_COLORS,
} from '@/lib/themeUtils'
import type { NPCStatColorKey } from '@/lib/themeUtils'
import { APP_THEMES } from '@/store/appThemeStore'
import {
  DEFAULT_SHEET_COLORS,
  MIKAMI_SHEET_COLORS,
  PARCHMENT_SHEET_COLORS,
  PITCH_BLACK_SHEET_COLORS,
} from '@/constants/gameData'
import type { SheetConfig } from '@/types'

/** The six NPC Combat Stats tokens, in sheet order. */
const NPC_STAT_KEYS: NPCStatColorKey[] = [
  'evasion',
  'armor',
  'movement',
  'saveDC',
  'hp',
  'mortalWounds',
]

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

// ---- NPC Combat Stats accents ----------------------------------------------

/** Parse a `#rrggbb` color into its sRGB channels. */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

/** Relative luminance (WCAG 2.1). */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colors. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** CIE76 ΔE — a compact "are these two accents clearly different?" metric. */
function deltaE76(a: string, b: string): number {
  const toLab = (hex: string): [number, number, number] => {
    const [r, g, b] = rgb(hex).map((c) => {
      const s = c / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29)
    const x = f((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047)
    const y = f(r * 0.2126729 + g * 0.7151522 + b * 0.072175)
    const z = f((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883)
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
  }
  const [l1, a1, b1] = toLab(a)
  const [l2, a2, b2] = toLab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

test('every app theme has a full NPC stat palette', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeNpcStatColors(theme)
    expect(palette).toBe(NPC_STAT_TOKEN_COLORS[theme])
    for (const key of NPC_STAT_KEYS) {
      expect(palette[key], `${theme}.${key}`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  }
})

test('NPC stat accents are all different within a theme', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeNpcStatColors(theme)
    const values = NPC_STAT_KEYS.map((key) => palette[key].toLowerCase())
    expect(new Set(values).size, `${theme} has duplicate accents`).toBe(
      NPC_STAT_KEYS.length,
    )
  }
})

test('NPC HP token keeps the theme HP bar color, wounds never match it', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeNpcStatColors(theme)
    expect(palette.hp, `${theme} HP`).toBe(appThemeSheetColors(theme).hpBar)
    // The regression this palette exists for: a wound accent that reads as the
    // HP token (they were the same color in Mikami).
    expect(palette.mortalWounds.toLowerCase()).not.toBe(palette.hp.toLowerCase())
  }
})

test('NPC stat accents stay distinct and visible on every theme card', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeNpcStatColors(theme)
    const surface = appThemeSheetColors(theme).bgSurface

    for (let i = 0; i < NPC_STAT_KEYS.length; i++) {
      const key = NPC_STAT_KEYS[i]
      // Each 3px stripe has to read against the token it sits on.
      expect(
        contrastRatio(palette[key], surface),
        `${theme}.${key} vs card surface`,
      ).toBeGreaterThanOrEqual(3.5)

      for (let j = i + 1; j < NPC_STAT_KEYS.length; j++) {
        const other = NPC_STAT_KEYS[j]
        expect(
          deltaE76(palette[key], palette[other]),
          `${theme}: ${key} vs ${other}`,
        ).toBeGreaterThanOrEqual(16)
      }
    }
  }
})
