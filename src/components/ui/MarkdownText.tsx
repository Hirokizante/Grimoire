/**
 * MarkdownText — renders a string of Markdown into styled HTML.
 *
 * Used by ability-block descriptions, overcharge, innate narrative,
 * physical description, and backstory fields throughout the sheet.
 *
 * Backward-compat: existing data stores HTML strings (previously rendered
 * via `dangerouslySetInnerHTML`). `rehype-raw` ensures that raw HTML embeds
 * continue to display correctly, while new entries can use clean Markdown.
 *
 * Dice notation: when `mode` is 'view', any dice notation inside the text
 * (e.g. `1d6+POW`, `d20+3`) is rendered as a clickable button via the shared
 * {@link DiceHighlighter}, so the same click-to-roll experience offered in the
 * AbilityBlock damage field extends to every prose description field.
 */

import { Fragment, cloneElement, createElement } from 'react'
import type { ReactNode, ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

import StatusHighlighter from '@/components/status/StatusHighlighter'
import { hasStatusCandidate } from '@/lib/statusReference'
import type { Character } from '@/types/character'
import type { RollSource } from '@/types/rollLog'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface MarkdownTextProps {
  children: string
  className?: string
  /**
   * When 'view', dice notation is highlighted as clickable buttons. When
   * 'edit', the text renders plainly. Defaults to 'view' so existing call
   * sites keep behaviour unchanged.
   */
  mode?: SheetMode
  /**
   * Explicit character whose stats are used for variable substitution when a
   * dice notation button is clicked. Falls back to the store's
   * `currentCharacter` when omitted (DiceHighlighter's default).
   */
  character?: Character
  /**
   * The roll source to record with dice rolls triggered from this text
   * (e.g. ability-damage for an ability's description field).
   */
  source?: RollSource
}

/** Cheap pre-check: does this string contain any dice-notation shape at all? */
function hasDiceCandidate(text: string): boolean {
  return /\d*d\s*\d+/i.test(text)
}

/**
 * Recursively map over markdown children, replacing any plain string child
 * that contains dice notation with a clickable {@link DiceHighlighter}.
 * Non-string nodes are returned unchanged, but their string children are still
 * scanned recursively so notation nested in links/emphasis is also clickable.
 */
function highlightChildren(
  children: ReactNode,
  mode: SheetMode,
  character?: Character,
  source?: RollSource,
): ReactNode {
  if (children == null) return null

  if (typeof children === 'string') {
    if (hasDiceCandidate(children) || hasStatusCandidate(children)) {
      return (
        <StatusHighlighter text={children} mode={mode} character={character} source={source} />
      )
    }
    return children
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <Fragment key={i}>{highlightChildren(child, mode, character, source)}</Fragment>
    ))
  }

  // A React element — recurse into its children, preserving the element itself.
  const element = children as ReactElement<{ children?: ReactNode }>
  if (element && element.props && element.props.children != null) {
    return cloneElement(
      element,
      { children: highlightChildren(element.props.children, mode, character, source) },
    )
  }

  return children
}

/**
 * Build a react-markdown `Components` override. Each registered tag renders its
 * own default element with its string children scanned for dice notation. We
 * preserve the element itself (so block tags keep their block layout) and only
 * replace string children that contain dice notation with clickable buttons.
 */
function buildDiceComponents(mode: SheetMode, character?: Character, source?: RollSource): Components {
  // Build a renderer that emits the real DOM element for `tag`, forwarding its
  // props (className, etc.) while highlighting any dice-notation text children.
  // `createElement` sidesteps JSX's generic LibraryManagedAttributes narrowing;
  // the components are typed as `any` so they satisfy react-markdown's
  // per-tag `ComponentType<...>` signature without losing element fidelity.
  const makeRenderer = (tag: string) => {
    const DiceText = (props: Record<string, unknown>) => {
      const { node: _node, children, ...rest } = props
      return createElement(
        tag,
        rest,
        highlightChildren(children as ReactNode, mode, character, source),
      )
    }
    return DiceText as unknown as (props: never) => ReactNode
  }

  return {
    p: makeRenderer('p'),
    li: makeRenderer('li'),
    td: makeRenderer('td'),
    th: makeRenderer('th'),
    blockquote: makeRenderer('blockquote'),
    em: makeRenderer('em'),
    strong: makeRenderer('strong'),
    h1: makeRenderer('h1'),
    h2: makeRenderer('h2'),
    h3: makeRenderer('h3'),
    h4: makeRenderer('h4'),
    h5: makeRenderer('h5'),
    h6: makeRenderer('h6'),
  } as unknown as Components
}

export default function MarkdownText({
  children,
  className,
  mode = 'view',
  character,
  source,
}: MarkdownTextProps) {
  const classes = ['md', className].filter(Boolean).join(' ')
  const isView = mode === 'view'

  // In edit mode we render plain Markdown (no clickable dice). In view mode we
  // augment the renderer so text nodes inside block containers become
  // clickable dice buttons.
  const components: Components | undefined = isView
    ? buildDiceComponents(mode, character, source)
    : undefined

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
