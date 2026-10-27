import { describe, expect, it } from 'vitest'
import { coverAuthor, fitLine, textWidth, titleLines } from './coverText'

const text = (lines: { text: string }[]) => lines.map((l) => l.text)

describe('titleLines', () => {
  it('keeps short titles whole and wraps longer ones by word', () => {
    expect(text(titleLines('Matilda', 3.3, 21))).toEqual(['Matilda'])
    expect(text(titleLines('Braiding Sweetgrass', 3.3, 21))).toEqual(['Braiding', 'Sweetgrass'])
  })

  it('drops the subtitle', () => {
    expect(text(titleLines('Sapiens: A Brief History of Humankind', 3.3, 21))).toEqual(['Sapiens'])
  })

  it('stops at three lines and ends the last with "…"', () => {
    const lines = titleLines('Everything Is Illuminated by the Light of the Past', 2.9, 21)
    expect(lines).toHaveLength(3)
    expect(lines[2].text.endsWith('…')).toBe(true)
  })

  it('squeezes a line that is a little too wide', () => {
    expect(titleLines('Understanding by Design', 3.3, 21)[0]).toEqual({ text: 'Understanding', squeeze: true })
  })

  it('counts wide letters as wide, so a short line of them is squeezed or cut, not left to overflow', () => {
    expect(textWidth.title('WWWW')).toBeGreaterThan(textWidth.title('iiii') * 2)
    const [line] = titleLines('WWWWWWWWWW', 3.3, 21)
    expect(line.squeeze).toBe(true)
  })

  it('cuts a single huge word short instead of squeezing it unreadable', () => {
    const [line] = titleLines('Supercalifragilisticexpialidocious', 2.9, 21)
    expect(line.text).toMatch(/^Supercali.*…$/)
    // Short enough that the gentlest allowed squeeze fits it on the cover
    expect(textWidth.title(line.text) * 2.9 * 0.75).toBeLessThanOrEqual(21)
  })
})

describe('fitLine', () => {
  it('never needs more than a gentle squeeze', () => {
    for (const word of ['A', 'Understanding', 'WOLFESCHLEGELSTEINHAUSENBERGERDORFF']) {
      const { text: fitted } = fitLine(word, 2.8, 21, textWidth.author)
      expect(textWidth.author(fitted) * 2.8 * 0.75).toBeLessThanOrEqual(21)
    }
  })
})

describe('coverAuthor', () => {
  it.each([
    ['Roald Dahl', 'DAHL'],
    ['Grant Wiggins & Jay McTighe', 'WIGGINS'],
    ['Octavia E. Butler', 'BUTLER'],
    ['Martin Luther King Jr.', 'KING'],
    ['bell hooks', 'HOOKS'],
    ['Madonna', 'MADONNA'],
    ['Ursula K. Le Guin', 'LE GUIN'],
    ['Simone de Beauvoir', 'DE BEAUVOIR'],
    ['Vincent van Gogh', 'VAN GOGH'],
    ['Grant Wiggins; Jay McTighe', 'WIGGINS'],
    ['', ''],
  ])('%s → %s', (author, name) => {
    expect(coverAuthor(author)).toBe(name)
  })
})
