import { test, expect } from 'vitest'
import {
  parseDiceNotation,
  findDiceNotation,
  DICE_NOTATION_REGEX,
  type ExprNode,
} from '@/lib/diceParser'

// Shorthand builders, so an expectation reads like the notation it parses:
// `plus(die(1, 6), stat('POW'))` is `1d6+POW`.

function die(count: number, sides: number): ExprNode {
  return { kind: 'term', term: { type: 'dice', count, sides } }
}

function num(value: number, sign: 1 | -1 = 1): ExprNode {
  return { kind: 'term', term: { type: 'constant', value, sign } }
}

function stat(name: string, sign: 1 | -1 = 1, alt?: string): ExprNode {
  return {
    kind: 'term',
    term: alt
      ? { type: 'variable', name, alt, sign }
      : { type: 'variable', name, sign },
  }
}

function plus(left: ExprNode, right: ExprNode): ExprNode {
  return { kind: 'binary', op: '+', left, right }
}

function times(left: ExprNode, right: ExprNode): ExprNode {
  return { kind: 'binary', op: '*', left, right }
}

function over(left: ExprNode, right: ExprNode): ExprNode {
  return { kind: 'binary', op: '/', left, right }
}

function minus(operand: ExprNode): ExprNode {
  return { kind: 'negate', operand }
}

/** The root of a parsed expression (the tests below always parse something). */
function rootOf(notation: string): ExprNode | null {
  return parseDiceNotation(notation).root
}

// ---- Leaves ------------------------------------------------------------------

test('parseDiceNotation: simple dice (NdS)', () => {
  expect(rootOf('2d6')).toEqual(die(2, 6))
})

test('parseDiceNotation: single die (dS, count defaults to 1)', () => {
  expect(rootOf('d20')).toEqual(die(1, 20))
})

test('parseDiceNotation: the die letter is case-insensitive', () => {
  expect(rootOf('2D6')).toEqual(die(2, 6))
})

test('parseDiceNotation: dice + constant', () => {
  expect(rootOf('d20+3')).toEqual(plus(die(1, 20), num(3)))
})

test('parseDiceNotation: dice + variable (POW)', () => {
  expect(rootOf('2d6+POW')).toEqual(plus(die(2, 6), stat('POW')))
})

test('parseDiceNotation: variable with alt (POW/MAR)', () => {
  expect(rootOf('1d6+POW/MAR')).toEqual(plus(die(1, 6), stat('POW', 1, 'MAR')))
})

test('parseDiceNotation: the alt form tolerates spaces around the slash', () => {
  expect(rootOf('1d6 + POW / MAR')).toEqual(plus(die(1, 6), stat('POW', 1, 'MAR')))
})

test('parseDiceNotation: subtraction folds the sign into the leaf', () => {
  expect(rootOf('d20-1')).toEqual(plus(die(1, 20), num(1, -1)))
})

test('parseDiceNotation: dice minus variable', () => {
  expect(rootOf('2d6-Sneak')).toEqual(plus(die(2, 6), stat('Sneak', -1)))
})

test('parseDiceNotation: a subtracted die is a negation, not a sign', () => {
  expect(rootOf('d20-2d6')).toEqual(plus(die(1, 20), minus(die(2, 6))))
})

test('parseDiceNotation: a leading minus negates a group', () => {
  expect(rootOf('-(1d6+2)')).toEqual(minus(plus(die(1, 6), num(2))))
})

test('parseDiceNotation: double negation cancels', () => {
  expect(rootOf('d20--2')).toEqual(plus(die(1, 20), num(2)))
})

test('parseDiceNotation: multi-term expression', () => {
  expect(rootOf('2d6+POW+3')).toEqual(plus(plus(die(2, 6), stat('POW')), num(3)))
})

// ---- Precedence, groups and operators ----------------------------------------

test('parseDiceNotation: multiplication binds tighter than addition', () => {
  expect(rootOf('1d6+2*3')).toEqual(plus(die(1, 6), times(num(2), num(3))))
})

test('parseDiceNotation: multiplication and division', () => {
  expect(rootOf('2d6*3')).toEqual(times(die(2, 6), num(3)))
  expect(rootOf('2d6/3')).toEqual(over(die(2, 6), num(3)))
  expect(rootOf('1d6/2*3')).toEqual(times(over(die(1, 6), num(2)), num(3)))
})

test('parseDiceNotation: a die can be divided by a stat', () => {
  expect(rootOf('2d6/POW')).toEqual(over(die(2, 6), stat('POW')))
})

test('parseDiceNotation: a variable divided by a number is division, not an alt', () => {
  expect(rootOf('1d6+POW/2')).toEqual(plus(die(1, 6), over(stat('POW'), num(2))))
})

