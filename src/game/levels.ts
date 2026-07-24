import { BRICK_COLS } from '../config';

export interface BrickDef {
  col: number;
  row: number;
  hp: number; // 1..5
}

/** Deterministic seeded RNG so every player sees the same level layouts. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pattern = (
  cells: (number | null)[][],
  rows: number,
  rng: () => number,
  maxHp: number,
) => void;

const patterns: Pattern[] = [
  // full rows with hp gradient
  (cells, rows, rng, maxHp) => {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < BRICK_COLS; c++)
        cells[r][c] = 1 + Math.min(maxHp - 1, Math.floor((r / Math.max(1, rows - 1)) * maxHp));
  },
  // checkerboard
  (cells, rows, rng, maxHp) => {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < BRICK_COLS; c++)
        if ((r + c) % 2 === 0) cells[r][c] = 1 + Math.floor(rng() * maxHp);
  },
  // pyramid
  (cells, rows, rng, maxHp) => {
    for (let r = 0; r < rows; r++) {
      const inset = Math.floor(r / 2);
      for (let c = inset; c < BRICK_COLS - inset; c++)
        cells[r][c] = Math.min(maxHp, 1 + inset + (rng() < 0.25 ? 1 : 0));
    }
  },
  // vertical columns with gaps
  (cells, rows, rng, maxHp) => {
    for (let c = 0; c < BRICK_COLS; c++) {
      if (c % 3 === 1 && rows > 3) continue;
      for (let r = 0; r < rows; r++) cells[r][c] = 1 + Math.floor(rng() * maxHp);
    }
  },
  // diamond
  (cells, rows, rng, maxHp) => {
    const mid = (BRICK_COLS - 1) / 2;
    for (let r = 0; r < rows; r++) {
      const half = Math.min(mid, r * 1.2 + 1);
      for (let c = 0; c < BRICK_COLS; c++)
        if (Math.abs(c - mid) <= half) cells[r][c] = Math.min(maxHp, 1 + Math.floor(half - Math.abs(c - mid)));
    }
  },
  // scattered clusters
  (cells, rows, rng, maxHp) => {
    const clusters = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < clusters; i++) {
      const cr = Math.floor(rng() * rows);
      const cc = Math.floor(rng() * BRICK_COLS);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = cr + dr;
          const c = cc + dc;
          if (r >= 0 && r < rows && c >= 0 && c < BRICK_COLS && rng() < 0.8)
            cells[r][c] = 1 + Math.floor(rng() * maxHp);
        }
    }
  },
  // horizontal stripes with holes
  (cells, rows, rng, maxHp) => {
    for (let r = 0; r < rows; r += 2) {
      const hole = Math.floor(rng() * BRICK_COLS);
      for (let c = 0; c < BRICK_COLS; c++)
        if (c !== hole) cells[r][c] = 1 + Math.floor(rng() * maxHp);
    }
  },
  // zigzag
  (cells, rows, rng, maxHp) => {
    for (let r = 0; r < rows; r++) {
      const start = r % 2 === 0 ? 0 : 2;
      for (let c = start; c < BRICK_COLS; c += 3) cells[r][c] = 1 + Math.floor(rng() * maxHp);
      // sprinkle extra on higher levels
      if (rng() < 0.5) {
        const c = Math.floor(rng() * BRICK_COLS);
        cells[r][c] = 1 + Math.floor(rng() * maxHp);
      }
    }
  },
  // frame / border
  (cells, rows, rng, maxHp) => {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < BRICK_COLS; c++) {
        const edge = r === 0 || c === 0 || c === BRICK_COLS - 1;
        const inner = (r + c) % 3 === 0;
        if (edge || inner) cells[r][c] = edge ? maxHp : 1 + Math.floor(rng() * maxHp);
      }
  },
  // waves
  (cells, rows, rng, maxHp) => {
    for (let c = 0; c < BRICK_COLS; c++) {
      const h = Math.round((Math.sin(c * 0.9) * 0.5 + 0.5) * (rows - 1));
      for (let r = 0; r <= h && r < rows; r++) cells[r][c] = 1 + Math.floor(rng() * maxHp);
    }
  },
];

/**
 * Generate level `n` (1-based, 1..50). Difficulty scales across ALL 50 levels:
 *  - rows ramp smoothly 4 → 14 (was capped at 11 already on level 29)
 *  - brick toughness in 5 tiers 1..5 hp (was hard-capped at 3 from level 16)
 *  - ball speed grows linearly, then accelerates after level 30 (330 → 780)
 *  - density ramps up to 0.97 (keeps growing until the very end)
 *  - every 10th level (10/20/30/40/50) is a "boss" milestone: +1 row,
 *    +1 maxHp, near-full density, always 2 layered patterns
 *  - late levels layer up to 3 patterns for more visual variety
 */
export function generateLevel(n: number): {
  bricks: BrickDef[];
  ballSpeed: number;
  ballRadius: number;
} {
  const rng = mulberry32(n * 7919 + 13);
  const boss = n % 10 === 0;

  // rows: smooth ramp 4 → 14 over the full 50-level range
  let rows = 4 + Math.ceil(((n - 1) / 49) * 10);
  if (boss) rows = Math.min(rows + 1, 14);

  // brick toughness tiers (engine has colors/score for hp 1..5)
  let maxHp = n < 6 ? 1 : n < 15 ? 2 : n < 25 ? 3 : n < 35 ? 4 : 5;
  if (boss) maxHp = Math.min(maxHp + 1, 5);

  // density keeps growing until the final levels
  let density = Math.min(0.6 + n * 0.0075, 0.97);
  if (boss) density = Math.min(density + 0.1, 0.98);

  const cells: (number | null)[][] = Array.from({ length: rows }, () =>
    Array(BRICK_COLS).fill(null),
  );

  // 1-3 patterns layered for variety (bosses always get at least 2)
  const p1 = patterns[Math.floor(rng() * patterns.length)];
  p1(cells, rows, rng, maxHp);
  const want2 = boss || (n > 8 && rng() < Math.min(0.25 + n * 0.012, 0.75));
  if (want2) {
    const p2 = patterns[Math.floor(rng() * patterns.length)];
    p2(cells, rows, rng, maxHp);
  }
  if (n > 25 && rng() < Math.min(0.1 + (n - 25) * 0.02, 0.6)) {
    const p3 = patterns[Math.floor(rng() * patterns.length)];
    p3(cells, rows, rng, maxHp);
  }

  // density filter (keeps early levels sparse)
  const bricks: BrickDef[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < BRICK_COLS; c++) {
      const hp = cells[r][c];
      if (hp !== null && rng() < density) {
        // tougher bricks appear deeper into the game, top rows hardest;
        // the bump chance grows with level
        const bump = n > 15 && r < rows / 3 && rng() < Math.min(0.15 + n * 0.008, 0.55) ? 1 : 0;
        const tough = Math.min(maxHp, Math.max(1, hp + bump));
        bricks.push({ col: c, row: r, hp: tough });
      }
    }

  // guarantee a playable minimum
  if (bricks.length < 6) {
    for (let c = 0; c < BRICK_COLS && bricks.length < 8; c += 2)
      bricks.push({ col: c, row: 0, hp: 1 });
  }

  // speed: linear early, accelerating after level 30
  const ballSpeed = Math.min(330 + (n - 1) * 7 + (n > 30 ? (n - 30) * 9 : 0), 780);
  const ballRadius = Math.max(7 - Math.floor((n - 1) / 10), 5);

  return { bricks, ballSpeed, ballRadius };
}
