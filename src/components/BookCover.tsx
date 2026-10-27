import { useId, type ReactElement } from 'react'
import { coverAuthor, fitLine, textWidth, titleLines, type FittedLine } from '../lib/coverText'
import { GENRE_ICONS, iconFor } from '../lib/genreIcons'
import type { CoverColor, CoverPattern } from '../lib/types'

// [cover color, accent color for the pattern and trim]
export const PALETTE: Record<CoverColor, [string, string]> = {
  pink: ['#ff9fd2', '#e05a9f'],
  peach: ['#ffc29e', '#e8845a'],
  yellow: ['#ffd96b', '#d99a1e'],
  mint: ['#9fe8cf', '#3fae8a'],
  sky: ['#9cc3ff', '#4f7fd6'],
  lilac: ['#d2b6ff', '#8f66d6'],
  wine: ['#9b2550', '#f08ab0'],
  navy: ['#2e3f7a', '#93a9ff'],
  forest: ['#2f6b4f', '#a6e6bb'],
  cream: ['#fff4dc', '#d9b77a'],
}

const INK = '#3b2346'
const PAPER = '#fffaf0'

// Pixel tiles for each pattern: [tile width, tile height, ...[x, y] pixels]
const TILES: Record<Exclude<CoverPattern, 'plain'>, [number, number, [number, number][]]> = {
  stripes: [4, 4, [[0, 3], [1, 2], [2, 1], [3, 0]]],
  dots: [4, 4, [[1, 1]]],
  checks: [4, 4, [[0, 0], [1, 0], [0, 1], [1, 1]]],
  stars: [7, 7, [[3, 1], [2, 2], [3, 2], [4, 2], [3, 3]]],
  hearts: [8, 7, [[1, 1], [2, 1], [4, 1], [5, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [3, 3], [4, 3], [3, 4]]],
  waves: [6, 4, [[0, 1], [1, 0], [2, 0], [3, 1], [4, 2], [5, 2]]],
}

// Text on the darker covers is light; on the rest it's ink. Icons use the accent, darkened where it's too pale.
const DARK_COVERS = new Set<CoverColor>(['wine', 'navy', 'forest'])
const ICON_COLOR: Partial<Record<CoverColor, string>> = { yellow: '#b07a0a', cream: '#a8844a' }

// Where things go on the 32 × 42 cover.
const TEXT_WIDTH = 21
const CENTER = 16.5

interface BookCoverProps {
  title: string
  /** Its last name goes on the trim at the bottom. */
  author?: string
  /** Picks the icon on the label (see src/lib/genreIcons.ts). */
  genre?: string
  color: CoverColor
  pattern: CoverPattern
  /** Width in CSS pixels; height follows the book's shape. Small covers show just the icon. */
  size?: number
  className?: string
}

/** A line of cover text, squeezed to fit when fitLine says so. */
function Line({ line, y, size, font, weight, fill }: { line: FittedLine; y: number; size: number; font: string; weight?: number; fill: string }) {
  return (
    <text
      x={CENTER}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontFamily={font}
      fontWeight={weight}
      fill={fill}
      {...(line.squeeze ? { textLength: TEXT_WIDTH, lengthAdjust: 'spacingAndGlyphs' } : {})}
    >
      {line.text}
    </text>
  )
}

/** A cute pixel-art book with a genre icon, its title and its author, drawn as SVG so it stays crisp at any size. */
export default function BookCover({ title, author = '', genre, color, pattern, size = 120, className = '' }: BookCoverProps) {
  const patternId = useId()
  const [main, accent] = PALETTE[color]
  const text = DARK_COVERS.has(color) ? PAPER : INK
  const iconColor = ICON_COLOR[color] ?? accent
  const icon = GENRE_ICONS[iconFor(genre)]
  // Below this, words would be too small to read, so the cover shows just its icon.
  const withText = size >= 64

  // Two lines of title at the larger size if they fit, else up to three smaller ones.
  const large = withText ? titleLines(title, 3.3, TEXT_WIDTH, Infinity) : []
  const titleSize = large.length <= 2 ? 3.3 : 2.9
  const lines = large.length <= 2 ? large : titleLines(title, titleSize, TEXT_WIDTH)
  const name = withText ? fitLine(coverAuthor(author), 2.8, TEXT_WIDTH, textWidth.author) : null

  let tile: ReactElement | null = null
  if (pattern !== 'plain') {
    const [w, h, pixels] = TILES[pattern]
    tile = (
      <pattern id={patternId} width={w} height={h} patternUnits="userSpaceOnUse" x="5" y="1">
        {pixels.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={accent} />
        ))}
      </pattern>
    )
  }

  return (
    <svg className={`book-cover ${className}`} viewBox="0 0 32 42" width={size} height={(size * 42) / 32} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {tile && <defs>{tile}</defs>}
      {/* Pages peeking out behind the cover */}
      <rect x="3" y="2" width="29" height="40" fill={INK} />
      <rect x="4" y="3" width="27" height="38" fill={PAPER} />
      {Array.from({ length: 11 }, (_, i) => (
        <rect key={i} x="29" y={5 + i * 3} width="1" height="1" fill="#e2d2b4" />
      ))}
      {/* Front cover */}
      <rect x="0" y="0" width="29" height="40" fill={INK} />
      <rect x="1" y="1" width="27" height="38" fill={main} />
      {tile && <rect x="5" y="1" width="23" height="38" fill={`url(#${patternId})`} opacity="0.55" />}
      {/* A plain band behind the title, so the pattern doesn't make it hard to read */}
      {lines.length > 0 && <rect x="5" y="19.5" width="23" height={lines.length * (titleSize + 0.9) + 2} fill={main} />}
      {/* Spine shading and highlight */}
      <rect x="1" y="1" width="3" height="38" fill="#000" opacity="0.2" />
      <rect x="4" y="1" width="1" height="38" fill="#fff" opacity="0.3" />
      {/* The label, with the genre's icon */}
      <rect x="9" y="5.5" width="15" height="12.5" fill={INK} />
      <rect x="10" y="6.5" width="13" height="10.5" fill={PAPER} />
      {icon.flatMap((row, y) =>
        [...row].map((pixel, x) => (pixel === '#' ? <rect key={`${x}-${y}`} x={12 + x * 1.3} y={7.2 + y * 1.3} width="1.3" height="1.3" fill={iconColor} /> : null)),
      )}
      {lines.map((line, i) => (
        <Line key={i} line={line} y={22 + i * (titleSize + 0.9)} size={titleSize} font="'Pixelify Sans', monospace" weight={600} fill={text} />
      ))}
      {/* Trim band, with the author's last name under it */}
      <rect x="5" y="33" width="23" height="1.5" fill={accent} />
      {name?.text && <Line line={name} y={37.6} size={2.8} font="'VT323', monospace" fill={text} />}
    </svg>
  )
}
