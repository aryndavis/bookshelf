/** Strip spaces and dashes; returns a valid ISBN-10/13 or null. */
export function normalizeIsbn(raw: string): string | null {
  const isbn = raw.replace(/[\s-]/g, '').toUpperCase()
  return /^\d{9}[\dX]$|^\d{13}$/.test(isbn) ? isbn : null
}

export interface IsbnResult {
  title: string
  author: string
  year: number | null
  pages: number | null
}

/** Look up a book on Open Library (openlibrary.org) by ISBN. Returns null if nothing is found. */
export async function lookupIsbn(isbn: string): Promise<IsbnResult | null> {
  const url = new URL('https://openlibrary.org/search.json')
  url.searchParams.set('isbn', isbn)
  url.searchParams.set('fields', 'title,author_name,first_publish_year,number_of_pages_median')
  url.searchParams.set('limit', '1')
  const response = await fetch(url, { headers: { Accept: 'application/json' }, referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error('Open Library didn’t answer. Try again in a moment.')
  const json = (await response.json()) as {
    docs?: { title?: unknown; author_name?: unknown; first_publish_year?: unknown; number_of_pages_median?: unknown }[]
  }
  const doc = json.docs?.[0]
  if (!doc || typeof doc.title !== 'string') return null
  return {
    title: doc.title.slice(0, 300),
    author: Array.isArray(doc.author_name) ? doc.author_name.filter((a) => typeof a === 'string').join(' & ').slice(0, 300) : '',
    year: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
    pages: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : null,
  }
}
