import { afterEach, describe, expect, it, vi } from 'vitest'
import { fillBlanks, genreFrom, hasBlanks, lookupBook, lookupDetails, lookupIsbn, normalizeIsbn, sameTitle } from './openLibrary'

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
    expect(await lookupIsbn('9780142410370')).toEqual({ title: 'Matilda', author: 'Roald Dahl & Quentin Blake', genre: '', year: 1988, pages: 240 })
  })

  it('returns null when nothing matches and ignores fields of the wrong type', async () => {
    respond({ docs: [] })
    expect(await lookupIsbn('9780142410370')).toBeNull()
    respond({ docs: [{ title: 'X', author_name: 'not a list', first_publish_year: '1988' }] })
    expect(await lookupIsbn('9780142410370')).toEqual({ title: 'X', author: '', genre: '', year: null, pages: null })
  })

  it('picks a genre from the subjects', async () => {
    respond({ docs: [{ title: 'Matilda', subject: ['juvenile fiction', 'Schools', 42, 'Fiction'] }] })
    expect((await lookupIsbn('9780142410370'))?.genre).toBe('Children’s')
  })

  it('reports a failed request', async () => {
    respond({}, false)
    await expect(lookupIsbn('9780142410370')).rejects.toThrow(/didn’t answer/)
  })
})

describe('lookupIsbn: network failures', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passes a dropped connection on so the form can show it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(lookupIsbn('9780142410370')).rejects.toThrow('Failed to fetch')
  })

  it('treats a response that is not the expected shape as "not found"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ unexpected: true }) })))
    expect(await lookupIsbn('9780142410370')).toBeNull()
  })
})

describe('genreFrom (subject lists as Open Library returns them)', () => {
  it.each([
    ['an explicit genre tag wins', ['form:novel', 'genre:fantasy', 'English literature', 'Fiction'], 'Fantasy'],
    ['the first specific subject, not plain "Fiction"', ['Fiction, general', 'Fiction, science fiction, general', 'Science fiction'], 'Science Fiction'],
    ['subjects are in order of relevance', ['Botany', 'Ecology', 'Philosophy', 'Biography'], 'Nature'],
    ['children’s books', ['juvenile fiction', 'Schools', 'Fiction', 'Humorous stories'], 'Children’s'],
    ['nonfiction about technology', ['Artificial intelligence', 'OpenAI', 'ChatGPT'], 'Technology'],
    ['plain fiction only when nothing else fits', ['Fiction', 'New York (N.Y.)'], 'Fiction'],
    ['nothing to go on', [], ''],
    // Subjects that only look like a genre
    ['time travel is not Travel', ['Fiction', 'Time travel', 'Science fiction'], 'Science Fiction'],
    ['political science is Politics', ['Political science', 'Democracy'], 'Politics'],
    ['social science is not Science', ['Social science', 'Ethnic studies', 'Physics'], 'Science'],
    ['human nature is not Nature', ['Human nature', 'Fiction'], 'Fiction'],
    ['Romance languages are not Romance', ['Romance languages', 'Grammar'], ''],
    ['time management is not Business', ['Time management', 'Self-help techniques'], 'Self-Help'],
    ['classical antiquity is not Classic', ['Classical antiquity', 'History'], 'History'],
    ['a curly apostrophe still counts', ['Children’s fiction'], 'Children’s'],
  ])('%s', (_case, subjects, genre) => {
    expect(genreFrom(subjects)).toBe(genre)
  })
})

