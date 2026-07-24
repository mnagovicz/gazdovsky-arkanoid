import { BRICK_COLS } from '../config';

export interface BrickDef {
  col: number;
  row: number;
  hp: number; // 1..3
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
 * Generate level `n` (1-based, 1..50). Difficulty scales:
 *  - more rows of bricks
 *  - tougher bricks (more multi-hit)
 *  - faster, slightly smaller ball (handled by engine via ballSpeed/ballRadius)
 *  - denser, more varied patterns
 */
export function generateLevel(n: number): {
  bricks: BrickDef[];
  ballSpeed: number;
  ballRadius: number;
} {
  const rng = mulberry32(n * 7919 + 13);

  const rows = Math.min(4 + Math.floor((n - 1) / 4), 11);
  const maxHp = n < 6 ? 1 : n < 16 ? 2 : 3;
  const density = Math.min(0.62 + n * 0.008, 0.95);

  const cells: (number | null)[][] = Array.from({ length: rows }, () =>
    Array(BRICK_COLS).fill(null),
  );

  // 1-2 patterns layered for variety
  const p1 = patterns[Math.floor(rng() * patterns.length)];
  p1(cells, rows, rng, maxHp);
  if (n > 8 && rng() < Math.min(0.25 + n * 0.012, 0.7)) {
    const p2 = patterns[Math.floor(rng() * patterns.length)];
    p2(cells, rows, rng, maxHp);
  }

  // density filter (keeps early levels sparse)
  const bricks: BrickDef[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < BRICK_COLS; c++) {
      const hp = cells[r][c];
      if (hp !== null && rng() < density) {
        // tougher bricks appear deeper into the game, top rows hardest
        const tough = Math.min(maxHp, Math.max(1, hp + (n > 20 && r < rows / 3 && rng() < 0.4 ? 1 : 0)));
        bricks.push({ col: c, row: r, hp: tough });
      }
    }

  // guarantee a playable minimum
  if (bricks.length < 6) {
    for (let c = 0; c < BRICK_COLS && bricks.length < 8; c += 2)
      bricks.push({ col: c, row: 0, hp: 1 });
  }

  const ballSpeed = Math.min(330 + (n - 1) * 7, 640);
  const ballRadius = Math.max(7 - Math.floor((n - 1) / 12), 5);

  return { bricks, ballSpeed, ballRadius };
}
