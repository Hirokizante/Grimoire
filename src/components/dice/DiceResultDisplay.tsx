/**
 * DiceResultDisplay — shows the breakdown of a dice roll result.
 *
 * Renders the original notation, each term's contribution (die results,
 * substituted variables), and the final total. Includes a dismiss button.
 *
 * Example output:
 *   2d6+POW
 *   [4] [3] + POW(4) = 11
 */

import type { RollResult } from '@/lib/diceRoller'

export interface DiceResultDisplayProps {
  result: RollResult
  onDismiss: () => void
}

export default function DiceResultDisplay({
  result,
  onDismiss,
}: DiceResultDisplayProps) {
  const { notation, total, terms } = result

  return (
    <div className="dice-result">
      <div className="dice-result__header">
        <span className="dice-result__notation">{notation}</span>
        <button
          type="button"
          className="btn btn--ghost dice-result__close"
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>

      <div className="dice-result__terms">
        {terms.map((term, i) => {
          if (term.term.type === 'dice' && term.rolls) {
            return (
              <div key={i} className="dice-result__term dice-result__term--dice">
                <span className="dice-result__term-label">{term.term.count}d{term.term.sides}:</span>
                <div className="dice-result__dice-rolls">
                  {term.rolls.map((roll, j) => (
                    <span key={j} className="dice-result__die-result">
                      {roll}
                    </span>
                  ))}
                </div>
                <span className="dice-result__term-value">= {term.value}</span>
              </div>
            )
          }
          if (term.term.type === 'variable') {
            return (
              <div key={i} className="dice-result__term dice-result__term--variable">
                <span className="dice-result__term-label">{term.label}</span>
              </div>
            )
          }
          // constant
          return (
            <div key={i} className="dice-result__term dice-result__term--constant">
              <span className="dice-result__term-label">{term.label}</span>
            </div>
          )
        })}
      </div>

      <div className="dice-result__total">
        <span className="dice-result__total-label">Total</span>
        <span className="dice-result__total-value">{total}</span>
      </div>

      <p className="dice-result__breakdown">{result.breakdown}</p>

      <button
        type="button"
        className="btn btn--primary dice-result__dismiss"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}
