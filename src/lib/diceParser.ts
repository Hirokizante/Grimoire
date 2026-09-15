/**
 * Dice notation parser for the Divergence TTRPG.
 *
 * Parses strings like "2d6+POW", "d20+3", "1d6+POW/MAR", "1d6" and compound
 * expressions like "(1d6+POW)*2/2d6+MAR" into an expression tree that the
 * roller evaluates.
 *
 * Supported syntax:
 *   - Dice:         `NdS` or `dS` (N defaults to 1), e.g. `2d6`, `d20`, `3d6`
 *   - Constants:    plain numbers, e.g. `+3`, `-1`
 *   - Variables:    attribute/skill names, e.g. `POW`, `MAR`, `Sneak`
 *   - Variable alt: `POW/MAR` means "use POW or MAR, player's choice"
 *   - Operators:    `+`, `-`, `*`, `/` and parentheses for grouping
 *
 * Precedence is the usual one — `*` and `/` bind tighter than `+` and `-`, and
 * parentheses override both — so `(1d6+POW)*2/2d6+MAR` halves the doubled
 * attack before adding MAR. Division is integer division rounded down.
 *
 * Two shape rules keep notation out of prose's way:
 *
 *   - `*` and `/` must be written **tight** (`2d6*3`, `1d6/POW`), while `+` and
 *     `-` may be spaced as before. A spaced asterisk in prose is Markdown
 *     emphasis (`*1d6+2* slashing`), and reading it as multiplication would
 *     swallow the following words into the roll.
 *   - A slash between two bare names is the `POW/MAR` alternative form rather
 *     than division, so the documented "either stat" syntax keeps working.
 *
 * The parser is deliberately permissive: anything it can't read as dice or a
 * known variable is taken as a variable name, which the roller resolves to 0 —
 * a typo shows up in the breakdown instead of swallowing the whole roll.
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

/** A leaf of a parsed dice expression. */
export type ParsedTerm = DiceTerm | ConstantTerm | VariableTerm

/** Every operator a notation can write. */
export type BinaryOp = '+' | '-' | '*' | '/'

/**
 * A node of the parsed expression tree.
 *
 * Subtraction never reaches the tree: `a-b` is parsed as `a + (-b)`, and a
 * minus in front of a constant or variable is folded into that leaf's `sign`.
 * A negated die or group — `-1d6`, `-(1d6+2)` — is the one case that needs an
 * explicit {@link NegateNode}.
 */
export type ExprNode =
  | { kind: 'term'; term: ParsedTerm }
  | { kind: 'binary'; op: '+' | '*' | '/'; left: ExprNode; right: ExprNode }
  | { kind: 'negate'; operand: ExprNode }

/** A fully parsed dice expression. */
export interface ParsedExpression {
  /** The original notation string. */
  notation: string
  /** The parsed expression tree, or null when nothing could be read at all. */
  root: ExprNode | null
}

// ---- Tokenizer ---------------------------------------------------------------

/** Where the parser is in the input. */
interface Cursor {
  input: string
  pos: number
  /** Leaves read so far, against {@link MAX_EXPRESSION_NODES}. */
  nodes: number
  /**
   * Set when the expression grew past its budget. Backtracking means a partial
   * parse still comes back, so the entry points check this and refuse the whole
   * notation rather than accepting the truncated prefix.
   */
  overBudget: boolean
}

/** A dice term at the cursor: `2d6`, `d20`, `3D8`. */
const DICE_AT = /(\d*)d(\d+)/iy

/** A constant at the cursor. */
const NUMBER_AT = /\d+/y

/**
 * The permissive last resort for a variable name: a letter followed by letters
 * and spaces (`2d6+Martial Arts`, and the historical "swallow the trailing
 * prose" reading for a sheet that defines no such attribute).
 */
const WORD_AT = /[A-Za-z][A-Za-z ]*/y

/** The five built-in Attribute abbreviations, always recognized. */
const BUILTIN_ABBREVIATIONS = ['MAR', 'POW', 'AGI', 'VIT', 'GRT']

