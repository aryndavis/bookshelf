import { BrowserRouter, Route, Routes } from 'react-router-dom'
import BookCover from './components/BookCover'
import Layout from './components/Layout'
import NotInCatalog from './components/NotInCatalog'
import OwnerOnly from './components/OwnerOnly'
import Panel from './components/Panel'
import Backup from './pages/Backup'
import { AddBook, EditBook } from './pages/BookForm'
import Borrowing from './pages/Borrowing'
import BookPage from './pages/BookPage'
import Catalog from './pages/Catalog'
import Loans from './pages/Loans'
import Login from './pages/Login'
import SignIn from './pages/SignIn'
import { LibraryProvider, useLibrary } from './state/LibraryContext'

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
        <Route
          path="add"
          element={
            <OwnerOnly reason="Only the librarian can add books. Sign in to continue.">
              <AddBook />
            </OwnerOnly>
          }
        />
        <Route path="book/:id" element={<BookPage />} />
        <Route
          path="book/:id/edit"
          element={
            <OwnerOnly>
              <EditBook />
            </OwnerOnly>
          }
        />
        <Route
          path="loans"
          element={
            <OwnerOnly reason="Who has what is private. Sign in to see it.">
              <Loans />
            </OwnerOnly>
          }
        />
        <Route
          path="borrowing"
          element={
            <OwnerOnly reason="What I’m borrowing is private. Sign in to see it.">
              <Borrowing />
            </OwnerOnly>
          }
        />
        <Route
          path="backup"
          element={
            <OwnerOnly>
              <Backup />
            </OwnerOnly>
          }
        />
        <Route path="signin" element={<SignIn />} />
        <Route path="*" element={<NotInCatalog message="This page wandered off the shelf." />} />
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