test('parseDiceNotation: a free-form left side keeps its alt reading', () => {
  expect(rootOf('1d6+Sneak/MAR')).toEqual(
    plus(die(1, 6), stat('Sneak', 1, 'MAR')),
  )
})

test('parseDiceNotation: parentheses group an expression', () => {
  expect(rootOf('(1d6+2)*3')).toEqual(times(plus(die(1, 6), num(2)), num(3)))
})

test('parseDiceNotation: parentheses can be nested', () => {
  expect(rootOf('((1d6))')).toEqual(die(1, 6))
  expect(rootOf('2d6*(1d6+2)')).toEqual(times(die(2, 6), plus(die(1, 6), num(2))))
})

test('parseDiceNotation: multiple operators and groups', () => {
  expect(rootOf('(1d6+POW)*2/2d6+MAR')).toEqual(
    plus(
      over(times(plus(die(1, 6), stat('POW')), num(2)), die(2, 6)),
      stat('MAR'),
    ),
  )
})

test('parseDiceNotation: whitespace is trimmed', () => {
  expect(rootOf('  2d6 + POW  ')).toEqual(plus(die(2, 6), stat('POW')))
})

// ---- Shape rules that keep notation out of prose -----------------------------

test('parseDiceNotation: * and / must be written tight', () => {
  // A spaced operator is prose (Markdown emphasis), so the expression ends at
  // the last complete term instead.
  expect(rootOf('2d6 * 3')).toEqual(die(2, 6))
  expect(rootOf('2d6* 3')).toEqual(die(2, 6))
  expect(rootOf('2d6 *3')).toEqual(die(2, 6))
})

test('parseDiceNotation: division by a multi-word free-form name is prose', () => {
  // "half of that" is not a stat; the historical matcher stopped at POW, and
  // so does this one.
  expect(rootOf('1d6+POW/half of that')).toEqual(plus(die(1, 6), stat('POW')))
})

test('parseDiceNotation: a half-typed operator ends the expression', () => {
  expect(rootOf('1d6+')).toEqual(die(1, 6))
  expect(rootOf('(1d6+')).toBeNull()
})

test('parseDiceNotation: a group without dice is still an expression', () => {
  expect(rootOf('(2+3)*2')).toEqual(times(plus(num(2), num(3)), num(2)))
})

test('parseDiceNotation: empty string parses to nothing', () => {
  expect(parseDiceNotation('').root).toBeNull()
  expect(parseDiceNotation('   ').root).toBeNull()
  expect(rootOf('+++')).toBeNull()
})

test('parseDiceNotation: an unrollable die is refused, not read as a number', () => {
  expect(rootOf('0d6')).toBeNull()
  expect(rootOf('2000d6')).toBeNull()
  // A die of more sides than any table uses is a typo, and `Number` turns a
  // long enough run of nines into Infinity — which must not roll as a total.
  expect(rootOf(`1d${'9'.repeat(400)}`)).toBeNull()
  expect(rootOf('1d1000000')).toEqual(die(1, 1000000))
})

test('parseDiceNotation: runaway nesting is refused, not a stack overflow', () => {
  // The parser descends a few frames per group, so a pasted run of parens must
  // read as "not notation" rather than throwing mid-render.
  expect(rootOf(`${'('.repeat(5000)}1d6`)).toBeNull()
  expect(rootOf(`${'-'.repeat(5000)}3`)).toBeNull()
  // Real notation nests, and still parses.
  expect(rootOf('((1d6+2))*3')).toEqual(times(plus(die(1, 6), num(2)), num(3)))
})

test('parseDiceNotation: a runaway term chain is refused whole', () => {
  // The tree walks are recursive, so a pasted run of thousands of terms is
  // refused outright rather than truncated to its first terms — a pill that
  // silently rolled only part of what it showed would be worse than none.
  expect(rootOf(`1d6${'+1d6'.repeat(200)}`)).toBeNull()
  expect(rootOf(`1d6${'+1d6'.repeat(10)}`)).toEqual(
    expect.objectContaining({ kind: 'binary' }),
  )
})

test('parseDiceNotation: preserves original notation string', () => {
  const notation = '2d6+POW/MAR'
  const expr = parseDiceNotation(notation)
  expect(expr.notation).toBe(notation)
})

// ---- Free-text matching ------------------------------------------------------

test('findDiceNotation: finds single match', () => {
  const matches = findDiceNotation('2d6+POW')
  expect(matches).toHaveLength(1)
  expect(matches[0].match).toBe('2d6+POW')
  expect(matches[0].start).toBe(0)
  expect(matches[0].end).toBe(7)
})

