/**
 * DiceTermBreakdown — the per-term reading of one evaluated dice expression:
 * the individual dice (a natural 20 marked, a fumble struck, a maximum die
 * highlighted) followed by every constant and variable term with its resolved
 * value.
 *
 * Shared by the single-roll result modal and the activation modal (which prints
 * one of these per roll), so an accuracy roll read from an activation and the
 * same expression clicked by hand can never render differently.
 */

import type { RollResult } from '@/lib/diceRoller'

export interface DiceTermBreakdownProps {
  /** The evaluated expression to break down. */
  result: RollResult
}

export default function DiceTermBreakdown({ result }: DiceTermBreakdownProps) {
  return (
    <div className="dice-modal__terms">
      {result.terms.map((term, i) => {
        if (term.term.type === 'dice' && term.rolls) {
          const { count, sides } = term.term
          return (
            <div key={i} className="dice-modal__term dice-modal__term--dice">
              <span className="dice-modal__term-label">
                {count}d{sides}:
              </span>
              <div className="dice-modal__rolls">
                {term.rolls.map((roll, j) => {
                  const isCrit = sides === 20 && roll === 20
                  const isFumble = sides === 20 && roll === 1
                  const maxRoll = roll === sides
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
  )
}
