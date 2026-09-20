/**
 * Shared helpers for mapping SheetColors onto CSS custom properties.
 *
 * Used by CharacterSheet, DiceRollOverlay, and RollLogDrawer so they all
 * inherit the active character's theme consistently.
 */

import type { CSSProperties } from 'react'

import type { PanelStatusDuration, SheetColors, SheetConfig } from '@/types'
import {
  DEFAULT_SHEET_COLORS,
  DEFAULT_SHEET_CONFIG,
  MIKAMI_SHEET_COLORS,
  PARCHMENT_SHEET_COLORS,
  PITCH_BLACK_SHEET_COLORS,
} from '@/constants/gameData'
import type { AppTheme } from '@/store/appThemeStore'

/**
 * Sheet palette that follows the app theme. Used by NPC sheets, which have
 * no per-sheet customization: a standalone NPC sheet matches the app chrome
 * (Midnight = the built-in defaults, every other theme = its own palette).
 *
 * Embedded NPC sections never call this — they inherit the player sheet's
 * own color variables, so the player sheet theme takes precedence there.
 */
export function appThemeSheetColors(theme: AppTheme): SheetColors {
  switch (theme) {
    case 'parchment':
      return PARCHMENT_SHEET_COLORS
    case 'mikami':
      return MIKAMI_SHEET_COLORS
    case 'pitch-black':
      return PITCH_BLACK_SHEET_COLORS
    default:
      return DEFAULT_SHEET_COLORS
  }
}

/**
 * Every Combat Stats token the app renders, on either kind of sheet.
 *
 * Deliberately NOT `keyof SheetColors`: the player row shows Milestones and END
 * Recovery where an NPC's shows HP and Mortal Wounds, so the two rows need one
 * shared set of keys rather than the per-sheet palette's (see
 * {@link STAT_TOKEN_COLORS}).
 */
export type StatColorKey =
  | 'milestone'
  | 'evasion'
  | 'armor'
  | 'movement'
  | 'saveDC'
  | 'endRecovery'
  | 'hp'
  | 'mortalWounds'

/**
 * Accents for the Combat Stats token rows — one palette per app theme, shared
 * by player and NPC sheets so the SAME stat is the SAME color wherever it is
 * read.
 *
 * A player row reads Milestones / Evasion / Armor / Movement / Save DC / END
 * Recovery; an NPC row reads Evasion / Armor / Movement / Save DC / HP / Mortal
 * Wounds. The four in the middle are the same stats, so they hold the same hues
 * in every theme — which is why this palette exists instead of each row reading
 * its own colors. Two rows on one GM Screen used to disagree about what
 * "Evasion" or "Movement" looked like, and a sheet's own palette could not fix
 * that: its token colors are picked for one sheet's taste, not for a row of six
 * stripes that have to stay apart (Evasion and HP were the same blush in
 * Midnight and Parchment, HP and Mortal Wounds the same red in Mikami,
 * Armor/Movement both grays in Pitch Black, and a record stored before a color
 * key existed rendered that token colorless entirely).
 *
 * Mapped by meaning:
 *   Evasion       — cool cyan/teal (air, dodging)
 *   Armor         — steel blue/slate (metal)
 *   Movement      — green/moss (motion)
 *   Save DC       — violet/plum/cream (arcane)
 *   HP            — the theme's HP bar color, matching the rest of the app
 *   Mortal Wounds — deep blood red/orange, always distinct from HP
 *   Milestones    — gold/amber (the reward/achievement accent, and the color
 *                   every shipped sheet palette already gives this token)
 *   END Recovery  — the row's calm one: mint in Midnight, a parchment/warm
 *                   neutral in Parchment, Nord snow in Mikami, taupe in Pitch
 *                   Black. Recovery is the restorative read-out, so it takes a
 *                   quiet tone rather than competing with the six above.
 *
 * Distinctness is a requirement, not a nicety: the six stripes of a row have to
 * be tellable at a glance even at 3px tall, so themeUtils.test.ts enforces a
 * floor of ΔE(CIE76) >= 16 between every pair WITHIN a row and >= 3.5:1 contrast
 * against the card surface. The shipped palettes sit at >= 18 ΔE and >= 3.7:1.
 * (Milestones and HP may share a hue in a theme — Pitch Black's gold is both —
 * since those two never appear in the same row.)
 */
export const STAT_TOKEN_COLORS: Record<
  AppTheme,
  Record<StatColorKey, string>
