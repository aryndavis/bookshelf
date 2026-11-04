import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import BookCover from './components/BookCover'
import Layout from './components/Layout'
import NotInCatalog from './components/NotInCatalog'
import OwnerOnly from './components/OwnerOnly'
import Panel from './components/Panel'
import BookPage from './pages/BookPage'
import Catalog from './pages/Catalog'
import Login from './pages/Login'
import SignIn from './pages/SignIn'
import { LibraryProvider, useLibrary } from './state/LibraryContext'

// Owner-only pages load on first use, so visitors don't download them.
const AddBook = lazy(() => import('./pages/BookForm').then((m) => ({ default: m.AddBook })))
const EditBook = lazy(() => import('./pages/BookForm').then((m) => ({ default: m.EditBook })))
const Loans = lazy(() => import('./pages/Loans'))
const Borrowing = lazy(() => import('./pages/Borrowing'))
const Backup = lazy(() => import('./pages/Backup'))

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
