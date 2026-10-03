import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { getSessionId } from '../lib/session'

const STATUS = {
  LOADING: 'loading',
  NO_GAME: 'no_game',
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
  ERROR: 'error',
}

export function useTodaysGame() {
  const [status, setStatus] = useState(STATUS.LOADING)
  const [totalFrames, setTotalFrames] = useState(0)
  const [frameUrls, setFrameUrls] = useState([]) // revealed frames, in order
  const [attempts, setAttempts] = useState(0)
  const [movie, setMovie] = useState(null)
  const [guessedMovies, setGuessedMovies] = useState([]) // [{id, title}], in guess order
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const sessionId = supabaseConfigured ? getSessionId() : null

  const loadFrame = useCallback(async (frameNumber) => {
    const { data, error: err } = await supabase.rpc('get_frame', { p_frame_number: frameNumber })
    if (err) throw err
    return data
  }, [])

  const bootstrap = useCallback(async () => {
    if (!supabaseConfigured) {
      setStatus(STATUS.ERROR)
      setError('Supabase is not configured yet. See the README to set up your .env file.')
      return
    }

    setStatus(STATUS.LOADING)
    try {
      const { data: progress, error: err } = await supabase.rpc('get_session_progress', {
        p_session_id: sessionId,
      })
      if (err) throw err

      if (!progress?.has_game) {
        setStatus(STATUS.NO_GAME)
        return
      }

      setTotalFrames(progress.total_frames)
      setAttempts(progress.attempts)
      setGuessedMovies(progress.guessed_movies ?? [])

      const framesToShow = Math.max(1, Math.min(progress.attempts + 1, progress.total_frames))
      const urls = []
      for (let n = 1; n <= framesToShow; n++) {
        urls.push(await loadFrame(n))
      }
      setFrameUrls(urls)

      if (progress.solved) {
        setMovie(progress.movie)
        setStatus(STATUS.WON)
      } else if (progress.game_over) {
        setMovie(progress.movie)
        setStatus(STATUS.LOST)
      } else {
        setStatus(STATUS.PLAYING)
      }
    } catch (e) {
      console.error(e)
      setStatus(STATUS.ERROR)
      setError(e.message ?? 'Something went wrong loading today\'s game.')
    }
  }, [loadFrame, sessionId])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const submitGuess = useCallback(
    async (guessedMovie) => {
      if (submitting) return
      // Defense in depth: MovieSearchInput already filters these out of its
      // suggestions, but guard here too in case of a stale list.
      if (guessedMovies.some((g) => g.id === guessedMovie.id)) return

      setSubmitting(true)
      try {
        const { data, error: err } = await supabase.rpc('submit_guess', {
          p_session_id: sessionId,
          p_movie_id: guessedMovie.id,
        })
        if (err) throw err
        if (data?.error) throw new Error(data.error)

        setAttempts(data.attempt_number)
        setGuessedMovies((prev) => [
          ...prev,
          { id: guessedMovie.id, title: guessedMovie.title, tmdbId: guessedMovie.tmdbId },
        ])

        if (!data.is_correct && !data.game_over) {
          const nextFrame = await loadFrame(data.attempt_number + 1)
          setFrameUrls((prev) => [...prev, nextFrame])
        }

        if (data.is_correct) {
          setMovie(data.movie)
          setStatus(STATUS.WON)
        } else if (data.game_over) {
          setMovie(data.movie)
          setStatus(STATUS.LOST)
        }

        return data
      } catch (e) {
        console.error(e)
        setError(e.message ?? 'Could not submit that guess.')
      } finally {
        setSubmitting(false)
      }
    },
    [guessedMovies, loadFrame, sessionId, submitting]
  )

  return {
    status,
    totalFrames,
    frameUrls,
    attempts,
    movie,
    guessedMovies,
    error,
    submitting,
    submitGuess,
    STATUS,
  }
}
