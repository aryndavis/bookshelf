import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigationType, useSearchParams } from 'react-router-dom'
import BookCard from '../components/BookCard'
import BookCover from '../components/BookCover'
import { config } from '../config'
import { addDays, plural, today } from '../lib/dates'
import { isOverdue } from '../lib/loans'
import type { Book } from '../lib/types'
import { useLibrary } from '../state/LibraryContext'

const FILTERS = { all: 'All books', shelf: 'On the shelf', out: 'Checked out', overdue: 'Overdue' } as const
type Filter = keyof typeof FILTERS

const SORTS = { recent: 'Recently added', title: 'Title A–Z', author: 'Author A–Z' } as const
type Sort = keyof typeof SORTS

const byText = (key: 'title' | 'author') => (a: Book, b: Book) => a[key].localeCompare(b[key], undefined, { sensitivity: 'base' })

// Object.hasOwn, not `in`: `'toString' in FILTERS` is true.
const readOption = <T extends string>(params: URLSearchParams, name: string, options: Record<T, string>, fallback: T): T => {
  const value = params.get(name)
  return value !== null && Object.hasOwn(options, value) ? (value as T) : fallback
}
const readFilter = (params: URLSearchParams) => readOption<Filter>(params, 'show', FILTERS, 'all')
const readSort = (params: URLSearchParams) => readOption<Sort>(params, 'sort', SORTS, 'recent')

export default function Catalog() {
  const { books, activeLoans, canEdit } = useLibrary()
  // The page's own state is the source of truth; the URL mirrors it so a search survives
  // going back from a book. (React Router's setter can't stack two quick updates.)
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [filter, setFilter] = useState<Filter>(() => readFilter(params))
  const [sort, setSort] = useState<Sort>(() => readSort(params))

  // A link elsewhere (like the header's Catalog link) or Back/Forward can change the URL without remounting
  // this page: adopt that URL. Our own mirror writes are marked so they're skipped, but the mark stays in
  // history, so Back/Forward (POP) onto one of those entries must still be adopted.
  useEffect(() => {
    if (navigationType !== 'POP' && (location.state as { fromCatalog?: boolean } | null)?.fromCatalog) return
    setQuery(params.get('q') ?? '')
    setFilter(readFilter(params))
    setSort(readSort(params))
  }, [location.key])

  // Mirror only when the page's own state changes. (setParams changes with every URL change; reacting to it
  // would write the old state back over a URL that's about to be adopted.)
  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (filter !== 'all') next.set('show', filter)
    if (sort !== 'recent') next.set('sort', sort)
    if (next.toString() !== window.location.search.replace(/^\?/, '')) setParams(next, { replace: true, state: { fromCatalog: true } })
  }, [query, filter, sort])

  const overdueCount = [...activeLoans.values()].filter(isOverdue).length
  const borrowers = new Set([...activeLoans.values()].map((l) => l.borrower.trim().toLowerCase())).size
  const since = addDays(today(), -config.newArrivalDays)
  const arrivals = books
    .filter((b) => b.acquiredOn >= since)
    .sort((a, b) => b.acquiredOn.localeCompare(a.acquiredOn) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  const needle = query.trim().toLowerCase()
  const shown = books
    .filter((b) => {
      const loan = activeLoans.get(b.id)
      if (filter === 'shelf' && loan) return false
      if (filter === 'out' && !loan) return false
      if (filter === 'overdue' && !(loan && isOverdue(loan))) return false
      if (!needle) return true
      return [b.title, b.author, b.genre, b.isbn ?? '', loan?.borrower ?? ''].some((field) => field.toLowerCase().includes(needle))
    })
    .sort(sort === 'title' ? byText('title') : sort === 'author' ? byText('author') : (a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <>
      <section className="hero" aria-labelledby="catalog-title">
        <h1 id="catalog-title">Card catalog</h1>
        <ul className="stats" aria-label="Library at a glance">
          <li>
            <strong>{books.length}</strong> {books.length === 1 ? 'book' : 'books'}
          </li>
          <li>
            <strong>{books.length - activeLoans.size}</strong> on the shelf
          </li>
          <li>
            <strong>{activeLoans.size}</strong> on loan{canEdit && borrowers > 0 && ` to ${borrowers} ${borrowers === 1 ? 'person' : 'people'}`}
          </li>
          <li className={overdueCount ? 'alert' : ''}>
            <strong>{overdueCount}</strong> overdue
          </li>
        </ul>
      </section>

      {(canEdit || arrivals.length > 0) && (
        <section className="arrivals" aria-labelledby="arrivals-title">
          <h2 id="arrivals-title">
            <span aria-hidden="true">✦ </span>New arrivals
          </h2>
          <div className="shelf-scroll">
            <ul className="arrivals-row">
              {arrivals.map((book) => (
                <li key={book.id}>
                  <Link to={`/book/${book.id}`} className="arrival">
                    <BookCover title={book.title} color={book.coverColor} pattern={book.coverPattern} size={84} />
                    <span className="sr-only">{book.title}</span>
                    <span className="new-tag" aria-hidden="true">
                      new!
                    </span>
                  </Link>
                </li>
              ))}
              {canEdit && (
                <li>
                  <Link to="/add" className="arrival add-slot">
                    <span aria-hidden="true">+</span>
                    Add a book you just bought
                  </Link>
                </li>
              )}
            </ul>
          </div>
          <div className="shelf-plank" aria-hidden="true" />
        </section>
      )}

      <section className="catalog" aria-labelledby="all-books-title">
        <div className="catalog-head">
          <h2 id="all-books-title">All books</h2>
          <div className="controls">
            <label className="search">
              <span className="sr-only">Search the catalog</span>
              <input
                type="search"
                placeholder={canEdit ? 'Search title, author, genre, borrower…' : 'Search title, author, genre…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="sort">
              <span>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="filters" role="group" aria-label="Show">
          {(Object.keys(FILTERS) as Filter[]).map((key) => (
            <button key={key} type="button" className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {FILTERS[key]}
            </button>
          ))}
        </div>

        <p className="result-count" aria-live="polite">
          {shown.length === books.length ? plural(books.length, 'book') : `${shown.length} of ${plural(books.length, 'book')}`}
        </p>

        {books.length === 0 ? (
          <div className="empty">
            <BookCover title="?" color="cream" pattern="stars" size={90} />
            {canEdit ? (
              <>
                <p>Your shelves are empty. Add the first book!</p>
                <Link to="/add" className="pixel-button">
                  + Add a book
                </Link>
              </>
            ) : (
              <p>The shelves are empty for now. Check back soon!</p>
            )}
          </div>
        ) : shown.length === 0 ? (
          <p className="empty">No books match. Try a different search or filter.</p>
        ) : (
          <ul className="book-grid">
            {shown.map((book) => (
              <BookCard key={book.id} book={book} loan={activeLoans.get(book.id)} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
