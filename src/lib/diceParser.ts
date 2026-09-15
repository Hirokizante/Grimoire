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

/** The five built-in Attribute abbreviations, always recognized. */
const BUILTIN_ABBREVIATIONS = 'MAR|POW|AGI|VIT|GRT'

/**
 * A free-form variable word: any capitalized/plain word, optionally written
 * with the `POW/MAR` alternative syntax. This is the permissive last resort —
 * an unknown name still highlights and rolls as 0 rather than staying literal,
 * which is what makes a typo visible in the roll breakdown.
 */
const WORD_VARIABLE = '[A-Za-z][A-Za-z ]*(?:\\/[A-Za-z][A-Za-z ]*)?'

/** The five built-in abbreviations, never matching the prefix of a longer word. */
const BUILTIN_VARIABLE = `(?:${BUILTIN_ABBREVIATIONS})(?![A-Za-z])`

/** Escape a literal variable name for embedding in a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalize a caller-supplied variable list: trim, drop empties, de-duplicate
 * case-insensitively, and order longest-first.
 *
 * Longest-first matters because JavaScript alternation is first-match: with
 * "Martial" and "Martial Arts" both on the sheet, `2d6+Martial Arts` has to try
 * the longer name first or it would stop at "Martial".
 */
function normalizeVariables(extraVariables: readonly string[]): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const raw of extraVariables) {
    const name = raw.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names.sort((a, b) => b.length - a.length)
}

/**
 * Build the dice-notation pattern, optionally teaching it a character's own
 * variable names (their custom attributes' shorthands and full names).
 *
 * Known names are tried before the built-in abbreviations and before the
 * permissive word fallback, so `2d6+FOO` in "2d6+FOO damage" stops at the
 * attribute instead of swallowing the following prose into the variable name —
 * and a multi-word custom name ("Martial Arts") matches whole. Every named
 * branch (custom names and the five abbreviations alike) refuses to match the
 * prefix of a longer word, so the full attribute names `resolveVariable` has
 * always accepted — `2d6+Martial`, `2d6+Power` — highlight as the one variable
 * they are instead of being clipped to the abbreviation inside them.
 *
 * The `/` alternative syntax is offered on both named branches, so
 * `1d6+POW/MAR` and `1d6+FOO/BAR` each highlight as one term.
 */
function diceNotationPattern(extraVariables: readonly string[] = []): string {
  const variables = normalizeVariables(extraVariables)
  const escaped = variables.map(escapeRegExp).join('|')
  // The `X/Y` alternative form ("use either stat"), available to both kinds of
  // name; the custom names are listed first so they win a tie as usual.
  const altNames =
    variables.length > 0
      ? `${escaped}|${BUILTIN_ABBREVIATIONS}`
      : BUILTIN_ABBREVIATIONS
  const alt = `(?:\\s*\\/\\s*(?:${altNames}))?`
  const customBranch =
    variables.length > 0 ? `(?:${escaped})(?![A-Za-z])${alt}|` : ''
  const variableAlternation =
    `(?:${customBranch}${BUILTIN_VARIABLE}${alt}|\\d+|${WORD_VARIABLE})`
  return `(\\d*d\\d+(?:\\s*[+-]\\s*${variableAlternation})*)`
}

/**
 * Regex that matches dice notation in free text. Used by the DiceHighlighter
 * component to find and make notation clickable.
 *
 * Matches patterns like:
 *   - 1d6, 2d6, 3d20, d20
 *   - 1d6+POW, 2d6+MAR, d20+3
 *   - 1d6+POW/MAR, 2d6-1+Sneak
 *
 * This is the character-less pattern (built-in stats and free-form words only);
 * {@link findDiceNotation} with a variable list is what knows a sheet's custom
 * attributes.
 */
export const DICE_NOTATION_REGEX = new RegExp(diceNotationPattern(), 'gi')

/**
 * Compiled character-aware patterns, keyed by the variable list they were built
 * from. A sheet renders one highlighter per prose field, all with the same
 * vocabulary, so caching keeps a re-render from rebuilding the same regex.
 */
const patternCache = new Map<string, RegExp>()

/** How many distinct vocabularies to keep compiled before starting over. */
const MAX_CACHED_PATTERNS = 32

/** The (cached) regex for a variable vocabulary; the shared one when none. */
function notationRegex(extraVariables: readonly string[]): RegExp {
  const variables = normalizeVariables(extraVariables)
  if (variables.length === 0) return DICE_NOTATION_REGEX
  const key = variables.join('\u0000').toLowerCase()
  const cached = patternCache.get(key)
  if (cached) return cached
  const regex = new RegExp(diceNotationPattern(variables), 'gi')
  if (patternCache.size >= MAX_CACHED_PATTERNS) patternCache.clear()
  patternCache.set(key, regex)
  return regex
}

/**
 * Cheap pre-check: does this string contain any dice-notation shape at all?
 *
 * Deliberately looser than {@link DICE_NOTATION_REGEX} — it only has to avoid
 * running the full parse on prose that cannot contain a roll. Callers that need
 * the exact matches still use {@link findDiceNotation}.
 */
export function hasDiceCandidate(text: string): boolean {
  return /\d*d\s*\d+/i.test(text)
}

/**
 * Find all dice notation matches in a string. Returns the matched text and
 * its position for highlighting.
 *
 * `extraVariables` is the character's own variable vocabulary (a sheet's custom
 * attribute shorthands and names — see `customAttributeVariableNames`). Passing
 * it makes those names first-class tokens: they are matched exactly, keep
 * multi-word names whole, and end the match before trailing prose. Omitting it
 * leaves the historical character-less behavior untouched.
 */
export function findDiceNotation(
  text: string,
  extraVariables: readonly string[] = [],
): { match: string; start: number; end: number }[] {
  const results: { match: string; start: number; end: number }[] = []
  const regex = notationRegex(extraVariables)
  // Reset regex state.
  regex.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    results.push({ match: m[0], start: m.index, end: m.index + m[0].length })
  }
  return results
}
