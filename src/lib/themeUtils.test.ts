import { test, expect } from 'vitest'
import {
  appThemeSheetCardBackground,
  appThemeSheetColors,
  appThemeColorVars,
  appThemeStatColors,
  appThemeSheetPageBackground,
  appThemeSheetVars,
  appThemeStatusDurationColors,
  colorVars,
  gmPanelSheetPresentation,
  STAT_TOKEN_COLORS,
  STATUS_DURATION_COLORS,
  statusDurationColor,
} from '@/lib/themeUtils'
import type { StatColorKey } from '@/lib/themeUtils'
import { APP_THEMES } from '@/store/appThemeStore'
import {
  createDefaultCharacter,
  createDefaultNPC,
  DEFAULT_SHEET_COLORS,
  DEFAULT_SHEET_CONFIG,
  MIKAMI_SHEET_COLORS,
  PARCHMENT_SHEET_COLORS,
  PITCH_BLACK_SHEET_COLORS,
} from '@/constants/gameData'
import type { PanelStatusDuration, SheetConfig } from '@/types'

/** The six tokens a player sheet's Combat Stats row shows, in reading order. */
const PLAYER_STAT_KEYS: StatColorKey[] = [
  'milestone',
  'evasion',
  'armor',
  'movement',
  'saveDC',
  'endRecovery',
]

/** The six an NPC's Combat Stats row shows, in reading order. */
const NPC_STAT_KEYS: StatColorKey[] = [
  'evasion',
  'armor',
  'movement',
  'saveDC',
  'hp',
  'mortalWounds',
]

/** The four stats BOTH rows show — the ones that have to match across panels. */
const SHARED_STAT_KEYS: StatColorKey[] = [
  'evasion',
  'armor',
  'movement',
  'saveDC',
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

// ---- Standalone sheets that follow the app theme ----------------------------

test('appThemeSheetVars: default config is the theme palette plus default card background', () => {
  const vars = appThemeSheetVars('parchment') as Record<string, string>

  // The theme's own values, variable for variable.
  expect(vars['--bg-base']).toBe(PARCHMENT_SHEET_COLORS.bgBase)
  expect(vars['--accent-violet']).toBe(PARCHMENT_SHEET_COLORS.accent)
  expect(vars['--hp-bar-color']).toBe(PARCHMENT_SHEET_COLORS.hpBar)
  // The historical standalone card background — never a character's own
  // customization.
  expect(vars['--sheet-bg']).toBe(
    appThemeSheetCardBackground('parchment', DEFAULT_SHEET_CONFIG),
  )
  // No fonts: an unconfigured sheet inherits the app chrome's type, exactly
  // like every other menu and a matched GM panel body.
  expect(vars['--sheet-heading-font']).toBeUndefined()
  expect(vars['--sheet-heading-weight']).toBeUndefined()
  expect(vars['--sheet-label-font']).toBeUndefined()
  expect(vars['--sheet-text-font']).toBeUndefined()
  expect(vars['--sheet-helper-font']).toBeUndefined()
})

test('appThemeSheetVars: an NPC config renders identically to the default', () => {
  // An NPC record carries the default config, so a character sheet that passes
  // no config at all (the "Match app theme" switch) must land on the exact same
  // style an NPC sheet renders — under every app theme.
  for (const theme of APP_THEMES) {
    expect(appThemeSheetVars(theme, createDefaultNPC().config)).toEqual(
      appThemeSheetVars(theme),
    )
  }
})

// ---- GM panel sheet bodies --------------------------------------------------

/** A player config whose every customization is impossible to miss. */
function customizedSheetConfig(): SheetConfig {
  const { config } = createDefaultCharacter()
  return {
    ...config,
    backgroundColor: '#123123',
    sectionHeadingFontFamily: 'Playfair Display',
    sectionHeadingFontWeight: '800',
    labelFontFamily: 'Cinzel',
    textFontFamily: 'Georgia',
    helperTextFontFamily: 'monospace',
    hideSectionBackground: true,
    colors: {
      ...DEFAULT_SHEET_COLORS,
      bgBase: '#010203',
      accent: '#ff00ff',
      hpBar: '#00ff00',
    },
  }
}

test('gmPanelSheetPresentation: matching the app theme drops every per-sheet value', () => {
  const { className, style: rawStyle } = gmPanelSheetPresentation(
    customizedSheetConfig(),
    'parchment',
    true,
  )
  const style = rawStyle as Record<string, string>

  // Exactly the app theme's palette, variable for variable.
  expect(style).toEqual(appThemeColorVars('parchment'))
  // Nothing per-sheet survives: no custom card background, no custom fonts,
  // and no flat-section layout override.
  expect(style['--sheet-bg']).toBeUndefined()
  expect(style['--sheet-heading-font']).toBeUndefined()
  expect(style['--sheet-text-font']).toBeUndefined()
  expect(className).toBe('character-sheet character-sheet--view gm-panel__sheet')
  expect(className).not.toContain('character-sheet--flat')
  for (const garish of ['#123123', '#010203', '#ff00ff', '#00ff00']) {
    expect(Object.values(style)).not.toContain(garish)
  }
})

test('gmPanelSheetPresentation: without the setting the sheet keeps its customization', () => {
  const { className, style: rawStyle } = gmPanelSheetPresentation(
    customizedSheetConfig(),
    'parchment',
    false,
  )
  const style = rawStyle as Record<string, string>

  expect(style['--sheet-bg']).toBe('#123123')
  expect(style['--sheet-heading-font']).toBe('Playfair Display')
  expect(style['--sheet-heading-weight']).toBe('800')
  expect(style['--sheet-label-font']).toBe('Cinzel')
  expect(style['--sheet-text-font']).toBe('Georgia')
  expect(style['--sheet-helper-font']).toBe('monospace')
  expect(style['--bg-base']).toBe('#010203')
  expect(style['--accent-violet']).toBe('#ff00ff')
  expect(style['--hp-bar-color']).toBe('#00ff00')
  expect(className).toContain('character-sheet--flat')
})

test('gmPanelSheetPresentation: matching the app theme is identical to an NPC panel', () => {
  // An NPC panel always matches the app theme, so its body is the reference a
  // player panel has to hit with the setting on — under every app theme.
  const player = customizedSheetConfig()
  const npc = createDefaultNPC().config

  for (const theme of APP_THEMES) {
    expect(gmPanelSheetPresentation(player, theme, true)).toEqual(
      gmPanelSheetPresentation(npc, theme, true),
    )
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

test('every app theme has a full stat palette covering both rows', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeStatColors(theme)
    expect(palette).toBe(STAT_TOKEN_COLORS[theme])
    for (const key of new Set([...PLAYER_STAT_KEYS, ...NPC_STAT_KEYS])) {
      expect(palette[key], `${theme}.${key}`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  }
})

test('the stats both rows share are palette keys, not per-row colors', () => {
  // The whole point of one palette: Evasion/Armor/Movement/Save DC are read
  // from the same entry by a player row and an NPC row, so two panels can never
  // disagree about what a stat looks like.
  for (const theme of APP_THEMES) {
    const palette = appThemeStatColors(theme)
    for (const key of SHARED_STAT_KEYS) {
      expect(PLAYER_STAT_KEYS).toContain(key)
      expect(NPC_STAT_KEYS).toContain(key)
      expect(palette[key], `${theme}.${key}`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  }
})

test('the accents within one Combat Stats row are all different', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeStatColors(theme)
    for (const [rowName, row] of [
      ['player', PLAYER_STAT_KEYS],
      ['npc', NPC_STAT_KEYS],
    ] as const) {
      const values = row.map((key) => palette[key].toLowerCase())
      expect(
        new Set(values).size,
        `${theme} ${rowName} row has duplicate accents`,
      ).toBe(row.length)
    }
  }
})

test('NPC HP token keeps the theme HP bar color, wounds never match it', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeStatColors(theme)
    expect(palette.hp, `${theme} HP`).toBe(appThemeSheetColors(theme).hpBar)
    // The regression this palette exists for: a wound accent that reads as the
    // HP token (they were the same color in Mikami).
    expect(palette.mortalWounds.toLowerCase()).not.toBe(palette.hp.toLowerCase())
  }
})

test('stat accents stay distinct within a row and visible on every theme card', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeStatColors(theme)
    const surface = appThemeSheetColors(theme).bgSurface

    // Every accent has to read against the token it sits on.
    for (const key of Object.keys(palette) as StatColorKey[]) {
      expect(
        contrastRatio(palette[key], surface),
        `${theme}.${key} vs card surface`,
      ).toBeGreaterThanOrEqual(3.5)
    }

    // Distinctness is per ROW: the six stripes a GM reads side by side are the
    // ones inside one row. (Milestones and HP may share a hue — Pitch Black's
    // gold is both — because those two never appear together.)
    for (const [rowName, row] of [
      ['player', PLAYER_STAT_KEYS],
      ['npc', NPC_STAT_KEYS],
    ] as const) {
      for (let i = 0; i < row.length; i++) {
        for (let j = i + 1; j < row.length; j++) {
          expect(
            deltaE76(palette[row[i]], palette[row[j]]),
            `${theme} ${rowName}: ${row[i]} vs ${row[j]}`,
          ).toBeGreaterThanOrEqual(16)
        }
      }
    }
  }
})

