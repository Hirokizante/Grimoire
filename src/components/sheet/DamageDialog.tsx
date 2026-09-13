/**
 * DamageDialog — a modal overlay for inputting damage in live play (view mode).
 *
 * Per DESIGN.md "Automatic HP Tracking": the player inputs an amount of damage,
 * and the system automatically updates HP, taking into account Armor (1d6
 * reduction per Armor point) and Resistance (halves incoming damage). Temporary
 * HP is reduced before regular HP.
 *
 * After applying damage, the dialog shows a breakdown of the calculation and
 * notifies the player if a Mortal Wound was incurred or the character was
 * knocked out.
 *
 * The dialog is **target-agnostic**: `characterId` drives a live character
 * sheet (mortal wounds, death saves, healing rules) while `npcInstance`
 * drives a GM-screen NPC instance (armor/max HP come from the base record;
 * a Mortal Wound is rolled automatically at 0 HP while the base allows one,
 * and an instance with none left is driven `downed` — NPCs have no death
 * saves). Same dialog, two target descriptors — deliberately not forked.
 *
 * `autoRollMortalWounds` is the GM Screen's rule layered on the character
 * target, not a third target: a panel has no Mortal Wound card to press, so
 * its damage resolves the D20 as it lands (`takePanelDamage`) exactly as an
 * instance's does. The player's own sheet leaves it unset and keeps the
 * "Pending Roll" step they roll themselves.
 */

import { useState } from 'react'

import { useModalDialog } from '@/hooks/useModalDialog'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore, type DamageResult } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { effectiveCombatStats, effectiveNPCStats } from '@/lib/abilityModifiers'
import { panelDamageOutcome } from '@/lib/gmScreenUtils'
import { KNOCKED_OUT_MESSAGE } from '@/lib/mortalWounds'
import type { Character } from '@/types'

/**
 * Describes an NPC instance panel as a damage target. The instance's armor and
 * max HP come from the panel's own entity — the base record with the instance's
 * live ability state applied (see `gmScreenUtils.withInstanceState`), so an
 * armor or Max HP modifier the GM switched on this panel is what the dialog
 * shows and what the store's pipeline rolls against — and its temp HP lives on
 * the panel state.
 */
export interface NpcInstanceTarget {
  /** The owning screen (for `updateInstanceState`). */
  screenId: string
  /** The panel id inside that screen. */
  panelId: string
  /** Display label, shown in the dialog title. */
  label: string
  /**
   * The instance's entity: the base NPC record with this instance's own live
   * ability state applied (armor + max HP source). Pass
   * `gmScreenUtils.withInstanceState(base, state)` rather than the raw record,
   * so the readouts match the damage the instance really takes.
   */
  base: Character
  /** Current instance HP. */
  currentHP: number
  /** Current instance temp HP. */
  tempHP: number
}

export interface DamageDialogProps {
  onClose: () => void
  /**
   * Character whose sheet this dialog damages/heals. Defaults to the store's
   * `currentCharacter` so existing sheet call sites keep working.
   */
  characterId?: string
  /** NPC-instance target. Mutually exclusive with `characterId`. */
  npcInstance?: NpcInstanceTarget
  /**
   * Roll any Mortal Wound this damage causes straight away instead of leaving
   * the slot on "Pending Roll" — the GM Screen player-panel rule. Ignored for
   * an `npcInstance` target, which always rolls inside its own pipeline.
   */
  autoRollMortalWounds?: boolean
}

