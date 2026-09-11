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
 * drives a GM-screen NPC instance (armor/max HP come from the base record,
 * damage to 0 HP downs the instance — NPCs have no death saves). Same dialog,
 * two target descriptors — deliberately not forked.
 */

import { useState } from 'react'

import { useModalDialog } from '@/hooks/useModalDialog'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore, type DamageResult } from '@/store/characterStore'
import { useGMScreenStore } from '@/store/gmScreenStore'
import { effectiveCombatStats } from '@/lib/abilityModifiers'
import type { Character } from '@/types'

/**
 * Describes an NPC instance panel as a damage target. The instance's armor,
 * max HP, and temp HP live on the base record / panel state, not on a
 * Character's live-play fields.
 */
export interface NpcInstanceTarget {
  /** The owning screen (for `updateInstanceState`). */
  screenId: string
  /** The panel id inside that screen. */
  panelId: string
  /** Display label, shown in the dialog title. */
  label: string
  /** The base NPC record (armor + max HP source). */
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
}

export default function DamageDialog({
  onClose,
  characterId,
  npcInstance,
}: DamageDialogProps) {
  const takeDamage = useCharacterStore((s) => s.takeDamage)
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

  // Armor for characters includes any ability modifiers currently switched on;
  // NPC instances use the base record's manual `npcStats.armor`.
  const armor = npcInstance
    ? (npcInstance.base.npcStats?.armor ?? 0)
    : target
      ? effectiveCombatStats(target).armor
      : 0

  const title = npcInstance
    ? `Apply Damage — ${npcInstance.label}`
    : 'Apply Damage'

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
        res.downed
          ? `${npcInstance.label} is DOWNED!`
          : `Applied ${res.hpLost} damage to ${npcInstance.label}.`,
        res.downed ? 'error' : 'warning',
      )
      return
    }

    if (!target) return
    const res = takeDamage(target.id, n, { applyArmor, resistant, ignoreTempHP })
    setResult(res)
    if (res.causedMortalWound) {
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
              {result.causedMortalWound && (
                <p className="damage-result__alert">
                  ⚠ {result.mortalWoundsIncurred} Mortal Wound(s) incurred!
                  {result.knockedOut && ' Character is KNOCKED OUT!'}
                  {' '}Roll on the Mortal Wounds table.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