// ---- Status-duration accents (GM Screen pills) ------------------------------

/** The five status durations, in picker order. */
const DURATION_KEYS: PanelStatusDuration[] = [
  'quick',
  'persistent',
  'countdown',
  'permanent',
  'conditional',
]

test('every app theme has a full status-duration palette', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeStatusDurationColors(theme)
    expect(palette).toBe(STATUS_DURATION_COLORS[theme])
    for (const key of DURATION_KEYS) {
      expect(palette[key], `${theme}.${key}`).toMatch(/^#[0-9a-f]{6}$/i)
      expect(statusDurationColor(theme, key)).toBe(palette[key])
    }
  }
})

test('status-duration accents stay distinct and legible on every theme', () => {
  for (const theme of APP_THEMES) {
    const palette = appThemeStatusDurationColors(theme)
    const surface = appThemeSheetColors(theme).bgSurface

    for (let i = 0; i < DURATION_KEYS.length; i++) {
      const key = DURATION_KEYS[i]
      // The tone paints each pill's duration icon and the duration chip's
      // frame: small text and glyphs, so it needs body-text contrast, not the
      // 3px-stripe floor the NPC tokens use.
      expect(
        contrastRatio(palette[key], surface),
        `${theme}.${key} vs panel surface`,
      ).toBeGreaterThanOrEqual(4.5)

      for (let j = i + 1; j < DURATION_KEYS.length; j++) {
        const other = DURATION_KEYS[j]
        expect(
          deltaE76(palette[key], palette[other]),
          `${theme}: ${key} vs ${other}`,
        ).toBeGreaterThanOrEqual(16)
      }
    }
  }
})
