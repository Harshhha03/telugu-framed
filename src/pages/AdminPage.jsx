import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoginForm from '../admin/LoginForm'
import MovieForm from '../admin/MovieForm'
import FrameManager from '../admin/FrameManager'
import ScheduleForm from '../admin/ScheduleForm'

export default function AdminPage() {
  const [session, setSession] = useState(undefined) // undefined = checking, null = signed out
  const [isAdmin, setIsAdmin] = useState(false)
  const [movies, setMovies] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.rpc('is_admin', { uid: session.user.id }).then(({ data }) => setIsAdmin(Boolean(data)))
  }, [session])

  useEffect(() => {
    if (!isAdmin) return
    loadMovies()
  }, [isAdmin])

  async function loadMovies() {
    const { data } = await supabase.from('movies').select('*').order('created_at', { ascending: false })
    setMovies(data ?? [])
  }

  if (session === undefined) return <p className="status-line">Checking session&hellip;</p>
  if (!session) return <LoginForm />

  if (!isAdmin) {
    return (
      <div className="page">
        <p className="status-line">
          Signed in, but this account isn't on the admin allowlist yet. Add its user id to the{' '}
          <code>admins</code> table (see README), then refresh.
        </p>
        <button type="button" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="page admin">
      <header className="topbar">
        <h1 className="wordmark wordmark--small">ADMIN</h1>
        <nav className="admin-nav">
          <Link to="/">View site</Link>
          <button type="button" className="secondary" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </nav>
      </header>

      <main className="admin-grid">
        <MovieForm onCreated={loadMovies} />
        <FrameManager movies={movies} />
        <ScheduleForm movies={movies} />
      </main>
    </div>
  )
}
