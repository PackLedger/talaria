/** Collapse markdown into a short plain-text preview (for cards, tooltips, etc.).
 *  Not a full parser — just strips the common syntax so previews read cleanly. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s{0,3}[-*+]\s+/gm, '') // bullet markers
    .replace(/^\s{0,3}\d+\.\s+/gm, '') // ordered-list markers
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1') // bold/italic/strike
    .replace(/[*_~`#>]/g, '') // stray tokens
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
}
