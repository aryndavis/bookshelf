// Conformance: the demo store (this browser's localStorage) and the Supabase store must behave the same,
// so the app can swap them freely. The Supabase store runs against an in-memory fake client (src/test)
// that mirrors supabase/schema.sql: one open loan per book, loans must point at a book, and deleting a
// book deletes its loans. Borrowings (supabase/update-2026-10.sql) are books lent to the owner.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from '../test/fakeSupabase'
import { MemoryStorage } from '../test/memoryStorage'
import { STORAGE_KEY, demoStore } from './demoStore'
import { supabaseStore } from './supabase'
import type { BookInput, BorrowingInput, LibraryStore } from './types'

const bookInput = (patch: Partial<BookInput> = {}): BookInput => ({
  title: 'Matilda',
  author: 'Roald Dahl',
  isbn: '9780142410370',
  genre: 'Children’s',
  year: 1988,
  pages: null,
  coverColor: 'pink',
  coverPattern: 'hearts',
  readingStatus: 'read',
  notes: '',
  acquiredOn: '2026-10-15',
  ...patch,
})
const loanInput = { borrower: 'Sam', contact: '555-0100', loanedOn: '2026-10-18', dueOn: '2026-11-08', notes: '' }
const borrowingInput = (patch: Partial<BorrowingInput> = {}): BorrowingInput => ({
  title: 'Piranesi',
  author: 'Susanna Clarke',
  lender: 'Brooklyn Public Library',
  borrowedOn: '2026-10-20',
  dueOn: '2026-11-10',
  coverColor: 'navy',
  coverPattern: 'stars',
  notes: 'renewed once',
  ...patch,
})

function libraryDatabase({ maxRows }: { maxRows?: number } = {}) {
  return fakeSupabase({
    maxRows,
    userId: '11111111-1111-1111-1111-111111111111',
    cascades: { books: [{ table: 'loans', column: 'book_id' }] },
    beforeInsert: (table, row, existing) => {
      if (table !== 'loans') return null
      if (existing.some((loan) => loan.book_id === row.book_id && !loan.returned_on)) return 'duplicate key value violates unique constraint "loans_one_open_loan_per_book"'
      return null
    },
  })
}

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

const implementations: [string, () => LibraryStore][] = [
  [
    'demo store',
    () => {
      storage.setItem(STORAGE_KEY, JSON.stringify({ books: [], loans: [], borrowings: [] })) // start from an empty library
      return demoStore()
    },
  ],
  ['Supabase store', () => supabaseStore(libraryDatabase().client)],
]

