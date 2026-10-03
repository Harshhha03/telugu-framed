-- ============================================================
-- TELUGU FRAMED — Supabase schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

create table if not exists movies (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  telugu_title text,
  release_year int,
  tmdb_id int,
  poster_url text,
  created_at timestamptz not null default now()
);

-- A given TMDB movie should only ever map to one row here (partial index so
-- multiple manually-added movies with no tmdb_id are still allowed).
create unique index if not exists movies_tmdb_id_unique on movies (tmdb_id) where tmdb_id is not null;

create table if not exists frames (
  id uuid primary key default uuid_generate_v4(),
  movie_id uuid not null references movies(id) on delete cascade,
  frame_number int not null,
  image_url text not null,
  created_at timestamptz not null default now(),
  unique (movie_id, frame_number)
);

-- One movie per calendar date. This is the row that holds "today's answer".
create table if not exists game_days (
  id uuid primary key default uuid_generate_v4(),
  play_date date not null unique,
  movie_id uuid not null references movies(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists guesses (
  id uuid primary key default uuid_generate_v4(),
  game_day_id uuid not null references game_days(id) on delete cascade,
  session_id text not null,
  guess_movie_id uuid references movies(id),
  is_correct boolean not null,
  attempt_number int not null,
  created_at timestamptz not null default now()
);
create index if not exists guesses_lookup on guesses (game_day_id, session_id);

-- Admin allowlist. Add a row here (with the user's auth.users id) to grant
-- them write access to movies / frames / game_days. See README for how.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- security definer is required here: is_admin() is called from inside RLS
-- policies on other tables, evaluated as the querying (non-owner) role. The
-- admins table itself has RLS enabled with no select policy, so without
-- security definer this would always see zero rows and return false, even
-- for real admins.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = uid);
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table movies enable row level security;
alter table frames enable row level security;
alter table game_days enable row level security;
alter table guesses enable row level security;
alter table admins enable row level security;

-- movies: readable by everyone (a movie's existence isn't a spoiler on its
-- own — only game_days links a movie to a date), writable by admins only.
drop policy if exists "movies public read" on movies;
create policy "movies public read" on movies for select using (true);

drop policy if exists "movies admin write" on movies;
create policy "movies admin write" on movies for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- frames: NOT publicly readable — a frame row's movie_id would reveal the
-- answer. Frames are only ever served through the get_frame() RPC below.
drop policy if exists "frames admin all" on frames;
create policy "frames admin all" on frames for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- game_days: same reasoning — never expose directly.
drop policy if exists "game_days admin all" on game_days;
create policy "game_days admin all" on game_days for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- guesses: written only via the submit_guess() RPC (SECURITY DEFINER, so it
-- bypasses RLS on insert). Admins can read for a scoreboard later if wanted.
drop policy if exists "guesses admin read" on guesses;
create policy "guesses admin read" on guesses for select
  using (is_admin(auth.uid()));

-- admins: nobody reads/writes this from the client at all; manage it from
-- the Supabase dashboard/SQL editor only. (No policies = default deny.)

-- ------------------------------------------------------------
-- RPC functions — the only way the browser talks to game_days / frames
-- ------------------------------------------------------------

-- Basic info the game screen needs before any guess is made.
create or replace function public.get_today_meta()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movie_id uuid;
  v_total int;
begin
  select movie_id into v_movie_id from game_days where play_date = current_date;

  if v_movie_id is null then
    return json_build_object('has_game', false);
  end if;

  select count(*) into v_total from frames where movie_id = v_movie_id;

  return json_build_object('has_game', true, 'total_frames', v_total);
end;
$$;

-- Fetch a single frame's image by number, for today's movie only.
create or replace function public.get_frame(p_frame_number int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movie_id uuid;
  v_url text;
begin
  select movie_id into v_movie_id from game_days where play_date = current_date;
  if v_movie_id is null then
    return null;
  end if;

  select image_url into v_url from frames
  where movie_id = v_movie_id and frame_number = p_frame_number;

  return v_url;
end;
$$;

-- Restore a returning player's progress for today (attempts so far, whether
-- they've already won/lost, and the reveal if the round is over).
create or replace function public.get_session_progress(p_session_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_day_id uuid;
  v_movie_id uuid;
  v_total int;
  v_count int;
  v_solved boolean;
  v_movie json;
  v_guessed json;
begin
  select id, movie_id into v_game_day_id, v_movie_id
  from game_days where play_date = current_date;

  if v_game_day_id is null then
    return json_build_object('has_game', false);
  end if;

  select count(*) into v_total from frames where movie_id = v_movie_id;

  select count(*), coalesce(bool_or(is_correct), false)
  into v_count, v_solved
  from guesses where game_day_id = v_game_day_id and session_id = p_session_id;

  v_movie := null;
  if v_solved or v_count >= v_total then
    select json_build_object(
      'title', title, 'telugu_title', telugu_title,
      'release_year', release_year, 'poster_url', poster_url
    ) into v_movie from movies where id = v_movie_id;
  end if;

  -- Previously guessed movies this session, in order guessed. Lets the
  -- frontend restore the "already tried" chips/blocklist after a refresh.
  select coalesce(
    json_agg(json_build_object('id', m.id, 'title', m.title, 'tmdbId', m.tmdb_id) order by g.attempt_number),
    '[]'::json
  )
  into v_guessed
  from guesses g
  join movies m on m.id = g.guess_movie_id
  where g.game_day_id = v_game_day_id and g.session_id = p_session_id;

  return json_build_object(
    'has_game', true,
    'total_frames', v_total,
    'attempts', v_count,
    'solved', v_solved,
    'game_over', (v_count >= v_total and not v_solved),
    'movie', v_movie,
    'guessed_movies', v_guessed
  );
end;
$$;

-- Submit a guess. Returns the result without ever exposing the answer id
-- unless the round is actually over (won or out of frames).
create or replace function public.submit_guess(p_session_id text, p_movie_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_day_id uuid;
  v_answer_id uuid;
  v_total int;
  v_count int;
  v_solved boolean;
  v_is_correct boolean;
  v_movie json;
begin
  select id, movie_id into v_game_day_id, v_answer_id
  from game_days where play_date = current_date;

  if v_game_day_id is null then
    return json_build_object('error', 'no_game_today');
  end if;

  select count(*) into v_total from frames where movie_id = v_answer_id;

  select count(*), coalesce(bool_or(is_correct), false)
  into v_count, v_solved
  from guesses where game_day_id = v_game_day_id and session_id = p_session_id;

  if v_solved or v_count >= v_total then
    return json_build_object('error', 'already_finished');
  end if;

  v_is_correct := (p_movie_id = v_answer_id);

  insert into guesses (game_day_id, session_id, guess_movie_id, is_correct, attempt_number)
  values (v_game_day_id, p_session_id, p_movie_id, v_is_correct, v_count + 1);

  v_movie := null;
  if v_is_correct or (v_count + 1) >= v_total then
    select json_build_object(
      'title', title, 'telugu_title', telugu_title,
      'release_year', release_year, 'poster_url', poster_url
    ) into v_movie from movies where id = v_answer_id;
  end if;

  return json_build_object(
    'attempt_number', v_count + 1,
    'is_correct', v_is_correct,
    'total_frames', v_total,
    'game_over', (not v_is_correct and (v_count + 1) >= v_total),
    'movie', v_movie
  );
end;
$$;

-- Turn a TMDB search result into a local movie row, so players can guess
-- from the whole TMDB catalog without an admin pre-typing every title.
-- Looks up by tmdb_id first (so this naturally reuses the exact row an
-- admin already created when scheduling a movie — that's what makes a
-- correct guess actually match), and only inserts if truly new.
create or replace function public.resolve_tmdb_movie(
  p_tmdb_id int,
  p_title text,
  p_release_year int default null,
  p_poster_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from movies where tmdb_id = p_tmdb_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into movies (title, release_year, poster_url, tmdb_id)
  values (p_title, p_release_year, p_poster_url, p_tmdb_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- Let any client call these RPCs (RLS on the underlying tables still applies
-- to everything that ISN'T going through a SECURITY DEFINER function).
grant execute on function public.get_today_meta() to anon, authenticated;
grant execute on function public.get_frame(int) to anon, authenticated;
grant execute on function public.get_session_progress(text) to anon, authenticated;
grant execute on function public.submit_guess(text, uuid) to anon, authenticated;
grant execute on function public.resolve_tmdb_movie(int, text, int, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Storage bucket for frame images
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('frames', 'frames', true)
on conflict (id) do nothing;

drop policy if exists "frame images public read" on storage.objects;
create policy "frame images public read" on storage.objects for select
  using (bucket_id = 'frames');

drop policy if exists "frame images admin write" on storage.objects;
create policy "frame images admin write" on storage.objects for insert
  with check (bucket_id = 'frames' and is_admin(auth.uid()));

drop policy if exists "frame images admin update" on storage.objects;
create policy "frame images admin update" on storage.objects for update
  using (bucket_id = 'frames' and is_admin(auth.uid()));

drop policy if exists "frame images admin delete" on storage.objects;
create policy "frame images admin delete" on storage.objects for delete
  using (bucket_id = 'frames' and is_admin(auth.uid()));
