/**
 * Dice roller — evaluates a parsed dice expression with character stats.
 *
 * Given a {@link ParsedExpression} from `diceParser.ts` and a `Character`,
 * this module:
 *   1. Rolls each dice term (using `rollDie` from `dice.ts`).
 *   2. Substitutes variable terms (MAR, POW, AGI, VIT, GRT, skill names) with
 *      the character's actual values.
 *   3. Computes the total and produces a human-readable breakdown string.
 *
 * Per DESIGN.md "Variable substitution": stat references are automatically
 * substituted. For `POW/MAR` notation, the player chooses; we default to the
 * higher value for convenience but include both in the breakdown.
 */

import { rollDie } from '@/lib/dice'
import { parseDiceNotation, type ParsedExpression, type ParsedTerm } from '@/lib/diceParser'
import type { Character } from '@/types'
import { SKILL_LIST, ATTRIBUTE_LIST } from '@/constants/gameData'

/** A single term's evaluated result for the breakdown. */
export interface TermResult {
  /** The term that was evaluated. */
  term: ParsedTerm
  /** The numeric result of this term. */
  value: number
  /** Human-readable label, e.g. "2d6", "POW(4)", "+3". */
  label: string
  /** Individual die rolls (only for dice terms). */
  rolls?: number[]
}

/** The full result of evaluating a dice expression. */
export interface RollResult {
  /** The original notation. */
  notation: string
  /** The total result. */
  total: number
  /** Per-term breakdown. */
  terms: TermResult[]
  /** Human-readable breakdown string, e.g. "2d6+POW → 4 + 3 + 4 = 11". */
  breakdown: string
}

/**
 * Resolve a variable name to a numeric value from the character.
 * Returns null if the name is not a recognized attribute or skill.
 */
export function resolveVariable(
  name: string,
  character: Character,
): number | null {
  // Check attributes first (by key or name).
  const attr = ATTRIBUTE_LIST.find(
    (a) =>
      a.key === name.toUpperCase() ||
      a.name.toLowerCase() === name.toLowerCase() ||
      a.abbreviation.toLowerCase() === name.toLowerCase(),
  )
  if (attr) return character.attributes[attr.key]

  // Check skills (exact match, case-insensitive).
  const skill = SKILL_LIST.find((s) => s.toLowerCase() === name.toLowerCase())
  if (skill) return character.skills[skill]

  return null
}

/**
 * Evaluate a single term and return its result.
 */
function evaluateTerm(
  term: ParsedTerm,
  character: Character,
): TermResult {
  switch (term.type) {
    case 'dice': {
      const rolls = Array.from({ length: term.count }, () => rollDie(term.sides))
      const value = rolls.reduce((a, b) => a + b, 0)
      const label = `${term.count}d${term.sides}`
      return { term, value, label, rolls }
    }
    case 'constant': {
      const value = term.value * term.sign
      const label = `${term.sign === 1 ? '+' : '-'}${term.value}`
      return { term, value, label }
    }
    case 'variable': {
      const resolved = resolveVariable(term.name, character)
      if (resolved === null) {
        // Unknown variable — treat as 0.
        return { term, value: 0, label: `${term.name}(?)` }
      }
      const value = resolved * term.sign
      const sign = term.sign === 1 ? '+' : '-'
      const label = `${sign}${term.name}(${resolved})`
      return { term, value, label }
    }
  }
}

/**
 * Evaluate a full parsed dice expression with a character's stats.
 *
 * Produces both the numeric total and a human-readable breakdown string.
 */
export function evaluateExpression(
  expr: ParsedExpression,
  character: Character,
): RollResult {
  const termResults = expr.terms.map((t) => evaluateTerm(t, character))
  const total = termResults.reduce((sum, r) => sum + r.value, 0)

  // Build the breakdown string: "2d6+POW → 4 + 3 + 4 = 11"
  const parts: string[] = []
  for (const r of termResults) {
    if (r.term.type === 'dice' && r.rolls) {
      // Show each die result: "4 + 3"
      if (r.rolls.length === 1) {
        parts.push(String(r.rolls[0]))
      } else {
        r.rolls.forEach((roll, idx) => {
          if (idx === 0) {
            parts.push(String(roll))
          } else {
            parts.push(`+ ${roll}`)
          }
        })
      }
    } else if (r.term.type === 'variable') {
      // Show the variable name and its resolved value
      const sign = r.term.sign === 1 ? '+' : '-'
      const resolved = resolveVariable(r.term.name, character)
      parts.push(`${sign} ${resolved ?? 0}`)
    } else if (r.term.type === 'constant') {
      const sign = r.term.sign === 1 ? '+' : '-'
      parts.push(`${sign} ${r.term.value}`)
    }
  }

  const breakdown = `${expr.notation} → ${parts.join(' ')} = ${total}`

  return {
    notation: expr.notation,
    total,
    terms: termResults,
    breakdown,
  }
}

/**
 * Convenience: parse + evaluate in one step.
 */
export function rollNotation(
  notation: string,
  character: Character,
): RollResult {
  const expr = parseDiceNotation(notation)
  return evaluateExpression(expr, character)
}
