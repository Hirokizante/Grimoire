/**
 * Unit tests for the inline-annotation tree transform.
 *
 * The walk is deliberately location-agnostic: a `[StatusName]` reference or a
 * dice notation is annotated wherever its text node sits — including as a bare
 * child of the document root, which is where a raw HTML block leaves the prose
 * that follows it (see the plugin's module docs).
 */

import { describe, expect, it } from 'vitest'

import {
  INLINE_ANNOTATION_TAG,
  rehypeInlineAnnotations,
} from '@/lib/rehypeInlineAnnotations'
import type { HastNode } from '@/lib/rehypeInlineAnnotations'

const annotate = (tree: HastNode): HastNode => {
  rehypeInlineAnnotations()(tree)
  return tree
}

const text = (value: string): HastNode => ({ type: 'text', value })
const element = (tagName: string, children: HastNode[] = []): HastNode => ({
  type: 'element',
  tagName,
  properties: {},
  children,
})
const marker = (value: string): HastNode => element(INLINE_ANNOTATION_TAG, [text(value)])

/** Root children of a tree built from `children`. */
const root = (...children: HastNode[]): HastNode => ({ type: 'root', children })

describe('rehypeInlineAnnotations', () => {
  it('wraps annotatable text wherever it sits', () => {
    const tree = annotate(
      root(
        text('inflicts [Diseased]'),
        element('div', [element('em', [text('roll 2d6'), text(' plain')])]),
      ),
    )

    expect(tree.children).toEqual([
      marker('inflicts [Diseased]'),
      element('div', [element('em', [marker('roll 2d6'), text(' plain')])]),
    ])
  })

  it('leaves prose without a status or dice candidate untouched', () => {
    const tree = annotate(root(element('p', [text('Targets must make a VIT save.')])))

    expect(tree.children).toEqual([
      element('p', [text('Targets must make a VIT save.')]),
    ])
  })

  it('does not annotate the raw text of style/script elements', () => {
    const tree = annotate(
      root(
        element('style', [text('.x[data-y] { color: 1d6red }')]),
        element('script', [text('const roll = "[Diseased]"')]),
      ),
    )

    expect(tree.children).toEqual([
      element('style', [text('.x[data-y] { color: 1d6red }')]),
      element('script', [text('const roll = "[Diseased]"')]),
    ])
  })

  it('never wraps an already-annotated node twice', () => {
    const tree = annotate(root(marker('[Diseased]')))

    expect(tree.children).toEqual([marker('[Diseased]')])
  })

  it('keeps every wrapper an element with a properties bag', () => {
    // react-markdown's own passes read `node.properties` without a guard.
    const tree = annotate(root(text('[Diseased]')))
    const wrapper = tree.children?.[0]

    expect(wrapper?.type).toBe('element')
    expect(wrapper?.properties).toEqual({})
  })
})
