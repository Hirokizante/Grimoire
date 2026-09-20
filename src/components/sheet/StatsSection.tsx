/**
 * StatsSection — combat stats, resource pools, and all live-play trackers.
 *
 * In **view mode**, this section is the live-play hub:
 *   - HP bar with inline +/− controls (click label → DamageDialog)
 *   - FP/AP/END bars with inline +/− controls
 *   - RecoverAction button (recover all END)
 *   - MortalWoundRoller for the wound track (counter + cards + actions)
 *   - DeathSaveTracker (shown when knocked out: 0 HP + 2 Mortal Wounds)
 *
 * In **edit mode**, the trackers are read-only — only the calculated stats and
 * bars are shown, with any wound on the track rendered as the read-out it is
 * (edit mode is for building the sheet, not playing it).
 *
 * The six derived stats (Milestones, Evasion, Armor, Movement, Save DC, END
 * Recovery) are displayed as stylized "stat tokens" with icons and accent
 * colors for visual flair. The accents are the character's own sheet colors by
 * default; a GM panel overrides them with the app theme's shared stat palette
 * (see the `tokenColors` prop) so a player panel reads exactly like an NPC one.
 */

import { useState } from 'react'
import {
  Star,
  Wind,
  Shield,
  Footprints,
  Target,
  Heart,
  Pencil,
} from '@/components/ui/icons'
import type { AppIcon } from '@/components/ui/icons'

import DamageDialog from '@/components/sheet/DamageDialog'
import DeathSaveTracker from '@/components/sheet/DeathSaveTracker'
import MortalWoundRoller from '@/components/sheet/MortalWoundRoller'
import RecoverAction from '@/components/sheet/RecoverAction'
import ResourceBar from '@/components/sheet/ResourceBar'
import CustomResourceBarModal from '@/components/sheet/CustomResourceBarModal'
import CustomAttributeModal from '@/components/sheet/CustomAttributeModal'
import CustomAttributeStrip from '@/components/sheet/CustomAttributeStrip'
import ConfirmModal from '@/components/sheet/ConfirmModal'
import {
  calcArmor,
  calcENDRecovery,
  calcEvasion,
  calcMilestoneBonus,
  calcMovement,
  calcSaveDC,
} from '@/lib/calculations'
import { effectiveCombatStats, formatModifierValue } from '@/lib/abilityModifiers'
import { MAX_AP, MAX_END } from '@/constants/gameData'
import { useNotification } from '@/context/NotificationContext'
import { KNOCKED_OUT_MESSAGE, isKnockedOut as isKnockedOutNow } from '@/lib/mortalWounds'
import { useCharacterStore } from '@/store/characterStore'
import {
  statTokenLabel,
  type StatTokenLabelMode,
} from '@/components/sheet/statTokenLabels'
import type { StatColorKey } from '@/lib/themeUtils'
import type { Character, CustomAttribute, CustomResourceBar } from '@/types'
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
  /**
   * Hide the HP bar (and its dialog trigger). Used by GM Screen panels, whose
   * header already carries an HP bar with its own steppers and Damage dialog —
   * showing both was redundant and pushed the rest of the sheet down.
   */
  hideHP?: boolean
  /**
   * Hide the Action Points bar. Used by GM Screen character panels, which show
   * AP in the panel chrome directly under the HP bar (see PanelApBar) — the
   * body must not print a second copy of the same number.
   */
  hideAP?: boolean
  /**
   * Hide the Mortal Wounds block (the wound cards, their roll button, and the
   * Rest button). Used by GM Screen character panels, which carry the same
   * wound track in their chrome as an NPC panel does (see PanelMortalWounds) —
   * the track is the panel's one reading of it, and the chrome row stays one
   * line tall where these cards are not.
   */
  hideMortalWounds?: boolean
  /**
   * Override the Combat Stats token accents, per {@link StatColorKey}.
   *
   * GM panels pass the active app theme's shared stat palette
   * (`appThemeStatColors`) so a player panel's row colors Evasion, Armor,
   * Movement and Save DC exactly like an NPC panel standing next to it — the
   * panel is app chrome, and two panels disagreeing about what "Evasion" looks
   * like defeats the at-a-glance reading the screen exists for.
   *
   * The sheet page passes nothing and keeps the character's own token colors
   * from the Customization panel.
   */
  tokenColors?: Partial<Record<StatColorKey, string>>
  /**
   * Show the custom-attribute strip (and, in edit mode, the "Add Attribute"
   * button beside "Add Resource Bar").
   *
   * The hero section opts in — that is where the strip belongs: with the
   * resource bars above it (turn actions first, in view mode) and the Mortal
   * Wounds block below. A GM Screen panel (which renders this same section with
   * `variant="flat"`) leaves it off: a custom attribute is part of the player's
   * own sheet, and the panel is there to run the encounter.
   */
  showCustomAttributes?: boolean
  /**
   * How much of each stat name the token prints.
   *
   * "full" (default) is the sheet page: it has the width for "END Recovery".
   * "short" is the GM Screen's expanded panel, whose ~7.5rem token columns cut
   * every long name down to "MILEST…", "SAVE …", "END RE…" — an ellipsis that
   * tells a GM nothing mid-turn. Short mode prints the {@link SHORT_STAT_LABELS}
   * shorthand instead, and every token carries its full name as a tooltip.
   */
  tokenLabels?: StatTokenLabelMode
}

