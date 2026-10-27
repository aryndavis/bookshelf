import { today } from './dates'
import type { Borrowing, Loan } from './types'

/** Still out and past its due date: a book you lent, or one you borrowed. */
export const isOverdue = (loan: Pick<Loan | Borrowing, 'dueOn' | 'returnedOn'>) => Boolean(loan.dueOn && !loan.returnedOn && loan.dueOn < today())
