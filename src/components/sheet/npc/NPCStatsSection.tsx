/**
 * NPCStatsSection — combat stats for an NPC, displayed as stat tokens.
 *
 * Unlike the CharacterSheet's StatsSection, NPC stats are manually entered
 * (not derived from attributes) and there are no resource bars, no HP
 * tracking, no death saves, and no recover action. Mortal Wounds is a plain
 * stat here — a static reference value, not the player sheet's wound track.
 *
 * Uses the same `stat-token` card style as the player sheet's StatsSection
 * for visual consistency. Each stat gets its own accent color from the
 * active app theme's NPC stat palette (see NPC_STAT_TOKEN_COLORS) — NPC
 * sheets have no per-sheet customization, so they follow the app theme
 * everywhere else too (page/card backgrounds, palette), and the record's own
 * stored colors are deliberately ignored: a record saved before a color key
 * existed would otherwise render that token with no stripe at all.
 *
 * In edit mode, each stat value is an editable number input.
 *
 * The `variant` prop controls the wrapper:
 *   - "section" (default): full `.sheet-section` card wrapper
 *   - "flat": flat block for embedding inside the hero section
 */

import { Wind, Shield, Footprints, Target, Heart, Skull } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { appThemeNpcStatColors } from '@/lib/themeUtils'
import {
  DEFAULT_NPC_STATS,
  effectiveNPCStats,
  formatModifierValue,
} from '@/lib/abilityModifiers'
import type { Character, NPCStats } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface NPCStatsSectionProps {
  npc: Character
  mode?: SheetMode
  /**
   * "section" (default) wraps the stats in a full `.sheet-section` card.
   * "flat" renders the content without a section wrapper so it can be
   * embedded inside the hero section.
   */
  variant?: 'section' | 'flat'
}

/** Metadata for each NPC stat token: icon, label, key in NPCStats, color. */
interface StatTokenMeta {
  label: string
  key: keyof NPCStats
  icon: LucideIcon
  /** Accent hex from the app theme's NPC stat palette. */
  color: string
}

export default function NPCStatsSection({
  npc,
  mode = 'view',
  variant = 'section',
}: NPCStatsSectionProps) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter)
  const update = (updater: (c: Character) => Character) =>
    updateCharacter(npc.id, updater)
  // Standalone NPC sheets follow the app theme (see NPCSheet) — including the
  // Combat Stats accents, which come from the theme's NPC stat palette.
  const appTheme = useAppThemeStore((s) => s.theme)
  const isEdit = mode === 'edit'

  // View mode shows stats with any switched-on ability modifiers applied;
  // edit mode always shows the manually-entered base values.
  const baseStats: NPCStats = { ...DEFAULT_NPC_STATS, ...(npc.npcStats ?? {}) }
  const stats = effectiveNPCStats(npc)

  const colors = appThemeNpcStatColors(appTheme)
  const statTokens: StatTokenMeta[] = [
    { label: 'Evasion', key: 'evasion', icon: Wind, color: colors.evasion },
    { label: 'Armor', key: 'armor', icon: Shield, color: colors.armor },
    { label: 'Movement', key: 'movement', icon: Footprints, color: colors.movement },
    { label: 'Save DC', key: 'saveDC', icon: Target, color: colors.saveDC },
    { label: 'HP', key: 'hp', icon: Heart, color: colors.hp },
    { label: 'Mortal Wounds', key: 'mortalWounds', icon: Skull, color: colors.mortalWounds },
  ]

  const setStat = (key: keyof NPCStats, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    update((c) => ({
      ...c,
      npcStats: { ...(c.npcStats ?? { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20, mortalWounds: 0 }), [key]: n },
    }))
  }

  const sectionClass =
    variant === 'flat'
      ? 'stat-block--flat'
      : 'sheet-section sheet-section--stats'
  const headingClass =
    variant === 'flat'
      ? 'stat-block__heading'
      : 'sheet-section__heading'

  return (
    <section className={sectionClass}>
      <h3 className={headingClass}>Combat Stats</h3>

      <div className="stat-tokens">
        {statTokens.map((token) => {
          const Icon = token.icon
          const value = isEdit ? baseStats[token.key] : stats[token.key]
          const delta = stats[token.key] - baseStats[token.key]
          const modified = !isEdit && delta !== 0
          return (
            <div
              key={token.label}
              className={'stat-token' + (modified ? ' stat-token--modified' : '')}
              style={{ '--token-color': token.color } as React.CSSProperties}
              title={modified ? 'Includes active ability modifiers' : undefined}
            >
              <div className="stat-token__left">
                <Icon className="stat-token__icon" size={18} strokeWidth={2.2} />
                {isEdit ? (
                  <input
                    type="number"
                    className="sheet-input stat-token__input"
                    value={value}
                    onChange={(e) => setStat(token.key, e.target.value)}
                    min={0}
                  />
                ) : (
                  <>
                    <span className="stat-token__value">{value}</span>
                    {modified && (
                      <span className="stat-token__delta">
                        {formatModifierValue(delta)}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="stat-token__right">
                <span className="stat-token__label">{token.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
