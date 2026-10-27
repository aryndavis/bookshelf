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
// An optional third pattern rules a subject out ("political science" isn't Science). Kept as separate
// patterns, not a lookbehind, which Safari before 16.4 can't parse.
const GENRES: [string, RegExp, RegExp?][] = [
  ['Graphic Novel', /graphic novel|comic/],
  ['Poetry', /poetry|poems/],
  ['Children’s', /juvenile|children['’]s (fiction|stories|books|literature)/],
  ['Young Adult', /young adult/],
  ['Science Fiction', /science fiction|sci-fi/],
  ['Fantasy', /fantasy/],
  ['Horror', /horror/],
  ['Mystery', /mystery|detective/],
  ['Thriller', /thriller|suspense/],
  ['Romance', /romance(?! languages)|love stories/],
  ['Historical Fiction', /historical fiction|fiction, historical/],
  ['Memoir', /memoir|autobiograph/],
  ['Biography', /biograph/],
  ['Cooking', /cooking|cookery|recipes/],
  ['Wine', /\bwine/],
  ['Education', /education|teaching/],
  ['Self-Help', /self-help|self-actualization/],
  ['Nature', /^nature\b|natural history|ecology|botany|^plants\b/],
  ['Technology', /artificial intelligence|computer|technology/],
  ['Politics', /politic/],
  ['Science', /\bscience\b|physics|biology|astronomy|chemistry/, /(social|political) science/],
  ['Psychology', /psychology/],
  ['Philosophy', /philosophy/],
  ['Business', /business|economics|^management\b/],
  ['History', /\bhistory\b/],
  ['Art', /\bart\b|photography/],
  ['Travel', /^travel\b|travel writing|description and travel/],
  ['Classic', /\bclassics?\b/],
]
const GENERAL: [string, RegExp, RegExp?][] = [
  ['Nonfiction', /nonfiction|non-fiction/],
  ['Fiction', /fiction|novel/],
]

const firstMatch = (subjects: string[], genres: [string, RegExp, RegExp?][]) => {
  for (const subject of subjects) {
    const found = genres.find(([, pattern, not]) => pattern.test(subject) && !not?.test(subject))
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

// Letters and digits only, without accents: "Les Misérables!" → "les miserables".
const simplify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // accents: "Misérables" → "miserables"
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/**
 * Whether two titles name the same book. A subtitle on just one side is ignored ("The Hobbit" matches "The Hobbit:
 * or, There and Back Again"), but two different subtitles don't match, and "Survivor Song" isn't "Survivor".
 */
export function sameTitle(a: string, b: string) {
  const [mainA, ...restA] = a.split(':')
  const [mainB, ...restB] = b.split(':')
  if (!simplify(mainA) || simplify(mainA) !== simplify(mainB)) return false
  return restA.length === 0 || restB.length === 0 || simplify(restA.join(':')) === simplify(restB.join(':'))
}

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
  if ('title' in query && !sameTitle(query.title, doc.title)) return null
  return {
    title: doc.title.slice(0, 300),
    author: Array.isArray(doc.author_name) ? doc.author_name.filter((a) => typeof a === 'string').join(' & ').slice(0, 300) : '',
    genre: genreFrom(Array.isArray(doc.subject) ? doc.subject.filter((s): s is string => typeof s === 'string') : []).slice(0, 80),
    // The same ranges a typed year or page count must fit (and the database checks), so a junk value is dropped, not saved.
    year: wholeNumberIn(doc.first_publish_year, 0, 3000),
    pages: wholeNumberIn(doc.number_of_pages_median, 1, 100000),
  }
}

const wholeNumberIn = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null

/** Look up a book on Open Library by ISBN. Returns null if nothing is found. */
export const lookupIsbn = (isbn: string) => lookupBook({ isbn })

/** Fills in a book's blank genre, year and pages from a lookup, keeping anything already there. */
export function fillBlanks<T extends { genre: string; year: number | null; pages: number | null }>(book: T, found: LookupResult | null): T {
  if (!found) return book
  return { ...book, genre: book.genre || found.genre, year: book.year ?? found.year, pages: book.pages ?? found.pages }
}

/** True when a lookup could add something: a blank genre, year or pages, and an ISBN or title to search with. */
export const hasBlanks = (book: { genre: string; year: number | null; pages: number | null }) => !book.genre || book.year === null || book.pages === null

/**
 * Looks a book up by its ISBN, and by title and author if there's no ISBN or Open Library doesn't know it.
 * An ISBN match must have the same title too, so a mistyped ISBN can't fill in some other book's details.
 */
export async function lookupDetails(book: { isbn: string | null; title: string; author: string }, signal?: AbortSignal) {
  const byIsbn = book.isbn ? await lookupBook({ isbn: book.isbn }, signal) : null
  return byIsbn && sameTitle(book.title, byIsbn.title) ? byIsbn : lookupBook({ title: book.title, author: book.author }, signal)
}
