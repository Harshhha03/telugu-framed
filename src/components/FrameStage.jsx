export default function FrameStage({ frameUrls, totalFrames, revealed }) {
  const current = frameUrls[frameUrls.length - 1]

  return (
    <div className="stage">
      <div className="stage__sprockets stage__sprockets--left" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="stage__frame">
        {current ? (
          <img src={current} alt={revealed ? 'Revealed movie still' : 'Guess the film from this still'} />
        ) : (
          <div className="stage__placeholder">Loading today's still&hellip;</div>
        )}
      </div>

      <div className="stage__sprockets stage__sprockets--right" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="stage__reel" role="img" aria-label={`Frame ${frameUrls.length} of ${totalFrames}`}>
        {Array.from({ length: totalFrames }).map((_, i) => (
          <span key={i} className={i < frameUrls.length ? 'is-shown' : ''} />
        ))}
      </div>
    </div>
  )
}
