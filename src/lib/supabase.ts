import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Book, BookInput, Borrowing, BorrowingInput, LibraryStore, Loan, LoanInput } from './types'

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
  /** Missing until supabase/update-2026-10.sql is run. */
  reading_status?: Book['readingStatus']
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

type BorrowingRow = {
  id: string
  title: string
  author: string
  lender: string
  borrowed_on: string
  due_on: string | null
  returned_on: string | null
  cover_color: Borrowing['coverColor']
  cover_pattern: Borrowing['coverPattern']
  notes: string
  created_at: string
}

const bookColumns = 'id,title,author,isbn,genre,year,pages,cover_color,cover_pattern,reading_status,notes,acquired_on,created_at'
// Before supabase/update-2026-10.sql adds reading_status, so the library still loads.
const bookColumnsBeforeUpdate = bookColumns.replace(',reading_status', '')
const loanColumns = 'id,book_id,borrower,contact,loaned_on,due_on,returned_on,notes,created_at'
const borrowingColumns = 'id,title,author,lender,borrowed_on,due_on,returned_on,cover_color,cover_pattern,notes,created_at'

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
  readingStatus: r.reading_status ?? null,
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
  reading_status: b.readingStatus,
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

const fromBorrowingRow = (r: BorrowingRow): Borrowing => ({
  id: r.id,
  title: r.title,
  author: r.author,
  lender: r.lender,
  borrowedOn: r.borrowed_on,
  dueOn: r.due_on,
  returnedOn: r.returned_on,
  coverColor: r.cover_color,
  coverPattern: r.cover_pattern,
  notes: r.notes,
  createdAt: r.created_at,
})

const toBorrowingRow = (b: BorrowingInput) => ({
  title: b.title,
  author: b.author,
  lender: b.lender,
  borrowed_on: b.borrowedOn,
  due_on: b.dueOn,
  cover_color: b.coverColor,
  cover_pattern: b.coverPattern,
  notes: b.notes,
})

// What Supabase answers when a table doesn't exist (PostgREST's code, then Postgres's own).
const MISSING_TABLE = new Set(['PGRST205', '42P01'])
// ...and when a column doesn't exist: writing one, then reading one.
const MISSING_COLUMN = new Set(['PGRST204', '42703'])

const friendly = (error: { message: string; code?: string }) => {
  if (error.code === '23505') return new Error('That book is already checked out.')
  if (MISSING_COLUMN.has(error.code ?? '') && error.message.includes('reading_status')) {
    return new Error('The database needs an update first: run supabase/update-2026-10.sql in the Supabase SQL Editor.')
  }
  return new Error(error.message)
}

// Supabase returns at most 1000 rows per request by default, so read whole tables page by page.
const PAGE_SIZE = 1000

async function selectAll<Row>(client: SupabaseClient, table: string, columns: string, newestFirst: string): Promise<Row[]> {
  const rows: Row[] = []
  for (;;) {
    const { data, error, count } = await client
      .from(table)
      .select(columns, { count: 'exact' })
      .order(newestFirst, { ascending: false })
      .order('id') // tie-breaker so pages don't overlap or skip rows
      .range(rows.length, rows.length + PAGE_SIZE - 1)
    if (error) throw Object.assign(friendly(error), { code: error.code })
    rows.push(...(data as unknown as Row[]))
    // Stop on the total, not on a short page: the project's "Max rows" setting can make every page shorter than PAGE_SIZE.
    if (data.length === 0 || rows.length >= (count ?? 0)) return rows
  }
}

/**
 * Every book, without reading statuses if supabase/update-2026-10.sql hasn't been run yet, so the library
 * (and the public view) still loads. Saving then explains what to run (see friendly).
 */
async function loadBooks(client: SupabaseClient) {
  try {
    return await selectAll<BookRow>(client, 'books', bookColumns, 'created_at')
  } catch (e) {
    if (!MISSING_COLUMN.has((e as { code?: string }).code ?? '')) throw e
    return selectAll<BookRow>(client, 'books', bookColumnsBeforeUpdate, 'created_at')
  }
}

/** Borrowings, or null if supabase/update-2026-10.sql hasn't been run yet (the rest of the library still loads). */
async function loadBorrowings(client: SupabaseClient) {
  try {
    return (await selectAll<BorrowingRow>(client, 'borrowings', borrowingColumns, 'borrowed_on')).map(fromBorrowingRow)
  } catch (e) {
    if (MISSING_TABLE.has((e as { code?: string }).code ?? '')) return null
    throw e
  }
}

export function supabaseStore(client: SupabaseClient): LibraryStore {
  return {
    async load() {
      const [books, loans, borrowings] = await Promise.all([
        loadBooks(client),
        selectAll<LoanRow>(client, 'loans', loanColumns, 'loaned_on'),
        loadBorrowings(client),
      ])
      return { books: books.map(fromBookRow), loans: loans.map(fromLoanRow), borrowings }
    },
    async loadPublic() {
      const [books, out] = await Promise.all([loadBooks(client), client.rpc('checked_out_books')])
      if (out.error) throw friendly(out.error)
      const loans = (out.data as { book_id: string; loaned_on: string; due_on: string | null }[]).map((row): Loan => ({
        id: `public-${row.book_id}`,
        bookId: row.book_id,
        borrower: '',
        contact: '',
        loanedOn: row.loaned_on,
        dueOn: row.due_on,
        returnedOn: null,
        notes: '',
        createdAt: row.loaned_on,
      }))
      return { books: books.map(fromBookRow), loans, borrowings: [] }
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
      // Only an open loan can be checked in, so a stale screen can't overwrite an earlier return date.
      const { data, error } = await client
        .from('loans')
        .update({ returned_on: returnedOn })
        .eq('id', loanId)
        .is('returned_on', null)
        .select(loanColumns)
        .maybeSingle()
      if (error) throw friendly(error)
      if (!data) throw new Error('That book was already checked back in.')
      return fromLoanRow(data as LoanRow)
    },
    async addBorrowing(input) {
      const { data, error } = await client.from('borrowings').insert(toBorrowingRow(input)).select(borrowingColumns).single()
      if (error) throw friendly(error)
      return fromBorrowingRow(data as BorrowingRow)
    },
    async giveBack(borrowingId, returnedOn) {
      const { data, error } = await client
        .from('borrowings')
        .update({ returned_on: returnedOn })
        .eq('id', borrowingId)
        .is('returned_on', null)
        .select(borrowingColumns)
        .maybeSingle()
      if (error) throw friendly(error)
      if (!data) throw new Error('That book was already given back.')
      return fromBorrowingRow(data as BorrowingRow)
    },
    async deleteBorrowing(borrowingId) {
      const { error } = await client.from('borrowings').delete().eq('id', borrowingId)
      if (error) throw friendly(error)
    },
  }
}
