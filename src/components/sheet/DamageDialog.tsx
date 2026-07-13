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
 */

import { useState } from 'react'

import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useNotification } from '@/context/NotificationContext'
import { useCharacterStore, type DamageResult } from '@/store/characterStore'
import { calcArmor } from '@/lib/calculations'

export interface DamageDialogProps {
  onClose: () => void
}

export default function DamageDialog({ onClose }: DamageDialogProps) {
  const takeDamage = useCharacterStore((s) => s.takeDamage)
  const character = useCharacterStore((s) => s.currentCharacter)
  const { notify } = useNotification()

  const [amount, setAmount] = useState('')
  const [applyArmor, setApplyArmor] = useState(true)
  const [resistant, setResistant] = useState(false)
  const [ignoreTempHP, setIgnoreTempHP] = useState(false)
  const [result, setResult] = useState<DamageResult | null>(null)

  useEscapeKey(onClose)

  const armor = character ? calcArmor(character.attributes.VIT) : 0

  const handleApply = () => {
    const n = parseInt(amount, 10)
    if (!Number.isFinite(n) || n <= 0) return
    const res = takeDamage(n, { applyArmor, resistant, ignoreTempHP })
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
    useCharacterStore.getState().heal(n)
    setResult(null)
    setAmount('')
    notify(`Healed ${n} HP.`, 'success')
  }

  const handleSetTempHP = () => {
    const n = parseInt(amount, 10)
    if (!Number.isFinite(n) || n < 0) return
    useCharacterStore.getState().setTempHP(n)
    setResult(null)
    setAmount('')
    notify(`Temp HP set to ${n}.`, 'info')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content damage-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Apply Damage</h3>
          <button type="button" className="btn btn--ghost modal-close" onClick={onClose}>✕</button>
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
