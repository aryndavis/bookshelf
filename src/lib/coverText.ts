// Fitting a book's title and author onto its little pixel cover. Pure functions, so they're easy to test.

/** About how wide a character is, per unit of font size (measured: Pixelify Sans varies, VT323 is monospaced). */
export const CHAR_WIDTH = { title: 0.58, author: 0.4 }

// A line may be squeezed to this fraction of its natural width; past that it's cut with "…" instead.
const MAX_SQUEEZE = 0.75

export interface FittedLine {
  text: string
  /** Squeeze the line to the available width (SVG textLength), because it's a little too wide. */
  squeeze: boolean
}

/** Fits one line into `width`: as is, squeezed a little, or cut short with "…" so it stays readable. */
export function fitLine(text: string, size: number, width: number, charWidth: number): FittedLine {
  const natural = text.length * size * charWidth
  if (natural <= width) return { text, squeeze: false }
  if (natural * MAX_SQUEEZE <= width) return { text, squeeze: true }
  const chars = Math.max(1, Math.floor(width / (size * charWidth * MAX_SQUEEZE)) - 1)
  return { text: `${text.slice(0, chars).trimEnd()}…`, squeeze: true }
}

/**
 * The title as up to `maxLines` lines that fit `width`, without the subtitle (after a colon). Words wrap greedily;
 * if there's more than fits, the last line ends with "…". A single long word gets a line of its own.
 */
export function titleLines(title: string, size: number, width: number, maxLines = 3): FittedLine[] {
  const main = title.split(':')[0].trim() || title.trim()
  const perLine = width / (size * CHAR_WIDTH.title)
  const lines: string[] = []
  for (const word of main.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1)
    if (last !== undefined && `${last} ${word}`.length <= perLine) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] += '…'
  }
  return lines.map((line) => fitLine(line, size, width, CHAR_WIDTH.title))
}

/** The first author's last name, for the cover: "Grant Wiggins & Jay McTighe" → "WIGGINS". */
export function coverAuthor(author: string): string {
  const first = author.split(/\s*(?:&|,|\band\b)\s*/)[0] ?? ''
  const names = first.split(/\s+/).filter((part) => part && !/^(jr|sr|ii|iii|iv|phd|md)\.?$/i.test(part))
  return (names.at(-1) ?? '').toUpperCase()
}
