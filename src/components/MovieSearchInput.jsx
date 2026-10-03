import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY

async function searchTmdb(query) {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}&include_adult=false`
  )
  if (!res.ok) throw new Error('TMDB search failed')
  const data = await res.json()
  // Keep this to actual Telugu-language productions, since that's the point
  // of the game — otherwise every search floods with unrelated results.
  return (data.results ?? [])
    .filter((r) => r.original_language === 'te' && r.title)
    .slice(0, 8)
    .map((r) => ({
      tmdbId: r.id,
      title: r.title,
      releaseYear: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
      posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
    }))
}

async function searchLocal(query) {
  const { data, error } = await supabase
    .from('movies')
    .select('id, title, telugu_title, release_year')
    .ilike('title', `%${query}%`)
    .limit(8)
  if (error) throw error
  return (data ?? []).map((m) => ({
    id: m.id, // already a local row — no resolve step needed
    title: m.title,
    releaseYear: m.release_year,
  }))
}

export default function MovieSearchInput({ onGuess, disabled, guessedMovies }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState(null)
  const boxRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const data = TMDB_KEY ? await searchTmdb(query.trim()) : await searchLocal(query.trim())
        setResults(data)
      } catch (e) {
        console.error(e)
        setResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Already-guessed movies are tracked by tmdbId when using TMDB search, or
  // by local id when falling back to the plain database search.
  const guessedKeys = new Set(guessedMovies.map((g) => (TMDB_KEY ? g.tmdbId : g.id)))
  const visibleResults = results.filter((r) => !guessedKeys.has(TMDB_KEY ? r.tmdbId : r.id))

  async function pick(result) {
    setOpen(false)
    setQuery('')
    setResults([])

    if (result.id) {
      // Local-search path: already a real row, nothing to resolve.
      onGuess({ id: result.id, title: result.title })
      return
    }

    // TMDB path: find-or-create the local row this title maps to, so the
    // guess can actually be compared against today's answer.
    setResolving(true)
    setError(null)
    try {
      const { data: localId, error: err } = await supabase.rpc('resolve_tmdb_movie', {
        p_tmdb_id: result.tmdbId,
        p_title: result.title,
        p_release_year: result.releaseYear,
        p_poster_url: result.posterUrl,
      })
      if (err) throw err
      onGuess({ id: localId, title: result.title, tmdbId: result.tmdbId })
    } catch (e) {
      console.error(e)
      setError('Could not submit that guess — try again.')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="search" ref={boxRef}>
      <input
        type="text"
        value={query}
        disabled={disabled || resolving}
        placeholder="Type a Telugu movie title&hellip;"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        aria-label="Search for a movie to guess"
      />
      {open && visibleResults.length > 0 && (
        <ul className="search__results">
          {visibleResults.map((r) => (
            <li key={r.tmdbId ?? r.id}>
              <button type="button" onClick={() => pick(r)} disabled={resolving}>
                <span className="search__title">{r.title}</span>
                {r.releaseYear && <span className="search__year">{r.releaseYear}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!TMDB_KEY && (
        <p className="hint search__hint">
          Add VITE_TMDB_API_KEY to .env for full-catalog search — right now this only searches
          movies you've added manually in Admin.
        </p>
      )}
      {error && <p className="status-line status-line--error">{error}</p>}
      {guessedMovies.length > 0 && (
        <ul className="search__history">
          {guessedMovies.map((g, i) => (
            <li key={g.id} className="guess-tile">
              <span className="guess-tile__frame">Frame {i + 1}</span>
              <span className="guess-tile__title">{g.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
