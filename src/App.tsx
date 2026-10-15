import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import BookCover from './components/BookCover'
import Layout from './components/Layout'
import Panel from './components/Panel'
import Backup from './pages/Backup'
import { AddBook, EditBook } from './pages/BookForm'
import BookPage from './pages/BookPage'
import Catalog from './pages/Catalog'
import Loans from './pages/Loans'
import Login from './pages/Login'
import { LibraryProvider, useLibrary } from './state/LibraryContext'

function NotFound() {
  return (
    <Panel title="error.txt" tone="pink" className="narrow">
      <p>This page wandered off the shelf.</p>
      <Link to="/" className="pixel-button">
        Back to the catalog
      </Link>
    </Panel>
  )
}

/** Shows the login, loading, or error screen until the library is ready. */
function Gate() {
  const { status, error, reload, signOut, mode } = useLibrary()
  if (status === 'signed-out') return <Login />
  if (status === 'loading') {
    return (
      <main className="loading-page" id="main" aria-busy="true">
        <BookCover title="…" color="lilac" pattern="stars" size={80} className="bounce" />
        <p>Opening the library…</p>
      </main>
    )
  }
  if (status === 'error') {
    return (
      <main className="loading-page" id="main">
        <Panel title="error.txt" tone="pink" className="narrow">
          <p>Couldn’t load your library: {error}</p>
          <div className="button-row">
            <button type="button" className="pixel-button" onClick={reload}>
              Try again
            </button>
            {mode === 'cloud' && (
              <button type="button" className="pixel-button secondary" onClick={() => signOut()}>
                Sign out
              </button>
            )}
          </div>
        </Panel>
      </main>
    )
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalog />} />
        <Route path="add" element={<AddBook />} />
        <Route path="book/:id" element={<BookPage />} />
        <Route path="book/:id/edit" element={<EditBook />} />
        <Route path="loans" element={<Loans />} />
        <Route path="backup" element={<Backup />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LibraryProvider>
        <Gate />
      </LibraryProvider>
    </BrowserRouter>
  )
}
