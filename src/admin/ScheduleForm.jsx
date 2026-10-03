import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTmdbBackdrops } from '../lib/tmdbFrames'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// Only touches frames if this movie has none yet — never overwrites frames
// you (or a previous auto-fill) already set up.
async function ensureFramesExist(movie) {
  const { count, error: countErr } = await supabase
    .from('frames')
    .select('id', { count: 'exact', head: true })
    .eq('movie_id', movie.id)
  if (countErr) throw countErr
  if ((count ?? 0) > 0) return { added: 0 }

  if (!movie.tmdb_id) {
    throw new Error(
      `"${movie.title}" has no TMDB link, so frames can't be auto-fetched. Re-add it using the ` +
        `"Look up on TMDB" button, or upload frames manually in the Frames panel.`
    )
  }

  const urls = await fetchTmdbBackdrops(movie.tmdb_id)
  if (urls.length === 0) {
    throw new Error(`TMDB has no usable images for "${movie.title}" — add frames manually instead.`)
  }

  const rows = urls.map((image_url, i) => ({ movie_id: movie.id, frame_number: i + 1, image_url }))
  const { error: insertErr } = await supabase.from('frames').insert(rows)
  if (insertErr) throw insertErr
  return { added: rows.length }
}

export default function ScheduleForm({ movies }) {
  const [movieId, setMovieId] = useState('')
  const [playDate, setPlayDate] = useState(todayIso())
  const [schedule, setSchedule] = useState([])
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSchedule()
  }, [])

  async function loadSchedule() {
    const { data, error: err } = await supabase
      .from('game_days')
      .select('id, play_date, movie_id, movies(title)')
      .order('play_date', { ascending: true })
      .gte('play_date', todayIso())
    if (!err) setSchedule(data ?? [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const movie = movies.find((m) => m.id === movieId)
      const frameResult = await ensureFramesExist(movie)

      const { error: err } = await supabase
        .from('game_days')
        .upsert({ play_date: playDate, movie_id: movieId }, { onConflict: 'play_date' })
      if (err) throw err

      setInfo(
        frameResult.added > 0
          ? `Scheduled — added ${frameResult.added} frames automatically from TMDB.`
          : 'Scheduled (this movie already had frames, so those were left as-is).'
      )
      await loadSchedule()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-card">
      <h3>Schedule</h3>
      <form onSubmit={handleSubmit} className="schedule-form">
        <label>
          Date
          <input type="date" value={playDate} onChange={(e) => setPlayDate(e.target.value)} required />
        </label>
        <label>
          Movie
          <select value={movieId} onChange={(e) => setMovieId(e.target.value)} required>
            <option value="">Choose a movie…</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} {m.release_year ? `(${m.release_year})` : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Set for this date'}
        </button>
        <p className="hint">
          Frames are added automatically from TMDB the first time a movie is scheduled — no manual
          upload needed unless you want to replace them (Frames panel, below).
        </p>
      </form>
      {error && <p className="status-line status-line--error">{error}</p>}
      {info && <p className="hint" style={{ color: 'var(--green)' }}>{info}</p>}

      <table className="schedule-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Movie</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((row) => (
            <tr key={row.id}>
              <td>{row.play_date}</td>
              <td>{row.movies?.title}</td>
            </tr>
          ))}
          {schedule.length === 0 && (
            <tr>
              <td colSpan={2}>Nothing scheduled yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
