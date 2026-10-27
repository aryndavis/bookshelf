import { addDays, today } from './dates'
import type { Book, Borrowing, LibraryStore, Loan } from './types'

// Demo mode: used until Supabase is configured. Data stays in this browser only.
export const STORAGE_KEY = 'bookshelf-demo-v1'

type Data = { books: Book[]; loans: Loan[]; borrowings: Borrowing[] }

// randomUUID only exists in secure contexts (HTTPS/localhost); getRandomValues also works over plain HTTP,
// e.g. when the dev server is opened from a phone on the LAN.
const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
      )
const now = () => new Date().toISOString()

function sampleData(): Data {
  const t = today()
  const book = (title: string, author: string, coverColor: Book['coverColor'], coverPattern: Book['coverPattern'], daysAgo: number, genre = '', readingStatus: Book['readingStatus'] = 'read'): Book => ({
    id: newId(),
    title,
    author,
    isbn: null,
    genre,
    year: null,
    pages: null,
    coverColor,
    coverPattern,
    readingStatus,
    notes: '',
    acquiredOn: addDays(t, -daysAgo),
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  })
  const books = [
    book('Matilda', 'Roald Dahl', 'pink', 'hearts', 3, 'Children’s', 'to-read'),
    book('The Hobbit', 'J.R.R. Tolkien', 'forest', 'stars', 40, 'Fantasy'),
    book('Understanding by Design', 'Grant Wiggins & Jay McTighe', 'sky', 'checks', 120, 'Education'),
    book('Wine Folly', 'Madeline Puckette', 'wine', 'dots', 12, 'Wine', 'reading'),
    book('Braiding Sweetgrass', 'Robin Wall Kimmerer', 'mint', 'waves', 200, 'Nature'),
    book('Little Women', 'Louisa May Alcott', 'peach', 'stripes', 300, 'Classic'),
  ]
  const loan = (b: Book, borrower: string, outDaysAgo: number, dueIn: number | null, returnedDaysAgo: number | null = null): Loan => ({
    id: newId(),
    bookId: b.id,
    borrower,
    contact: '',
    loanedOn: addDays(t, -outDaysAgo),
    dueOn: dueIn === null ? null : addDays(t, -outDaysAgo + dueIn),
    returnedOn: returnedDaysAgo === null ? null : addDays(t, -returnedDaysAgo),
    notes: '',
    createdAt: now(),
  })
  const borrowing = (title: string, author: string, lender: string, coverColor: Book['coverColor'], coverPattern: Book['coverPattern'], outDaysAgo: number, dueIn: number | null, returnedDaysAgo: number | null = null): Borrowing => ({
    id: newId(),
    title,
    author,
    lender,
    borrowedOn: addDays(t, -outDaysAgo),
    dueOn: dueIn === null ? null : addDays(t, -outDaysAgo + dueIn),
    returnedOn: returnedDaysAgo === null ? null : addDays(t, -returnedDaysAgo),
    coverColor,
    coverPattern,
    notes: '',
    createdAt: now(),
  })
  return {
    books,
    loans: [loan(books[1], 'Sam', 30, 21), loan(books[4], 'Priya', 6, 21), loan(books[5], 'Sam', 90, 21, 70)],
    borrowings: [
      borrowing('Piranesi', 'Susanna Clarke', 'Brooklyn Public Library', 'navy', 'stars', 10, 21),
      borrowing('The Secret History', 'Donna Tartt', 'Maya', 'wine', 'checks', 45, null),
      borrowing('Kindred', 'Octavia E. Butler', 'Brooklyn Public Library', 'peach', 'waves', 60, 21, 41),
    ],
  }
}

/** The saved library, or null if storage is unavailable, empty, or doesn't hold library data. */
function stored(): Data | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Data> | null) : null
    // Libraries saved before borrowing and reading status existed have neither yet.
    if (parsed && Array.isArray(parsed.books) && Array.isArray(parsed.loans)) {
      return {
        ...parsed,
        books: parsed.books.map((b) => ({ ...b, readingStatus: b.readingStatus ?? null })),
        borrowings: Array.isArray(parsed.borrowings) ? parsed.borrowings : [],
      } as Data
    }
  } catch {
    // Storage unavailable or corrupted.
  }
  return null
}

function read(): Data {
  const existing = stored()
  if (existing) return existing
  const data = sampleData()
  write(data)
  return data
}

/** Returns false if the data couldn't be stored. */
function write(data: Data): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    // Private mode or full storage: keep working in memory for this visit.
    return false
  }
}

export function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function demoStore(): LibraryStore {
  let data = read()
  // False once a change couldn't be stored: from then on this tab's copy is the newest, not the stored one.
  let savedToStorage = true
  // Another tab may have saved since we last looked; start each change from the stored copy so it isn't overwritten.
  const latest = () => (savedToStorage ? (data = stored() ?? data) : data)
  const save = (next: Data) => {
    data = next
    savedToStorage = write(data)
  }
  return {
    async load() {
      return structuredClone(latest())
    },
    async addBook(input) {
      const current = latest()
      const created: Book = { ...input, id: newId(), createdAt: now() }
      save({ ...current, books: [created, ...current.books] })
      return created
    },
    async updateBook(id, input) {
      const current = latest()
      const existing = current.books.find((b) => b.id === id)
      if (!existing) throw new Error('Book not found.')
      const updated = { ...existing, ...input }
      save({ ...current, books: current.books.map((b) => (b.id === id ? updated : b)) })
      return updated
    },
    async deleteBook(id) {
      const current = latest()
      save({ ...current, books: current.books.filter((b) => b.id !== id), loans: current.loans.filter((l) => l.bookId !== id) })
    },
    async checkOut(bookId, input) {
      const current = latest()
      if (!current.books.some((b) => b.id === bookId)) throw new Error('Book not found.')
      if (current.loans.some((l) => l.bookId === bookId && !l.returnedOn)) throw new Error('That book is already checked out.')
      const loan: Loan = { ...input, id: newId(), bookId, returnedOn: null, createdAt: now() }
      save({ ...current, loans: [loan, ...current.loans] })
      return loan
    },
    async returnLoan(loanId, returnedOn) {
      const current = latest()
      const existing = current.loans.find((l) => l.id === loanId)
      if (!existing) throw new Error('Loan not found.')
      if (existing.returnedOn) throw new Error('That book was already checked back in.')
      const updated = { ...existing, returnedOn }
      save({ ...current, loans: current.loans.map((l) => (l.id === loanId ? updated : l)) })
      return updated
    },
    async addBorrowing(input) {
      const current = latest()
      const created: Borrowing = { ...input, id: newId(), returnedOn: null, createdAt: now() }
      save({ ...current, borrowings: [created, ...current.borrowings] })
      return created
    },
    async giveBack(borrowingId, returnedOn) {
      const current = latest()
      const existing = current.borrowings.find((b) => b.id === borrowingId)
      if (!existing) throw new Error('Borrowed book not found.')
      if (existing.returnedOn) throw new Error('That book was already given back.')
      const updated = { ...existing, returnedOn }
      save({ ...current, borrowings: current.borrowings.map((b) => (b.id === borrowingId ? updated : b)) })
      return updated
    },
    async deleteBorrowing(borrowingId) {
      const current = latest()
      save({ ...current, borrowings: current.borrowings.filter((b) => b.id !== borrowingId) })
    },
  }
}