/** Metadata for each derived stat token: icon, label, accent class. */
interface StatToken {
  label: string
  value: number | string
  /**
   * A second number that belongs to this stat, printed beside its label as
   * `+N` on the same line. Omitted when there is nothing to show (a zero
   * bonus), so an unmodified stat prints no badge at all.
   *
   * Only Milestones has one (the bonus it grants), and it used to be a second
   * line — "+2 bonus" under the label. That line was what made this token
   * taller than the five beside it, and reserving its height on every token to
   * keep the row uniform cost the row ~13px of slack. Inlined, the row is one
   * line of stat and needs no reservation at all.
   */
  bonus?: number
  icon: AppIcon
  /** Hex color used for stripe + icon. */
  color: string
  /**
   * Difference between the displayed value and the unmodified base value.
   * Non-zero only while ability modifiers are switched on.
   */
  delta?: number
}

export default function StatsSection({
  character,
  mode = 'view',
  variant = 'section',
  hideHP = false,
  hideAP = false,
  hideMortalWounds = false,
  tokenColors,
  tokenLabels = 'full',
  showCustomAttributes = false,
}: StatsSectionProps) {
  const { attributes, milestones } = character

  // Combat stats with any switched-on ability modifiers already applied.
  const stats = effectiveCombatStats(character)
  const maxHP = stats.maxHP
  const milestoneBonus = calcMilestoneBonus(milestones)
  const evasion = stats.evasion
  const armor = stats.armor
  const movement = stats.movement
  const saveDC = stats.saveDC
  const endRecovery = stats.endRecovery

  // Store actions for resource bars. Every action is id-targeted so this
  // section can render for ANY entity — the open sheet or a GM-screen panel.
  const spendAP = useCharacterStore((s) => s.spendAP)
  const restoreAP = useCharacterStore((s) => s.restoreAP)
  const spendEND = useCharacterStore((s) => s.spendEND)
  const restoreEND = useCharacterStore((s) => s.restoreEND)
  const spendFP = useCharacterStore((s) => s.spendFP)
  const restoreFP = useCharacterStore((s) => s.restoreFP)
  const heal = useCharacterStore((s) => s.heal)
  const addCustomResourceBar = useCharacterStore((s) => s.addCustomResourceBar)
  const updateCustomResourceBar = useCharacterStore((s) => s.updateCustomResourceBar)
  const removeCustomResourceBar = useCharacterStore((s) => s.removeCustomResourceBar)
  const spendCustomResourceBar = useCharacterStore((s) => s.spendCustomResourceBar)
  const restoreCustomResourceBar = useCharacterStore((s) => s.restoreCustomResourceBar)
  const addCustomAttribute = useCharacterStore((s) => s.addCustomAttribute)
  const updateCustomAttribute = useCharacterStore((s) => s.updateCustomAttribute)
  const removeCustomAttribute = useCharacterStore((s) => s.removeCustomAttribute)
  // Read the bars off the character being rendered, not off `currentCharacter`:
  // an expanded GM-screen panel shows a character that may not be selected.
  const customResourceBars = character.customResourceBars ?? []

  const [showDamageDialog, setShowDamageDialog] = useState(false)
  const [showAddBar, setShowAddBar] = useState(false)
  const [barToEdit, setBarToEdit] = useState<CustomResourceBar | null>(null)
  const [barToRemove, setBarToRemove] = useState<{ id: string; name: string } | null>(null)
  const [showAddAttribute, setShowAddAttribute] = useState(false)
  const [attributeToEdit, setAttributeToEdit] = useState<CustomAttribute | null>(null)
  const [attributeToRemove, setAttributeToRemove] = useState<{ id: string; name: string } | null>(null)
  const { notify } = useNotification()
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  // 0 HP with no Mortal Wound left to take — the one condition for it, shared
  // with the store's damage pipeline (see `lib/mortalWounds.ts`).
  const isKnockedOut = isKnockedOutNow(character.mortalWounds, character.currentHP)

  const sectionClass =
    variant === 'flat'
      ? 'stat-block--flat'
      : 'sheet-section sheet-section--stats'
  const headingClass =
    variant === 'flat'
      ? 'stat-block__heading'
      : 'sheet-section__heading'

  const colors = character.config.colors
  // Each accent is the caller's override when it supplies one (GM panels pass
  // the app theme's shared stat palette), otherwise the character's own color.
  // `delta` flags tokens whose value is being changed by active ability
  // modifiers, so the extra badge only appears when something is switched on.
  const statTokens: StatToken[] = [
    { label: 'Milestones', value: milestones, bonus: milestoneBonus || undefined, icon: Star, color: tokenColors?.milestone ?? colors.tokenMilestone },
    { label: 'Evasion', value: evasion, delta: evasion - calcEvasion(attributes.AGI), icon: Wind, color: tokenColors?.evasion ?? colors.tokenEvasion },
    { label: 'Armor', value: armor, delta: armor - calcArmor(attributes.VIT), icon: Shield, color: tokenColors?.armor ?? colors.tokenArmor },
    { label: 'Movement', value: movement, delta: movement - calcMovement(attributes.AGI), icon: Footprints, color: tokenColors?.movement ?? colors.tokenMovement },
    { label: 'Save DC', value: saveDC, delta: saveDC - calcSaveDC(milestones), icon: Target, color: tokenColors?.saveDC ?? colors.tokenSaveDC },
    { label: 'END Recovery', value: endRecovery, delta: endRecovery - calcENDRecovery(attributes.GRT), icon: Heart, color: tokenColors?.endRecovery ?? colors.tokenEndRecovery },
  ]

  return (
    <section className={sectionClass}>
      <h3 className={headingClass}>Combat Stats</h3>

      <div className="stat-tokens">
        {statTokens.map((token) => {
          const Icon = token.icon
          const modified = token.delta != null && token.delta !== 0
          const { text: label, title } = statTokenLabel(
            token.label,
            tokenLabels,
            modified,
          )
          return (
            <div
              key={token.label}
              className={'stat-token' + (modified ? ' stat-token--modified' : '')}
              style={{ '--token-color': token.color } as React.CSSProperties}
              title={title}
            >
              <div className="stat-token__left">
                <Icon className="stat-token__icon" size={18} strokeWidth={2.2} />
                <span className="stat-token__value">{token.value}</span>
                {modified && (
                  <span className="stat-token__delta">
                    {formatModifierValue(token.delta as number)}
                  </span>
                )}
              </div>
              <div className="stat-token__right">
                <span className="stat-token__line">
                  <span className="stat-token__label">{label}</span>
                  {/* The milestone bonus, inline with the label: "+2" beside
                   *  "Miles", read as one phrase. Kept out of the ellipsised
                   *  label so a narrow token can never truncate the number. */}
                  {token.bonus != null && (
                    <span className="stat-token__bonus">
                      {formatModifierValue(token.bonus)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="stat-bars">
        {!hideHP && (
          <ResourceBar
            label="HP"
            value={character.currentHP}
            max={maxHP}
            color="var(--hp-bar-color)"
            continuous={maxHP > 30}
            interactive={isView}
            onSpend={() => {
              // Spending HP = taking 1 raw damage. The step runs the whole
              // damage pipeline, so it can be the hit that knocks the character
              // out (0 HP with no Mortal Wound left to take) — a state change
              // that would otherwise land without a word while the HP bar and
              // the Death Saves block silently rearrange themselves. A step that
              // only takes a wound is left alone: the wound card appears with it.
              const result = useCharacterStore.getState().takeDamage(character.id, 1)
              if (result.knockedOut) {
                notify(KNOCKED_OUT_MESSAGE, 'error', 5000)
              }
            }}
            onRestore={() => heal(character.id, 1)}
            onLabelClick={isView ? () => setShowDamageDialog(true) : undefined}
            labelTitle={isView ? 'Click to apply damage or heal' : undefined}
          />
        )}
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
          onSpend={() => spendFP(character.id, 1)}
          onRestore={() => restoreFP(character.id, 1)}
        />
        {!hideAP && (
          <ResourceBar
            label="Action Points"
            value={character.currentAP}
            max={MAX_AP}
            color="var(--ap-bar-color)"
            interactive={isView}
            onSpend={() => spendAP(character.id, 1)}
            onRestore={() => restoreAP(character.id, 1)}
          />
        )}
        <ResourceBar
          label="Endurance"
          value={character.currentEND}
          max={MAX_END}
          color="var(--end-bar-color)"
          interactive={isView}
          onSpend={() => spendEND(character.id, 1)}
          onRestore={() => restoreEND(character.id, 1)}
        />
        {customResourceBars.map((bar) => (
          <div key={bar.id} className="resource-bar-wrapper">
            <ResourceBar
              label={bar.name}
              value={bar.current}
              max={bar.max}
              color={bar.color}
              interactive={isView}
              onSpend={() => spendCustomResourceBar(character.id, bar.id)}
              onRestore={() => restoreCustomResourceBar(character.id, bar.id)}
            />
            {isEdit && (
              <button
                type="button"
                className="btn btn--icon resource-bar__edit"
                onClick={() => setBarToEdit(bar)}
                aria-label={`Edit ${bar.name}`}
                title={`Edit ${bar.name}`}
              >
                <Pencil size={14} />
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
          {showCustomAttributes && (
            <button
              type="button"
              className="btn btn--ghost section-add-btn"
              onClick={() => setShowAddAttribute(true)}
            >
              + Add Attribute
            </button>
          )}
        </div>
      )}

      <CustomResourceBarModal
        open={showAddBar}
        onSave={addCustomResourceBar}
        onClose={() => setShowAddBar(false)}
      />

      <CustomResourceBarModal
        open={barToEdit != null}
        bar={barToEdit ?? undefined}
        onSave={(updated) => updateCustomResourceBar(updated.id, () => updated)}
        onDelete={() => {
          if (!barToEdit) return
          // Close the edit modal and fall through to the shared confirm
          // flow so deletion keeps a single confirmation path.
          setBarToRemove({ id: barToEdit.id, name: barToEdit.name })
          setBarToEdit(null)
        }}
        onClose={() => setBarToEdit(null)}
      />

      <CustomAttributeModal
        open={showAddAttribute}
        onSave={addCustomAttribute}
        onClose={() => setShowAddAttribute(false)}
      />

      <CustomAttributeModal
        open={attributeToEdit != null}
        attribute={attributeToEdit ?? undefined}
        onSave={(updated) =>
          updateCustomAttribute(updated.id, () => updated)
        }
        onDelete={() => {
          if (!attributeToEdit) return
          // Same single confirmation path the resource bars use.
          setAttributeToRemove({
            id: attributeToEdit.id,
            name: attributeToEdit.name,
          })
          setAttributeToEdit(null)
        }}
        onClose={() => setAttributeToEdit(null)}
      />

      {isView && <RecoverAction characterId={character.id} />}

      {/* The player's own attributes — a horizontal, centered strip below the
        * turn actions (Recover / End Turn, view mode only) and above the Mortal
        * Wounds block. In edit mode, where there are no turn actions, it follows
        * the resource bars directly. */}
      {showCustomAttributes && (
        <CustomAttributeStrip
          character={character}
          mode={mode}
          onEdit={(attribute) => setAttributeToEdit(attribute)}
        />
      )}

      {/* View mode always shows the block — the counter and the manual add
        * included — because it is also where a specific wound is recorded by
        * hand (`MortalWoundRoller`'s "Add Mortal Wound…"), and that affordance
        * has to exist before the first wound lands. Edit mode keeps the same
        * block read-only, and only once something is on it: building a sheet is
        * not playing it. */}
      {!hideMortalWounds && (isView || character.mortalWounds.some((w) => w != null)) && (
        <div className="stat-mortals">
          <MortalWoundRoller character={character} readOnly={!isView} />
        </div>
      )}

      {isView && isKnockedOut && (
        <div className="stat-section__death-saves">
          <span className="stat-item__label">Death Saves</span>
          <DeathSaveTracker character={character} />
        </div>
      )}

      {showDamageDialog && (
        <DamageDialog
          characterId={character.id}
          onClose={() => setShowDamageDialog(false)}
        />
      )}

      {barToRemove && (
        <ConfirmModal
          title="Remove Resource Bar?"
          message={
            <>
              Are you sure you want to remove{' '}
              <strong>"{barToRemove.name}"</strong>? This resource bar and its
              data will be permanently removed.
            </>
          }
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => {
            removeCustomResourceBar(barToRemove.id)
            setBarToRemove(null)
          }}
          onClose={() => setBarToRemove(null)}
        />
      )}

      {attributeToRemove && (
        <ConfirmModal
          title="Remove Attribute?"
          message={
            <>
              Are you sure you want to remove{' '}
              <strong>"{attributeToRemove.name}"</strong>? Any dice notation
              that references it will no longer resolve.
            </>
          }
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => {
            removeCustomAttribute(attributeToRemove.id)
            setAttributeToRemove(null)
          }}
          onClose={() => setAttributeToRemove(null)}
        />
      )}
    </section>
  )
}
