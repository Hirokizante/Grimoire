/**
 * Unit tests for the emoji catalog and its search.
 *
 * The point of these is the picker's contract: a user types a word and gets
 * the emoji they meant — including the *game* words Unicode never uses
 * ("poisoned" is a skull and crossbones, not a "poison" emoji). The catalog is
 * the real one shipped to the browser, so the names asserted here are the names
 * the grid renders.
 */

import { test, expect } from 'vitest'

import {
  EMOJI_ALIASES,
  EMOJI_QUICK_PICKS,
  EMOJI_SEARCH_LIMIT,
  loadEmojiCatalog,
  pastedEmojiCandidate,
  searchEmojis,
} from '@/lib/emojiCatalog'
import type { EmojiGroup } from '@/lib/emojiCatalog'

const groups: EmojiGroup[] = await loadEmojiCatalog()

/** The emoji characters a search returns, best match first. */
function hits(query: string): string[] {
  return searchEmojis(groups, query).map((entry) => entry.emoji)
}

test('the catalog carries every Unicode group and the full emoji set', () => {
  expect(groups.map((group) => group.name)).toEqual([
    'Smileys & Emotion',
    'People & Body',
    'Animals & Nature',
    'Food & Drink',
    'Travel & Places',
    'Activities',
    'Objects',
    'Symbols',
    'Flags',
  ])
  const total = groups.reduce((sum, group) => sum + group.emojis.length, 0)
  expect(total).toBeGreaterThan(1900)
})

test('an empty query searches nothing (the picker shows its quick picks)', () => {
  expect(searchEmojis(groups, '')).toEqual([])
  expect(searchEmojis(groups, '   ')).toEqual([])
})

test('a name match ranks the emoji the user meant first', () => {
  expect(hits('fire')[0]).toBe('🔥')
  expect(hits('skull and crossbones')[0]).toBe('☠️')
  expect(hits('crossed swords')).toContain('⚔️')
})

test('every word of the query has to match', () => {
  // "grinning face" has 100+ hits; adding a third word narrows to one.
  expect(hits('grinning face with sweat')[0]).toBe('😅')
  expect(hits('fire snowflake')).toEqual([])
})

test('game terms reach emoji whose Unicode name never says them', () => {
  expect(hits('poisoned')[0]).toBe('☠️')
  expect(hits('blinded')).toContain('🙈')
  expect(hits('immobilized')[0]).toBe('⛓️')
  expect(hits('grappled')[0]).toBe('⛓️')
  expect(hits('sword')).toEqual(expect.arrayContaining(['⚔️', '🗡️']))
})

test('alias hits come before name matches', () => {
  const results = hits('heal')
  expect(['❤️‍🩹', '♻️']).toContain(results[0])
})

test('every alias points at an emoji the catalog actually ships', () => {
  const known = new Set(
    groups.flatMap((group) => group.emojis.map((entry) => entry.emoji)),
  )
  for (const [term, emojis] of Object.entries(EMOJI_ALIASES)) {
    expect(emojis.length, term).toBeGreaterThan(0)
    for (const emoji of emojis) {
      expect(known.has(emoji), `${term} → ${emoji}`).toBe(true)
    }
  }
  for (const emoji of EMOJI_QUICK_PICKS) {
    expect(known.has(emoji), emoji).toBe(true)
  }
})

test('an over-broad query is capped instead of rendering thousands of cells', () => {
  const results = searchEmojis(groups, 'a')
  expect(results.length).toBe(EMOJI_SEARCH_LIMIT)
})

test('a pasted emoji is offered as-is, a word is not', () => {
  expect(pastedEmojiCandidate('🔥')).toBe('🔥')
  expect(pastedEmojiCandidate(' ☠️ ')).toBe('☠️')
  expect(pastedEmojiCandidate('fire')).toBeNull()
  expect(pastedEmojiCandidate('d20')).toBeNull()
  expect(pastedEmojiCandidate('')).toBeNull()
  expect(pastedEmojiCandidate('🔥🔥🔥🔥🔥🔥🔥🔥🔥')).toBeNull()
})
