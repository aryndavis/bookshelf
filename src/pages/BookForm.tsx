import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BookCover, { PALETTE } from '../components/BookCover'
import NotInCatalog from '../components/NotInCatalog'
import Panel from '../components/Panel'
import { today } from '../lib/dates'
import { fillBlanks, hasBlanks, lookupBook, lookupIsbn, lookupQuery, normalizeIsbn } from '../lib/openLibrary'
import { READING_LABELS } from '../lib/reading'
import { COVER_COLORS, COVER_PATTERNS, READING_STATUSES, type Book, type BookInput, type CoverColor, type CoverPattern, type ReadingStatus } from '../lib/types'
import { useLibrary } from '../state/LibraryContext'

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

const blank = (): BookInput => ({
  title: '',
  author: '',
  isbn: null,
  genre: '',
  year: null,
  pages: null,
  coverColor: pick(COVER_COLORS),
  coverPattern: pick(COVER_PATTERNS),
  readingStatus: 'to-read',
  notes: '',
  acquiredOn: today(),
})

// Form fields are strings while editing; they become numbers/nulls on save.
type Draft = Omit<BookInput, 'isbn' | 'year' | 'pages'> & { isbn: string; year: string; pages: string }

const toDraft = (b: BookInput): Draft => ({
  title: b.title,
  author: b.author,
  genre: b.genre,
  coverColor: b.coverColor,
  coverPattern: b.coverPattern,
  readingStatus: b.readingStatus,
  notes: b.notes,
  acquiredOn: b.acquiredOn,
  isbn: b.isbn ?? '',
  year: b.year?.toString() ?? '',
  pages: b.pages?.toString() ?? '',
})

function parseDraft(d: Draft): BookInput | string {
  if (!d.title.trim()) return 'Every book needs a title.'
  const isbn = d.isbn.trim() ? normalizeIsbn(d.isbn) : null
  if (d.isbn.trim() && !isbn) return 'That ISBN doesn’t look right. It should be 10 or 13 digits.'
  const year = d.year.trim() ? Number(d.year) : null
  if (year !== null && !(Number.isInteger(year) && year >= 0 && year <= 3000)) return 'Year should be a number like 1998.'
  const pages = d.pages.trim() ? Number(d.pages) : null
  if (pages !== null && !(Number.isInteger(pages) && pages > 0 && pages <= 100000)) return 'Pages should be a whole number.'
  // The form is noValidate, so the date input's max isn't enforced by the browser.
  if (!d.acquiredOn) return 'When did it join the library?'
  if (d.acquiredOn > today()) return 'The date it joined the library can’t be in the future.'
  return { ...d, title: d.title.trim(), author: d.author.trim(), genre: d.genre.trim(), notes: d.notes.trim(), isbn, year, pages }
}

/** Fills in a blank genre, year or pages from Open Library. Saving never waits long or fails because of it. */
async function withDetails(input: BookInput): Promise<BookInput> {
  if (!hasBlanks(input)) return input
  try {
    return fillBlanks(input, await lookupBook(lookupQuery(input), AbortSignal.timeout(5000)))
  } catch {
    return input
  }
}