/**
 * The most dice one term may roll before the notation is refused outright.
 * A pasted `999999d6` should cost the player a highlight, not the browser.
 */
const MAX_DICE_COUNT = 1000

/** The most sides a die may have; past this the notation is a typo. */
const MAX_DICE_SIDES = 1000000

/**
 * How many leaves one expression may hold. The scanner and the roller walk the
 * tree recursively, so a pasted run of thousands of `+1d6` terms has to read as
 * "not notation" rather than blowing the stack mid-render. Real notation uses a
 * handful — the activation accuracy bonus, a damage expression, a stat or two.
 */
const MAX_EXPRESSION_NODES = 64

/**
 * How deeply groups and signs may nest. The parser descends a few frames per
 * level, and it runs on whatever prose a sheet holds, so a pasted run of
 * thousands of `(` must read as "not notation" rather than blowing the stack
 * mid-render. Real notation nests one or two deep.
 */
const MAX_NESTING_DEPTH = 32

/** Whether a character is whitespace (tolerates running off the end). */
function isSpace(ch: string | undefined): boolean {
  return ch != null && /\s/.test(ch)
}

/** Advance the cursor past whitespace. */
function skipSpaces(p: Cursor): void {
  while (isSpace(p.input[p.pos])) p.pos++
}

/** Whether a factor may start with this character (signs included). */
function isPrimaryStart(ch: string | undefined): boolean {
  if (ch == null) return false
  return ch === '(' || ch === '+' || ch === '-' || /[A-Za-z0-9]/.test(ch)
}

/**
 * Match a dice term at the cursor, refusing counts/sides that cannot be rolled
 * (`0d6`) or that would roll an unreasonable number of dice.
 */
function matchDice(p: Cursor): DiceTerm | null {
  DICE_AT.lastIndex = p.pos
  const match = DICE_AT.exec(p.input)
  if (!match) return null
  const count = match[1] === '' ? 1 : Number(match[1])
  const sides = Number(match[2])
  if (count < 1 || count > MAX_DICE_COUNT) return null
  if (sides < 1 || sides > MAX_DICE_SIDES) return null
  p.pos = DICE_AT.lastIndex
  return { type: 'dice', count, sides }
}

/** Count a leaf against the expression budget; false once it is spent. */
function spendNode(p: Cursor): boolean {
  p.nodes++
  if (p.nodes > MAX_EXPRESSION_NODES) {
    p.overBudget = true
    return false
  }
  return true
}

// ---- Variables ---------------------------------------------------------------

/** One matched variable name: what it is, where it ends, how it was matched. */
interface MatchedName {
  /** The name as the author wrote it (`SAN`, `Sanity`, `sneak`). */
  name: string
  /** Index just past the name. */
  end: number
  /**
   * True when the name is one the vocabulary knows — a custom attribute or a
   * built-in abbreviation. Only a named left side is allowed a `/` alternative
   * that is also a name; the permissive word branch keeps its historical
   * "either word" reading.
   */
  named: boolean
}

/**
 * Normalize a caller-supplied variable list: trim, drop empties, de-duplicate
 * case-insensitively, and order longest-first.
 *
 * Longest-first matters because the matcher tries names in order: with
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

/** Match one literal name at `pos`, case-insensitively and never mid-word. */
function matchName(input: string, pos: number, name: string): number | null {
  const end = pos + name.length
  if (end > input.length) return null
  if (input.slice(pos, end).toLowerCase() !== name.toLowerCase()) return null
  // A named branch refuses to match the prefix of a longer word, so the full
  // attribute names `resolveVariable` accepts (`Power`, `Martial`) are one
  // variable rather than the abbreviation inside them.
  const next = input[end]
  if (next != null && /[A-Za-z]/.test(next)) return null
  return end
}

/**
 * Match a variable name at `pos`: a name the sheet knows, then a built-in
 * abbreviation, then the permissive word fallback.
 */
