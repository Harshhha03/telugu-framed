import { useState } from 'react'

function buildShareText({ won, attempts, totalFrames }) {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  // One square per frame: red for a wrong guess, green for the winning
  // guess, white for frames never reached.
  const squares = Array.from({ length: totalFrames }, (_, i) => {
    const frameNumber = i + 1
    if (won && frameNumber < attempts) return '🟥'
    if (won && frameNumber === attempts) return '🟩'
    if (!won && frameNumber <= attempts) return '🟥'
    return '⬜'
  }).join('')

  const scoreLabel = won ? `${attempts}/${totalFrames}` : `X/${totalFrames}`

  return `తెలుగు FRAMED — ${dateLabel}\n${scoreLabel}\n${squares}`
}

export default function ResultBanner({ won, movie, attempts, totalFrames }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const text = buildShareText({ won, attempts, totalFrames })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be unavailable (older browsers, non-HTTPS origins).
      // Fall back to a prompt so the text is still selectable/copyable by hand.
      window.prompt('Copy your result:', text)
    }
  }

  return (
    <div className={`result ${won ? 'result--won' : 'result--lost'}`}>
      <p className="result__kicker">{won ? 'Nailed it' : 'Out of frames'}</p>
      <h2 className="result__title">
        {movie?.title}
        {movie?.telugu_title ? <span className="result__telugu"> · {movie.telugu_title}</span> : null}
      </h2>
      {movie?.release_year && <p className="result__year">{movie.release_year}</p>}
      <p className="result__meta">
        {won
          ? `Guessed in ${attempts} of ${totalFrames} frame${totalFrames === 1 ? '' : 's'}.`
          : `The answer took all ${totalFrames} frames to reveal.`}
      </p>
      <button type="button" className="result__share" onClick={handleShare}>
        {copied ? 'Copied!' : 'Share result'}
      </button>
      <p className="result__next">New film tomorrow at midnight.</p>
    </div>
  )
}