function BookFormInner({ existing }: { existing?: Book }) {
  const { books, addBook, updateBook } = useLibrary()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => toDraft(existing ?? blank()))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lookup, setLookup] = useState<{ state: 'idle' | 'busy' | 'done'; message: string }>({ state: 'idle', message: '' })
  const [added, setAdded] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  // Bumped when a lookup starts or is abandoned, so a stale answer can't overwrite newer input.
  const lookupRun = useRef(0)
  const genres = [...new Set(books.map((b) => b.genre).filter(Boolean))].sort()

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const cancelLookup = () => {
    lookupRun.current++
    setLookup({ state: 'idle', message: '' })
  }

  const runLookup = async () => {
    const isbn = normalizeIsbn(draft.isbn)
    if (!isbn) return setLookup({ state: 'done', message: 'Enter a 10 or 13 digit ISBN first.' })
    const run = ++lookupRun.current
    const started = draft
    setLookup({ state: 'busy', message: 'Looking it up…' })
    try {
      const found = await lookupIsbn(isbn)
      if (run !== lookupRun.current) return
      if (!found) return setLookup({ state: 'done', message: 'No match on Open Library. Fill it in by hand.' })
      setDraft((d) => {
        // Fill in what was found, but keep anything typed while the lookup was running.
        const fill = (key: 'title' | 'author' | 'genre' | 'year' | 'pages', value: string | undefined) => (value && d[key] === started[key] ? value : d[key])
        return {
          ...d,
          isbn,
          title: fill('title', found.title),
          author: fill('author', found.author),
          genre: fill('genre', found.genre.slice(0, 80)),
          year: fill('year', found.year?.toString()),
          pages: fill('pages', found.pages?.toString()),
        }
      })
      setLookup({ state: 'done', message: `Found “${found.title}”. Check the details below.` })
    } catch (e) {
      if (run !== lookupRun.current) return
      setLookup({ state: 'done', message: (e as Error).message })
    }
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const another = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'another'
    const parsed = parseDraft(draft)
    if (typeof parsed === 'string') return setError(parsed)
    setBusy(true)
    setError(null)
    try {
      const input = await withDetails(parsed)
      if (existing) {
        await updateBook(existing.id, input)
        navigate(`/book/${existing.id}`)
      } else {
        const book = await addBook(input)
        if (another) {
          setAdded(book.title)
          setDraft(toDraft({ ...blank(), acquiredOn: input.acquiredOn }))
          cancelLookup()
          setBusy(false)
          titleRef.current?.focus()
        } else {
          navigate(`/book/${book.id}`, { state: { added: true } })
        }
      }
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="form-page">
      <p className="breadcrumb">
        <Link to={existing ? `/book/${existing.id}` : '/'}>← {existing ? 'Back to the book' : 'Catalog'}</Link>
      </p>
      <h1>{existing ? 'Edit book' : 'Add a new book'}</h1>
      {added && (
        <p className="added-note" role="status">
          ✦ “{added}” is on the shelf. Next one!
        </p>
      )}

      <div className="form-layout">
        <form className="book-form" onSubmit={save} noValidate>
          <Panel title="1_find_it.exe" tone="sky">
            <label>
              <span>
                ISBN <small>(optional, fills in the rest for you)</small>
              </span>
              <span className="inline-field">
                <input
                  value={draft.isbn}
                  inputMode="numeric"
                  maxLength={17}
                  onChange={(e) => {
                    set('isbn', e.target.value)
                    if (lookup.state === 'busy') cancelLookup()
                  }}
                  onKeyDown={(e) => {
                    // Enter (or a barcode scanner's trailing Enter) looks the ISBN up instead of submitting the form.
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    if (lookup.state !== 'busy') runLookup()
                  }}
                  placeholder="978…"
                />
                <button type="button" className="pixel-button secondary" onClick={runLookup} disabled={lookup.state === 'busy'}>
                  Look up
                </button>
              </span>
            </label>
            <p className="hint" aria-live="polite">
              {lookup.message || 'Usually on the back cover above the barcode.'}
            </p>
          </Panel>

          <Panel title="2_details.txt" tone="cream">
            <label>
              <span>Title</span>
              <input ref={titleRef} value={draft.title} maxLength={300} required onChange={(e) => set('title', e.target.value)} />
            </label>
            <label>
              <span>Author</span>
              <input value={draft.author} maxLength={300} onChange={(e) => set('author', e.target.value)} />
            </label>
            <div className="field-row">
              <label>
                <span>Genre</span>
                <input list="genres" value={draft.genre} maxLength={80} onChange={(e) => set('genre', e.target.value)} />
                <datalist id="genres">
                  {genres.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </label>
              <label>
                <span>Year</span>
                <input value={draft.year} inputMode="numeric" maxLength={4} onChange={(e) => set('year', e.target.value)} />
              </label>
              <label>
                <span>Pages</span>
                <input value={draft.pages} inputMode="numeric" maxLength={6} onChange={(e) => set('pages', e.target.value)} />
              </label>
            </div>
            <p className="hint details-hint">Leave genre, year or pages blank and they’re filled in from Open Library when you save.</p>
            <label>
              <span>Reading status</span>
              <select value={draft.readingStatus ?? ''} onChange={(e) => set('readingStatus', (e.target.value || null) as ReadingStatus | null)}>
                {draft.readingStatus === null && <option value="">Not set</option>}
                {READING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {READING_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Joined the library on</span>
              <input type="date" value={draft.acquiredOn} max={today()} onChange={(e) => set('acquiredOn', e.target.value)} />
            </label>
            <label>
              <span>
                Notes <small>(optional)</small>
              </span>
              <textarea value={draft.notes} maxLength={2000} rows={3} onChange={(e) => set('notes', e.target.value)} placeholder="Signed copy! Gift from Mom. Coffee stain on p. 40." />
            </label>
          </Panel>

          <Panel title="3_decorate.paint" tone="pink">
            <fieldset className="swatches">
              <legend>Cover color</legend>
              {COVER_COLORS.map((color: CoverColor) => (
                <label key={color} className="swatch" title={color}>
                  <input type="radio" name="color" value={color} checked={draft.coverColor === color} onChange={() => set('coverColor', color)} />
                  <span style={{ background: PALETTE[color][0] }} />
                  <span className="sr-only">{color}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="patterns">
              <legend>Pattern</legend>
              {COVER_PATTERNS.map((pattern: CoverPattern) => (
                <label key={pattern} className="pattern-option">
                  <input type="radio" name="pattern" value={pattern} checked={draft.coverPattern === pattern} onChange={() => set('coverPattern', pattern)} />
                  <BookCover title={draft.title || '?'} color={draft.coverColor} pattern={pattern} size={36} />
                  <span>{pattern}</span>
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              className="pixel-button secondary"
              onClick={() => setDraft((d) => ({ ...d, coverColor: pick(COVER_COLORS), coverPattern: pick(COVER_PATTERNS) }))}
            >
              ✦ Surprise me
            </button>
          </Panel>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-buttons">
            <button className="pixel-button" type="submit" value="save" disabled={busy}>
              {existing ? 'Save changes' : '✦ Add to the library'}
            </button>
            {!existing && (
              <button className="pixel-button secondary" type="submit" value="another" disabled={busy}>
                Add & start another
              </button>
            )}
          </div>
        </form>

        <aside className="preview" aria-label="Cover preview">
          <div className="preview-stage">
            <BookCover title={draft.title || '?'} color={draft.coverColor} pattern={draft.coverPattern} size={190} />
          </div>
          <p className="preview-title">{draft.title || 'Untitled'}</p>
          {draft.author && <p className="preview-author">{draft.author}</p>}
        </aside>
      </div>
    </div>
  )
}

export function AddBook() {
  return <BookFormInner />
}

export function EditBook() {
  const { id } = useParams()
  const { books } = useLibrary()
  const book = books.find((b) => b.id === id)
  if (!book) return <NotInCatalog />
  return <BookFormInner key={book.id} existing={book} />
}
