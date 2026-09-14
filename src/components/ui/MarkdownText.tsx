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
 * Inline annotations: when `mode` is 'view', status references (`[Diseased]`)
 * and dice notation (`1d6+POW`, `d20+3`) in the text are rendered as clickable
 * pills/buttons via the shared {@link StatusHighlighter} — so the same
 * click-to-roll experience offered in the AbilityBlock damage field extends to
 * every prose description field.
 *
 * That scan happens on the *tree*, not per Markdown tag: the
 * {@link rehypeInlineAnnotations} plugin wraps each annotatable text node in an
 * {@link INLINE_ANNOTATION_TAG} element, which this component renders through
 * the highlighter. Scanning only the tags Markdown produces (`p`, `li`, …) is
 * not enough, because raw HTML blocks leave their neighbouring prose as a bare
 * child of the root (see that plugin for the gory details) — which is exactly
 * how `[Diseased]` used to survive as literal text.
 */

import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import type { ReactNode } from 'react'
import type { Components, ExtraProps } from 'react-markdown'

import StatusHighlighter from '@/components/status/StatusHighlighter'
import {
  INLINE_ANNOTATION_TAG,
  rehypeInlineAnnotations,
} from '@/lib/rehypeInlineAnnotations'
import type { Character } from '@/types/character'
import type { RollSource } from '@/types/rollLog'
import type { SheetMode } from '@/pages/CharacterSheetPage'

export interface MarkdownTextProps {
  children: string
  className?: string
  /**
   * When 'view', status references and dice notation are highlighted as
   * clickable pills/buttons. When 'edit', the text renders plainly so the
   * author sees the raw source. Defaults to 'view' so existing call sites keep
   * behaviour unchanged.
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

/**
 * The text a marker element wraps.
 *
 * {@link rehypeInlineAnnotations} wraps exactly one text node per marker and
 * react-markdown hands that node over (`passNode`), so the node is the
 * authoritative source. The rendered children are only a fallback, for a marker
 * that arrives without its node.
 */
function annotatedText(props: ExtraProps & { children?: ReactNode }): string {
  const first = props.node?.children[0]
  if (first?.type === 'text') return first.value
  return typeof props.children === 'string' ? props.children : ''
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

  // In edit mode we render plain Markdown so the author sees the exact source
  // (no clickable pills/buttons). In view mode the annotation plugin marks every
  // text node that may hold a status reference or dice notation, and the marker
  // component renders it through the shared highlighter.
  const components: Components | undefined = isView
    ? ({
        [INLINE_ANNOTATION_TAG]: (props: ExtraProps & { children?: ReactNode }) => (
          <StatusHighlighter
            text={annotatedText(props)}
            mode={mode}
            character={character}
            source={source}
          />
        ),
      } as unknown as Components)
    : undefined

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={
          isView ? [rehypeRaw, rehypeInlineAnnotations] : [rehypeRaw]
        }
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
