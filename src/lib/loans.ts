import { today } from './dates'
import type { Loan } from './types'

/** Still out and past its due date. */
export const isOverdue = (loan: Loan) => Boolean(loan.dueOn && !loan.returnedOn && loan.dueOn < today())
