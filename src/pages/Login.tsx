import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import BookCover from '../components/BookCover'
import Panel from '../components/Panel'
import { config } from '../config'
import { useLibrary } from '../state/LibraryContext'

/** The sign-in card. `embedded` puts it inside the site layout (for owner-only pages) instead of a full screen. */
export default function Login({ embedded = false, reason }: { embedded?: boolean; reason?: string }) {
  const Wrapper = embedded ? 'div' : 'main'
  const { signIn } = useLibrary()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Wrapper className={`login-page${embedded ? ' embedded' : ''}`} id={embedded ? undefined : 'main'}>
      <div className="login-books" aria-hidden="true">
        <BookCover title="L" color="pink" pattern="hearts" size={70} />
        <BookCover title="I" color="mint" pattern="dots" size={70} />
        <BookCover title="B" color="lilac" pattern="stars" size={70} />
      </div>
      <Panel title="library_card.exe" tone="yellow" className="login-panel" labelledBy="login-title">
        <h1 id="login-title">{config.libraryName}</h1>
        <p>{reason ?? 'Library card, please!'}</p>
        <form onSubmit={submit}>
          <label>
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="pixel-button" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Open the library'}
          </button>
        </form>
      </Panel>
      {embedded && <Link to="/">← Back to the catalog</Link>}
    </Wrapper>
  )
}
