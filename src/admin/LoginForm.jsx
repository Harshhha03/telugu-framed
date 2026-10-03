import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <form className="admin-login" onSubmit={handleSubmit}>
      <h1>Telugu Framed — Admin</h1>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="status-line status-line--error">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="admin-login__hint">
        No account yet? Create one from the Supabase dashboard (Authentication → Users → Add user),
        then add its user id to the <code>admins</code> table. See the README.
      </p>
    </form>
  )
}
