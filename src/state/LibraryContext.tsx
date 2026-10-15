import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoStore } from '../lib/demoStore'
import { supabase, supabaseStore } from '../lib/supabase'
import type { Book, BookInput, Loan, LoanInput } from '../lib/types'

type Status = 'loading' | 'signed-out' | 'ready' | 'error'

interface LibraryValue {
  /** 'cloud' when Supabase is configured; 'demo' keeps data in this browser. */
  mode: 'cloud' | 'demo'
  status: Status
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

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const checkingLogin = session === undefined
  const signedIn = mode === 'demo' || Boolean(userId)

  const load = useCallback(() => {
    setStatus('loading')
    setError(null)
    store
      .load()
      .then((data) => {
        setBooks(data.books)
        setLoans(data.loans)
        setStatus('ready')
      })
      .catch((e: Error) => {
        setError(e.message)
        setStatus('error')
      })
  }, [store])

  useEffect(() => {
    if (checkingLogin) return
    if (!signedIn) {
      setBooks([])
      setLoans([])
      setStatus('signed-out')
      return
    }
    load()
    // Keyed on the user id, so token refreshes don't trigger a reload.
  }, [checkingLogin, signedIn, userId, load])

  const activeLoans = useMemo(() => new Map(loans.filter((l) => !l.returnedOn).map((l) => [l.bookId, l])), [loans])

  const value: LibraryValue = {
    mode,
    status,
    error,
    userEmail: session?.user.email ?? null,
    books,
    loans,
    activeLoans,
    reload: load,
    async signIn(email, password) {
      if (!supabase) return
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error(authError.message === 'Invalid login credentials' ? 'That email and password don’t match.' : authError.message)
    },
    async signOut() {
      await supabase?.auth.signOut()
    },
    async addBook(input) {
      const book = await store.addBook(input)
      setBooks((list) => [book, ...list])
      return book
    },
    async updateBook(id, input) {
      const book = await store.updateBook(id, input)
      setBooks((list) => list.map((b) => (b.id === id ? book : b)))
      return book
    },
    async deleteBook(id) {
      await store.deleteBook(id)
      setBooks((list) => list.filter((b) => b.id !== id))
      setLoans((list) => list.filter((l) => l.bookId !== id))
    },
    async checkOut(bookId, input) {
      const loan = await store.checkOut(bookId, input)
      setLoans((list) => [loan, ...list])
      return loan
    },
    async returnLoan(loanId, returnedOn) {
      const loan = await store.returnLoan(loanId, returnedOn)
      setLoans((list) => list.map((l) => (l.id === loanId ? loan : l)))
      return loan
    },
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary() {
  const value = useContext(LibraryContext)
  if (!value) throw new Error('useLibrary must be used inside LibraryProvider')
  return value
}
