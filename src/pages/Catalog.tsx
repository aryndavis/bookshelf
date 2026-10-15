import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
const readFilter = (params: URLSearchParams): Filter => {
  const value = params.get('show')
  return value && Object.hasOwn(FILTERS, value) ? (value as Filter) : 'all'
}
const readSort = (params: URLSearchParams): Sort => {
  const value = params.get('sort')
  return value && Object.hasOwn(SORTS, value) ? (value as Sort) : 'recent'
}

export default function Catalog() {
  const { books, activeLoans } = useLibrary()
  // The page's own state is the source of truth; the URL mirrors it so a search survives
  // going back from a book. (React Router's setter can't stack two quick updates.)
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [filter, setFilter] = useState<Filter>(() => readFilter(params))
  const [sort, setSort] = useState<Sort>(() => readSort(params))

  // A link elsewhere (like the header's Catalog link) can change the URL without remounting this page:
  // adopt that URL. Our own mirror writes are marked so they're skipped.
  useEffect(() => {
    if ((location.state as { fromCatalog?: boolean } | null)?.fromCatalog) return
    setQuery(params.get('q') ?? '')
    setFilter(readFilter(params))
    setSort(readSort(params))
  }, [location.key])

  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (filter !== 'all') next.set('show', filter)
    if (sort !== 'recent') next.set('sort', sort)
    if (next.toString() !== window.location.search.replace(/^\?/, '')) setParams(next, { replace: true, state: { fromCatalog: true } })
  }, [query, filter, sort, setParams])

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
            <strong>{activeLoans.size}</strong> on loan{borrowers > 0 && ` to ${borrowers} ${borrowers === 1 ? 'person' : 'people'}`}
          </li>
          <li className={overdueCount ? 'alert' : ''}>
            <strong>{overdueCount}</strong> overdue
          </li>
        </ul>
      </section>

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
            <li>
              <Link to="/add" className="arrival add-slot">
                <span aria-hidden="true">+</span>
                Add a book you just bought
              </Link>
            </li>
          </ul>
        </div>
        <div className="shelf-plank" aria-hidden="true" />
      </section>

      <section className="catalog" aria-labelledby="all-books-title">
        <div className="catalog-head">
          <h2 id="all-books-title">All books</h2>
          <div className="controls">
            <label className="search">
              <span className="sr-only">Search the catalog</span>
              <input type="search" placeholder="Search title, author, genre, borrower…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
            <p>Your shelves are empty. Add the first book!</p>
            <Link to="/add" className="pixel-button">
              + Add a book
            </Link>
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