test('findDiceNotation: finds multiple matches in text', () => {
  const matches = findDiceNotation('Roll 1d6+POW for damage and d20+3 to hit')
  expect(matches.length).toBeGreaterThanOrEqual(2)
  expect(matches.some((m) => m.match === '1d6+POW')).toBe(true)
  expect(matches.some((m) => m.match === 'd20+3')).toBe(true)
})

test('findDiceNotation: no matches in plain text', () => {
  expect(findDiceNotation('No dice here')).toHaveLength(0)
})

test('findDiceNotation: handles d20 alone', () => {
  const matches = findDiceNotation('d20')
  expect(matches).toHaveLength(1)
  expect(matches[0].match).toBe('d20')
})

test('findDiceNotation: a compound expression is one token', () => {
  const matches = findDiceNotation('Deal (1d6+POW)*2/2d6+MAR damage')
  expect(matches).toHaveLength(1)
  expect(matches[0].match).toBe('(1d6+POW)*2/2d6+MAR')
  expect(matches[0].start).toBe(5)
  expect(matches[0].end).toBe(24)
})

test('findDiceNotation: a group before a die comes along', () => {
  expect(findDiceNotation('2*(1d6+2) total')[0].match).toBe('2*(1d6+2)')
})

test('findDiceNotation: a match always rolls at least one die', () => {
  // Arithmetic is not notation, and a bullet's dash is not a minus sign.
  expect(findDiceNotation('2*(3+4) damage')).toHaveLength(0)
  expect(findDiceNotation('- 1d6+2 fire')).toEqual([
    expect.objectContaining({ match: '1d6+2' }),
  ])
})

test('findDiceNotation: Markdown emphasis is not multiplication', () => {
  expect(findDiceNotation('*1d6+2* slashing')).toEqual([
    expect.objectContaining({ match: '1d6+2' }),
  ])
  expect(findDiceNotation('**2d6** piercing')).toEqual([
    expect.objectContaining({ match: '2d6' }),
  ])
})

test('findDiceNotation: a half-typed operator still highlights', () => {
  expect(findDiceNotation('Roll 1d6+')[0].match).toBe('1d6')
})

test('findDiceNotation: an unrollable die is left alone', () => {
  expect(findDiceNotation('0d6')).toHaveLength(0)
  expect(findDiceNotation('2000d6')).toHaveLength(0)
})

test('findDiceNotation: a pasted run of parens is scanned without throwing', () => {
  const text = `${'('.repeat(5000)}1d6+2`
  expect(() => findDiceNotation(text)).not.toThrow()
  // The runaway parens are prose; the notation after them still highlights.
  expect(findDiceNotation(text).map((m) => m.match)).toEqual(['1d6+2'])
})

test('findDiceNotation: the match is exactly the slice it reports', () => {
  const text = 'Deal 2d6+FOO*2 slashing damage'
  for (const m of findDiceNotation(text)) {
    expect(m.match).toBe(text.slice(m.start, m.end))
  }
})

test('findDiceNotation: a known multi-word name works inside a group', () => {
  const matches = findDiceNotation('deal (1d8+Martial Arts)*2 damage', [
    'Martial Arts',
  ])
  expect(matches).toEqual([
    expect.objectContaining({ match: '(1d8+Martial Arts)*2' }),
  ])
})

test('findDiceNotation: a long description is scanned linearly', () => {
  const text = `${'The blade hums with old power. '.repeat(400)}Roll 1d6+POW to hit.`
  const started = Date.now()
  const matches = findDiceNotation(text, ['SAN', 'Sanity'])

  expect(matches.map((m) => m.match)).toEqual(['1d6+POW'])
  // The scanner parses from each candidate start; the bound only has to catch a
  // catastrophic blow-up (it runs in single-digit milliseconds today).
  expect(Date.now() - started).toBeLessThan(1000)
})

test('findDiceNotation: long runs and long chains stay fast and safe', () => {
  const started = Date.now()
  // A pasted run of digits or letters must not be re-tried at every offset
  // (quadratic), and a pasted chain of terms must not blow the stack.
  expect(findDiceNotation('1'.repeat(20_000))).toHaveLength(0)
  expect(findDiceNotation('a'.repeat(20_000))).toHaveLength(0)
  expect(() => findDiceNotation(`1d6${'+1d6'.repeat(5000)}`)).not.toThrow()
  expect(() => findDiceNotation(`${'('.repeat(6000)}1d6`)).not.toThrow()
  expect(Date.now() - started).toBeLessThan(2000)
})

test('DICE_NOTATION_REGEX: global flag can be reset', () => {
  DICE_NOTATION_REGEX.lastIndex = 0
  expect(DICE_NOTATION_REGEX.test('2d6')).toBe(true)
  // Verify it's global (has lastIndex behavior)
  expect(DICE_NOTATION_REGEX.global).toBe(true)
})
