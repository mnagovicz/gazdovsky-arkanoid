import { PLAYERS, PlayerName } from './config';
import { fetchLeaderboard, isSupabaseConnected } from './leaderboard';

export interface UIHandlers {
  onStart: (player: PlayerName) => void;
  onBackToMenu: () => void;
  onRestart: () => void;
}

const ui = () => document.getElementById('ui')!;

function el(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
}

let selectedPlayer: PlayerName | null = null;
export function getSelectedPlayer() {
  return selectedPlayer;
}

export function showMenu(handlers: UIHandlers) {
  const root = ui();
  root.innerHTML = '';
  const screen = el(`<div class="screen"></div>`);
  screen.appendChild(el(`<h1 class="title">Gazdovský<br/>arkanoid</h1>`));
  screen.appendChild(el(`<div class="subtitle">Kdo hraje? Vyber si své jméno:</div>`));

  const grid = el(`<div class="player-grid"></div>`);
  const startBtn = el(`<button class="btn primary" disabled style="opacity:.4">▶ Hrát</button>`) as HTMLButtonElement;

  for (const p of PLAYERS) {
    const btn = el(
      `<button class="player-btn" style="background:linear-gradient(160deg, ${p.color}, ${p.color}99)">${p.name}</button>`,
    ) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      selectedPlayer = p.name;
      grid.querySelectorAll('.player-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
    });
    grid.appendChild(btn);
  }
  screen.appendChild(grid);

  startBtn.addEventListener('click', () => {
    if (selectedPlayer) handlers.onStart(selectedPlayer);
  });
  screen.appendChild(startBtn);

  const lbBtn = el(`<button class="btn">🏆 Žebříček</button>`);
  lbBtn.addEventListener('click', () => showLeaderboard(handlers));
  screen.appendChild(lbBtn);

  screen.appendChild(
    el(`<div class="subtitle" style="font-size:13px">Drž levou / pravou polovinu obrazovky pro pohyb pádla.<br/>Ťuknutí = vypustit míček / střílet laser.</div>`),
  );
  root.appendChild(screen);
}

export async function showLeaderboard(handlers: UIHandlers, highlight?: string) {
  const root = ui();
  root.innerHTML = '';
  const screen = el(`<div class="screen"></div>`);
  screen.appendChild(el(`<h1 class="title" style="font-size:34px">🏆 Žebříček</h1>`));

  const list = el(`<div class="leaderboard-list"><div class="subtitle">Načítám…</div></div>`);
  screen.appendChild(list);

  const back = el(`<button class="btn ghost">← Zpět do menu</button>`);
  back.addEventListener('click', () => showMenu(handlers));
  screen.appendChild(back);
  root.appendChild(screen);

  const { entries, source } = await fetchLeaderboard();
  list.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉'];
  entries.forEach((e, i) => {
    const row = el(
      `<div class="leaderboard-row${e.name === highlight ? ' me' : ''}">
        <span class="rank">${medals[i] ?? `${i + 1}.`}</span>
        <span class="name">${e.name}</span>
        <span class="lvl">lvl ${e.level}</span>
        <span class="score">${e.score}</span>
      </div>`,
    );
    list.appendChild(row);
  });
  if (!isSupabaseConnected() || source === 'local') {
    screen.appendChild(
      el(`<div class="leaderboard-note">⚠️ Lokální žebříček (Supabase není připojený — doplň VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY do .env)</div>`),
    );
  }
}

export function showGameOver(
  handlers: UIHandlers,
  player: string,
  score: number,
  level: number,
  isNewBest: boolean,
  won: boolean,
) {
  const root = ui();
  root.innerHTML = '';
  const screen = el(`<div class="screen"></div>`);
  screen.appendChild(
    el(`<div class="gameover-title">${won ? '🎉 Vyhrál jsi!' : '💥 Konec hry'}</div>`),
  );
  screen.appendChild(el(`<div class="subtitle">${player} · level ${level}</div>`));
  screen.appendChild(el(`<div class="big-score">${score}</div>`));
  if (isNewBest) screen.appendChild(el(`<div class="newbest">✨ Nové osobní maximum! ✨</div>`));

  const again = el(`<button class="btn primary">↻ Hrát znovu</button>`);
  again.addEventListener('click', handlers.onRestart);
  const lb = el(`<button class="btn">🏆 Žebříček</button>`);
  lb.addEventListener('click', () => showLeaderboard(handlers, player));
  const menu = el(`<button class="btn ghost">← Menu</button>`);
  menu.addEventListener('click', handlers.onBackToMenu);
  screen.append(again, lb, menu);
  root.appendChild(screen);
}

export function hideUI() {
  ui().innerHTML = '';
}
