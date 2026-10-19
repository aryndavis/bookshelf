export const COVER_COLORS = ['pink', 'peach', 'yellow', 'mint', 'sky', 'lilac', 'wine', 'navy', 'forest', 'cream'] as const
export const COVER_PATTERNS = ['plain', 'stripes', 'dots', 'stars', 'hearts', 'checks', 'waves'] as const

export type CoverColor = (typeof COVER_COLORS)[number]
export type CoverPattern = (typeof COVER_PATTERNS)[number]

export interface Book {
  id: string
  title: string
  author: string
  isbn: string | null
  genre: string
  year: number | null
  pages: number | null
  coverColor: CoverColor
  coverPattern: CoverPattern
  notes: string
  /** ISO date (YYYY-MM-DD) the book joined the library. */
  acquiredOn: string
  createdAt: string
}

export type BookInput = Omit<Book, 'id' | 'createdAt'>

export interface Loan {
  id: string
  bookId: string
  borrower: string
  contact: string
  loanedOn: string
  dueOn: string | null
  returnedOn: string | null
  notes: string
  createdAt: string
}

export type LoanInput = Pick<Loan, 'borrower' | 'contact' | 'loanedOn' | 'dueOn' | 'notes'>

/** Where the library's data lives: Supabase in real use, or this browser in demo mode. */
export interface LibraryStore {
  load(): Promise<{ books: Book[]; loans: Loan[] }>
  addBook(input: BookInput): Promise<Book>
  updateBook(id: string, input: BookInput): Promise<Book>
  deleteBook(id: string): Promise<void>
  checkOut(bookId: string, input: LoanInput): Promise<Loan>
  returnLoan(loanId: string, returnedOn: string): Promise<Loan>
}