> = {
  // Dark indigo. Cyan Evasion, steel-blue Armor and green Movement keep the
  // row's three cool stats apart; HP keeps the app's signature blush so it
  // matches every HP bar, with Mortal Wounds pushed to a deeper blood red.
  // Milestones take the sheet's own amber, and END Recovery a mint that reads
  // as restorative without colliding with the cyan Evasion or green Movement.
  midnight: {
    milestone: '#e0b054',
    evasion: '#5ec8d8',
    armor: '#7ba7d6',
    movement: '#a9e6a0',
    saveDC: '#9b7ed6',
    endRecovery: '#7fd6c2',
    hp: '#e8a0bf',
    mortalWounds: '#e0574f',
  },
  // Warm charcoal with parchment highlights. Muted and low-saturation to sit
  // in the theme: sage teal, slate blue and moss green for the cool stats, a
  // dusty plum for the arcane Save DC, terracotta HP and a brick-red wound,
  // with the sheet's muted gold for Milestones and a warm sand for the calm
  // END Recovery.
  parchment: {
    milestone: '#d9b26a',
    evasion: '#93b5ad',
    armor: '#9aa8bd',
    movement: '#a8cfa0',
    saveDC: '#b390a8',
    endRecovery: '#c0b79f',
    hp: '#c98f74',
    mortalWounds: '#cf6363',
  },
  // Nord on near-black: the aurora set, using the deeper frost blue (#5e81ac)
  // for Armor so it no longer reads as a twin of the cyan Evasion token, and
  // burnt orange for Mortal Wounds so it stays distinct from the red HP.
  // Milestones keep Nord's yellow and END Recovery its snow — the two colors
  // the Mikami sheet palette gives those tokens already.
  mikami: {
    milestone: '#ebcb8b',
    evasion: '#88c0d0',
    armor: '#5e81ac',
    movement: '#a3be8c',
    saveDC: '#b48ead',
    endRecovery: '#d8dee9',
    hp: '#bf616a',
    mortalWounds: '#d08770',
  },
  // Pure black with cream, gold and muted teal. Armor and Movement leave the
  // gray band they shared (slate vs moss) and Mortal Wounds is lifted off the
  // theme's near-black surface so its stripe stays visible. Milestones keep the
  // theme's gold (its sheet palette's milestone color too) and END Recovery a
  // muted taupe — the one quiet warm hue left that clears both the cream Save
  // DC and the slate Armor.
  'pitch-black': {
    milestone: '#eecc6c',
    evasion: '#5f8787',
    armor: '#9aa8b5',
    movement: '#8fa87c',
    saveDC: '#f3ecd4',
    endRecovery: '#a89078',
    hp: '#eecc6c',
    mortalWounds: '#b4655c',
  },
}

/** Combat Stats accents for the given app theme. */
export function appThemeStatColors(
  theme: AppTheme,
): Record<StatColorKey, string> {
  return STAT_TOKEN_COLORS[theme]
}

/**
 * Accents for the GM Screen's status-duration pills — one palette per app
 * theme, mapped by meaning:
 *   Quick        — amber/yellow (a flash, gone by the next turn)
 *   Persistent   — blue (a repeating save)
 *   Countdown    — orange (a clock running down)
 *   Permanent    — pale neutral/cream (enduring, no urgency)
 *   Conditional  — teal/green (a state that comes and goes)
 *
 * The GM Screen is app chrome, so these follow the active theme like the panel
 * stat tokens do, and they are tuned per theme rather than picked once: the
 * five labels sit side by side in a single hairline pill, so they have to stay
 * tellable from each other AND legible as small text on each theme's surface.
 * `themeUtils.test.ts` enforces a floor of ΔE(CIE76) >= 16 between every pair
 * and >= 4.5:1 contrast against the panel surface (the pills' small duration
 * label is body text, not a 3px stripe).
 */
export const STATUS_DURATION_COLORS: Record<
  AppTheme,
  Record<PanelStatusDuration, string>
