import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PLAYERS } from './config';

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  updated_at?: string;
}

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabase: SupabaseClient | null = null;
if (URL && KEY) {
  supabase = createClient(URL, KEY);
}

export const isSupabaseConnected = () => supabase !== null;

// ---------- local fallback (offline / before Supabase is configured) ----------
const LS_KEY = 'gazdovsky-arkanoid-leaderboard';

function localRead(): LeaderboardEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function localWrite(entries: LeaderboardEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

// ---------- public API ----------

/** Fetch best score per player, sorted desc. Always returns all 7 players (missing = 0). */
export async function fetchLeaderboard(): Promise<{
  entries: LeaderboardEntry[];
  source: 'supabase' | 'local';
}> {
  let rows: LeaderboardEntry[] = [];
  let source: 'supabase' | 'local' = 'local';

  if (supabase) {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('name, score, level, updated_at');
    if (!error && data) {
      rows = data as LeaderboardEntry[];
      source = 'supabase';
    } else {
      console.warn('Supabase fetch failed, falling back to local:', error?.message);
      rows = localRead();
    }
  } else {
    rows = localRead();
  }

  // ensure all family members appear
  const byName = new Map(rows.map((r) => [r.name, r]));
  const entries = PLAYERS.map(
    (p) => byName.get(p.name) ?? { name: p.name, score: 0, level: 0 },
  );
  entries.sort((a, b) => b.score - a.score);
  return { entries, source };
}

/**
 * Save score — only if it beats the player's current best (upsert on name).
 * Returns true if it was a new personal best.
 */
export async function saveScore(name: string, score: number, level: number): Promise<boolean> {
  const { entries } = await fetchLeaderboard();
  const current = entries.find((e) => e.name === name)?.score ?? 0;
  if (score <= current) return false;

  const entry: LeaderboardEntry = {
    name,
    score,
    level,
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    const { error } = await supabase
      .from('leaderboard')
      .upsert(entry, { onConflict: 'name' });
    if (error) {
      console.warn('Supabase upsert failed, saving locally:', error.message);
    }
  }

  // always mirror to local storage (offline cache of best scores)
  const local = localRead();
  const idx = local.findIndex((e) => e.name === name);
  if (idx >= 0) local[idx] = entry;
  else local.push(entry);
  localWrite(local);

  return true;
}