describe.each(implementations)('%s', (_name, makeStore) => {
  let store: LibraryStore
  beforeEach(() => {
    store = makeStore()
  })

  it('starts empty', async () => {
    expect(await store.load()).toEqual({ books: [], loans: [], borrowings: [] })
  })

  it('adds a book and loads it back with every field intact', async () => {
    // Act
    const added = await store.addBook(bookInput())
    const { books } = await store.load()

    // Assert
    expect(added).toMatchObject(bookInput())
    expect(added.id).toBeTruthy()
    expect(added.createdAt).toBeTruthy()
    expect(books).toEqual([added])
  })

  it('edits a book', async () => {
    const added = await store.addBook(bookInput())
    const updated = await store.updateBook(added.id, bookInput({ title: 'Matilda (anniversary edition)', pages: 240 }))
    expect(updated).toMatchObject({ id: added.id, title: 'Matilda (anniversary edition)', pages: 240 })
    expect((await store.load()).books[0].title).toBe('Matilda (anniversary edition)')
  })

  it('checks a book out and back in, then lets it go out again', async () => {
    // Arrange
    const book = await store.addBook(bookInput())

    // Act
    const loan = await store.checkOut(book.id, loanInput)
    const returned = await store.returnLoan(loan.id, '2026-10-25')
    const again = await store.checkOut(book.id, { ...loanInput, borrower: 'Priya' })
    const { loans } = await store.load()

    // Assert
    expect(loan).toMatchObject({ ...loanInput, bookId: book.id, returnedOn: null })
    expect(returned).toMatchObject({ id: loan.id, returnedOn: '2026-10-25' })
    expect(again.borrower).toBe('Priya')
    expect(loans).toHaveLength(2)
  })

  it('refuses a second checkout of a book that is already out', async () => {
    const book = await store.addBook(bookInput())
    await store.checkOut(book.id, loanInput)
    await expect(store.checkOut(book.id, { ...loanInput, borrower: 'Priya' })).rejects.toThrow('That book is already checked out.')
  })

  it('refuses to check in a loan twice (a stale screen cannot overwrite the real return date)', async () => {
    const book = await store.addBook(bookInput())
    const loan = await store.checkOut(book.id, loanInput)
    await store.returnLoan(loan.id, '2026-10-25')
    await expect(store.returnLoan(loan.id, '2026-10-30')).rejects.toThrow('That book was already checked back in.')
    expect((await store.load()).loans[0].returnedOn).toBe('2026-10-25')
  })

  it('deleting a book deletes its loan history', async () => {
    const keep = await store.addBook(bookInput({ title: 'Survivor' }))
    const book = await store.addBook(bookInput())
    await store.checkOut(book.id, loanInput)
    await store.checkOut(keep.id, loanInput)

    await store.deleteBook(book.id)
    const data = await store.load()

    expect(data.books.map((b) => b.title)).toEqual(['Survivor'])
    expect(data.loans.map((l) => l.bookId)).toEqual([keep.id])
  })

  it('refuses to edit a book that does not exist', async () => {
    await expect(store.updateBook('no-such-book', bookInput())).rejects.toThrow()
  })

  it('adds a borrowed book and loads it back with every field intact, apart from the catalog', async () => {
    const added = await store.addBorrowing(borrowingInput())
    const data = await store.load()
    expect(added).toMatchObject({ ...borrowingInput(), returnedOn: null })
    expect(added.id).toBeTruthy()
    expect(data.borrowings).toEqual([added])
    expect(data.books).toEqual([])
  })

  it('gives a borrowed book back once, and refuses a second time', async () => {
    const borrowing = await store.addBorrowing(borrowingInput())
    expect(await store.giveBack(borrowing.id, '2026-11-01')).toMatchObject({ id: borrowing.id, returnedOn: '2026-11-01' })
    await expect(store.giveBack(borrowing.id, '2026-11-05')).rejects.toThrow('That book was already given back.')
    expect((await store.load()).borrowings?.[0].returnedOn).toBe('2026-11-01')
  })

  it('removes a borrowed book added by mistake, and only that one', async () => {
    const keep = await store.addBorrowing(borrowingInput({ title: 'Kindred', lender: 'Maya' }))
    const mistake = await store.addBorrowing(borrowingInput())
    await store.deleteBorrowing(mistake.id)
    expect((await store.load()).borrowings?.map((b) => b.id)).toEqual([keep.id])
  })
})

