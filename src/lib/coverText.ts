// Fitting a book's title and author onto its little pixel cover. Pure functions, so they're easy to test.

/**
 * About how wide text is, per unit of font size. VT323 (the author) is monospaced at 0.4. Pixelify Sans (the
 * title) is proportional, so wide and narrow letters are counted separately (measured in a browser).
 */
export const textWidth = {
  author: (text: string) => text.length * 0.4,
  title: (text: string) =>
    [...text].reduce((sum, ch) => sum + (/[MWmw]/.test(ch) ? 0.78 : /[A-Z]/.test(ch) ? 0.64 : /[iljtf.,'’:;!| ]/.test(ch) ? 0.32 : 0.54), 0),
}

// A line may be squeezed to this fraction of its natural width; past that it's cut with "…" instead.
const MAX_SQUEEZE = 0.75

export interface FittedLine {
  text: string
  /** Squeeze the line to the available width (SVG textLength), because it's a little too wide. */
  squeeze: boolean
}

/** Fits one line into `width`: as is, squeezed a little, or cut short with "…" so it stays readable. */
export function fitLine(text: string, size: number, width: number, measure: (text: string) => number): FittedLine {
  const natural = measure(text) * size
  if (natural <= width) return { text, squeeze: false }
  if (natural * MAX_SQUEEZE <= width) return { text, squeeze: true }
  let cut = text
  while (cut.length > 1 && measure(`${cut}…`) * size * MAX_SQUEEZE > width) cut = cut.slice(0, -1)
  return { text: `${cut.trimEnd()}…`, squeeze: true }
}

/**
 * The title as up to `maxLines` lines that fit `width`, without the subtitle (after a colon). Words wrap greedily;
 * if there's more than fits, the last line ends with "…". A single long word gets a line of its own.
 */
export function titleLines(title: string, size: number, width: number, maxLines = 3): FittedLine[] {
  const main = title.split(':')[0].trim() || title.trim()
  const lines: string[] = []
  for (const word of main.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1)
    if (last !== undefined && textWidth.title(`${last} ${word}`) * size <= width) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] += '…'
  }
  return lines.map((line) => fitLine(line, size, width, textWidth.title))
}

// Words that belong to the surname after them: Le Guin, de Beauvoir, van Gogh, St. Clair.
const PARTICLES = new Set(['le', 'la', 'de', 'des', 'du', 'del', 'della', 'di', 'da', 'van', 'von', 'der', 'den', 'ter', 'st', 'st.', 'bin', 'ibn', 'al', 'el'])

/** The first author's last name, for the cover: "Grant Wiggins & Jay McTighe" → "WIGGINS", "Ursula K. Le Guin" → "LE GUIN". */
export function coverAuthor(author: string): string {
  const first = author.split(/\s*(?:&|,|;|\band\b)\s*/)[0] ?? ''
  const names = first.split(/\s+/).filter((part) => part && !/^(jr|sr|ii|iii|iv|phd|md)\.?$/i.test(part))
  let start = names.length - 1
  while (start > 1 && PARTICLES.has(names[start - 1].toLowerCase())) start--
  return names.slice(Math.max(start, 0)).join(' ').toUpperCase()
}
