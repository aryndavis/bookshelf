import { Navigate } from 'react-router-dom'
import { useLibrary } from '../state/LibraryContext'
import Login from './Login'

/** The header's "Sign in" link. Once signed in, back to the catalog. */
export default function SignIn() {
  const { canEdit } = useLibrary()
  return canEdit ? <Navigate to="/" replace /> : <Login embedded reason="Sign in to add, edit and lend books." />
}
