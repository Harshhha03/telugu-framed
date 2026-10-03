import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function ScheduleForm({ movies }) {
  const [movieId, setMovieId] = useState('')
  const [playDate, setPlayDate] = useState(todayIso())
  const [schedule, setSchedule] = useState([])
  const [error, setError] = useState(null)
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
    const { error: err } = await supabase
      .from('game_days')
      .upsert({ play_date: playDate, movie_id: movieId }, { onConflict: 'play_date' })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    await loadSchedule()
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
      </form>
      {error && <p className="status-line status-line--error">{error}</p>}

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
