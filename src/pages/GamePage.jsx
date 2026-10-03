import { Link } from 'react-router-dom'
import { useTodaysGame } from '../hooks/useTodaysGame'
import FrameStage from '../components/FrameStage'
import MovieSearchInput from '../components/MovieSearchInput'
import ResultBanner from '../components/ResultBanner'

export default function GamePage() {
  const {
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
  } = useTodaysGame()

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="wordmark">
          <span className="wordmark__te">తెలుగు</span> FRAMED
        </h1>
        <p className="tagline">One film. One frame at a time.</p>
      </header>

      <main className="game">
        {status === STATUS.LOADING && <p className="status-line">Rolling today's reel&hellip;</p>}

        {status === STATUS.NO_GAME && (
          <p className="status-line">
            No film is scheduled for today yet. Check back after midnight — or, if this is your site,
            add one from <Link to="/admin">the admin dashboard</Link>.
          </p>
        )}

        {status === STATUS.ERROR && <p className="status-line status-line--error">{error}</p>}

        {(status === STATUS.PLAYING || status === STATUS.WON || status === STATUS.LOST) && (
          <>
            <FrameStage
              frameUrls={frameUrls}
              totalFrames={totalFrames}
              revealed={status !== STATUS.PLAYING}
            />

            {status === STATUS.PLAYING && (
              <MovieSearchInput onGuess={submitGuess} disabled={submitting} guessedMovies={guessedMovies} />
            )}

            {(status === STATUS.WON || status === STATUS.LOST) && (
              <ResultBanner
                won={status === STATUS.WON}
                movie={movie}
                attempts={attempts}
                totalFrames={totalFrames}
              />
            )}

            {error && status === STATUS.PLAYING && <p className="status-line status-line--error">{error}</p>}
          </>
        )}
      </main>

      <footer className="footer">
        <Link to="/admin">Admin</Link>
      </footer>
    </div>
  )
}
