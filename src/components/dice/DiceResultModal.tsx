/**
 * DiceResultModal — the full-screen post-roll breakdown.
 *
 * VTT-inspired layout:
 *   - Big total on top, with natural-20 / natural-1 badge if applicable
 *   - Color-coded breakdown of every term (dice, attributes, constants)
 *   - The original roll source (ability, manual note, etc.) so players
 *     remember *why* this roll happened
 *   - Done button + click-outside-to-dismiss + Esc to dismiss
 *
 * It renders two shapes, and the store decides which is open:
 *
 *   - **one roll** (dice notation clicked anywhere on a sheet), and
 *   - **an activation** — every roll one Activate press performed (accuracy,
 *     damage, custom; see lib/activationRolls.ts), stacked in the order they
 *     were rolled and headed by the ability's name. They are shown together on
 *     purpose: an attack is one action, so its accuracy and damage read as one
 *     result rather than two modals to dismiss. A roll the author marked
 *     "hide result" starts collapsed behind a **Show result** toggle, which
 *     keeps a long optional list readable without dropping the numbers.
 */

import { useState } from 'react'

import DiceTermBreakdown from '@/components/dice/DiceTermBreakdown'
import { useModalDialog } from '@/hooks/useModalDialog'
import {
  useDiceRollStore,
  type ActivationRollRequest,
} from '@/store/diceRollStore'
import { isNaturalOne, isNaturalTwenty } from '@/lib/diceCrit'
import { sourceLabel } from '@/lib/rollSourceUtils'

export interface DiceResultModalProps {
  onClose: () => void
  style?: React.CSSProperties
}

/** One roll inside an activation: its heading, total, breakdown and toggle. */
function ActivationRollCard({ roll }: { roll: ActivationRollRequest }) {
  const [revealed, setRevealed] = useState(!roll.hidden)
  const { result } = roll
  const criticalHit = isNaturalTwenty(result)
  const criticalFail = isNaturalOne(result)

  return (
    <article
      className={`dice-activation__roll dice-activation__roll--${roll.kind}`}
      aria-label={`${roll.groupLabel}${roll.label ? `: ${roll.label}` : ''}`}
    >
      <div className="dice-activation__roll-head">
        <span className="dice-activation__roll-kind">{roll.groupLabel}</span>
        {roll.label && (
          <span className="dice-activation__roll-label">{roll.label}</span>
        )}
        <span className="dice-activation__roll-notation">{roll.notation}</span>
      </div>

      <div className="dice-activation__roll-total-row">
        {/* Announced as a whole for a screen reader, which cannot read the
          * notation on its own ("d20+MAR, total 19"). */}
        <span
          className="dice-activation__roll-total"
          aria-label={`${roll.label ?? roll.groupLabel}, ${roll.notation}, total ${result.total}`}
          title="Total"
        >
          {result.total}
        </span>
        {criticalHit && <span className="dice-badge dice-badge--crit">★ NAT 20</span>}
        {criticalFail && <span className="dice-badge dice-badge--fail">✗ NAT 1</span>}
        {roll.hidden && (
          <button
            type="button"
            className="btn btn--ghost dice-activation__reveal"
            aria-expanded={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? 'Hide result' : 'Show result'}
          </button>
        )}
      </div>

      {revealed && (
        <>
          <DiceTermBreakdown result={result} />
          <p className="dice-modal__breakdown">{result.breakdown}</p>
        </>
      )}
    </article>
  )
}

/** Every roll of one activation, in the order they were rolled. */
function ActivationResultGroup({ rolls }: { rolls: ActivationRollRequest[] }) {
  return (
    <>
      {rolls.map((roll, i) => (
        <ActivationRollCard key={`${roll.kind}-${i}`} roll={roll} />
      ))}
    </>
  )
}

export default function DiceResultModal({ onClose, style }: DiceResultModalProps) {
  const result = useDiceRollStore((s) => s.result)
  const source = useDiceRollStore((s) => s.source)
  const activation = useDiceRollStore((s) => s.activation)

  const dialogRef = useModalDialog(onClose)

  if (!result && !activation) return null

  const isActivation = activation != null && activation.rolls.length > 0
  const label = isActivation
    ? activation.abilityName
    : sourceLabel(source) ?? 'Roll Result'

  return (
    <div
      className="modal-overlay"
      style={style}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={
          'modal-content dice-modal' +
          (isActivation ? ' dice-modal--activation' : '')
        }
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{label}</h3>
        </div>

        <div className="dice-modal__body">
          {isActivation ? (
            <div
              className="dice-activation"
              role="status"
              aria-live="polite"
              aria-label={`Activation rolls for ${activation.abilityName}`}
            >
              <ActivationResultGroup rolls={activation.rolls} />
            </div>
          ) : result ? (
            <>
              {/* Big total */}
              <div className="dice-modal__total-row">
                <h2 className="dice-modal__total">{result.total}</h2>
                {isNaturalTwenty(result) && (
                  <span className="dice-badge dice-badge--crit">★ NAT 20</span>
                )}
                {isNaturalOne(result) && (
                  <span className="dice-badge dice-badge--fail">✗ NAT 1</span>
                )}
              </div>

              <DiceTermBreakdown result={result} />

              {/* Breakdown */}
              <p className="dice-modal__breakdown">{result.breakdown}</p>
            </>
          ) : null}

          <button
            type="button"
            className="btn btn--primary dice-modal__dismiss"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
