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

/** A book you're borrowing from someone else. It isn't in the catalog, so it carries its own title and cover. */
export interface Borrowing {
  id: string
  title: string
  author: string
  /** Who or where it's from: a friend, the public library. */
  lender: string
  borrowedOn: string
  dueOn: string | null
  returnedOn: string | null
  coverColor: CoverColor
  coverPattern: CoverPattern
  notes: string
  createdAt: string
}

export type BorrowingInput = Omit<Borrowing, 'id' | 'returnedOn' | 'createdAt'>

export interface LibraryData {
  books: Book[]
  loans: Loan[]
  /** Null when the database isn't set up for them yet (supabase/borrowing.sql not run). */
  borrowings: Borrowing[] | null
}

/** Where the library's data lives: Supabase in real use, or this browser in demo mode. */
export interface LibraryStore {
  load(): Promise<LibraryData>
  /**
   * What visitors who aren't signed in can see: the owner's books, and which are checked out.
   * Those loans have no borrower, contact or notes, and borrowings stay private. Not available in demo mode.
   */
  loadPublic?(): Promise<LibraryData>
  addBook(input: BookInput): Promise<Book>
  updateBook(id: string, input: BookInput): Promise<Book>
  deleteBook(id: string): Promise<void>
  checkOut(bookId: string, input: LoanInput): Promise<Loan>
  returnLoan(loanId: string, returnedOn: string): Promise<Loan>
  addBorrowing(input: BorrowingInput): Promise<Borrowing>
  /** Marks it given back. Like returnLoan, refuses one that's already back. */
  giveBack(borrowingId: string, returnedOn: string): Promise<Borrowing>
  deleteBorrowing(borrowingId: string): Promise<void>
}
