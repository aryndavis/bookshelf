import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupIsbn, normalizeIsbn } from './openLibrary'

describe('normalizeIsbn', () => {
  it('accepts ISBN-10 and ISBN-13 with spaces or dashes', () => {
    expect(normalizeIsbn('978-0-14-241037-0')).toBe('9780142410370')
    expect(normalizeIsbn(' 0 14 241037 x ')).toBe('014241037X')
  })

  it('rejects anything else', () => {
    expect(normalizeIsbn('12345')).toBeNull()
    expect(normalizeIsbn('97801424103701')).toBeNull()
    expect(normalizeIsbn('abc0142410370')).toBeNull()
  })
})

describe('lookupIsbn', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respond = (body: unknown, ok = true) =>
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })))

  it('maps the first result', async () => {
    respond({ docs: [{ title: 'Matilda', author_name: ['Roald Dahl', 'Quentin Blake'], first_publish_year: 1988, number_of_pages_median: 240 }] })
    expect(await lookupIsbn('9780142410370')).toEqual({ title: 'Matilda', author: 'Roald Dahl & Quentin Blake', year: 1988, pages: 240 })
  })

  it('returns null when nothing matches and ignores fields of the wrong type', async () => {
    respond({ docs: [] })
    expect(await lookupIsbn('9780142410370')).toBeNull()
    respond({ docs: [{ title: 'X', author_name: 'not a list', first_publish_year: '1988' }] })
    expect(await lookupIsbn('9780142410370')).toEqual({ title: 'X', author: '', year: null, pages: null })
  })

  it('reports a failed request', async () => {
    respond({}, false)
    await expect(lookupIsbn('9780142410370')).rejects.toThrow(/didn’t answer/)
  })
})
