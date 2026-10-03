import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function FrameManager({ movies }) {
  const [movieId, setMovieId] = useState('')
  const [frames, setFrames] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!movieId) {
      setFrames([])
      return
    }
    loadFrames(movieId)
  }, [movieId])

  async function loadFrames(id) {
    const { data, error: err } = await supabase
      .from('frames')
      .select('*')
      .eq('movie_id', id)
      .order('frame_number', { ascending: true })
    if (err) setError(err.message)
    else setFrames(data ?? [])
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !movieId) return
    setUploading(true)
    setError(null)

    const nextNumber = frames.length + 1
    const path = `${movieId}/frame-${nextNumber}-${Date.now()}.${file.name.split('.').pop()}`

    const { error: uploadErr } = await supabase.storage.from('frames').upload(path, file)
    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }

    const { data: pub } = supabase.storage.from('frames').getPublicUrl(path)

    const { error: insertErr } = await supabase.from('frames').insert({
      movie_id: movieId,
      frame_number: nextNumber,
      image_url: pub.publicUrl,
    })
    if (insertErr) setError(insertErr.message)
    else await loadFrames(movieId)

    setUploading(false)
    e.target.value = ''
  }

  async function removeFrame(frame) {
    await supabase.from('frames').delete().eq('id', frame.id)
    await loadFrames(movieId)
  }

  return (
    <div className="admin-card">
      <h3>Frames</h3>
      <label>
        Movie
        <select value={movieId} onChange={(e) => setMovieId(e.target.value)}>
          <option value="">Choose a movie…</option>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} {m.release_year ? `(${m.release_year})` : ''}
            </option>
          ))}
        </select>
      </label>

      {movieId && (
        <>
          <ol className="frame-list">
            {frames.map((f) => (
              <li key={f.id}>
                <img src={f.image_url} alt={`Frame ${f.frame_number}`} />
                <span>Frame {f.frame_number}</span>
                <button type="button" className="secondary" onClick={() => removeFrame(f)}>
                  Remove
                </button>
              </li>
            ))}
          </ol>

          <label className="upload-btn">
            {uploading ? 'Uploading…' : `Upload frame ${frames.length + 1}`}
            <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} hidden />
          </label>
          <p className="hint">Upload in the order you want them revealed — least revealing first.</p>
        </>
      )}

      {error && <p className="status-line status-line--error">{error}</p>}
    </div>
  )
}