> = {
  // Dark indigo: warm amber vs a deeper orange for Quick/Countdown, frost blue
  // for Persistent, a pale lavender for Permanent, mint for Conditional.
  midnight: {
    quick: '#e8c26a',
    persistent: '#7fa8e8',
    countdown: '#e08a5f',
    permanent: '#b9b3d6',
    conditional: '#5fc9a8',
  },
  // Warm charcoal: the same hues dropped into parchment's low-saturation
  // register, with Permanent a warm sand rather than a cold gray.
  parchment: {
    quick: '#dcae6a',
    persistent: '#8fa8c8',
    countdown: '#d98a63',
    permanent: '#c0b79f',
    conditional: '#8fbfa8',
  },
  // Nord on near-black: the aurora set — Nord yellow, frost blue, Nord orange,
  // Nord purple (which reads as the cooler "enduring" accent here) and teal.
  mikami: {
    quick: '#ebcb8b',
    persistent: '#81a1c1',
    countdown: '#d08770',
    permanent: '#b48ead',
    conditional: '#8fbcbb',
  },
  // Pure black with cream and gold: Quick leaves the theme's gold (which is
  // the HP bar color) for a burnt amber, Countdown a brick red, and Permanent
  // takes the theme's cream so it reads as the calm, open-ended one.
  'pitch-black': {
    quick: '#e0a458',
    persistent: '#8fa8c8',
    countdown: '#c96a5f',
    permanent: '#f3ecd4',
    conditional: '#8fbfa8',
  },
}

/** Status-duration accents for the given app theme. */
export function appThemeStatusDurationColors(
  theme: AppTheme,
): Record<PanelStatusDuration, string> {
  return STATUS_DURATION_COLORS[theme]
}

/** The tone for one duration under the active app theme. */
export function statusDurationColor(
  theme: AppTheme,
  duration: PanelStatusDuration,
): string {
  return STATUS_DURATION_COLORS[theme][duration]
}

/**
 * Card background for a standalone sheet that follows the app theme.
 * Midnight keeps the character's own background (the historical look);
 * every other theme uses its surface color so the card matches the chrome.
 */
export function appThemeSheetCardBackground(
  theme: AppTheme,
  config: SheetConfig,
): string {
  return theme === 'midnight'
    ? config.backgroundColor
    : appThemeSheetColors(theme).bgSurface
}

/**
 * Page background for a standalone sheet that follows the app theme.
 * Midnight keeps the character's own page color; every other theme uses
 * its base color.
 */
export function appThemeSheetPageBackground(
  theme: AppTheme,
  config: SheetConfig,
): string {
  return theme === 'midnight'
    ? config.pageBackgroundColor
    : appThemeSheetColors(theme).bgBase
}

/**
 * CSS custom properties for a standalone sheet that follows the app theme.
 * NPCs have no per-sheet customization, so overlays that outlive the page
 * (dice result modal, roll log) use the theme's palette for them instead of
 * their midnight-default config colors.
 */
export function appThemeColorVars(theme: AppTheme): Record<string, string> {
  return colorVars(appThemeSheetColors(theme))
}

/**
 * CSS custom properties for a STANDALONE sheet body that follows the app
 * theme: the theme's palette plus the default sheet card background.
 *
 * Fonts are deliberately not set. With no per-sheet customization to honor,
 * the sheet inherits the surrounding app chrome's type — the same font every
 * other menu renders in, including the Terminal style's monospace — exactly
 * as a GM panel body with "Match app theme" on does (the `--sheet-*-font`
 * declarations in sheet.css all fall back to `inherit`).
 *
 * Both standalone sheets build their body through this one function so they
 * cannot drift apart: an NPC sheet always follows the app theme (its `config`
 * is the default), and a character sheet follows it when the
 * Settings → Character Sheets → "Match app theme" switch is on, at which
 * point it passes no `config` at all — `DEFAULT_SHEET_CONFIG` stands in for
 * every per-sheet value (card background), because that is exactly what the
 * switch disables.
 */
export function appThemeSheetVars(
  theme: AppTheme,
  config: SheetConfig = DEFAULT_SHEET_CONFIG,
): CSSProperties {
  return {
    '--sheet-bg': appThemeSheetCardBackground(theme, config),
    ...appThemeColorVars(theme),
  } as CSSProperties
}

/**
 * Class + CSS variables for the sheet body inside an EXPANDED GM panel.
 *
 * Both panel kinds build their body from this one function so the two can never
 * drift apart, and so "a player panel with the setting on" is literally the
 * same rendering as "an NPC panel":
 *
 *   - `matchAppTheme` true — the app theme's sheet palette and nothing
 *     per-sheet: no custom card background, no custom fonts, no
 *     `character-sheet--flat` layout override. NPC panels always pass true
 *     (they have no per-sheet customization); player panels pass the
 *     "Match app theme" GM setting from `gmPanelThemeStore`.
 *   - false — the sheet's own customization (palette, card background, fonts,
 *     and its flat-section preference), which is what a player panel shows by
 *     default.
 *
 * Deliberately a rendering concern only: it reads a copy of the config and
 * never writes, so the character record, its own sheet page, and its exported
 * theme are untouched by the setting.
 */
