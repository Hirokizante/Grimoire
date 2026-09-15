/**
 * Dice roller — evaluates a parsed dice expression with character stats.
 *
 * Per DESIGN.md "Variable substitution": stat references are automatically
 * substituted. For `POW/MAR` notation, the player chooses; we roll with the
 * primary name and show its value in the breakdown.
 *
 * Evaluation walks the expression tree from lib/diceParser.ts, so groups and
 * precedence mean what they say: `(1d6+POW)*2/2d6+MAR` doubles the d6 plus POW,
 * divides that by a fresh 2d6, and adds MAR to the result. Multiplication and
 * division are integer arithmetic, division rounding **down**; a division by
 * zero contributes 0 rather than poisoning the total with `Infinity`.
 */

import { rollDie } from '@/lib/dice'
import {
  parseDiceNotation,
  type BinaryOp,
  type ExprNode,
  type ParsedExpression,
  type ParsedTerm,
} from '@/lib/diceParser'
import { effectiveAttributes } from '@/lib/abilityModifiers'
import { findCustomAttribute } from '@/lib/customAttributes'
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
  /**
   * The operator joining this term to the one before it ("+", "-", "*", "/").
   * Absent on the first term of an expression, and on results stored before
   * compound notation existed.
   *
   * A constant or variable already prints its own sign in `label` ("+POW(4)"),
   * so the breakdown only has to draw this for the multiplicative operators and
   * for a subtracted die.
   */
  op?: BinaryOp
}

/** The full result of evaluating a dice expression. */
export interface RollResult {
  /** The original notation. */
  notation: string
  /** The total result. */
  total: number
  /** Per-term breakdown, every leaf in the order it was rolled. */
  terms: TermResult[]
  /** Human-readable breakdown string, e.g. "2d6+POW → 4 + 3 + 4 = 11". */
  breakdown: string
}

/**
 * Resolve a variable name to a numeric value from the character.
 * Returns null if the name is not a recognized attribute, skill, or custom
 * attribute.
 */
