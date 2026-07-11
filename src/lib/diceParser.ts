/**
 * Dice notation parser for the Divergence TTRPG.
 *
 * Parses strings like "2d6+POW", "d20+3", "1d6+POW/MAR", "1d6" into a
 * structured representation that the roller can evaluate.
 *
 * Supported syntax:
 *   - Dice:   `NdS` or `dS` (N defaults to 1), e.g. `2d6`, `d20`, `3d6`
 *   - Constants:  plain numbers, e.g. `+3`, `-1`
 *   - Variables:  attribute/skill names, e.g. `POW`, `MAR`, `Sneak`
 *   - Variable alt: `POW/MAR` means "use POW or MAR, player's choice"
 *   - Operators:  `+` and `-` between terms
 *
 * The parser is deliberately permissive — anything it can't parse as dice
 * or a known variable is left as-is in the output for the roller to handle.
 */

/** A single dice term in a parsed expression (e.g. 2d6). */
export interface DiceTerm {
  type: 'dice'
  count: number
  sides: number
}

/** A constant modifier (e.g. +3, -1). */
export interface ConstantTerm {
  type: 'constant'
  value: number
  /** Whether this term is added or subtracted. */
  sign: 1 | -1
}

/** A variable reference (e.g. POW, Sneak). */
export interface VariableTerm {
  type: 'variable'
  /** The primary variable name, e.g. "POW". */
  name: string
  /** Optional alternative variable, e.g. "MAR" in "POW/MAR". */
  alt?: string
  sign: 1 | -1
}

/** Any term in a parsed dice expression. */
export type ParsedTerm = DiceTerm | ConstantTerm | VariableTerm

/** A fully parsed dice expression. */
export interface ParsedExpression {
  /** The original notation string. */
  notation: string
  /** The parsed terms in order. */
  terms: ParsedTerm[]
}

// ---- Tokenizer ---------------------------------------------------------------

/** A single token from the raw notation string. */
interface Token {
  kind: 'dice' | 'number' | 'variable' | 'plus' | 'minus'
  text: string
}

/**
 * Tokenize the notation string. We scan left to right, splitting on `+`/`-`
 * (keeping the operator) and identifying each segment as dice, number, or
 * variable.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  // Insert spaces around + and - (but not within variable names like "Use Force")
  // Strategy: walk the string, splitting at +/- operators.
  let current = ''

  const flush = () => {
    const trimmed = current.trim()
    if (trimmed === '') return

    // Check if it's a dice term: \d*d\d+ or d\d+
    if (/^\d*d\d+$/i.test(trimmed)) {
      tokens.push({ kind: 'dice', text: trimmed })
    } else if (/^-?\d+$/.test(trimmed)) {
      tokens.push({ kind: 'number', text: trimmed })
    } else {
      // Otherwise treat as a variable name (may contain spaces, slashes)
      tokens.push({ kind: 'variable', text: trimmed })
    }
    current = ''
  }

  // We need to handle the first segment (no preceding operator).
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    if (ch === '+' || ch === '-') {
      // Flush whatever we accumulated so far.
      flush()

      // Emit the operator.
      if (ch === '+') {
        tokens.push({ kind: 'plus', text: '+' })
      } else {
        tokens.push({ kind: 'minus', text: '-' })
      }
      i++
      continue
    }

    current += ch
    i++
  }

  // Flush the last segment.
  flush()

  return tokens
}

// ---- Parser ------------------------------------------------------------------

/**
 * Parse a dice notation string into a structured {@link ParsedExpression}.
 *
 * Returns terms in order; dice terms are always positive (you roll dice,
 * you don't un-roll them). Constants and variables carry their own sign.
 */
export function parseDiceNotation(notation: string): ParsedExpression {
  const trimmed = notation.trim()
  if (trimmed === '') return { notation, terms: [] }

  const tokens = tokenize(trimmed)
  const terms: ParsedTerm[] = []

  let sign: 1 | -1 = 1

  for (const token of tokens) {
    switch (token.kind) {
      case 'plus':
        sign = 1
        break
      case 'minus':
        sign = -1
        break
      case 'dice': {
        const parts = token.text.toLowerCase().split('d')
        const count = parts[0] === '' ? 1 : parseInt(parts[0], 10)
        const sides = parseInt(parts[1], 10)
        if (Number.isFinite(count) && Number.isFinite(sides) && count > 0 && sides > 0) {
          terms.push({ type: 'dice', count, sides })
        }
        break
      }
      case 'number': {
        const value = parseInt(token.text, 10)
        if (Number.isFinite(value)) {
          terms.push({ type: 'constant', value: Math.abs(value), sign })
        }
        break
      }
      case 'variable': {
        // Handle "POW/MAR" — split on /
        const slashIdx = token.text.indexOf('/')
        if (slashIdx > 0) {
          const primary = token.text.slice(0, slashIdx).trim()
          const alt = token.text.slice(slashIdx + 1).trim()
          terms.push({ type: 'variable', name: primary, alt, sign })
        } else {
          terms.push({ type: 'variable', name: token.text.trim(), sign })
        }
        break
      }
    }
  }

  return { notation, terms }
}

// ---- Pattern matching for highlighting --------------------------------------

/**
 * Regex that matches dice notation in free text. Used by the DiceHighlighter
 * component to find and make notation clickable.
 *
 * Matches patterns like:
 *   - 1d6, 2d6, 3d20, d20
 *   - 1d6+POW, 2d6+MAR, d20+3
 *   - 1d6+POW/MAR, 2d6-1+Sneak
 */
export const DICE_NOTATION_REGEX = /(\d*d\d+(?:\s*[+-]\s*(?:(?:MAR|POW|AGI|VIT|GRT)|\d+|[A-Za-z][A-Za-z ]*(?:\/[A-Za-z][A-Za-z ]*)?))*)/gi

/**
 * Find all dice notation matches in a string. Returns the matched text and
 * its position for highlighting.
 */
export function findDiceNotation(text: string): { match: string; start: number; end: number }[] {
  const results: { match: string; start: number; end: number }[] = []
  // Reset regex state.
  DICE_NOTATION_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DICE_NOTATION_REGEX.exec(text)) !== null) {
    results.push({ match: m[0], start: m.index, end: m.index + m[0].length })
  }
  return results
}
