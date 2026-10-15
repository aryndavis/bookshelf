import { addDays, today } from './dates'
import type { Book, LibraryStore, Loan } from './types'

// Demo mode: used until Supabase is configured. Data stays in this browser only.
const STORAGE_KEY = 'bookshelf-demo-v1'

type Data = { books: Book[]; loans: Loan[] }

const newId = () => crypto.randomUUID()
const now = () => new Date().toISOString()

function sampleData(): Data {
  const t = today()
  const book = (title: string, author: string, coverColor: Book['coverColor'], coverPattern: Book['coverPattern'], daysAgo: number, genre = ''): Book => ({
    id: newId(),
    title,
    author,
    isbn: null,
    genre,
    year: null,
    pages: null,
    coverColor,
    coverPattern,
    notes: '',
    acquiredOn: addDays(t, -daysAgo),
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  })
  const books = [
    book('Matilda', 'Roald Dahl', 'pink', 'hearts', 3, 'Children’s'),
    book('The Hobbit', 'J.R.R. Tolkien', 'forest', 'stars', 40, 'Fantasy'),
    book('Understanding by Design', 'Grant Wiggins & Jay McTighe', 'sky', 'checks', 120, 'Education'),
    book('Wine Folly', 'Madeline Puckette', 'wine', 'dots', 12, 'Wine'),
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
  return {
    books,
    loans: [loan(books[1], 'Sam', 30, 21), loan(books[4], 'Priya', 6, 21), loan(books[5], 'Sam', 90, 21, 70)],
  }
}

function read(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Data
  } catch {
    // Storage unavailable or corrupted: fall back to sample data.
  }
  const data = sampleData()
  write(data)
  return data
}

function write(data: Data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Private mode or full storage: keep working in memory for this visit.
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
  const save = (next: Data) => {
    data = next
    write(data)
  }
  return {
    async load() {
      return structuredClone(data)
    },
    async addBook(input) {
      const created: Book = { ...input, id: newId(), createdAt: now() }
      save({ ...data, books: [created, ...data.books] })
      return created
    },
    async updateBook(id, input) {
      const existing = data.books.find((b) => b.id === id)
      if (!existing) throw new Error('Book not found.')
      const updated = { ...existing, ...input }
      save({ ...data, books: data.books.map((b) => (b.id === id ? updated : b)) })
      return updated
    },
    async deleteBook(id) {
      save({ books: data.books.filter((b) => b.id !== id), loans: data.loans.filter((l) => l.bookId !== id) })
    },
    async checkOut(bookId, input) {
      if (data.loans.some((l) => l.bookId === bookId && !l.returnedOn)) throw new Error('That book is already checked out.')
      const loan: Loan = { ...input, id: newId(), bookId, returnedOn: null, createdAt: now() }
      save({ ...data, loans: [loan, ...data.loans] })
      return loan
    },
    async returnLoan(loanId, returnedOn) {
      const existing = data.loans.find((l) => l.id === loanId)
      if (!existing) throw new Error('Loan not found.')
      const updated = { ...existing, returnedOn }
      save({ ...data, loans: data.loans.map((l) => (l.id === loanId ? updated : l)) })
      return updated
    },
  }
}
