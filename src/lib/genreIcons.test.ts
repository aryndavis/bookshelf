import { describe, expect, it } from 'vitest'
import { DEFAULT_ICON, GENRE_ICONS, iconFor } from './genreIcons'

describe('iconFor', () => {
  it.each([
    ['Fantasy', 'Fantasy'],
    ['fantasy', 'Fantasy'],
    ['Children’s', 'Children’s'],
    ["Children's", 'Children’s'],
    ['Kids', 'Children’s'],
    ['Sci-Fi', 'Science Fiction'],
    ['Historical Fiction', 'Historical Fiction'],
    ['Contemporary Fiction', 'Fiction'],
    ['Cookbook', 'Cooking'],
    ['Knitting', DEFAULT_ICON],
    ['', DEFAULT_ICON],
    [undefined, DEFAULT_ICON],
  ])('%s → %s', (genre, icon) => {
    expect(iconFor(genre)).toBe(icon)
  })

  it('has an icon for every genre Open Library details can fill in', async () => {
    const source = await import('./openLibrary?raw').then((m) => m.default as string)
    const filled = [...source.matchAll(/^ {2}\['([^']+)', \//gm)].map((m) => m[1])
    expect(filled.length).toBeGreaterThan(20)
    for (const genre of filled) expect(Object.keys(GENRE_ICONS), genre).toContain(genre)
  })

  it('draws every icon on the same 7 × 7 grid', () => {
    for (const [genre, rows] of Object.entries(GENRE_ICONS)) {
      expect(rows, genre).toHaveLength(7)
      for (const row of rows) expect(row, genre).toMatch(/^[.#]{7}$/)
    }
  })
})