function matchVariableName(
  input: string,
  pos: number,
  vocabulary: readonly string[],
): MatchedName | null {
  for (const name of vocabulary) {
    const end = matchName(input, pos, name)
    if (end !== null) return { name: input.slice(pos, end), end, named: true }
  }
  for (const name of BUILTIN_ABBREVIATIONS) {
    const end = matchName(input, pos, name)
    if (end !== null) return { name: input.slice(pos, end), end, named: true }
  }
  WORD_AT.lastIndex = pos
  const word = WORD_AT.exec(input)
  if (!word) return null
  // The free-form branch may run over inner spaces ("Sanity psychic damage"),
  // but it ends on the last letter: a trailing space would make the following
  // word look like a tight operand (`and *1d6` reading as a multiplication).
  const name = word[0].replace(/\s+$/, '')
  if (!name) return null
  return { name, end: pos + name.length, named: false }
}

/** Whether a matched name is one the sheet's vocabulary or the builtins own. */
function isKnownVariableName(
  name: string,
  vocabulary: readonly string[],
): boolean {
  const lower = name.toLowerCase()
  return (
    BUILTIN_ABBREVIATIONS.some((builtin) => builtin.toLowerCase() === lower) ||
    vocabulary.some((known) => known.toLowerCase() === lower)
  )
}

/**
 * Whether a right-hand operand can be divided by.
 *
 * A number, a die, a group or a known name is fine. A multi-word free-form name
 * ("half of that") is prose rather than a stat, and the matcher has always
 * stopped there — so it stops here too.
 */
function isDivisionOperand(
  node: ExprNode,
  vocabulary: readonly string[],
): boolean {
  if (node.kind !== 'term' || node.term.type !== 'variable') return true
  const { name } = node.term
  if (!/\s/.test(name)) return true
  return isKnownVariableName(name, vocabulary)
}

/**
 * The `POW/MAR` alternative form after a matched variable, if one follows.
 *
 * Spaces around the slash are allowed — it is the documented "either stat"
 * syntax, and division never has a bare name on both sides (`2d6/POW` is
 * division, because its left side is a die).
 */
function matchAlt(
  input: string,
  from: number,
  left: MatchedName,
  vocabulary: readonly string[],
): MatchedName | null {
  let i = from
  while (isSpace(input[i])) i++
  if (input[i] !== '/') return null
  i++
  while (isSpace(input[i])) i++
  const right = matchVariableName(input, i, vocabulary)
  if (!right) return null
  if (left.named && !right.named) return null
  return right
}

// ---- Parser ------------------------------------------------------------------

/**
 * Fold a leading minus into a node.
 *
 * Constants and variables carry their own sign, so `-3` and `-POW` stay plain
 * leaves; a die or a group cannot, and becomes a negate node.
 */
function negate(node: ExprNode): ExprNode {
  if (node.kind === 'term' && node.term.type !== 'dice') {
    const sign: 1 | -1 = node.term.sign === 1 ? -1 : 1
    return { kind: 'term', term: { ...node.term, sign } }
  }
  if (node.kind === 'negate') return node.operand
  return { kind: 'negate', operand: node }
}

/** A factor: a signed primary, a `(...)` group, dice, a number or a variable. */
function parseUnary(
  p: Cursor,
  vocabulary: readonly string[],
  depth: number,
): ExprNode | null {
  skipSpaces(p)
  const ch = p.input[p.pos]
  if (ch === '-' || ch === '+') {
    if (depth >= MAX_NESTING_DEPTH) return null
    const start = p.pos
    p.pos++
    const operand = parseUnary(p, vocabulary, depth + 1)
    if (!operand) {
      p.pos = start
      return null
    }
    return ch === '-' ? negate(operand) : operand
  }
  return parsePrimary(p, vocabulary, depth)
}

