# Telugu Framed

A daily Telugu-cinema guessing game: one movie a day, revealed one still at a
time. Players search and guess a title; a wrong guess reveals the next frame.

Stack: React + Vite frontend, Supabase (Postgres + Auth + Storage) backend,
no separate server to run — Supabase is called directly from the browser
using Postgres functions (RPCs) that keep the answer hidden until a round
is actually won or lost.

## 1. Create a Supabase project

1. Go to https://supabase.com, create a free project.
2. In the SQL editor, paste the entire contents of `supabase/schema.sql` and
   run it. This creates every table, security policy, RPC function, and the
   public `frames` storage bucket.
3. In **Project Settings → API**, copy the **Project URL** and **anon public
   key**.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.

`VITE_TMDB_API_KEY` is now effectively required: it's what lets players
search and guess from TMDB's whole movie catalog, instead of only being able
to guess titles you've manually typed into the admin panel. Get a free key
at https://www.themoviedb.org/settings/api ("API Read Access Token" page —
you want the plain v3 **API Key**, not the Bearer token). Without this key
set, the search box falls back to only searching movies already in your own
`movies` table.

## 3. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` for the game, `/admin` for the dashboard.

## 4. Create your admin account

The admin dashboard needs one real login. This project deliberately keeps
`admins` un-writable from the client, so you set it up once by hand:

1. Supabase dashboard → **Authentication → Users → Add user**. Create
   yourself an email + password.
2. Copy that user's **UID** (shown in the users table).
3. Back in the SQL editor:
   ```sql
   insert into admins (user_id) values ('paste-the-uid-here');
   ```
4. Sign in at `/admin` with that email/password.

You can add more admins the same way.

## 5. Add today's (and future) movies

From `/admin`:

1. **Add a movie** — title, Telugu title, year, poster URL. **Always use the
   "Look up on TMDB" button and pick the matching result**, rather than
   typing the title in by hand. This matters more than it sounds: a
   player's guess gets matched to a TMDB id, not just a title string, so if
   today's answer wasn't created from that same TMDB id, a correct guess
   can never register as correct. (A movie added without a TMDB id still
   works fine — it just can't be *guessed*, which only matters for the one
   movie scheduled as the day's answer.)
2. **Frames** — pick that movie, upload stills in the order you want them
   revealed (least-revealing first, most-revealing last). There's no fixed
   count — upload as many as you like; that number becomes the round's
   total frame count.
3. **Schedule** — assign the movie to a date. One movie per date; setting a
   new movie on a date that already has one replaces it.

The site always shows whatever movie is scheduled for **today's date**
(server time, i.e. Supabase/Postgres's `current_date`). Nothing needs to run
at midnight — the next scheduled row just becomes "today" automatically.
Add several days ahead of time if you want a buffer.

## How the "no spoilers in the network tab" part works

A common bug in guessing-game clones: the frontend fetches "today's movie
row" directly, which means the answer sits in a network response before
anyone has guessed anything. This project avoids that by never exposing
`game_days` or `frames` to anonymous users directly (Row Level Security
blocks it outright). Instead, the browser only ever calls four Postgres
functions (`get_today_meta`, `get_frame`, `get_session_progress`,
`submit_guess`), each of which decides server-side exactly how much to
reveal — the movie's identity is only included in a response once the
round is actually won or exhausted.

## How guessing against the full TMDB catalog works

The search box calls TMDB directly as you type (filtered to
`original_language === 'te'`, i.e. actual Telugu productions). Nothing is
written to your database just from searching. Only when a player actually
picks a result does the app call a `resolve_tmdb_movie` function, which
looks up a local `movies` row by `tmdb_id` — reusing it if one already
exists (e.g. because that's today's scheduled movie), or creating a
lightweight new row if not. That local row's id is what actually gets
compared against the day's answer. This is also why admin-added movies
should go through the TMDB lookup button: it's what gives the row a
`tmdb_id` to match against.

## Notes / things to extend later

- Player identity is just a random id in `localStorage` — good enough for a
  daily-attempt limit, but it means progress doesn't follow you across
  devices/browsers. Add real auth later if you want that.
- There's a `guesses` table with an admin-only read policy already in
  place, so a stats/leaderboard view is a matter of adding queries, not
  schema changes.
- Deploy the built site (`npm run build`) anywhere that serves static
  files — Vercel, Netlify, Cloudflare Pages all work with zero config
  beyond setting the same two `VITE_SUPABASE_*` env vars.
