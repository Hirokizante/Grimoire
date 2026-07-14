/**
 * DiceResultModal — the full-screen post-roll breakdown.
 *
 * VTT-inspired layout:
 *   - Big total on top, with natural-20 / natural-1 badge if applicable
 *   - Color-coded breakdown of every term (dice, attributes, constants)
 *   - The original roll source (ability, manual note, etc.) so players
 *     remember *why* this roll happened
 *   - Done button + click-outside-to-dismiss + Esc to dismiss
 */

import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useDiceRollStore } from '@/store/diceRollStore'
import { sourceLabel } from '@/lib/rollSourceUtils'

export interface DiceResultModalProps {
  onClose: () => void
  style?: React.CSSProperties
}

export default function DiceResultModal({ onClose, style }: DiceResultModalProps) {
  const result = useDiceRollStore((s) => s.result)
  const source = useDiceRollStore((s) => s.source)

  useEscapeKey(onClose)

  if (!result) return null

  const { total, terms, breakdown } = result

  const criticalHit = terms.some((t) => {
    if (t.term.type !== 'dice') return false
    return t.term.sides === 20 && (t.rolls ?? []).some((r) => r === 20)
  })
  const criticalFail = terms.some((t) => {
    if (t.term.type !== 'dice') return false
    return t.term.sides === 20 && (t.rolls ?? []).some((r) => r === 1)
  })

  const label = sourceLabel(source)

  return (
    <div
      className="modal-overlay"
      style={style}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-content dice-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{label ?? 'Roll Result'}</h3>
        </div>

        <div className="dice-modal__body">
          {/* Big total */}
          <div className="dice-modal__total-row">
            <h2 className="dice-modal__total">{total}</h2>
            {criticalHit && <span className="dice-badge dice-badge--crit">★ NAT 20</span>}
            {criticalFail && <span className="dice-badge dice-badge--fail">✗ NAT 1</span>}
          </div>

          {/* Per-term breakdown */}
          <div className="dice-modal__terms">
            {terms.map((term, i) => {
              if (term.term.type === 'dice' && term.rolls) {
                return (
                  <div key={i} className="dice-modal__term dice-modal__term--dice">
                    <span className="dice-modal__term-label">
                      {term.term.count}d{term.term.sides}:
                    </span>
                    <div className="dice-modal__rolls">
                      {term.rolls.map((roll, j) => {
                        const isCrit = term.term.type === 'dice' && term.term.sides === 20 && roll === 20
                        const isFumble = term.term.type === 'dice' && term.term.sides === 20 && roll === 1
                        const maxRoll = term.term.type === 'dice' && roll === term.term.sides
                        return (
                          <span
                            key={j}
                            className={`dice-modal__roll${
                              isCrit
                                ? ' dice-modal__roll--crit'
                                : isFumble
                                ? ' dice-modal__roll--fumble'
                                : maxRoll
                                ? ' dice-modal__roll--max'
                                : ''
                            }`}
                          >
                            {roll}
                          </span>
                        )
                      })}
                    </div>
                    <span className="dice-modal__term-value">= {term.value}</span>
                  </div>
                )
              }
              return (
                <div
                  key={i}
                  className={`dice-modal__term dice-modal__term--${term.term.type}`}
                >
                  <span className="dice-modal__term-label">{term.label}</span>
                </div>
              )
            })}
          </div>

          {/* Breakdown */}
          <p className="dice-modal__breakdown">{breakdown}</p>

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