export function resolveVariable(
  name: string,
  character: Character,
): number | null {
  // Check attributes first (by key or name). Attributes resolve to their
  // *effective* value, so a switched-on ability modifier (e.g. +1 MAR) is
  // included in every roll that references it.
  const attr = ATTRIBUTE_LIST.find(
    (a) =>
      a.key === name.toUpperCase() ||
      a.name.toLowerCase() === name.toLowerCase() ||
      a.abbreviation.toLowerCase() === name.toLowerCase(),
  )
  if (attr) return effectiveAttributes(character)[attr.key]

  // Check skills (exact match, case-insensitive).
  const skill = SKILL_LIST.find((s) => s.toLowerCase() === name.toLowerCase())
  if (skill) return character.skills[skill]

  // Check the sheet's own custom attributes last, by shorthand or full name.
  // They come after the canonical stats on purpose: a custom attribute named
  // "Sneak" cannot quietly take over every Sneak roll on the sheet.
  const custom = findCustomAttribute(character.customAttributes, name)
  if (custom) return custom.value

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

// ---- Evaluation --------------------------------------------------------------

/**
 * One node's evaluated result: its value, every leaf under it, and the working
 * the result modal prints ("(4 + 3) × 2").
 *
 * `text` never carries a leading sign — the node's {@link sign} does — so a
 * parent can print the term the way its own operator reads: `+ 4` in a sum, a
 * bare `4` in a product.
 */
interface EvaluatedNode {
  value: number
  /** Every leaf under this node, in the order it was rolled. */
  leaves: TermResult[]
  /** The node's working, with no leading sign. */
  text: string
  /** How the node joins a sum: +1 or -1. */
  sign: 1 | -1
  /** Rendering precedence: an additive chain 1, a product 2, a leaf 3. */
  precedence: number
}

/** Integer division, rounded down; dividing by zero contributes 0. */
function divide(left: number, right: number): number {
  if (right === 0) return 0
  return Math.floor(left / right)
}

/** A node's text, parenthesized when its precedence needs the help. */
function wrap(node: EvaluatedNode, parentPrecedence: number): string {
  return node.precedence < parentPrecedence ? `(${node.text})` : node.text
}

/**
 * A node the way it reads as an operand: `-4`, `(3 + 2)`, `-(3 + 2)`, `2 × 3`.
 * A negative operand whose working is itself an expression takes parentheses,
 * because the minus applies to all of it.
 */
function operandText(node: EvaluatedNode, parentPrecedence: number): string {
  if (node.sign === -1) {
    return node.precedence < 3
      ? `-(${node.text})`
      : `-${wrap(node, parentPrecedence)}`
  }
  return wrap(node, parentPrecedence)
}

/** A node the way it reads inside a sum: `+ 4`, `- 3`, `- (4 + 3)`. */
function addedText(node: EvaluatedNode): string {
  const operator = node.sign === 1 ? '+' : '-'
  const body =
    node.sign === -1 && node.precedence < 3 ? `(${node.text})` : node.text
  return `${operator} ${body}`
}

/**
 * The working one leaf contributes: a die's rolls, a constant's magnitude, or
 * the value a stat resolved to (a negative stat keeps its own minus).
 */
function leafWorking(leaf: TermResult): EvaluatedNode {
  const { term } = leaf
  if (term.type === 'dice') {
    const rolls = leaf.rolls ?? []
    return {
      value: leaf.value,
      leaves: [leaf],
      text: rolls.join(' + '),
      sign: 1,
      // Several dice print as a sum ("4 + 3"), which reads additively.
      precedence: rolls.length > 1 ? 1 : 3,
    }
  }
  // A constant prints its own magnitude; a variable prints the value it
  // resolved to, which a negative stat can make negative in turn.
  const magnitude =
    term.type === 'constant'
      ? term.value
      : term.sign === 1
        ? leaf.value
        : -leaf.value
  return {
    value: leaf.value,
    leaves: [leaf],
    text: String(magnitude),
    sign: term.sign,
    precedence: 3,
  }
}

/**
 * Which of a node's leaves a leading minus reaches.
 *
 * Negation distributes over an additive chain (`-(2+3)` is `-2-3`), and a
 * product only needs its first factor flipped (`-(2*3)` is `-2*3`). Both are
 * the same number, and this is the reading the flat term list can show.
 */
function negatedLeafMask(node: ExprNode, negate: boolean, out: boolean[]): void {
  switch (node.kind) {
    case 'term':
      out.push(negate)
      return
    case 'negate':
      negatedLeafMask(node.operand, !negate, out)
      return
    case 'binary':
      negatedLeafMask(node.left, negate, out)
      negatedLeafMask(node.right, node.op === '+' && negate, out)
  }
}

/**
 * Flip one leaf for the negation the working carries, so the term list reads
 * the same minus (`5 - (2 × 3)` chips as `-2`, `×3`). The values here are for
 * display; the node's total came from the tree.
 */
function negateLeaf(leaf: TermResult, character: Character): TermResult {
  const { term } = leaf
  if (term.type === 'dice') {
    // Dice carry no sign of their own, so the minus is drawn beside them; a
    // product's operator is the one the reader needs, so it stays.
    const diceOp = leaf.op === '*' || leaf.op === '/' ? leaf.op : '-'
    return { ...leaf, value: -leaf.value, op: diceOp }
  }
  const sign: 1 | -1 = term.sign === 1 ? -1 : 1
  const mark = sign === 1 ? '+' : '-'
  const negated = { ...leaf, term: { ...term, sign }, value: -leaf.value }
  if (term.type === 'variable' && resolveVariable(term.name, character) === null) {
    // An unknown name prints no sign at all (it counts 0), so it keeps none.
    return negated
  }
  const magnitude =
    term.type === 'constant'
      ? term.value
      : term.sign === 1
        ? leaf.value
        : -leaf.value
  negated.label =
    term.type === 'constant'
      ? `${mark}${magnitude}`
      : `${mark}${term.name}(${magnitude})`
  return negated
}

/**
 * Evaluate a node, tagging each leaf with the operator that joins it to the one
 * before it (`op`) and building the working as it goes.
 */
function evaluateNode(
  node: ExprNode,
  character: Character,
  op: BinaryOp | null,
): EvaluatedNode {
  switch (node.kind) {
    case 'term': {
      const leaf = evaluateTerm(node.term, character)
      if (op) {
        leaf.op = op
        // A term joined by `*` or `/` is not being added, so a leading `+` on
        // its label would only be noise beside the operator ("× 3", "÷ POW(4)").
        if ((op === '*' || op === '/') && leaf.label.startsWith('+')) {
          leaf.label = leaf.label.slice(1)
        }
      }
      return leafWorking(leaf)
    }
    case 'negate': {
      const inner = evaluateNode(node.operand, character, op)
      // The leaves wear the minus the working shows, so the term list can never
      // read as a different sum than the total.
      const mask: boolean[] = []
      negatedLeafMask(node.operand, true, mask)
      const leaves = inner.leaves.map((leaf, i) =>
        mask[i] ? negateLeaf(leaf, character) : leaf,
      )
      return {
        value: -inner.value,
        leaves,
        text: inner.text,
        sign: inner.sign === 1 ? -1 : 1,
        precedence: inner.precedence,
      }
    }
    case 'binary': {
      const left = evaluateNode(node.left, character, op)
      const right = evaluateNode(node.right, character, node.op)
      const leaves = [...left.leaves, ...right.leaves]
      if (node.op === '+') {
        // The right side prints its own sign ("+ 4", "- 2"), which is how the
        // flat breakdown has always read.
        return {
          value: left.value + right.value,
          leaves,
          text: `${operandText(left, 1)} ${addedText(right)}`,
          sign: 1,
          precedence: 1,
        }
      }
      const symbol = node.op === '*' ? '×' : '÷'
      return {
        value:
          node.op === '*'
            ? left.value * right.value
            : divide(left.value, right.value),
        leaves,
        text: `${operandText(left, 2)} ${symbol} ${operandText(right, 2)}`,
        sign: 1,
        precedence: 2,
      }
    }
  }
}

/**
 * Evaluate a full parsed dice expression with a character's stats.
 *
 * Produces both the numeric total and a human-readable breakdown string that
 * keeps the expression's shape:
 * `(1d6+POW)*2/2d6+MAR → (3 + 4) × 2 ÷ (5 + 3) + 3 = 4`.
 */
export function evaluateExpression(
  expr: ParsedExpression,
  character: Character,
): RollResult {
  if (!expr.root) {
    return {
      notation: expr.notation,
      total: 0,
      terms: [],
      breakdown: `${expr.notation} → 0`,
    }
  }

  const evaluated = evaluateNode(expr.root, character, null)
  const working = operandText(evaluated, 0)
  const breakdown = `${expr.notation} → ${working} = ${evaluated.value}`

  return {
    notation: expr.notation,
    total: evaluated.value,
    terms: evaluated.leaves,
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
