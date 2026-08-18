/**
 * Markdown → plain-text conversion for truncated previews.
 *
 * Card excerpts and tooltips clamp their text with `-webkit-line-clamp`,
 * which only works on single text blocks — rendering real block-level
 * Markdown there would break the clamping and leak `**` / `#` syntax into
 * the preview. This helper strips a Markdown string down to approximate
 * plain text so previews stay tidy; the full Markdown render is always one
 * click away in the detail modal.
 */

/**
 * Convert a Markdown string to approximate plain text.
 *
 * Strips the formatting users most commonly write in short descriptions —
 * emphasis, code, headings, links, images, list markers — and collapses
 * whitespace. Lossy by design: tables keep their pipes and raw HTML is
 * left as-is, matching what these previews showed before Markdown support.
 */
export function plainTextFromMarkdown(text: string): string {
  return (
    text
      // Images → alt text (keep something readable in the preview).
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Links → link text only. Plain `[StatusName]` refs are untouched.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // ATX heading markers.
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      // Bold + italic markers (***x*** / ___x___ covered by repeat passes).
      .replace(/(\*{1,3}|_{1,3})(?=\S)(.+?)(?<=\S)\1/g, '$2')
      // Inline code backticks.
      .replace(/`([^`]*)`/g, '$1')
      // Strikethrough.
      .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$2')
      // Blockquote markers.
      .replace(/^\s{0,3}>\s?/gm, '')
      // Horizontal rules → em dash separator.
      .replace(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/gm, '—')
      // List items keep their text, drop the marker.
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      // Fenced code blocks → keep inner text.
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*\n?/gi, ''))
      // Collapse all whitespace to single spaces.
      .replace(/\s+/g, ' ')
      .trim()
  )
}
