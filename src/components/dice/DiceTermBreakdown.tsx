/**
 * DiceTermBreakdown — the per-term reading of one evaluated dice expression:
 * the individual dice (a natural 20 marked, a fumble struck, a maximum die
 * highlighted) followed by every constant and variable term with its resolved
 * value.
 *
 * Compound notation (`(1d6+POW)*2/2d6+MAR`) reads as a flat list of the terms
 * in the order they were rolled, each wearing the operator that joins it to the
 * one before it — `+POW(4)`, `× 2`, `÷ 2d6`, `+MAR(3)`. A constant or variable
 * prints its own sign, so only the multiplicative operators and a subtracted
 * die need a glyph drawn for them. The full working, parentheses included, is
 * the breakdown line the modal prints below.
 *
 * Shared by the single-roll result modal and the activation modal (which prints
 * one of these per roll), so an accuracy roll read from an activation and the
 * same expression clicked by hand can never render differently.
 */

import type { TermResult, RollResult } from '@/lib/diceRoller'

export interface DiceTermBreakdownProps {
  /** The evaluated expression to break down. */
  result: RollResult
}

/** The glyph the breakdown draws for an operator. */
const OPERATOR_GLYPH: Record<string, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
}

/**
 * The operator to draw before a term, or null when the term's own label already
 * reads correctly: a constant or variable starts with its sign ("+POW(4)",
 * "-3"), and the first term of an expression has no operator at all.
 */
function operatorGlyph(term: TermResult): string | null {
  const { op } = term
  if (!op) return null
  if (term.term.type !== 'dice' && (op === '+' || op === '-')) return null
  return OPERATOR_GLYPH[op] ?? null
}

export default function DiceTermBreakdown({ result }: DiceTermBreakdownProps) {
  return (
    <div className="dice-modal__terms">
      {result.terms.map((term, i) => {
        const glyph = operatorGlyph(term)
        const operator = glyph ? (
          // The printed working below spells the expression out; the glyph is
          // punctuation beside it, not a number to announce on its own.
          <span className="dice-modal__term-op" aria-hidden="true">
            {glyph}
          </span>
        ) : null

        if (term.term.type === 'dice' && term.rolls) {
          const { count, sides } = term.term
          return (
            <div key={i} className="dice-modal__term dice-modal__term--dice">
              {operator}
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
            {operator}
            <span className="dice-modal__term-label">{term.label}</span>
          </div>
        )
      })}
    </div>
  )
}
