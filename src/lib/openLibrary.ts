/** Strip spaces and dashes; returns a valid ISBN-10/13 or null. */
export function normalizeIsbn(raw: string): string | null {
  const isbn = raw.replace(/[\s-]/g, '').toUpperCase()
  return /^\d{9}[\dX]$|^\d{13}$/.test(isbn) ? isbn : null
}

export interface LookupResult {
  title: string
  author: string
  /** One plain genre picked from Open Library's subjects, or '' if none fits. */
  genre: string
  year: number | null
  pages: number | null
}

// Plain genres and the subjects that point to them, most specific first. Open Library's subjects are a
// mix of library headings, bookstore categories and tags, so these match loosely.
const GENRES: [string, RegExp][] = [
  ['Graphic Novel', /graphic novel|comic/],
  ['Poetry', /poetry|poems/],
  ['Children’s', /juvenile|children's (fiction|stories|books|literature)/],
  ['Young Adult', /young adult/],
  ['Science Fiction', /science fiction|sci-fi/],
  ['Fantasy', /fantasy/],
  ['Horror', /horror/],
  ['Mystery', /mystery|detective/],
  ['Thriller', /thriller|suspense/],
  ['Romance', /romance|love stories/],
  ['Historical Fiction', /historical fiction|fiction, historical/],
  ['Memoir', /memoir|autobiograph/],
  ['Biography', /biograph/],
  ['Cooking', /cooking|cookery|recipes/],
  ['Wine', /\bwine/],
  ['Education', /education|teaching/],
  ['Self-Help', /self-help|self-actualization/],
  ['Nature', /nature|natural history|ecology|botany|plants/],
  ['Technology', /artificial intelligence|computer|technology/],
  ['Science', /\bscience\b|physics|biology|astronomy|chemistry/],
  ['Psychology', /psychology/],
  ['Philosophy', /philosophy/],
  ['Business', /business|economics|management/],
  ['Politics', /politic/],
  ['History', /\bhistory\b/],
  ['Art', /\bart\b|photography/],
  ['Travel', /travel/],
  ['Classic', /classic/],
]
const GENERAL: [string, RegExp][] = [
  ['Nonfiction', /nonfiction|non-fiction/],
  ['Fiction', /fiction|novel/],
]

const firstMatch = (subjects: string[], genres: [string, RegExp][]) => {
  for (const subject of subjects) {
    const found = genres.find(([, pattern]) => pattern.test(subject))
    if (found) return found[0]
  }
  return ''
}

/**
 * A plain genre from Open Library's subjects: an explicit "genre:" tag if there is one, else the first subject
 * (they're roughly in order of relevance) naming a specific genre, and only then plain fiction or nonfiction.
 */
export function genreFrom(subjects: string[]): string {
  const lower = subjects.map((s) => s.toLowerCase())
  const tagged = lower.filter((s) => s.startsWith('genre:')).map((s) => s.slice('genre:'.length))
  return firstMatch(tagged, GENRES) || firstMatch(lower, GENRES) || firstMatch(lower, GENERAL)
}

// The main title (before any subtitle) in letters and digits only, so "The Hobbit: or, There and Back Again"
// matches "the hobbit" but "Survivor Song" doesn't match "Survivor".
const mainTitle = (text: string) =>
  text.split(':')[0].toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Look up a book on Open Library (openlibrary.org) by ISBN, or else by title (and author, if known).
 * A title search only counts if the title really matches, so a near miss doesn't fill in the wrong book.
 * Returns null if nothing is found.
 */
export async function lookupBook(query: { isbn: string } | { title: string; author: string }, signal?: AbortSignal): Promise<LookupResult | null> {
  const url = new URL('https://openlibrary.org/search.json')
  if ('isbn' in query) url.searchParams.set('isbn', query.isbn)
  else {
    url.searchParams.set('title', query.title)
    if (query.author) url.searchParams.set('author', query.author)
  }
  url.searchParams.set('fields', 'title,author_name,first_publish_year,number_of_pages_median,subject')
  url.searchParams.set('limit', '1')
  const response = await fetch(url, { headers: { Accept: 'application/json' }, referrerPolicy: 'no-referrer', signal })
  if (!response.ok) throw new Error('Open Library didn’t answer. Try again in a moment.')
  const json = (await response.json()) as {
    docs?: { title?: unknown; author_name?: unknown; first_publish_year?: unknown; number_of_pages_median?: unknown; subject?: unknown }[]
  }
  const doc = json.docs?.[0]
  if (!doc || typeof doc.title !== 'string') return null
  if ('title' in query && (!mainTitle(query.title) || mainTitle(query.title) !== mainTitle(doc.title))) return null
  return {
    title: doc.title.slice(0, 300),
    author: Array.isArray(doc.author_name) ? doc.author_name.filter((a) => typeof a === 'string').join(' & ').slice(0, 300) : '',
    genre: genreFrom(Array.isArray(doc.subject) ? doc.subject.filter((s): s is string => typeof s === 'string') : []),
    year: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
    pages: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : null,
  }
}

/** Look up a book on Open Library by ISBN. Returns null if nothing is found. */
export const lookupIsbn = (isbn: string) => lookupBook({ isbn })

/** Fills in a book's blank genre, year and pages from a lookup, keeping anything already there. */
export function fillBlanks<T extends { genre: string; year: number | null; pages: number | null }>(book: T, found: LookupResult | null): T {
  if (!found) return book
  return { ...book, genre: book.genre || found.genre.slice(0, 80), year: book.year ?? found.year, pages: book.pages ?? found.pages }
}

/** True when a lookup could add something: a blank genre, year or pages, and an ISBN or title to search with. */
export const hasBlanks = (book: { genre: string; year: number | null; pages: number | null }) => !book.genre || book.year === null || book.pages === null

/** How to search for a book: by ISBN if it has one, else by title and author. */
export const lookupQuery = (book: { isbn: string | null; title: string; author: string }) => (book.isbn ? { isbn: book.isbn } : { title: book.title, author: book.author })
