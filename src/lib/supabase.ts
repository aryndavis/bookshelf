import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Book, BookInput, LibraryStore, Loan, LoanInput } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

/** Supabase is used only when both settings are present and the URL is HTTPS. */
export const supabase: SupabaseClient | null =
  url && key && url.startsWith('https://')
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null

type BookRow = {
  id: string
  title: string
  author: string
  isbn: string | null
  genre: string
  year: number | null
  pages: number | null
  cover_color: Book['coverColor']
  cover_pattern: Book['coverPattern']
  notes: string
  acquired_on: string
  created_at: string
}

type LoanRow = {
  id: string
  book_id: string
  borrower: string
  contact: string
  loaned_on: string
  due_on: string | null
  returned_on: string | null
  notes: string
  created_at: string
}

const bookColumns = 'id,title,author,isbn,genre,year,pages,cover_color,cover_pattern,notes,acquired_on,created_at'
const loanColumns = 'id,book_id,borrower,contact,loaned_on,due_on,returned_on,notes,created_at'

const fromBookRow = (r: BookRow): Book => ({
  id: r.id,
  title: r.title,
  author: r.author,
  isbn: r.isbn,
  genre: r.genre,
  year: r.year,
  pages: r.pages,
  coverColor: r.cover_color,
  coverPattern: r.cover_pattern,
  notes: r.notes,
  acquiredOn: r.acquired_on,
  createdAt: r.created_at,
})

const toBookRow = (b: BookInput) => ({
  title: b.title,
  author: b.author,
  isbn: b.isbn,
  genre: b.genre,
  year: b.year,
  pages: b.pages,
  cover_color: b.coverColor,
  cover_pattern: b.coverPattern,
  notes: b.notes,
  acquired_on: b.acquiredOn,
})

const fromLoanRow = (r: LoanRow): Loan => ({
  id: r.id,
  bookId: r.book_id,
  borrower: r.borrower,
  contact: r.contact,
  loanedOn: r.loaned_on,
  dueOn: r.due_on,
  returnedOn: r.returned_on,
  notes: r.notes,
  createdAt: r.created_at,
})

const friendly = (error: { message: string; code?: string }) => {
  if (error.code === '23505') return new Error('That book is already checked out.')
  return new Error(error.message)
}

export function supabaseStore(client: SupabaseClient): LibraryStore {
  return {
    async load() {
      const [books, loans] = await Promise.all([
        client.from('books').select(bookColumns).order('created_at', { ascending: false }),
        client.from('loans').select(loanColumns).order('loaned_on', { ascending: false }),
      ])
      if (books.error) throw friendly(books.error)
      if (loans.error) throw friendly(loans.error)
      return { books: (books.data as BookRow[]).map(fromBookRow), loans: (loans.data as LoanRow[]).map(fromLoanRow) }
    },
    async addBook(input) {
      const { data, error } = await client.from('books').insert(toBookRow(input)).select(bookColumns).single()
      if (error) throw friendly(error)
      return fromBookRow(data as BookRow)
    },
    async updateBook(id, input) {
      const { data, error } = await client.from('books').update(toBookRow(input)).eq('id', id).select(bookColumns).single()
      if (error) throw friendly(error)
      return fromBookRow(data as BookRow)
    },
    async deleteBook(id) {
      const { error } = await client.from('books').delete().eq('id', id)
      if (error) throw friendly(error)
    },
    async checkOut(bookId, input: LoanInput) {
      const row = { book_id: bookId, borrower: input.borrower, contact: input.contact, loaned_on: input.loanedOn, due_on: input.dueOn, notes: input.notes }
      const { data, error } = await client.from('loans').insert(row).select(loanColumns).single()
      if (error) throw friendly(error)
      return fromLoanRow(data as LoanRow)
    },
    async returnLoan(loanId, returnedOn) {
      const { data, error } = await client.from('loans').update({ returned_on: returnedOn }).eq('id', loanId).select(loanColumns).single()
      if (error) throw friendly(error)
      return fromLoanRow(data as LoanRow)
    },
  }
}
