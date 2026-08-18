import { describe, expect, test } from 'vitest'

import { plainTextFromMarkdown } from './markdown'

describe('plainTextFromMarkdown', () => {
  test('strips bold and italic markers', () => {
    expect(plainTextFromMarkdown('**Heavy** and *light* text')).toBe(
      'Heavy and light text',
    )
  })

  test('strips heading markers and list bullets', () => {
    expect(
      plainTextFromMarkdown('# Title\n- item one\n- item two'),
    ).toBe('Title item one item two')
  })

  test('unwraps links to their text', () => {
    expect(plainTextFromMarkdown('see [the rules](https://example.com)')).toBe(
      'see the rules',
    )
  })

  test('keeps status references intact', () => {
    expect(plainTextFromMarkdown('inflicts [Poisoned] on save')).toBe(
      'inflicts [Poisoned] on save',
    )
  })

  test('strips inline code backticks', () => {
    expect(plainTextFromMarkdown('roll `1d6` twice')).toBe('roll 1d6 twice')
  })

  test('collapses whitespace and trims', () => {
    expect(plainTextFromMarkdown('  lots   of \n\n spaces\n')).toBe(
      'lots of spaces',
    )
  })

  test('leaves plain text unchanged', () => {
    expect(plainTextFromMarkdown('Evasion drops to 5.')).toBe(
      'Evasion drops to 5.',
    )
  })
})
