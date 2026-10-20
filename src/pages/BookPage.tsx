import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import BookCover from '../components/BookCover'
import NotInCatalog from '../components/NotInCatalog'
import Stamp, { type StampKind } from '../components/Stamp'
import { config } from '../config'
import { addDays, daysBetween, formatDate, plural, stampDate, today } from '../lib/dates'
import { isOverdue } from '../lib/loans'
import type { Book, Loan } from '../lib/types'
import { useLibrary } from '../state/LibraryContext'

function CheckOutForm({ book, onDone }: { book: Book; onDone: (loan: Loan) => void }) {
  const { loans, checkOut } = useLibrary()
  const t = today()
  const [borrower, setBorrower] = useState('')
  const [contact, setContact] = useState('')
  const [loanedOn, setLoanedOn] = useState(t)
  const [dueOn, setDueOn] = useState(addDays(t, config.loanDays))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Suggest people you've lent to before, and remember how to reach them.
  const pastBorrowers = useMemo(() => {
    const seen = new Map<string, string>()
    for (const loan of loans) if (!seen.has(loan.borrower)) seen.set(loan.borrower, loan.contact)
    return seen
  }, [loans])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!borrower.trim()) return setError('Who’s borrowing it?')
    // The form is noValidate, so the date input's required/max aren't enforced by the browser.
    if (!loanedOn) return setError('When did it go out?')
    if (loanedOn > today()) return setError('The checkout date can’t be in the future.')
    if (dueOn && dueOn < loanedOn) return setError('The due date can’t be before the checkout date.')
    setBusy(true)
    setError(null)
    try {
      const loan = await checkOut(book.id, { borrower: borrower.trim(), contact: contact.trim(), loanedOn, dueOn: dueOn || null, notes: notes.trim() })
      onDone(loan)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <form className="checkout-form" onSubmit={submit} noValidate>
      <h2 className="form-title">Check this book out</h2>
      <label>
        <span>Borrower</span>
        <input
          list="past-borrowers"
          value={borrower}
          maxLength={120}
          autoComplete="off"
          required
          onChange={(e) => {
            setBorrower(e.target.value)
            const known = pastBorrowers.get(e.target.value)
            if (known && !contact) setContact(known)
          }}
        />
        <datalist id="past-borrowers">
          {[...pastBorrowers.keys()].map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label>
        <span>
          How to reach them <small>(optional)</small>
        </span>
        <input value={contact} maxLength={200} onChange={(e) => setContact(e.target.value)} placeholder="phone, email, “my sister”…" />
      </label>
      <div className="field-row">
        <label>
          <span>Checked out</span>
          <input type="date" value={loanedOn} max={t} onChange={(e) => setLoanedOn(e.target.value)} required />
        </label>
        <label>
          <span>
            Due back <small>(optional)</small>
          </span>
          <input type="date" value={dueOn} min={loanedOn} onChange={(e) => setDueOn(e.target.value)} />
        </label>
      </div>
      <label>
        <span>
          Note <small>(optional)</small>
        </span>
        <input value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="“for book club”" />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="pixel-button stamp-button" type="submit" disabled={busy}>
        {busy ? 'Stamping…' : '✦ Stamp & check out'}
      </button>
    </form>
  )
}

