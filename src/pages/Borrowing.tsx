import { useMemo, useState, type FormEvent } from 'react'
import BookCover from '../components/BookCover'
import Panel from '../components/Panel'
import { daysBetween, formatDate, plural, today } from '../lib/dates'
import { isOverdue } from '../lib/loans'
import { COVER_COLORS, COVER_PATTERNS, type Borrowing } from '../lib/types'
import { useLibrary } from '../state/LibraryContext'

const tones = ['sky', 'lilac', 'mint', 'yellow', 'pink'] as const
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

function BorrowForm({ lenders }: { lenders: string[] }) {
  const { addBorrowing } = useLibrary()
  const t = today()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [lender, setLender] = useState('')
  const [borrowedOn, setBorrowedOn] = useState(t)
  const [dueOn, setDueOn] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return setError('What’s the book called?')
    if (!lender.trim()) return setError('Who or where is it from?')
    // The form is noValidate, so the date inputs' required/max aren't enforced by the browser.
    if (!borrowedOn) return setError('When did you borrow it?')
    if (borrowedOn > today()) return setError('The borrowed date can’t be in the future.')
    if (dueOn && dueOn < borrowedOn) return setError('The due date can’t be before the borrowed date.')
    setBusy(true)
    setError(null)
    try {
      const borrowing = await addBorrowing({
        title: title.trim(),
        author: author.trim(),
        lender: lender.trim(),
        borrowedOn,
        dueOn: dueOn || null,
        coverColor: pick(COVER_COLORS),
        coverPattern: pick(COVER_PATTERNS),
        notes: notes.trim(),
      })
      setAdded(borrowing.title)
      setTitle('')
      setAuthor('')
      setDueOn('')
      setNotes('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="borrow-form" onSubmit={submit} noValidate>
      <h2 className="form-title">I borrowed a book</h2>
      <div className="field-row">
        <label>
          <span>Title</span>
          <input value={title} maxLength={300} required onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span>
            Author <small>(optional)</small>
          </span>
          <input value={author} maxLength={300} onChange={(e) => setAuthor(e.target.value)} />
        </label>
      </div>
      <label>
        <span>From</span>
        <input
          list="past-lenders"
          value={lender}
          maxLength={120}
          autoComplete="off"
          required
          placeholder="a friend, “Brooklyn Public Library”…"
          onChange={(e) => setLender(e.target.value)}
        />
        <datalist id="past-lenders">
          {lenders.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <div className="field-row">
        <label>
          <span>Borrowed on</span>
          <input type="date" value={borrowedOn} max={t} onChange={(e) => setBorrowedOn(e.target.value)} required />
        </label>
        <label>
          <span>
            Due back <small>(optional)</small>
          </span>
          <input type="date" value={dueOn} min={borrowedOn} onChange={(e) => setDueOn(e.target.value)} />
        </label>
      </div>
      <label>
        <span>
          Note <small>(optional)</small>
        </span>
        <input value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="“she wants it back by Christmas”" />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="pixel-button stamp-button" type="submit" disabled={busy}>
        {busy ? 'Adding…' : '✦ Add to my borrowed pile'}
      </button>
      {added && (
        <p className="added-note" role="status">
          ✦ “{added}” is on your borrowed pile.
        </p>
      )}
    </form>
  )
}

/** One borrowed book on a lender's card, with buttons to give it back or remove it (for a mistake). */
function BorrowedBook({ borrowing }: { borrowing: Borrowing }) {
  const { giveBack, deleteBorrowing } = useLibrary()
  const t = today()
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overdue = isOverdue(borrowing)
  const days = daysBetween(borrowing.borrowedOn, t)

  const act = async (change: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await change()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <li className={overdue ? 'is-overdue' : ''}>
      <BookCover title={borrowing.title} color={borrowing.coverColor} pattern={borrowing.coverPattern} size={40} />
      <span>
        <strong className="borrowed-title">{borrowing.title}</strong>
        {borrowing.author && <small>{borrowing.author}</small>}
        <small>
          {overdue && borrowing.dueOn ? (
            <strong className="overdue-text">Overdue by {plural(daysBetween(borrowing.dueOn, t), 'day')}</strong>
          ) : (
            <>
              Had it {days === 0 ? 'since today' : plural(days, 'day')}
              {borrowing.dueOn && ` · due ${formatDate(borrowing.dueOn)}`}
            </>
          )}
        </small>
        {borrowing.notes && <small>{borrowing.notes}</small>}
        <span className="borrowed-actions">
          {confirmRemove ? (
            <>
              <button type="button" className="pixel-button danger small" disabled={busy} onClick={() => act(() => deleteBorrowing(borrowing.id))}>
                Yes, remove
              </button>
              <button type="button" className="pixel-button secondary small" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="pixel-button return-button small" disabled={busy} onClick={() => act(() => giveBack(borrowing.id, t))}>
                ↩ Gave it back
              </button>
              <button type="button" className="pixel-button secondary small" onClick={() => setConfirmRemove(true)} aria-label={`Remove ${borrowing.title}`}>
                Remove
              </button>
            </>
          )}
        </span>
        {error && (
          <small className="form-error" role="alert">
            {error}
          </small>
        )}
      </span>
    </li>
  )
}

export default function BorrowingPage() {
  const { borrowings } = useLibrary()

  const all = useMemo(() => borrowings ?? [], [borrowings])
  const open = all.filter((b) => !b.returnedOn)
  const history = all.filter((b) => b.returnedOn).sort((a, b) => (b.returnedOn ?? '').localeCompare(a.returnedOn ?? ''))
  // Suggest people and places you've borrowed from before, most recent first.
  const lenders = useMemo(() => {
    const seen = new Map<string, string>()
    for (const b of [...all].sort((x, y) => y.borrowedOn.localeCompare(x.borrowedOn))) {
      const key = b.lender.trim().toLowerCase()
      if (!seen.has(key)) seen.set(key, b.lender.trim())
    }
    return [...seen.values()]
  }, [all])

  // Group what you have by who or where it's from (ignoring capitalization), overdue first.
  const groups = new Map<string, { name: string; items: Borrowing[] }>()
  for (const b of open) {
    const key = b.lender.trim().toLowerCase()
    const group = groups.get(key) ?? { name: b.lender.trim(), items: [] }
    group.items.push(b)
    groups.set(key, group)
  }
  const sources = [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort((a, b) => a.borrowedOn.localeCompare(b.borrowedOn)), overdue: g.items.filter(isOverdue).length }))
    .sort((a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name))

  return (
    <>
      <section className="hero" aria-labelledby="borrowing-title">
        <h1 id="borrowing-title">Books I’m borrowing</h1>
        <p className="hero-sub">
          {borrowings === null
            ? 'Almost ready: the database needs one more step.'
            : open.length === 0
              ? 'Nothing borrowed right now.'
              : `${plural(open.length, 'book')} from ${sources.length} ${sources.length === 1 ? 'place' : 'places'}. Only you can see this page.`}
        </p>
      </section>

      {borrowings === null ? (
        <Panel title="setup.txt" tone="yellow" className="narrow">
          <h2 className="panel-heading">Turn on borrowing</h2>
          <p>
            In the Supabase dashboard, open <strong>SQL Editor → New query</strong>, paste in <code>supabase/update-2026-10.sql</code> from this app’s repo, and
            run it. Then reload this page.
          </p>
        </Panel>
      ) : (
        <>
          <div className="borrowing-layout">
            <Panel title="borrow_a_book.exe" tone="lilac">
              <BorrowForm lenders={lenders} />
            </Panel>
            {sources.length === 0 ? (
              <div className="empty">
                <BookCover title="?" color="sky" pattern="dots" size={90} />
                <p>No borrowed books. Add one when a friend or the library lends you something.</p>
              </div>
            ) : (
              <ul className="borrower-grid">
                {sources.map((source, i) => (
                  <li key={source.name}>
                    <Panel title={`${source.name.toLowerCase().replace(/\s+/g, '_')}.card`} tone={source.overdue ? 'pink' : tones[i % tones.length]}>
                      <h2 className="borrower-name">From {source.name}</h2>
                      <ul className="borrower-books">
                        {source.items.map((b) => (
                          <BorrowedBook key={b.id} borrowing={b} />
                        ))}
                      </ul>
                    </Panel>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Panel title="given_back.txt" tone="cream" className="history">
            <h2 className="history-title">Given back</h2>
            {history.length === 0 ? (
              <p>Nothing given back yet.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Book</th>
                      <th scope="col">From</th>
                      <th scope="col">Borrowed</th>
                      <th scope="col">Back</th>
                      <th scope="col">Kept for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((b) => (
                      <tr key={b.id}>
                        <td>{b.title}</td>
                        <td>{b.lender}</td>
                        <td>{formatDate(b.borrowedOn)}</td>
                        <td>{formatDate(b.returnedOn as string)}</td>
                        <td>{plural(daysBetween(b.borrowedOn, b.returnedOn as string), 'day')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  )
}
