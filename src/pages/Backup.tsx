import { useRef, useState } from 'react'
import Panel from '../components/Panel'
import { downloadCsv, downloadJson } from '../lib/backup'
import { fillBlanks, hasBlanks, lookupBook, lookupQuery } from '../lib/openLibrary'
import { resetDemo } from '../lib/demoStore'
import { plural } from '../lib/dates'
import { useLibrary } from '../state/LibraryContext'

// Open Library asks callers to go easy; one lookup at a time with a short pause is plenty.
const PAUSE_MS = 400

/** Looks up every book with a blank genre, year or pages and fills in what Open Library knows. */
function FillDetails() {
  const { books, updateBook } = useLibrary()
  const [progress, setProgress] = useState<{ done: number; total: number; filled: number; running: boolean } | null>(null)
  const stopped = useRef(false)
  const missing = books.filter(hasBlanks)

  const run = async () => {
    stopped.current = false
    const queue = [...missing]
    let filled = 0
    setProgress({ done: 0, total: queue.length, filled, running: true })
    for (const [i, book] of queue.entries()) {
      if (stopped.current) break
      try {
        const found = await lookupBook(lookupQuery(book), AbortSignal.timeout(10000))
        const next = fillBlanks(book, found)
        if (next.genre !== book.genre || next.year !== book.year || next.pages !== book.pages) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id and createdAt aren't part of an edit.
          const { id, createdAt, ...input } = next
          await updateBook(book.id, input)
          filled++
        }
      } catch {
        // Skip this one (no answer, or the save failed) and keep going.
      }
      setProgress({ done: i + 1, total: queue.length, filled, running: true })
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
    }
    setProgress((p) => p && { ...p, running: false })
  }

  return (
    <Panel title="fill_in_details.exe" tone="sky">
      <h2 className="panel-heading">Fill in missing details</h2>
      <p>
        {missing.length === 0
          ? 'Every book has a genre, year and page count. Nice!'
          : `${plural(missing.length, 'book')} ${missing.length === 1 ? 'is' : 'are'} missing a genre, year or page count. Look ${missing.length === 1 ? 'it' : 'them'} up on Open Library and fill in the blanks? Nothing you’ve typed is changed.`}
      </p>
      {progress && (
        <p className="hint" role="status">
          {progress.running ? `Looked up ${progress.done} of ${progress.total}…` : `Looked up ${progress.done} of ${progress.total}.`}{' '}
          Filled in {plural(progress.filled, 'book')}.
          {!progress.running && progress.filled < progress.done && ' Open Library didn’t know the rest; fill them in by hand.'}
        </p>
      )}
      {progress?.running ? (
        <button type="button" className="pixel-button secondary" onClick={() => (stopped.current = true)}>
          Stop
        </button>
      ) : (
        missing.length > 0 && (
          <button type="button" className="pixel-button" onClick={run}>
            ✦ Fill in the blanks
          </button>
        )
      )}
    </Panel>
  )
}

export default function Backup() {
  const { mode, books, loans, borrowings, userEmail, signOut } = useLibrary()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <>
      <section className="hero" aria-labelledby="backup-title">
        <h1 id="backup-title">Backup & account</h1>
        <p className="hero-sub">
          {plural(books.length, 'book')}, {plural(loans.length, 'loan')} and {plural(borrowings?.length ?? 0, 'borrowed book')} on record.
        </p>
      </section>

      <div className="panel-grid">
        <Panel title="save_a_copy.exe" tone="mint">
          <h2 className="panel-heading">Download a copy</h2>
          <p>Keep a copy of your catalog somewhere safe, or open it in a spreadsheet.</p>
          <div className="button-row">
            <button type="button" className="pixel-button" onClick={() => downloadCsv(books, loans)}>
              Catalog spreadsheet (.csv)
            </button>
            <button type="button" className="pixel-button secondary" onClick={() => downloadJson(books, loans, borrowings ?? [])}>
              Full backup (.json)
            </button>
          </div>
        </Panel>

        <FillDetails />

        <Panel title="account.txt" tone="lilac">
          <h2 className="panel-heading">Account</h2>
          {mode === 'cloud' ? (
            <>
              <p>Signed in as {userEmail}. Your books sync through Supabase.</p>
              <button type="button" className="pixel-button secondary" onClick={() => signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <p>Demo mode: everything is saved in this browser only. Add your Supabase settings to sync across devices (see the README).</p>
              {confirmReset ? (
                <p className="confirm">
                  Erase the demo books and start over with the samples?
                  <button
                    type="button"
                    className="pixel-button danger"
                    onClick={() => {
                      resetDemo()
                      window.location.assign('/')
                    }}
                  >
                    Yes, reset
                  </button>
                  <button type="button" className="pixel-button secondary" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </p>
              ) : (
                <button type="button" className="pixel-button secondary" onClick={() => setConfirmReset(true)}>
                  Reset demo data
                </button>
              )}
            </>
          )}
        </Panel>
      </div>
    </>
  )
}
