/**
 * rehypeInlineAnnotations — mark every text node that may hold an inline
 * annotation, wherever it sits in the rendered document.
 *
 * Sheet prose is authored as Markdown with raw HTML allowed for backward
 * compatibility (see `MarkdownText`). The two styles produce very differently
 * shaped trees, and a `[StatusName]` reference or a dice notation can land
 * anywhere in them:
 *
 *   - `inflicts [Diseased]` becomes a text node inside a Markdown paragraph;
 *   - a raw HTML block — `<span style="…">…</span>` on its own line with **no
 *     blank line** before the prose that follows — is parsed by `rehype-raw`
 *     into an element the Markdown pipeline never wraps, so the prose after it
 *     ends up as a *direct child of the root*, next to the `<span>`; text inside
 *     such an element (`<div>`, `<span>`, …) is unwrapped as well.
 *
 * Highlighting per tag (rendering `<p>`/`<li>`/`<em>` through a custom component
 * that scans its children) therefore only ever covered the part of a document
 * that Markdown happened to wrap — which is why `[Diseased]` stayed literal
 * after a raw HTML block. This plugin instead annotates text nodes themselves,
 * so the renderer can scan them uniformly.
 *
 * Only text that could actually contain an annotation is wrapped (a cheap
 * `[`…`]` / dice-shape pre-check), so plain prose keeps its default rendering.
 * Text inside raw-text elements is skipped: it is CSS/JS rather than prose, and
 * injecting markup into it would corrupt it.
 */

import { hasDiceCandidate } from '@/lib/diceParser'
import { hasStatusCandidate } from '@/lib/statusReference'

/**
 * Tag name of the element this plugin wraps annotatable text in. It is rendered
 * by the host component (see `MarkdownText`), never by the browser.
 */
export const INLINE_ANNOTATION_TAG = 'grimoire-inline'

/**
 * Elements whose children are raw text rather than prose — annotating them
 * would splice markup into CSS/JS.
 */
const RAW_TEXT_ELEMENTS = new Set([
  'iframe',
  'noembed',
  'noframes',
  'plaintext',
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
])

/**
 * Minimal structural view of the hast nodes this plugin touches.
 *
 * Declared locally rather than imported from `hast`/`@types/hast`, which reach
 * this project only as transitive dependencies of `react-markdown`: the walk
 * needs nothing beyond `type`, `tagName`, `properties` and `children`. Exported
 * so tests can build trees by hand.
 */
export interface HastNode {
  type: string
  tagName?: string
  value?: string
  /** Set on the wrapper elements this plugin builds — see {@link annotationWrapper}. */
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/** Whether a text value could hold a `[StatusName]` reference or dice notation. */
function isAnnotatable(value: string): boolean {
  return hasStatusCandidate(value) || hasDiceCandidate(value)
}

/** The wrapper element for `text`, carrying an empty `properties` bag. */
function annotationWrapper(text: HastNode): HastNode {
  // `properties` must exist: downstream consumers (`hast-util-to-jsx-runtime`
  // and react-markdown's own raw-node pass) read it without a guard.
  return {
    type: 'element',
    tagName: INLINE_ANNOTATION_TAG,
    properties: {},
    children: [text],
  }
}

/**
 * Wrap annotatable text children of `parent` in place, recursing into elements.
 *
 * Already-wrapped nodes are not descended into, so a tree that was annotated
 * once (or raw HTML that happens to use the marker tag) is never wrapped twice.
 */
function annotateChildren(parent: HastNode): void {
  const children = parent.children
  if (!children || children.length === 0) return

  parent.children = children.map((child) => {
    if (child.type === 'text') {
      return typeof child.value === 'string' && isAnnotatable(child.value)
        ? annotationWrapper(child)
        : child
    }

    if (
      child.type === 'element' &&
      child.tagName !== INLINE_ANNOTATION_TAG &&
      !(child.tagName && RAW_TEXT_ELEMENTS.has(child.tagName))
    ) {
      annotateChildren(child)
    }

    return child
  })
}

/**
 * Rehype plugin: wrap every annotatable text node in {@link INLINE_ANNOTATION_TAG}.
 *
 * Must run *after* `rehype-raw`, so raw HTML has already been parsed into
 * elements and its text is part of the tree this walks.
 */
export function rehypeInlineAnnotations() {
  return (tree: HastNode): void => {
    annotateChildren(tree)
  }
}