/** A primary: `(expression)`, dice, a constant, or a variable. */
function parsePrimary(
  p: Cursor,
  vocabulary: readonly string[],
  depth: number,
): ExprNode | null {
  skipSpaces(p)

  if (p.input[p.pos] === '(') {
    if (depth >= MAX_NESTING_DEPTH) return null
    const start = p.pos
    p.pos++
    const inner = parseAdditive(p, vocabulary, depth + 1)
    if (inner) {
      skipSpaces(p)
      if (p.input[p.pos] === ')') {
        p.pos++
        return inner
      }
    }
    // An unclosed or empty group is not notation; leave the text as it was.
    p.pos = start
    return null
  }

  const dice = matchDice(p)
  if (dice) {
    if (!spendNode(p)) return null
    return { kind: 'term', term: dice }
  }

  // A dice-shaped token the matcher refused (`0d6`, or a count past the cap) is
  // a notation error, not a constant followed by junk — ending here keeps
  // `2000d6` from parsing as the number 2000.
  DICE_AT.lastIndex = p.pos
  if (DICE_AT.test(p.input)) return null

  NUMBER_AT.lastIndex = p.pos
  const number = NUMBER_AT.exec(p.input)
  if (number) {
    if (!spendNode(p)) return null
    p.pos += number[0].length
    return {
      kind: 'term',
      term: { type: 'constant', value: Number(number[0]), sign: 1 },
    }
  }

  const variable = matchVariableName(p.input, p.pos, vocabulary)
  if (!variable) return null
  if (!spendNode(p)) return null
  const term: VariableTerm = { type: 'variable', name: variable.name, sign: 1 }
  p.pos = variable.end
  const alt = matchAlt(p.input, variable.end, variable, vocabulary)
  if (alt) {
    term.alt = alt.name
    p.pos = alt.end
  }
  return { kind: 'term', term }
}

/**
 * Multiplication and division, which bind tighter than `+`/`-`.
 *
 * Both operators must be written tight on both sides: `2d6*3`, `1d6/POW`,
 * `(1d6+2)/2`. A spaced operator is prose (`*1d6+2* slashing`) and ends the
 * expression instead.
 */
function parseMultiplicative(
  p: Cursor,
  vocabulary: readonly string[],
  depth: number,
): ExprNode | null {
  let left = parseUnary(p, vocabulary, depth)
  if (!left) return null

  for (;;) {
    const opPos = p.pos
    const op = p.input[opPos]
    if (op !== '*' && op !== '/') return left
    if (!isPrimaryStart(p.input[opPos + 1])) return left
    p.pos = opPos + 1
    const right = parseUnary(p, vocabulary, depth)
    if (!right || (op === '/' && !isDivisionOperand(right, vocabulary))) {
      p.pos = opPos
      return left
    }
    left = { kind: 'binary', op, left, right }
  }
}

/**
 * The additive chain that ties an expression together: `2d6+POW`, `d20 - 1`,
 * `1d6+2*3`. Spacing around `+`/`-` is free.
 *
 * A trailing operator with nothing after it (`1d6+`) ends the expression at the
 * last complete term rather than failing outright, so half-typed notation still
 * highlights the part that makes sense.
 */
function parseAdditive(
  p: Cursor,
  vocabulary: readonly string[],
  depth: number,
): ExprNode | null {
  let left = parseMultiplicative(p, vocabulary, depth)
  if (!left) return null

  for (;;) {
    const start = p.pos
    let i = start
    while (isSpace(p.input[i])) i++
    const op = p.input[i]
    if (op !== '+' && op !== '-') {
      p.pos = start
      return left
    }
    p.pos = i + 1
    const right = parseMultiplicative(p, vocabulary, depth)
    if (!right) {
      p.pos = start
      return left
    }
    left = {
      kind: 'binary',
      op: '+',
      left,
      right: op === '-' ? negate(right) : right,
    }
  }
}

/**
 * Parse a dice notation string into a structured {@link ParsedExpression}.
 *
 * The whole string is read from the left; anything the parser cannot use
 * (trailing prose, a half-typed operator) is simply where the expression stops.
 */
