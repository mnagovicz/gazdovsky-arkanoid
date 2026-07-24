-- Gazdovský arkanoid — Supabase schema
-- Spusť v Supabase SQL editoru (https://supabase.com/dashboard → SQL Editor).

create table if not exists public.leaderboard (
  name        text primary key,
  score       integer not null default 0,
  level       integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- Naplnění všech 7 hráčů, aby žebříček vždy ukazoval kompletní rodinu
insert into public.leaderboard (name) values
  ('Táta'), ('Máma'), ('Laura'), ('Honza'), ('Maty'), ('Tobi'), ('Miku')
on conflict (name) do nothing;

-- RLS: hra běží s anon klíčem → povolíme čtení všem a zápis pouze "zlepšení" skóre
alter table public.leaderboard enable row level security;

create policy "leaderboard_select_all"
  on public.leaderboard for select
  using (true);

create policy "leaderboard_insert_anon"
  on public.leaderboard for insert
  with check (true);

-- Update povolen jen pokud nové skóre překoná stávající (ochrana proti přepsání horším)
create policy "leaderboard_update_only_better"
  on public.leaderboard for update
  using (true)
  with check (score >= (select l.score from public.leaderboard l where l.name = leaderboard.name));

-- Pozn.: upsert z klienta používá onConflict: 'name'.
-- Pro větší bezpečnost lze místo přímého update použít RPC funkci s logikou na serveru.
