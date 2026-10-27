import { Link } from 'react-router-dom'
import { isOverdue } from '../lib/loans'
import { READING_LABELS } from '../lib/reading'
import type { Book, Loan } from '../lib/types'
import BookCover from './BookCover'
import Stamp from './Stamp'

export default function BookCard({ book, loan }: { book: Book; loan?: Loan }) {
  const overdue = loan ? isOverdue(loan) : false
  return (
    <li className="book-card">
      <Link className="book-card-link" to={`/book/${book.id}`}>
        <span className="book-card-cover">
          <BookCover title={book.title} color={book.coverColor} pattern={book.coverPattern} size={112} />
          {loan && <Stamp kind={overdue ? 'overdue' : 'out'} small />}
        </span>
        <span className="book-card-title">{book.title}</span>
        {book.author && <span className="book-card-author">{book.author}</span>}
        {book.readingStatus && <span className={`reading-tag is-${book.readingStatus}`}>{READING_LABELS[book.readingStatus]}</span>}
        <span className={`book-card-status${loan ? (overdue ? ' is-overdue' : ' is-out') : ''}`}>
          {loan ? `${overdue ? 'Overdue' : 'Out'} with ${loan.borrower}` : 'On the shelf'}
        </span>
      </Link>
    </li>
  )
}