export function parseDiceNotation(notation: string): ParsedExpression {
  const cursor: Cursor = { input: notation, pos: 0, nodes: 0, overBudget: false }
  const root = parseAdditive(cursor, [], 0)
  return { notation, root: cursor.overBudget ? null : root }
}

// ---- Finding notation in free text -------------------------------------------

/** Whether an expression tree rolls any dice at all. */
function hasDice(node: ExprNode): boolean {
  switch (node.kind) {
    case 'term':
      return node.term.type === 'dice'
    case 'negate':
      return hasDice(node.operand)
    case 'binary':
      return hasDice(node.left) || hasDice(node.right)
  }
}

/**
 * Regex that matches a dice term in free text — the only thing, besides an
 * opening parenthesis, that can start a notation match.
 *
 * It is a cheap public probe, not the matcher: reading a whole expression
 * (groups, operators, a sheet's own vocabulary) needs the parser, which is what
 * {@link findDiceNotation} runs.
 */
export const DICE_NOTATION_REGEX = /\d*d\d+/gi

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

/** The next index at which a factor could start, or -1 when there is none. */
function nextCandidate(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || /[A-Za-z0-9]/.test(ch)) return i
  }
  return -1
}

/**
 * Where to resume after an attempt at `start` found nothing: past the token
 * that was read.
 *
 * A refused die (`0d6`, a count past the cap) goes whole, so its `d6` tail is
 * not read as a term of its own, and a long run of digits or letters is not
 * re-tried at every offset — that is quadratic, and a pasted run of 50 000
 * digits took seconds inside a render.
 *
 * A **word** run is the one place a die can hide from that skip: the permissive
 * word branch swallows letters, so "for damage and d20+3" ends on the `d` of
 * `d20`, and the run is only skipped up to the die that starts the next match.
 */
function resumeAfterFailed(text: string, start: number): number {
  DICE_AT.lastIndex = start
  const dice = DICE_AT.exec(text)
  if (dice) return start + dice[0].length

  NUMBER_AT.lastIndex = start
  const number = NUMBER_AT.exec(text)
  if (number) return start + number[0].length

  WORD_AT.lastIndex = start
  const word = WORD_AT.exec(text)
  if (!word) return start + 1
  const end = start + word[0].length
  for (let i = start + 1; i < end; i++) {
    DICE_AT.lastIndex = i
    if (DICE_AT.test(text)) return i
  }
  return end
}

/**
 * Find all dice notation matches in a string. Returns the matched text and
 * its position for highlighting.
 *
 * A match is the longest expression that parses from a candidate start and
 * contains at least one die, so groups, operators and precedence come along
 * whole: `(1d6+POW)*2/2d6+MAR` is one token, `d20+3` is another. A bare number
 * or word before a die is only ever part of a match when the text really reads
 * as one expression (`2*(1d6+2)`), never as prose ("2 rounds").
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
  const vocabulary = normalizeVariables(extraVariables)
  const results: { match: string; start: number; end: number }[] = []
  let i = 0

  while (i < text.length) {
    const start = nextCandidate(text, i)
    if (start < 0) break

    const cursor: Cursor = {
      input: text,
      pos: start,
      nodes: 0,
      overBudget: false,
    }
    const root = parseAdditive(cursor, vocabulary, 0)

    if (!cursor.overBudget && root && hasDice(root)) {
      // The permissive word branch may have swallowed trailing spaces; the
      // pill should not wear them.
      let end = cursor.pos
      while (end > start && isSpace(text[end - 1])) end--
      results.push({ match: text.slice(start, end), start, end })
      i = Math.max(end, start + 1)
      continue
    }

    // Nothing usable here. The token that was read is skipped whole: a
    // dice-shaped token the parser refused (`0d6`, a count past the cap) must not
    // be re-read as its own `d6` tail, and a long run of digits or letters must
    // not be re-tried at every offset.
    i = Math.max(resumeAfterFailed(text, start), start + 1)
  }

  return results
}
