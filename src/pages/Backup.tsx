import { useState } from 'react'
import Panel from '../components/Panel'
import { downloadCsv, downloadJson } from '../lib/backup'
import { resetDemo } from '../lib/demoStore'
import { plural } from '../lib/dates'
import { useLibrary } from '../state/LibraryContext'

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
