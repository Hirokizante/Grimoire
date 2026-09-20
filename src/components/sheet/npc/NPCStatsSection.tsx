/**
 * NPCStatsSection — combat stats for an NPC, displayed as stat tokens.
 *
 * Unlike the CharacterSheet's StatsSection, NPC stats are manually entered
 * (not derived from attributes) and there are no resource bars, no HP
 * tracking, no death saves, and no recover action. Mortal Wounds is a plain
 * stat here — the NPC's **allowance**, i.e. how many Mortal Wounds it can take
 * before 0 HP downs it — and an instance spawned on a GM screen reads it from
 * here (see `gmScreenStore`). The wounds an instance has actually taken are
 * tracked on its panel, never on this record.
 *
 * Uses the same `stat-token` card style as the player sheet's StatsSection
 * for visual consistency, and the same accent palette (STAT_TOKEN_COLORS): the
 * four stats the two rows share — Evasion, Armor, Movement, Save DC — are the
 * same color on an NPC sheet, a player sheet page, and a GM panel of either
 * kind. NPC sheets have no per-sheet customization, so they follow the app
 * theme everywhere (page/card backgrounds, palette), and the record's own
 * stored colors are deliberately ignored: a record saved before a color key
 * existed would otherwise render that token with no stripe at all.
 *
 * In edit mode, each stat value is an editable number input.
 *
 * The `variant` prop controls the wrapper:
 *   - "section" (default): full `.sheet-section` card wrapper
 *   - "flat": flat block for embedding inside the hero section
 */

import { Wind, Shield, Footprints, Target, Heart, Skull } from '@/components/ui/icons'
import type { AppIcon } from '@/components/ui/icons'

import { useCharacterStore } from '@/store/characterStore'
import { useAppThemeStore } from '@/store/appThemeStore'
import { appThemeStatColors } from '@/lib/themeUtils'
import {
  statTokenLabel,
  type StatTokenLabelMode,
} from '@/components/sheet/statTokenLabels'
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
  /**
   * How much of each stat name the token prints — see
   * {@link StatsSectionProps.tokenLabels}. "full" (default) is the sheet page;
   * an NPC's "Mortal Wounds" is the longest stat name in the app and a GM
   * Screen panel's token column is far too narrow for it, so panels ask for
   * "short" ("Wounds") and carry the full name as a tooltip.
   */
  tokenLabels?: StatTokenLabelMode
}

/** Metadata for each NPC stat token: icon, label, key in NPCStats, color. */
interface StatTokenMeta {
  label: string
  key: keyof NPCStats
  icon: AppIcon
  /** Accent hex from the app theme's NPC stat palette. */
  color: string
}

export default function NPCStatsSection({
  npc,
  mode = 'view',
  variant = 'section',
  tokenLabels = 'full',
}: NPCStatsSectionProps) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter)
  const update = (updater: (c: Character) => Character) =>
    updateCharacter(npc.id, updater)
  // Standalone NPC sheets follow the app theme (see NPCSheet) — including the
  // Combat Stats accents, which come from the theme's shared stat palette (the
  // one a player panel's row uses too, so both panels agree on every shared
  // stat).
  const appTheme = useAppThemeStore((s) => s.theme)
  const isEdit = mode === 'edit'

  // View mode shows stats with any switched-on ability modifiers applied;
  // edit mode always shows the manually-entered base values.
  const baseStats: NPCStats = { ...DEFAULT_NPC_STATS, ...(npc.npcStats ?? {}) }
  const stats = effectiveNPCStats(npc)

  const colors = appThemeStatColors(appTheme)
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
          // Short mode prints the shorthand; the full name rides along as the
          // tooltip so "Wounds" is never a guess (see statTokenLabel). Mortal
          // Wounds is the one stat with a rule attached — it is the allowance a
          // GM-screen instance rolls against — so the EDIT input spells that
          // out. View mode keeps the plain full-name tooltip the other tokens
          // carry, which is what the label vocabulary tests pin.
          const { text: label, title } = statTokenLabel(
            token.label,
            tokenLabels,
            modified,
          )
          const tooltip =
            isEdit && token.key === 'mortalWounds'
              ? 'Mortal Wounds this NPC can take before it goes down at 0 HP'
              : title
          return (
            <div
              key={token.label}
              className={'stat-token' + (modified ? ' stat-token--modified' : '')}
              style={{ '--token-color': token.color } as React.CSSProperties}
              title={tooltip}
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
                <span className="stat-token__line">
                  <span className="stat-token__label">{label}</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
