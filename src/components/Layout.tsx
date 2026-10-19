import { Link, NavLink, Outlet } from 'react-router-dom'
import { config } from '../config'
import { useLibrary } from '../state/LibraryContext'
import BookCover from './BookCover'
import { isOverdue } from '../lib/loans'

export default function Layout() {
  const { mode, books, activeLoans } = useLibrary()
  const overdue = [...activeLoans.values()].filter(isOverdue).length

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to content
      </a>
      {mode === 'demo' && (
        <p className="demo-banner">
          <strong>Demo mode:</strong> books are saved only in this browser. Add your Supabase settings to sync them (see the README).
        </p>
      )}
      <header className="site-header">
        <Link to="/" className="logo">
          <BookCover title="L" color="pink" pattern="hearts" size={34} />
          <span>{config.libraryName}</span>
        </Link>
        <nav className="main-nav" aria-label="Main">
          <NavLink to="/" end>
            Catalog <span className="count">{books.length}</span>
          </NavLink>
          <NavLink to="/loans">
            Who has what <span className={`count${overdue ? ' alert' : ''}`}>{activeLoans.size}</span>
          </NavLink>
          <NavLink to="/backup">Backup</NavLink>
        </nav>
        <Link to="/add" className="pixel-button add-button">
          + Add a book
        </Link>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>✦ {config.libraryName} ✦ please return books in the condition you found them ✦</span>
      </footer>
    </>
  )
}
