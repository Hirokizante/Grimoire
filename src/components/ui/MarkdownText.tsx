/**
 * MarkdownText — renders a string of Markdown into styled HTML.
 *
 * Used by ability-block descriptions, overcharge, innate narrative,
 * physical description, and backstory fields throughout the sheet.
 *
 * Backward-compat: existing data stores HTML strings (previously rendered
 * via `dangerouslySetInnerHTML`). `rehype-raw` ensures that raw HTML embeds
 * continue to display correctly, while new entries can use clean Markdown.
 */

import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

export interface MarkdownTextProps {
  children: string
  className?: string
}

/** Inline-only render set — strips block-level containers for compact use. */
const inlineComponents: Components = {
  p: ({ children }) => <>{children}</>,
}

export default function MarkdownText({ children, className }: MarkdownTextProps) {
  const classes = ['md', className].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={className?.includes('inline') ? inlineComponents : undefined}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