describe('lookupBook by title', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respond = (body: unknown) => {
    const fetch = vi.fn(async (_url: URL) => ({ ok: true, json: async () => body }))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('searches by title and author when there is no ISBN', async () => {
    const fetch = respond({ docs: [{ title: 'Empire of AI', author_name: ['Karen Hao'], first_publish_year: 2025, number_of_pages_median: 496, subject: ['Artificial intelligence'] }] })
    expect(await lookupBook({ title: 'Empire of AI', author: 'Karen Hao' })).toMatchObject({ genre: 'Technology', year: 2025, pages: 496 })
    const url = fetch.mock.calls[0][0]
    expect([url.searchParams.get('title'), url.searchParams.get('author'), url.searchParams.get('isbn')]).toEqual(['Empire of AI', 'Karen Hao', null])
  })

  it('matches titles with or without accents, and titles in any alphabet', async () => {
    respond({ docs: [{ title: 'Les Misérables' }] })
    expect(await lookupBook({ title: 'Les Miserables', author: '' })).not.toBeNull()
    respond({ docs: [{ title: 'Война и мир' }] })
    expect(await lookupBook({ title: 'Война и мир', author: 'Лев Толстой' })).not.toBeNull()
  })

  it('drops a year or page count no typed value could have', async () => {
    respond({ docs: [{ title: 'Odd', first_publish_year: 30000, number_of_pages_median: 0 }] })
    expect(await lookupBook({ title: 'Odd', author: '' })).toMatchObject({ year: null, pages: null })
  })

  it('ignores an ISBN match for a different book (a mistyped ISBN) and searches by title instead', async () => {
    const fetch = vi.fn(async (url: URL) => ({ ok: true, json: async () => ({ docs: [url.searchParams.get('isbn') ? { title: 'Cookbook', pages: 90 } : { title: 'Kindred', number_of_pages_median: 287 }] }) }))
    vi.stubGlobal('fetch', fetch)
    expect(await lookupDetails({ isbn: '9780807083697', title: 'Kindred', author: '' })).toMatchObject({ title: 'Kindred', pages: 287 })
  })

  it('falls back to the title when Open Library does not know the ISBN', async () => {
    const fetch = vi.fn(async (url: URL) => ({ ok: true, json: async () => ({ docs: url.searchParams.get('isbn') ? [] : [{ title: 'Kindred', first_publish_year: 1979 }] }) }))
    vi.stubGlobal('fetch', fetch)
    expect(await lookupDetails({ isbn: '9780807083697', title: 'Kindred', author: 'Octavia E. Butler' })).toMatchObject({ year: 1979 })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('accepts a subtitle and different punctuation, but not a different book', async () => {
    respond({ docs: [{ title: 'The Hobbit: or, There and Back Again' }] })
    expect(await lookupBook({ title: 'the hobbit', author: '' })).not.toBeNull()
    respond({ docs: [{ title: 'Survivor Song' }] })
    expect(await lookupBook({ title: 'Survivor', author: 'Octavia E. Butler' })).toBeNull()
  })
})

describe('fillBlanks', () => {
  const found = { title: 'Matilda', author: 'Roald Dahl', genre: 'Children’s', year: 1988, pages: 240 }

  it('fills only what is blank, and never changes what was typed', () => {
    expect(fillBlanks({ genre: '', year: null, pages: null }, found)).toEqual({ genre: 'Children’s', year: 1988, pages: 240 })
    expect(fillBlanks({ genre: 'Classic', year: 1990, pages: null }, found)).toEqual({ genre: 'Classic', year: 1990, pages: 240 })
    expect(fillBlanks({ genre: '', year: null, pages: null }, null)).toEqual({ genre: '', year: null, pages: null })
  })

  it('knows when there is anything left to fill in', () => {
    expect(hasBlanks({ genre: 'Classic', year: 1990, pages: 200 })).toBe(false)
    expect(hasBlanks({ genre: 'Classic', year: 1990, pages: null })).toBe(true)
  })
})

describe('sameTitle', () => {
  it.each([
    ['The Hobbit', 'The Hobbit: or, There and Back Again', true],
    ['Les Miserables', 'Les Misérables', true],
    ['Survivor', 'Survivor Song', false],
    ['Sapiens: A Graphic History', 'Sapiens: A Brief History of Humankind', false],
    ['Sapiens: a brief history of humankind', 'Sapiens: A Brief History of Humankind', true],
    ['', '', false],
  ])('%s / %s', (a, b, same) => {
    expect(sameTitle(a, b)).toBe(same)
  })
})
