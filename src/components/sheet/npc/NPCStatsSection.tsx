/**
 * NPCStatsSection — combat stats for an NPC, displayed as large stylish cards.
 *
 * Unlike the CharacterSheet's StatsSection, NPC stats are manually entered
 * (not derived from attributes) and there are no resource bars, no HP
 * tracking, no death saves, no mortal wounds, and no recover action.
 *
 * Each stat gets its own distinct color and a prominent value display.
 * In edit mode, each stat value is an editable number input.
 */

import { Wind, Shield, Footprints, Target, Heart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useCharacterStore } from '@/store/characterStore'
import type { Character, NPCStats } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface NPCStatsSectionProps {
  npc: Character
  mode?: SheetMode
}

/** Metadata for each NPC stat card: icon, label, key in NPCStats, color. */
interface StatCardMeta {
  label: string
  key: keyof NPCStats
  icon: LucideIcon
  /** Distinct hex color for this stat's accent (stripe, icon, glow). */
  color: string
}

/** Five distinct stat colors — no reuse. */
const STAT_COLORS = {
  evasion: '#e85a8a',
  armor: '#7bc4d6',
  movement: '#e8b04a',
  saveDC: '#9b7ed6',
  hp: '#e85252',
} as const

export default function NPCStatsSection({
  npc,
  mode = 'view',
}: NPCStatsSectionProps) {
  const update = useCharacterStore((s) => s.updateCurrentCharacter)
  const isEdit = mode === 'edit'

  const stats: StatCardMeta[] = [
    { label: 'Evasion', key: 'evasion', icon: Wind, color: STAT_COLORS.evasion },
    { label: 'Armor', key: 'armor', icon: Shield, color: STAT_COLORS.armor },
    { label: 'Movement', key: 'movement', icon: Footprints, color: STAT_COLORS.movement },
    { label: 'Save DC', key: 'saveDC', icon: Target, color: STAT_COLORS.saveDC },
    { label: 'HP', key: 'hp', icon: Heart, color: STAT_COLORS.hp },
  ]

  const setStat = (key: keyof NPCStats, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    update((c) => ({
      ...c,
      npcStats: { ...(c.npcStats ?? { evasion: 10, armor: 0, movement: 5, saveDC: 10, hp: 20 }), [key]: n },
    }))
  }

  return (
    <section className="sheet-section sheet-section--npc-stats">
      <h3 className="sheet-section__heading">Combat Stats</h3>

      <div className="npc-stat-cards">
        {stats.map((token) => {
          const Icon = token.icon
          const value = npc.npcStats?.[token.key] ?? 0
          return (
            <div
              key={token.label}
              className="npc-stat-card"
              style={{ '--npc-stat-color': token.color } as React.CSSProperties}
            >
              <span className="npc-stat-card__stripe" />
              <Icon className="npc-stat-card__icon" size={22} strokeWidth={2} />
              {isEdit ? (
                <input
                  type="number"
                  className="sheet-input npc-stat-card__input"
                  value={value}
                  onChange={(e) => setStat(token.key, e.target.value)}
                  min={0}
                />
              ) : (
                <span className="npc-stat-card__value">{value}</span>
              )}
              <span className="npc-stat-card__label">{token.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