describe('Supabase store: beyond the shared contract', () => {
  // The fake caps every answer at `maxRows` (1,000 by default, like Supabase), so these fail if the store stops paging.
  it.each([
    ['the default 1,000-row limit', undefined],
    ['a lower "Max rows" setting (every page comes back short)', 300],
  ])('loads all 2,500 books past %s, each exactly once', async (_limit, maxRows) => {
    // Arrange: 2,500 books, many sharing a created_at so the id tie-breaker matters
    const db = libraryDatabase({ maxRows })
    const books: Record<string, unknown>[] = []
    db.tables.set('books', books)
    for (let i = 0; i < 2500; i++) {
      books.push({ id: `b${String(i).padStart(4, '0')}`, title: `Book ${i}`, author: '', isbn: null, genre: '', year: null, pages: null, cover_color: 'pink', cover_pattern: 'plain', notes: '', acquired_on: '2026-01-01', created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z` })
    }

    // Act
    const { books: loaded } = await supabaseStore(db.client).load()

    // Assert: every book, exactly once
    expect(loaded).toHaveLength(2500)
    expect(new Set(loaded.map((b) => b.id)).size).toBe(2500)
  })

  it('the public view gets which books are out and when, never who has them', async () => {
    const db = libraryDatabase()
    db.tables.set('rpc:checked_out_books', [{ book_id: 'b1', loaned_on: '2026-10-18', due_on: '2026-11-08' }])
    const { loans } = await supabaseStore(db.client).loadPublic!()
    expect(loans).toEqual([expect.objectContaining({ bookId: 'b1', borrower: '', contact: '', notes: '', loanedOn: '2026-10-18', dueOn: '2026-11-08', returnedOn: null })])
  })

  it('the public view never asks for what the owner is borrowing', async () => {
    const db = libraryDatabase()
    // Reading borrowings would fail here; the public view must not try.
    db.failNext('borrowings', 'select', { message: 'permission denied for table borrowings', code: '42501' })
    expect((await supabaseStore(db.client).loadPublic!()).borrowings).toEqual([])
  })

  it('loads books without reading statuses before the update SQL adds the column', async () => {
    const db = libraryDatabase()
    db.tables.set('books', [{ id: 'b1', title: 'Matilda', author: '', isbn: null, genre: '', year: null, pages: null, cover_color: 'pink', cover_pattern: 'plain', notes: '', acquired_on: '2026-01-01', created_at: '2026-01-01T00:00:00Z' }])
    db.failNext('books', 'select', { message: 'column books.reading_status does not exist', code: '42703' })
    const { books } = await supabaseStore(db.client).load()
    expect(books).toEqual([expect.objectContaining({ title: 'Matilda', readingStatus: null })])
  })

  it('explains what to run when saving needs the reading status column', async () => {
    const db = libraryDatabase()
    db.failNext('books', 'insert', { message: "Could not find the 'reading_status' column of 'books' in the schema cache", code: 'PGRST204' })
    await expect(supabaseStore(db.client).addBook(bookInput())).rejects.toThrow('supabase/update-2026-10.sql')
  })

  it.each([
    ['PGRST205', 'Could not find the table \'public.borrowings\' in the schema cache'],
    ['42P01', 'relation "public.borrowings" does not exist'],
  ])('still loads the library before the update SQL is run (%s), with borrowings marked not set up', async (code, message) => {
    const db = libraryDatabase()
    const store = supabaseStore(db.client)
    await store.addBook(bookInput())
    db.failNext('borrowings', 'select', { message, code })
    const data = await store.load()
    expect(data.books).toHaveLength(1)
    expect(data.borrowings).toBeNull()
  })

  it('other borrowing errors still fail the load', async () => {
    const db = libraryDatabase()
    db.failNext('borrowings', 'select', { message: 'JWT expired', code: 'PGRST301' })
    await expect(supabaseStore(db.client).load()).rejects.toThrow('JWT expired')
  })

  it('passes database errors on instead of pretending it worked', async () => {
    const db = libraryDatabase()
    const store = supabaseStore(db.client)
    db.failNext('books', 'select', { message: 'JWT expired' })
    await expect(store.load()).rejects.toThrow('JWT expired')
    db.failNext('books', 'insert', { message: 'permission denied for table books' })
    await expect(store.addBook(bookInput())).rejects.toThrow('permission denied')
    db.failNext('checked_out_books', 'select', { message: 'function not found' })
    await expect(store.loadPublic!()).rejects.toThrow('function not found')
  })
})

describe('demo store: when browser storage misbehaves', () => {
  it('starts with sample books when nothing is saved yet', async () => {
    const { books, loans, borrowings } = await demoStore().load()
    expect(books).toHaveLength(6)
    expect(loans.length).toBeGreaterThan(0)
    expect(borrowings?.length).toBeGreaterThan(0)
  })

  it('keeps a library saved before borrowing existed, with no borrowings yet', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ books: [], loans: [] }))
    const store = demoStore()
    expect((await store.load()).borrowings).toEqual([])
    const added = await store.addBorrowing(borrowingInput())
    expect((await store.load()).borrowings).toEqual([added])
  })

  it('keeps books saved before reading status existed, with no status yet', async () => {
    const { readingStatus: _, ...old } = { ...bookInput(), id: 'b1', createdAt: '2026-01-01' }
    storage.setItem(STORAGE_KEY, JSON.stringify({ books: [old], loans: [] }))
    expect((await demoStore().load()).books).toEqual([{ ...old, readingStatus: null }])
  })

  it('recovers with sample books instead of crashing when the saved data is corrupt', async () => {
    storage.setItem(STORAGE_KEY, '{not json')
    expect((await demoStore().load()).books).toHaveLength(6)
    storage.setItem(STORAGE_KEY, JSON.stringify({ books: 'oops' }))
    expect((await demoStore().load()).books).toHaveLength(6)
  })

  it('keeps working for this visit when storage is full', async () => {
    // Arrange
    storage.setItem(STORAGE_KEY, JSON.stringify({ books: [], loans: [] }))
    const store = demoStore()
    storage.failWrites = true

    // Act
    const added = await store.addBook(bookInput())
    const second = await store.addBook(bookInput({ title: 'Survivor' }))

    // Assert: both books are kept in memory, and nothing older overwrote them
    expect((await store.load()).books.map((b) => b.id)).toEqual([second.id, added.id])
  })

  it('works when storage is blocked entirely (for example, strict privacy settings)', async () => {
    storage.failReads = true
    storage.failWrites = true
    const store = demoStore()
    const added = await store.addBook(bookInput())
    expect((await store.load()).books).toContainEqual(added)
  })

  it('picks up a book another tab saved, instead of overwriting it', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ books: [], loans: [] }))
    const thisTab = demoStore()
    const otherTab = demoStore()

    await otherTab.addBook(bookInput({ title: 'From the other tab' }))
    await thisTab.addBook(bookInput({ title: 'From this tab' }))

    expect((await thisTab.load()).books.map((b) => b.title).sort()).toEqual(['From the other tab', 'From this tab'])
  })
})
