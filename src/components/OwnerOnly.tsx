import type { ReactNode } from 'react'
import Login from '../pages/Login'
import { useLibrary } from '../state/LibraryContext'

/** Pages only the owner can use. Visitors get the sign-in card instead; the page appears once signed in. */
export default function OwnerOnly({ children, reason = 'Only the librarian can do that. Sign in to continue.' }: { children: ReactNode; reason?: string }) {
  const { canEdit } = useLibrary()
  return canEdit ? children : <Login embedded reason={reason} />
}