export default function DamageDialog({
  onClose,
  characterId,
  npcInstance,
  autoRollMortalWounds = false,
}: DamageDialogProps) {
  const takeDamage = useCharacterStore((s) => s.takeDamage)
  const takePanelDamage = useCharacterStore((s) => s.takePanelDamage)
  const storeCharacter = useCharacterStore((s) => s.currentCharacter)
  const damageInstance = useGMScreenStore((s) => s.damageInstance)
  const healInstance = useGMScreenStore((s) => s.healInstance)
  const setInstanceTempHP = useGMScreenStore((s) => s.setInstanceTempHP)
  const { notify } = useNotification()

  const [amount, setAmount] = useState('')
  const [applyArmor, setApplyArmor] = useState(true)
  const [resistant, setResistant] = useState(false)
  const [ignoreTempHP, setIgnoreTempHP] = useState(false)
  const [result, setResult] = useState<DamageResult | null>(null)

  const dialogRef = useModalDialog(onClose)

  const character = useCharacterStore((s) =>
    characterId ? (s.characters.find((c) => c.id === characterId) ?? null) : null,
  )
  const target: Character | null = npcInstance
    ? npcInstance.base
    : (character ?? (characterId ? null : storeCharacter))

  // Armor includes any ability modifiers currently switched on — for a
  // character through `effectiveCombatStats`, for an NPC instance through
  // `effectiveNPCStats` on the entity the panel passed (the base record with
  // this instance's own switches applied), so the preview matches the roll
  // `gmScreenStore.damageInstance` is about to make.
  const armor = npcInstance
    ? effectiveNPCStats(npcInstance.base).armor
    : target
      ? effectiveCombatStats(target).armor
      : 0

  const title = npcInstance
    ? `Apply Damage — ${npcInstance.label}`
    : 'Apply Damage'

  // What the target is called once it is out of the fight — the one word the
  // two targets disagree on (NPC instances are DOWNED, characters are KNOCKED
  // OUT and move to Death Saves). Everything else about a wound reads the same
  // on both, including the D20 that is rolled for the GM.
  const outOfFightLabel = npcInstance ? 'DOWNED' : 'KNOCKED OUT'

  const handleApply = () => {
    const n = parseInt(amount, 10)
    if (!Number.isFinite(n) || n <= 0) return

    if (npcInstance) {
      const res = damageInstance(npcInstance.screenId, npcInstance.panelId, n, {
        applyArmor,
        resistant,
        ignoreTempHP,
      })
      if (!res) return
      setResult(res)
      notify(
        panelDamageOutcome(npcInstance.label, res, outOfFightLabel),
        res.downed || res.causedMortalWound ? 'error' : 'warning',
      )
      return
    }

    if (!target) return
    // A GM panel resolves the wound as it deals it (see the dialog doc); the
    // sheet leaves the slot pending for the player's own Mortal Wound card.
    const res = autoRollMortalWounds
      ? takePanelDamage(target.id, n, { applyArmor, resistant, ignoreTempHP })
      : takeDamage(target.id, n, { applyArmor, resistant, ignoreTempHP })
    setResult(res)
    if (autoRollMortalWounds) {
      if (res.causedMortalWound || res.knockedOut) {
        notify(panelDamageOutcome(target.name, res, outOfFightLabel), 'error', 5000)
      } else {
        notify(`Applied ${res.hpLost} damage.`, 'warning')
      }
    } else if (res.knockedOut) {
      // The SRD's knock-out: reduced to 0 HP with no Mortal Wound left to take
      // — never merely a full track (that is the Critical Condition, and the
      // sheet's banner says so). Wounds this hit did cause are on the track as
      // pending rolls, so the message names them.
      notify(
        res.causedMortalWound
          ? `${res.mortalWoundsIncurred} Mortal Wound${res.mortalWoundsIncurred === 1 ? '' : 's'} incurred — ${KNOCKED_OUT_MESSAGE}`
          : KNOCKED_OUT_MESSAGE,
        'error',
        5000,
      )
    } else if (res.causedMortalWound) {
      // The sheet's own wording: it has to send the player to the Mortal Wound
      // card, because that is where their roll still is.
      notify(`${res.hpLost} damage taken! Mortal Wound incurred.`, 'error')
    } else {
      notify(`Applied ${res.hpLost} damage.`, 'warning')
    }
  }

  const handleHeal = () => {
    const n = parseInt(amount, 10)
    if (!Number.isFinite(n) || n <= 0) return
    if (npcInstance) {
      healInstance(npcInstance.screenId, npcInstance.panelId, n)
      notify(`Healed ${n} HP on ${npcInstance.label}.`, 'success')
    } else if (target) {
      useCharacterStore.getState().heal(target.id, n)
      notify(`Healed ${n} HP.`, 'success')
    }
    setResult(null)
    setAmount('')
  }

  const handleSetTempHP = () => {
    const n = parseInt(amount, 10)
    if (!Number.isFinite(n) || n < 0) return
    if (npcInstance) {
      setInstanceTempHP(npcInstance.screenId, npcInstance.panelId, n)
    } else if (target) {
      useCharacterStore.getState().setTempHP(target.id, n)
    }
    setResult(null)
    setAmount('')
    notify(`Temp HP set to ${n}.`, 'info')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content damage-dialog" ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="btn btn--icon modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="damage-dialog__body">
          <label className="ability-editor__field">
            <span className="ability-editor__label">Amount</span>
            <input
              type="number"
              className="sheet-input sheet-input--num"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </label>

          <div className="damage-dialog__options">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={applyArmor}
                onChange={(e) => setApplyArmor(e.target.checked)}
              />
              <span>Apply Armor ({armor}d6 reduction)</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={resistant}
                onChange={(e) => setResistant(e.target.checked)}
              />
              <span>Resistance (half damage)</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={ignoreTempHP}
                onChange={(e) => setIgnoreTempHP(e.target.checked)}
              />
              <span>Bypass Temp HP</span>
            </label>
          </div>

          <div className="damage-dialog__actions">
            <button type="button" className="btn btn--primary" onClick={handleApply}>
              Apply Damage
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleHeal}>
              Heal
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleSetTempHP}>
              Set Temp HP
            </button>
          </div>

          {result && (
            <div className="damage-result">
              <h4>Result</h4>
              <div className="damage-result__grid">
                <div><span className="damage-result__label">Raw</span> {result.rawDamage}</div>
                <div><span className="damage-result__label">After Armor</span> {result.afterArmor}</div>
                <div><span className="damage-result__label">After Resistance</span> {result.afterResistance}</div>
                <div><span className="damage-result__label">Temp HP Used</span> {result.tempHPConsumed}</div>
                <div><span className="damage-result__label">HP Lost</span> {result.hpLost}</div>
                <div><span className="damage-result__label">Final HP</span> {result.finalHP}</div>
              </div>
              {result.causedMortalWound &&
                ((result.mortalWoundRolls ?? []).length > 0 ? (
                  // Resolved for the GM (an NPC instance, or a character
                  // damaged from a panel): name every wound that was rolled.
                  <p className="damage-result__alert">
                    ⚠ {(result.mortalWoundRolls ?? []).length} Mortal Wound(s)
                    rolled automatically:{' '}
                    {(result.mortalWoundRolls ?? [])
                      .map((wound) => `${wound.name} (d20 ${wound.roll})`)
                      .join(', ')}
                    . HP reset to {result.finalHP}.
                    {result.knockedOut &&
                      ` ${npcInstance ? 'Instance' : 'Character'} is ${outOfFightLabel}!`}
                  </p>
                ) : (
                  <p className="damage-result__alert">
                    ⚠ {result.mortalWoundsIncurred} Mortal Wound(s) incurred!
                    {result.knockedOut && ' Character is KNOCKED OUT!'}
                    {' '}Roll on the Mortal Wounds table.
                  </p>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