function OnLoan({ loan, onReturned }: { loan: Loan; onReturned: (loan: Loan) => void }) {
  const { returnLoan } = useLibrary()
  const t = today()
  const [returnedOn, setReturnedOn] = useState(t)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const days = daysBetween(loan.loanedOn, t)
  const overdue = isOverdue(loan)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!returnedOn) return setError('When did it come back?')
    if (returnedOn < loan.loanedOn) return setError('It can’t come back before it went out.')
    setBusy(true)
    setError(null)
    try {
      onReturned(await returnLoan(loan.id, returnedOn))
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className={`on-loan${overdue ? ' is-overdue' : ''}`}>
      <h2 className="form-title">Out with {loan.borrower}</h2>
      <p>
        Since {formatDate(loan.loanedOn)} ({days === 0 ? 'today' : plural(days, 'day')})
        {loan.dueOn && (
          <>
            {' · '}
            {overdue ? <strong>overdue by {plural(daysBetween(loan.dueOn, t), 'day')}</strong> : <>due {formatDate(loan.dueOn)}</>}
          </>
        )}
      </p>
      {loan.contact && <p>Reach them: {loan.contact}</p>}
      {loan.notes && <p>Note: {loan.notes}</p>}
      <form className="return-form" onSubmit={submit}>
        <label>
          <span>Returned on</span>
          <input type="date" value={returnedOn} min={loan.loanedOn} max={t} onChange={(e) => setReturnedOn(e.target.value)} />
        </label>
        <button className="pixel-button return-button" type="submit" disabled={busy}>
          {busy ? 'Stamping…' : '↩ Check it back in'}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** The pocket card from inside an old library book, listing every loan. */
function LibraryCard({ book, loans }: { book: Book; loans: Loan[] }) {
  const rows = [...loans].sort((a, b) => a.loanedOn.localeCompare(b.loanedOn))
  return (
    <section className="library-card" aria-labelledby="card-title">
      <h2 id="card-title">
        <span>Date due</span> · {book.title}
      </h2>
      {rows.length === 0 ? (
        <p className="card-empty">Never been checked out. A fresh card!</p>
      ) : (
        <div className="card-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Out</th>
                <th scope="col">Borrower</th>
                <th scope="col">Due</th>
                <th scope="col">Back</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((loan, i) => (
                <tr key={loan.id} style={{ '--tilt': `${((i * 7) % 5) - 2}deg` } as CSSProperties}>
                  <td>{stampDate(loan.loanedOn)}</td>
                  <td>{loan.borrower}</td>
                  <td>{loan.dueOn ? stampDate(loan.dueOn) : '—'}</td>
                  <td>{loan.returnedOn ? stampDate(loan.returnedOn) : <em>still out</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function BookPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { books, loans, activeLoans, deleteBook, canEdit } = useLibrary()
  const book = books.find((b) => b.id === id)
  const loan = book ? activeLoans.get(book.id) : undefined
  const bookLoans = loans.filter((l) => l.bookId === id)

  // The stamp slams down right after a checkout or return; "returned" fades away afterwards.
  const [stamp, setStamp] = useState<{ kind: StampKind; key: number; date: string } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  // Read once, then cleared from history so the note doesn't come back on reload.
  const [justAdded, setJustAdded] = useState(() => (location.state as { added?: boolean } | null)?.added === true)

  useEffect(() => {
    if (justAdded) navigate(location.pathname, { replace: true })
    // Only on arrival.
  }, [])

  useEffect(() => {
    if (stamp?.kind !== 'returned') return
    const timer = setTimeout(() => setStamp(null), 2600)
    return () => clearTimeout(timer)
  }, [stamp])

  useEffect(() => {
    titleRef.current?.focus()
  }, [id])

  if (!book) return <NotInCatalog />

  const shownStamp: StampKind | null = stamp?.kind ?? (loan ? (isOverdue(loan) ? 'overdue' : 'out') : null)
  const details: [string, string | number | null][] = [
    ['Genre', book.genre || null],
    ['Published', book.year],
    ['Pages', book.pages],
    ['ISBN', book.isbn],
    ['In the library since', formatDate(book.acquiredOn)],
  ]

  return (
    <article className="book-page" aria-labelledby="book-title">
      <p className="breadcrumb">
        <Link to="/">← Catalog</Link>
      </p>
      <div className="book-layout">
        <div className={`book-hero${stamp ? ' thunk' : ''}${justAdded ? ' just-added' : ''}`} key={stamp?.key}>
          <BookCover title={book.title} color={book.coverColor} pattern={book.coverPattern} size={220} />
          {shownStamp && <Stamp kind={shownStamp} date={stamp ? stamp.date : loan?.loanedOn} animate={Boolean(stamp)} />}
          {stamp && (
            <span className="ink-sparks" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
        </div>

        <div className="book-info">
          <h1 id="book-title" ref={titleRef} tabIndex={-1}>
            {book.title}
          </h1>
          {book.author && <p className="byline">by {book.author}</p>}
          {justAdded && <p className="added-note">✦ Added to the library!</p>}
          <dl className="details">
            {details.map(
              ([label, value]) =>
                value !== null &&
                value !== '' && (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
            )}
          </dl>
          {book.notes && <p className="book-notes">{book.notes}</p>}

          {!canEdit ? (
            // Visitors see whether the book is in, never who has it.
            <p className={`public-status${loan ? ' is-out' : ''}`}>
              {loan ? <>Checked out{loan.dueOn && <> · due back {formatDate(loan.dueOn)}</>}</> : 'On the shelf'}
            </p>
          ) : (
            <div className="loan-box">
              {loan ? (
                <OnLoan
                  key={loan.id}
                  loan={loan}
                  onReturned={(returned) => {
                    setJustAdded(false)
                    setStamp({ kind: 'returned', key: Date.now(), date: returned.returnedOn ?? today() })
                    setAnnouncement(`Checked back in from ${returned.borrower}.`)
                  }}
                />
              ) : (
                <CheckOutForm
                  book={book}
                  onDone={(created) => {
                    setJustAdded(false)
                    setStamp({ kind: 'out', key: Date.now(), date: created.loanedOn })
                    setAnnouncement(`Checked out to ${created.borrower}.`)
                  }}
                />
              )}
            </div>
          )}
          <p className="sr-only" role="status">
            {announcement}
          </p>

          {canEdit && (
            <div className="book-actions">
              <Link to={`/book/${book.id}/edit`} className="pixel-button secondary">
                ✎ Edit details
              </Link>
              {confirmDelete ? (
                <span className="confirm">
                  Remove this book and its loan history?
                  <button
                    type="button"
                    className="pixel-button danger"
                    onClick={async () => {
                      setDeleteError(null)
                      try {
                        await deleteBook(book.id)
                        navigate('/', { replace: true })
                      } catch (e) {
                        setDeleteError(`Couldn’t remove it: ${(e as Error).message}`)
                      }
                    }}
                  >
                    Yes, remove
                  </button>
                  <button type="button" className="pixel-button secondary" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </button>
                </span>
              ) : (
                <button type="button" className="pixel-button secondary" onClick={() => setConfirmDelete(true)}>
                  Remove book
                </button>
              )}
            </div>
          )}
          {deleteError && (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          )}
        </div>
      </div>

      {/* The card lists borrowers, so only the owner sees it. */}
      {canEdit && <LibraryCard book={book} loans={bookLoans} />}
    </article>
  )
}
