import { useId, type ReactElement } from 'react'
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

interface BookCoverProps {
  title: string
  color: CoverColor
  pattern: CoverPattern
  /** Width in CSS pixels; height follows the book's shape. */
  size?: number
  className?: string
}

/** A cute pixel-art book, drawn as SVG so it stays crisp at any size. */
export default function BookCover({ title, color, pattern, size = 120, className = '' }: BookCoverProps) {
  const patternId = useId()
  const [main, accent] = PALETTE[color]
  const letter = (title.trim()[0] ?? '?').toUpperCase()

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
      {/* Spine shading and highlight */}
      <rect x="1" y="1" width="3" height="38" fill="#000" opacity="0.2" />
      <rect x="4" y="1" width="1" height="38" fill="#fff" opacity="0.3" />
      {/* Title label */}
      <rect x="8" y="7" width="17" height="12" fill={INK} />
      <rect x="9" y="8" width="15" height="10" fill={PAPER} />
      <rect x="10" y="17" width="13" height="1" fill={accent} />
      <text x="16.5" y="15.6" textAnchor="middle" fontSize="8" fontFamily="'Pixelify Sans', monospace" fontWeight="600" fill={INK}>
        {letter}
      </text>
      {/* Trim band */}
      <rect x="5" y="32" width="23" height="2" fill={accent} />
      <rect x="5" y="35" width="23" height="1" fill={accent} opacity="0.6" />
    </svg>
  )
}
