import './style.css';
import { Game } from './game/engine';
import { showMenu, showGameOver, hideUI, UIHandlers, getSelectedPlayer } from './ui';
import { saveScore } from './leaderboard';
import { PlayerName } from './config';

const canvas = document.getElementById('game') as HTMLCanvasElement;

let currentPlayer: PlayerName | null = null;

const game = new Game(canvas, {
  onGameOver: (score, level) => void finish(score, level, false),
  onWin: (score) => void finish(score, 50, true),
});

async function finish(score: number, level: number, won: boolean) {
  game.stop();
  let isNewBest = false;
  if (currentPlayer) {
    isNewBest = await saveScore(currentPlayer, score, level);
  }
  showGameOver(handlers, currentPlayer ?? 'Hráč', score, level, isNewBest, won);
}

const handlers: UIHandlers = {
  onStart: (player) => {
    currentPlayer = player;
    hideUI();
    game.start();
  },
  onRestart: () => {
    hideUI();
    game.start();
  },
  onBackToMenu: () => {
    game.stop();
    showMenu(handlers);
  },
};

showMenu(handlers);

// Register service worker (PWA offline support) — production only
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  });
}
