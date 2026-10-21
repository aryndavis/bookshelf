import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { demoStore, STORAGE_KEY } from '../lib/demoStore'
import { supabase, supabaseStore } from '../lib/supabase'
import type { Book, BookInput, Loan, LoanInput } from '../lib/types'

// 'signed-out' only happens when the public view isn't set up (supabase/public-view.sql not run yet):
// then the app falls back to asking for a login before showing anything.
type Status = 'loading' | 'signed-out' | 'ready' | 'error'

interface LibraryValue {
  /** 'cloud' when Supabase is configured; 'demo' keeps data in this browser. */
  mode: 'cloud' | 'demo'
  status: Status
  /** True when the owner is signed in (or in demo mode). Visitors can only look. */
  canEdit: boolean
  error: string | null
  userEmail: string | null
  books: Book[]
  loans: Loan[]
  /** The open loan for each checked-out book, keyed by book id. */
  activeLoans: Map<string, Loan>
  reload: () => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  addBook: (input: BookInput) => Promise<Book>
  updateBook: (id: string, input: BookInput) => Promise<Book>
  deleteBook: (id: string) => Promise<void>
  checkOut: (bookId: string, input: LoanInput) => Promise<Loan>
  returnLoan: (loanId: string, returnedOn: string) => Promise<Loan>
}

const LibraryContext = createContext<LibraryValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const mode = supabase ? 'cloud' : 'demo'
  const store = useMemo(() => (supabase ? supabaseStore(supabase) : demoStore()), [])
  // undefined = still checking for a saved login.
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [loans, setLoans] = useState<Loan[]>([])

  // Bumped on every load and on sign-out, so a slow response can't land after the user has changed.
  const loadRun = useRef(0)
  // Who the loaded library belongs to (null = signed out), so token refreshes for the same user are ignored.
  const currentUser = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      currentUser.current ??= data.session?.user.id ?? null
      setSession(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextUser = next?.user.id ?? null
      if (currentUser.current !== undefined && nextUser !== currentUser.current) {
        // Signed in, out, or as someone else: show the loading screen, and clear right away so nothing
        // from the previous view stays on screen. Bumping loadRun drops anything still in flight.
        loadRun.current++
        setBooks([])
        setLoans([])
        setError(null)
        setStatus('loading')
      }
      currentUser.current = nextUser
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const checkingLogin = session === undefined
  const signedIn = mode === 'demo' || Boolean(userId)


  // Fetches the library. Whatever starts a load (signing in or out, or Try again) shows the loading screen;
  // this only fills in the result.
  const fetchLibrary = useCallback((asVisitor: boolean) => {
    const run = ++loadRun.current
    const request = asVisitor ? (store.loadPublic?.() ?? Promise.reject(new Error('No public view'))) : store.load()
    request
      .then((data) => {
        if (run !== loadRun.current) return
        setBooks(data.books)
        setLoans(data.loans)
        setStatus('ready')
      })
      .catch((e: Error) => {
        if (run !== loadRun.current) return
        if (asVisitor) {
          // The public view isn't set up yet, so ask for a login like before.
          setBooks([])
          setLoans([])
          return setStatus('signed-out')
        }
        setError(e.message)
        setStatus('error')
      })
  }, [store])

  // Demo mode: when another tab saves, quietly pick up its changes (no loading screen) so this tab
  // doesn't show stale books or loans.
  useEffect(() => {
    if (mode !== 'demo') return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const run = loadRun.current
      store
        .load()
        .then((data) => {
          if (run !== loadRun.current) return
          setBooks(data.books)
          setLoans(data.loans)
        })
        .catch(() => {
          // Keep showing what we have; the next change or reload will pick up the latest copy.
        })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [mode, store])

  useEffect(() => {
    if (checkingLogin) return
    // Signed out: show the public, read-only library.
    fetchLibrary(!signedIn)
    // Keyed on the user id, so token refreshes don't trigger a reload.
  }, [checkingLogin, signedIn, userId, fetchLibrary])

  const activeLoans = useMemo(() => {
    // Skip loans for books that aren't loaded, so counts match the books on screen.
    const bookIds = new Set(books.map((b) => b.id))
    return new Map(loans.filter((l) => !l.returnedOn && bookIds.has(l.bookId)).map((l) => [l.bookId, l]))
  }, [books, loans])

  // A change that finishes after sign-out (or a switch to another user) must not land in the next library.
  const commit = async <T,>(change: Promise<T>, apply: (result: T) => void) => {
    const run = loadRun.current
    const result = await change
    if (run === loadRun.current) apply(result)
    return result
  }

  const value: LibraryValue = {
    mode,
    status,
    canEdit: signedIn,
    error,
    userEmail: session?.user.email ?? null,
    books,
    loans,
    activeLoans,
    reload: () => {
      setError(null)
      setStatus('loading')
      fetchLibrary(!signedIn)
    },
    async signIn(email, password) {
      if (!supabase) return
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error(authError.message === 'Invalid login credentials' ? 'That email and password don’t match.' : authError.message)
    },
    async signOut() {
      // Signs out on every device. If Supabase can't be reached (e.g. offline), supabase-js still clears
      // the session on this device.
      await supabase?.auth.signOut()
    },
    addBook: (input) => commit(store.addBook(input), (book) => setBooks((list) => [book, ...list])),
    updateBook: (id, input) => commit(store.updateBook(id, input), (book) => setBooks((list) => list.map((b) => (b.id === id ? book : b)))),
    deleteBook: (id) =>
      commit(store.deleteBook(id), () => {
        setBooks((list) => list.filter((b) => b.id !== id))
        setLoans((list) => list.filter((l) => l.bookId !== id))
      }),
    checkOut: (bookId, input) => commit(store.checkOut(bookId, input), (loan) => setLoans((list) => [loan, ...list])),
    returnLoan: (loanId, returnedOn) => commit(store.returnLoan(loanId, returnedOn), (loan) => setLoans((list) => list.map((l) => (l.id === loanId ? loan : l)))),
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary() {
  const value = useContext(LibraryContext)
  if (!value) throw new Error('useLibrary must be used inside LibraryProvider')
  return value
}
