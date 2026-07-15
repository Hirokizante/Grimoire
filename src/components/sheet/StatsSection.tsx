/**
 * StatsSection — combat stats, resource pools, and all live-play trackers.
 *
 * In **view mode**, this section is the live-play hub:
 *   - HP bar with inline +/− controls (click label → DamageDialog)
 *   - FP/AP/END bars with inline +/− controls
 *   - RecoverAction button (recover all END)
 *   - MortalWoundRoller for wound slots + rolling
 *   - DeathSaveTracker (shown when knocked out: 0 HP + 2 Mortal Wounds)
 *
 * In **edit mode**, all trackers are hidden — only the calculated stats and
 * bars are shown (edit mode is for building the sheet, not playing).
 *
 * The six derived stats (Milestones, Evasion, Armor, Movement, Save DC, END
 * Recovery) are displayed as stylized "stat tokens" with icons and accent
 * colors for visual flair.
 */

import { useState } from 'react'
import {
  Star,
  Wind,
  Shield,
  Footprints,
  Target,
  Heart,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import DamageDialog from '@/components/sheet/DamageDialog'
import DeathSaveTracker from '@/components/sheet/DeathSaveTracker'
import MortalWoundRoller from '@/components/sheet/MortalWoundRoller'
import RecoverAction from '@/components/sheet/RecoverAction'
import ResourceBar from '@/components/sheet/ResourceBar'
import CustomResourceBarModal from '@/components/sheet/CustomResourceBarModal'
import {
  calcArmor,
  calcENDRecovery,
  calcEvasion,
  calcHP,
  calcMilestoneBonus,
  calcMovement,
  calcSaveDC,
} from '@/lib/calculations'
import { MAX_AP, MAX_END, MAX_MORTAL_WOUNDS } from '@/constants/gameData'
import { useCharacterStore } from '@/store/characterStore'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface StatsSectionProps {
  character: Character
  mode?: SheetMode
  /**
   * "section" (default) wraps the stats in a full `.sheet-section` card.
   * "flat" renders the content without a section wrapper so it can be
   * embedded inside the hero section.
   */
  variant?: 'section' | 'flat'
}

/** Metadata for each derived stat token: icon, label, accent class. */
interface StatToken {
  label: string
  value: number | string
  sub?: string
  icon: LucideIcon
  /** Hex color used for stripe + icon. */
  color: string
}

export default function StatsSection({
  character,
  mode = 'view',
  variant = 'section',
}: StatsSectionProps) {
  const { attributes, milestones } = character

  const maxHP = calcHP(attributes.VIT)
  const milestoneBonus = calcMilestoneBonus(milestones)
  const evasion = calcEvasion(attributes.AGI)
  const armor = calcArmor(attributes.VIT)
  const movement = calcMovement(attributes.AGI)
  const saveDC = calcSaveDC(milestones)
  const endRecovery = calcENDRecovery(attributes.GRT)

  // Store actions for resource bars
  const spendAP = useCharacterStore((s) => s.spendAP)
  const restoreAP = useCharacterStore((s) => s.restoreAP)
  const spendEND = useCharacterStore((s) => s.spendEND)
  const restoreEND = useCharacterStore((s) => s.restoreEND)
  const spendFP = useCharacterStore((s) => s.spendFP)
  const restoreFP = useCharacterStore((s) => s.restoreFP)
  const heal = useCharacterStore((s) => s.heal)
  const addCustomResourceBar = useCharacterStore((s) => s.addCustomResourceBar)
  const removeCustomResourceBar = useCharacterStore((s) => s.removeCustomResourceBar)
  const spendCustomResourceBar = useCharacterStore((s) => s.spendCustomResourceBar)
  const restoreCustomResourceBar = useCharacterStore((s) => s.restoreCustomResourceBar)
  const customResourceBars = useCharacterStore((s) => s.currentCharacter?.customResourceBars ?? [])

  const [showDamageDialog, setShowDamageDialog] = useState(false)
  const [showAddBar, setShowAddBar] = useState(false)
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const isKnockedOut =
    character.currentHP <= 0 &&
    character.mortalWounds.filter((w) => w != null).length >= MAX_MORTAL_WOUNDS

  const sectionClass =
    variant === 'flat'
      ? 'stat-block--flat'
      : 'sheet-section sheet-section--stats'
  const headingClass =
    variant === 'flat'
      ? 'stat-block__heading'
      : 'sheet-section__heading'

  const colors = character.config.colors
  const statTokens: StatToken[] = [
    { label: 'Milestones', value: milestones, sub: `+${milestoneBonus} bonus`, icon: Star, color: colors.tokenMilestone },
    { label: 'Evasion', value: evasion, icon: Wind, color: colors.tokenEvasion },
    { label: 'Armor', value: armor, icon: Shield, color: colors.tokenArmor },
    { label: 'Movement', value: movement, icon: Footprints, color: colors.tokenMovement },
    { label: 'Save DC', value: saveDC, icon: Target, color: colors.tokenSaveDC },
    { label: 'END Recovery', value: endRecovery, icon: Heart, color: colors.tokenEndRecovery },
  ]

  return (
    <section className={sectionClass}>
      <h3 className={headingClass}>Combat Stats</h3>

      <div className="stat-tokens">
        {statTokens.map((token) => {
          const Icon = token.icon
          return (
            <div key={token.label} className="stat-token" style={{ '--token-color': token.color } as React.CSSProperties}>
              <div className="stat-token__left">
                <Icon className="stat-token__icon" size={18} strokeWidth={2.2} />
                <span className="stat-token__value">{token.value}</span>
              </div>
              <div className="stat-token__right">
                <span className="stat-token__label">{token.label}</span>
                {token.sub && <span className="stat-token__sub">{token.sub}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="stat-bars">
        <ResourceBar
          label="HP"
          value={character.currentHP}
          max={maxHP}
          color="var(--hp-bar-color)"
          interactive={isView}
          onSpend={() => {
            // Spending HP = taking 1 raw damage
            const store = useCharacterStore.getState()
            store.takeDamage(1)
          }}
          onRestore={() => heal(1)}
          onLabelClick={isView ? () => setShowDamageDialog(true) : undefined}
          labelTitle={isView ? 'Click to apply damage or heal' : undefined}
        />
        {character.tempHP > 0 && (
          <ResourceBar
            label="Temp HP"
            value={character.tempHP}
            max={character.tempHP}
            color="var(--fp-bar-color)"
          />
        )}
        <ResourceBar
          label="Fate Points"
          value={character.currentFP}
          max={character.maxFP}
          color="var(--fp-bar-color)"
          interactive={isView}
          onSpend={() => spendFP(1)}
          onRestore={() => restoreFP(1)}
        />
        <ResourceBar
          label="Action Points"
          value={character.currentAP}
          max={MAX_AP}
          color="var(--ap-bar-color)"
          interactive={isView}
          onSpend={() => spendAP(1)}
          onRestore={() => restoreAP(1)}
        />
        <ResourceBar
          label="Endurance"
          value={character.currentEND}
          max={MAX_END}
          color="var(--end-bar-color)"
          interactive={isView}
          onSpend={() => spendEND(1)}
          onRestore={() => restoreEND(1)}
        />
        {customResourceBars.map((bar) => (
          <div key={bar.id} className="resource-bar-wrapper">
            <ResourceBar
              label={bar.name}
              value={bar.current}
              max={bar.max}
              color={bar.color}
              interactive={isView}
              onSpend={() => spendCustomResourceBar(bar.id)}
              onRestore={() => restoreCustomResourceBar(bar.id)}
            />
            {isEdit && (
              <button
                type="button"
                className="btn btn--ghost resource-bar__delete"
                onClick={() => removeCustomResourceBar(bar.id)}
                aria-label={`Remove ${bar.name}`}
                title={`Remove ${bar.name}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isEdit && (
        <div className="stat-bars-add">
          <button
            type="button"
            className="btn btn--ghost section-add-btn"
            onClick={() => setShowAddBar(true)}
          >
            + Add Resource Bar
          </button>
        </div>
      )}

      <CustomResourceBarModal
        open={showAddBar}
        onSave={addCustomResourceBar}
        onClose={() => setShowAddBar(false)}
      />

      {isView && <RecoverAction />}

      {character.mortalWounds.some((w) => w != null) && (
        <div className="stat-mortals">
          <span className="stat-item__label">Mortal Wounds</span>
          {isView ? (
            <MortalWoundRoller character={character} />
          ) : (
            <div className="mortal-wounds">
              {Array.from({ length: MAX_MORTAL_WOUNDS }, (_, i) => {
                const wound = character.mortalWounds[i]
                const filled = wound != null
                return (
                  <div
                    key={i}
                    className={
                      'mortal-wound-slot' +
                      (filled ? ' mortal-wound-slot--filled' : '')
                    }
                    title={filled ? wound ?? '' : 'Empty'}
                  >
                    {filled ? '✕' : ''}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isView && isKnockedOut && (
        <div className="stat-section__death-saves">
          <span className="stat-item__label">Death Saves</span>
          <DeathSaveTracker character={character} />
        </div>
      )}

      {showDamageDialog && (
        <DamageDialog onClose={() => setShowDamageDialog(false)} />
      )}
    </section>
  )
}
