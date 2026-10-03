import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY

async function searchTmdb(query) {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}&include_adult=false`
  )
  if (!res.ok) {
    if (res.status === 429) throw new Error('TMDB rate limit hit — wait a few seconds and try again.')
    throw new Error(`TMDB search failed (HTTP ${res.status})`)
  }
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
    id: m.id, // already a local row — resolved as-is, no tmdbId round trip needed
    title: m.title,
    releaseYear: m.release_year,
  }))
}

export default function MovieSearchInput({ onGuess, disabled, guessedMovies }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searchError, setSearchError] = useState(null)
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
      setSearchError(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const data = TMDB_KEY ? await searchTmdb(query.trim()) : await searchLocal(query.trim())
        setResults(data)
        setSearchError(null)
      } catch (e) {
        console.error(e)
        setResults([])
        setSearchError(e.message ?? 'Could not load suggestions.')
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Already-guessed movies are tracked by tmdbId when using TMDB search, or
  // by local id when falling back to the plain database search.
  const guessedKeys = new Set(guessedMovies.map((g) => (TMDB_KEY ? g.tmdbId : g.id)))
  const visibleResults = results.filter((r) => !guessedKeys.has(TMDB_KEY ? r.tmdbId : r.id))

  function pick(result) {
    setOpen(false)
    setQuery('')
    setResults([])
    // No resolve step here anymore — the hook submits this straight to the
    // server (which resolves-or-creates the local row AND records the guess
    // in one call) rather than us doing a separate round trip first.
    onGuess(result)
  }

  return (
    <div className="search" ref={boxRef}>
      <input
        type="text"
        value={query}
        disabled={disabled}
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
              <button type="button" onClick={() => pick(r)} disabled={disabled}>
                <span className="search__title">{r.title}</span>
                {r.releaseYear && <span className="search__year">{r.releaseYear}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searchError && <p className="status-line status-line--error search__hint">{searchError}</p>}
      {!TMDB_KEY && (
        <p className="hint search__hint">
          Add VITE_TMDB_API_KEY to .env for full-catalog search — right now this only searches
          movies you've added manually in Admin.
        </p>
      )}
      {guessedMovies.length > 0 && (
        <ul className="search__history">
          {guessedMovies.map((g, i) => (
            <li key={g.tmdbId ?? g.id} className="guess-tile">
              <span className="guess-tile__frame">Frame {i + 1}</span>
              <span className="guess-tile__title">{g.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