export function gmPanelSheetPresentation(
  config: SheetConfig,
  appTheme: AppTheme,
  matchAppTheme: boolean,
): { className: string; style: CSSProperties } {
  const baseClass = 'character-sheet character-sheet--view gm-panel__sheet'

  if (matchAppTheme) {
    return {
      className: baseClass,
      style: appThemeColorVars(appTheme) as CSSProperties,
    }
  }

  return {
    className:
      baseClass + (config.hideSectionBackground ? ' character-sheet--flat' : ''),
    style: {
      '--sheet-bg': config.backgroundColor,
      '--sheet-heading-font': config.sectionHeadingFontFamily,
      '--sheet-heading-weight': config.sectionHeadingFontWeight,
      '--sheet-label-font': config.labelFontFamily,
      '--sheet-text-font': config.textFontFamily,
      '--sheet-helper-font': config.helperTextFontFamily,
      ...colorVars(config.colors),
    } as CSSProperties,
  }
}

/**
 * Map a SheetColors object onto CSS custom properties. This is the single
 * injection point that drives the entire per-character theme.
 */
export function colorVars(colors: SheetColors): Record<string, string> {
  return {
    '--bg-base': colors.bgBase,
    '--bg-surface': colors.bgSurface,
    '--bg-surface-raised': colors.bgSurfaceRaised,
    '--bg-surface-hover': colors.bgSurfaceHover,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-muted': colors.textMuted,
    '--border': colors.border,
    '--border-soft': colors.borderSoft,
    '--accent-violet': colors.accent,
    '--accent-violet-soft': colors.accentSoft,
    '--accent-blush': colors.hpBar,
    '--danger': colors.danger,
    '--color-minor-ability': colors.minorAbility,
    '--color-success': colors.success,
    '--hp-bar-color': colors.hpBar,
    '--fp-bar-color': colors.fpBar,
    '--ap-bar-color': colors.apBar,
    '--end-bar-color': colors.endBar,
    '--color-token-milestone': colors.tokenMilestone,
    '--color-token-movement': colors.tokenMovement,
    '--color-token-evasion': colors.tokenEvasion,
    '--color-token-save-dc': colors.tokenSaveDC,
    '--color-token-armor': colors.tokenArmor,
    '--color-token-end-recovery': colors.tokenEndRecovery,
    '--color-token-mortal-wounds': colors.tokenMortalWounds,
  }
}

/**
 * Accent color keys from {@link SheetColors} that can be chosen as a Sub-Ability
 * color override. Each entry maps a SheetColors key to a CSS variable name and a
 * human-readable label for the color picker swatches.
 */
export const SUB_ABILITY_ACCENT_OPTIONS: {
  key: string
  label: string
  cssVar: string
}[] = [
  { key: 'accent', label: 'Accent', cssVar: '--accent-violet' },
  { key: 'accentSoft', label: 'Accent Soft', cssVar: '--accent-violet-soft' },
  { key: 'danger', label: 'Danger', cssVar: '--danger' },
  { key: 'success', label: 'Success', cssVar: '--color-success' },
  { key: 'minorAbility', label: 'Minor', cssVar: '--color-minor-ability' },
  { key: 'hpBar', label: 'HP', cssVar: '--hp-bar-color' },
  { key: 'fpBar', label: 'FP', cssVar: '--fp-bar-color' },
  { key: 'apBar', label: 'AP', cssVar: '--ap-bar-color' },
  { key: 'endBar', label: 'END', cssVar: '--end-bar-color' },
  { key: 'tokenMilestone', label: 'Milestone', cssVar: '--color-token-milestone' },
  { key: 'tokenMovement', label: 'Movement', cssVar: '--color-token-movement' },
  { key: 'tokenEvasion', label: 'Evasion', cssVar: '--color-token-evasion' },
  { key: 'tokenSaveDC', label: 'Save DC', cssVar: '--color-token-save-dc' },
  { key: 'tokenArmor', label: 'Armor', cssVar: '--color-token-armor' },
  { key: 'tokenEndRecovery', label: 'END Recovery', cssVar: '--color-token-end-recovery' },
  { key: 'tokenMortalWounds', label: 'Mortal Wounds', cssVar: '--color-token-mortal-wounds' },
]
