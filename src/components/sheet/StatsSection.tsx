/**
 * StatsSection — combat stats, resource pools, and all live-play trackers.
 *
 * In **view mode**, this section is the live-play hub:
 *   - HP bar is clickable to open the DamageDialog
 *   - ResourceTracker for AP/END/FP spend/restore
 *   - RecoverAction button (3 AP → all END)
 *   - MortalWoundRoller for wound slots + rolling
 *   - DeathSaveTracker (shown when knocked out: 0 HP + 2 Mortal Wounds)
 *
 * In **edit mode**, all trackers are hidden — only the calculated stats and
 * bars are shown (edit mode is for building the sheet, not playing).
 */

import { useState } from 'react'

import DamageDialog from '@/components/sheet/DamageDialog'
import DeathSaveTracker from '@/components/sheet/DeathSaveTracker'
import MortalWoundRoller from '@/components/sheet/MortalWoundRoller'
import RecoverAction from '@/components/sheet/RecoverAction'
import ResourceTracker from '@/components/sheet/ResourceTracker'
import SegmentedBar from '@/components/ui/SegmentedBar'
import {
  calcArmor,
  calcENDRecovery,
  calcEvasion,
  calcHP,
  calcMilestoneBonus,
  calcMovement,
  calcSaveDC,
} from '@/lib/calculations'
import type { Character } from '@/types'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface StatsSectionProps {
  character: Character
  mode?: SheetMode
}

/** Maximum Action Points, constant per DESIGN.md "Action Points". */
const MAX_AP = 3
/** Maximum Endurance, constant per DESIGN.md "Endurance". */
const MAX_END = 10
/** Maximum Mortal Wounds a character can sustain. */
const MAX_MORTAL_WOUNDS = 2

export default function StatsSection({ character, mode = 'view' }: StatsSectionProps) {
  const isView = mode === 'view'
  const { attributes, milestones } = character

  const maxHP = calcHP(attributes.VIT)
  const milestoneBonus = calcMilestoneBonus(milestones)
  const evasion = calcEvasion(attributes.AGI)
  const armor = calcArmor(attributes.VIT)
  const movement = calcMovement(attributes.AGI)
  const saveDC = calcSaveDC(milestones)
  const endRecovery = calcENDRecovery(attributes.GRT)

  const [showDamageDialog, setShowDamageDialog] = useState(false)

  // Knocked Out = 0 HP and both mortal wound slots filled.
  const isKnockedOut =
    character.currentHP <= 0 &&
    character.mortalWounds.filter((w) => w != null).length >= MAX_MORTAL_WOUNDS

  return (
    <section className="sheet-section sheet-section--stats">
      <h3 className="sheet-section__heading">Combat Stats</h3>

      <div className="stat-grid">
        <div className="stat-item">
          <span className="stat-item__label">Milestones</span>
          <span className="stat-item__value">
            {milestones}
            <span className="stat-item__sub">+{milestoneBonus} bonus</span>
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">Evasion</span>
          <span className="stat-item__value">{evasion}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">Armor</span>
          <span className="stat-item__value">{armor}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">Movement</span>
          <span className="stat-item__value">{movement}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">Save DC</span>
          <span className="stat-item__value">{saveDC}</span>
        </div>
        <div className="stat-item">
          <span className="stat-item__label">END Recovery</span>
          <span className="stat-item__value">{endRecovery}</span>
        </div>
      </div>

      <div className="stat-bars">
        <div
          className={
            'stat-bars__hp' + (isView ? ' stat-bars__hp--clickable' : '')
          }
          onClick={isView ? () => setShowDamageDialog(true) : undefined}
          role={isView ? 'button' : undefined}
          title={isView ? 'Click to apply damage or heal' : undefined}
        >
          <SegmentedBar
            label="HP"
            value={character.currentHP}
            max={maxHP}
            color="var(--accent-blush)"
          />
        </div>
        {character.tempHP > 0 && (
          <SegmentedBar
            label="Temp HP"
            value={character.tempHP}
            max={character.tempHP}
            color="var(--accent-violet-soft)"
          />
        )}
        <SegmentedBar
          label="Fate Points"
          value={character.currentFP}
          max={character.maxFP}
          color="var(--accent-violet-soft)"
        />
        <SegmentedBar
          label="Action Points"
          value={character.currentAP}
          max={MAX_AP}
          color="var(--accent-violet)"
        />
        <SegmentedBar
          label="Endurance"
          value={character.currentEND}
          max={MAX_END}
          color="var(--accent-violet)"
        />
      </div>

      {isView && (
        <>
          <ResourceTracker character={character} />
          <RecoverAction />
        </>
      )}

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
