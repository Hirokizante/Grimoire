/**
 * NPCStatsSection — combat stats for an NPC, displayed as stat tokens.
 *
 * Unlike the CharacterSheet's StatsSection, NPC stats are manually entered
 * (not derived from attributes) and there are no resource bars, no HP
 * tracking, no death saves, no mortal wounds, and no recover action.
 *
 * Uses the same `stat-token` card style as the player sheet's StatsSection
 * for visual consistency. Each stat gets its own accent color from the
 * sheet theme.
 *
 * In edit mode, each stat value is an editable number input.
 *
 * The `variant` prop controls the wrapper:
 *   - "section" (default): full `.sheet-section` card wrapper
 *   - "flat": flat block for embedding inside the hero section
 */

import { Wind, Shield, Footprints, Target, Heart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
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
  /** Theme color key from SheetColors. */
  color: string
}

export default function NPCStatsSection({
  npc,
  mode = 'view',
  variant = 'section',
}: NPCStatsSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'

  const colors = npc.config.colors
  const statTokens: StatTokenMeta[] = [
    { label: 'Evasion', key: 'evasion', icon: Wind, color: colors.tokenEvasion },
    { label: 'Armor', key: 'armor', icon: Shield, color: colors.tokenArmor },
    { label: 'Movement', key: 'movement', icon: Footprints, color: colors.tokenMovement },
    { label: 'Save DC', key: 'saveDC', icon: Target, color: colors.tokenSaveDC },
    { label: 'HP', key: 'hp', icon: Heart, color: colors.hpBar },
  ]

  const setStat = (key: keyof NPCStats, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    update((c) => ({
      ...c,
      npcStats: { ...(c.npcStats ?? { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20 }), [key]: n },
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
          const value = npc.npcStats?.[token.key] ?? 0
          return (
            <div
              key={token.label}
              className="stat-token"
              style={{ '--token-color': token.color } as React.CSSProperties}
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
                  <span className="stat-token__value">{value}</span>
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
