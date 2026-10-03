import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY

export default function MovieForm({ onCreated }) {
  const [title, setTitle] = useState('')
  const [teluguTitle, setTeluguTitle] = useState('')
  const [releaseYear, setReleaseYear] = useState('')
  const [posterUrl, setPosterUrl] = useState('')
  const [tmdbId, setTmdbId] = useState(null)
  const [tmdbResults, setTmdbResults] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function searchTmdb() {
    if (!TMDB_KEY || !title.trim()) return
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=${TMDB_KEY}`
    )
    const data = await res.json()
    setTmdbResults(data.results ?? [])
  }

  function applyTmdbPick(r) {
    setTitle(r.title)
    setReleaseYear(r.release_date ? r.release_date.slice(0, 4) : '')
    setPosterUrl(r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : '')
    setTmdbId(r.id)
    setTmdbResults([])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('movies')
      .insert({
        title: title.trim(),
        telugu_title: teluguTitle.trim() || null,
        release_year: releaseYear ? Number(releaseYear) : null,
        poster_url: posterUrl.trim() || null,
        tmdb_id: tmdbId,
      })
      .select()
      .single()
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onCreated(data)
    setTitle('')
    setTeluguTitle('')
    setReleaseYear('')
    setPosterUrl('')
    setTmdbId(null)
  }

  return (
    <form className="admin-card" onSubmit={handleSubmit}>
      <h3>Add a movie</h3>
      <label>
        Title (English)
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      {TMDB_KEY && (
        <button type="button" className="secondary" onClick={searchTmdb}>
          Look up on TMDB
        </button>
      )}
      {tmdbResults.length > 0 && (
        <ul className="tmdb-results">
          {tmdbResults.slice(0, 5).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => applyTmdbPick(r)}>
                {r.title} {r.release_date ? `(${r.release_date.slice(0, 4)})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label>
        Telugu title
        <input value={teluguTitle} onChange={(e) => setTeluguTitle(e.target.value)} />
      </label>
      <label>
        Release year
        <input
          type="number"
          value={releaseYear}
          onChange={(e) => setReleaseYear(e.target.value)}
          placeholder="2013"
        />
      </label>
      <label>
        Poster URL
        <input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} />
      </label>
      {error && <p className="status-line status-line--error">{error}</p>}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save movie'}
      </button>
    </form>
  )
}
