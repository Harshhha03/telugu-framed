const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY
export const AUTO_FRAME_COUNT = 6

// TMDB doesn't know anything about "spoiler order" — these are just the
// stills it has catalogued for the movie. Sorting least-voted-first is a
// rough, imperfect heuristic: less-popular shots are more often an odd
// angle or minor scene rather than the single most iconic poster-ready
// shot, which gives a little bit of a reveal curve instead of none at all.
export async function fetchTmdbBackdrops(tmdbId, count = AUTO_FRAME_COUNT) {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/images?api_key=${TMDB_KEY}`)
  if (!res.ok) throw new Error('TMDB image lookup failed')
  const data = await res.json()

  return (data.backdrops ?? [])
    .slice()
    .sort((a, b) => (a.vote_count ?? 0) - (b.vote_count ?? 0))
    .slice(0, count)
    .map((b) => `https://image.tmdb.org/t/p/w780${b.file_path}`)
}
