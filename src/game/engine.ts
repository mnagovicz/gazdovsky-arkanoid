import {
  WORLD_W,
  WORLD_H,
  HUD_H,
  BRICK_AREA_TOP,
  BRICK_COLS,
  BRICK_GAP,
  BRICK_H,
  PADDLE_Y,
  PADDLE_W,
  PADDLE_H,
  PADDLE_SPEED,
  MAX_LEVEL,
  START_LIVES,
} from '../config';
import { generateLevel } from './levels';
import { sfx } from './audio';

export type PowerupType =
  | 'expand'
  | 'shrink'
  | 'multiball'
  | 'life'
  | 'sticky'
  | 'fast'
  | 'slow'
  | 'laser';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  stuck: boolean; // attached to paddle (sticky powerup or level start)
  stuckOffset: number;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
}

interface Powerup {
  x: number;
  y: number;
  type: PowerupType;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface LaserBolt {
  x: number;
  y: number;
}

export interface GameEvents {
  onGameOver: (score: number, level: number) => void;
  onWin: (score: number) => void;
}

const HP_COLORS: Record<number, string[]> = {
  1: ['#06d6a0', '#04b589'], // green — one hit
  2: ['#ffd23f', '#e6b800'], // yellow — two hits
  3: ['#ff5d8f', '#d63a6e'], // pink — three hits
};
const HP_SCORE: Record<number, number> = { 1: 50, 2: 120, 3: 200 };

const POWERUP_META: Record<PowerupType, { color: string; label: string }> = {
  expand: { color: '#06d6a0', label: '↔' },
  shrink: { color: '#ff9f1c', label: '→←' },
  multiball: { color: '#3fd2ff', label: '●●' },
  life: { color: '#ff5d8f', label: '♥' },
  sticky: { color: '#c77dff', label: '⌾' },
  fast: { color: '#ff4d4d', label: '≫' },
  slow: { color: '#8ecae6', label: '≪' },
  laser: { color: '#ffd23f', label: '⌖' },
};

const EFFECT_DUR: Partial<Record<PowerupType, number>> = {
  expand: 14,
  shrink: 14,
  sticky: 10,
  fast: 9,
  slow: 9,
  laser: 10,
};

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private events: GameEvents;

  private scale = 1;
  private raf = 0;
  private lastT = 0;
  private running = false;

  level = 1;
  score = 0;
  lives = START_LIVES;

  private paddle = { x: WORLD_W / 2 - PADDLE_W / 2, w: PADDLE_W };
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerups: Powerup[] = [];
  private particles: Particle[] = [];
  private lasers: LaserBolt[] = [];

  private baseSpeed = 330;
  private baseRadius = 7;
  private speedMult = 1;
  private effects = new Map<PowerupType, number>(); // type -> remaining seconds

  private moveDir = 0; // -1 left, +1 right (from held touch zones)
  private touches = new Map<number, { x: number; y: number; t: number }>();
  private banner = { text: '', t: 0 };
  private ballOnPaddle = true; // waiting to launch
  private laserCooldown = 0;
  private bgStars: { x: number; y: number; s: number; tw: number }[] = [];

  constructor(canvas: HTMLCanvasElement, events: GameEvents) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.events = events;
    for (let i = 0; i < 60; i++)
      this.bgStars.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        s: Math.random() * 1.8 + 0.4,
        tw: Math.random() * Math.PI * 2,
      });
    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.lastT = 0; // avoid huge dt jump
    });
  }

  // ---------- lifecycle ----------

  start() {
    this.level = 1;
    this.score = 0;
    this.lives = START_LIVES;
    this.loadLevel();
    this.running = true;
    this.lastT = 0;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loadLevel() {
    const def = generateLevel(this.level);
    this.baseSpeed = def.ballSpeed;
    this.baseRadius = def.ballRadius;
    this.speedMult = 1;
    this.effects.clear();
    this.powerups = [];
    this.lasers = [];
    this.paddle.w = PADDLE_W;
    this.paddle.x = WORLD_W / 2 - this.paddle.w / 2;

    const brickW = (WORLD_W - 24 - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
    this.bricks = def.bricks.map((b) => ({
      x: 12 + b.col * (brickW + BRICK_GAP),
      y: BRICK_AREA_TOP + b.row * (BRICK_H + BRICK_GAP),
      w: brickW,
      h: BRICK_H,
      hp: b.hp,
      maxHp: b.hp,
    }));

    this.balls = [];
    this.spawnBallOnPaddle();
    this.ballOnPaddle = true;
    this.banner = { text: `Level ${this.level}`, t: 2 };
    if (this.level > 1) sfx.levelUp();
  }

  private spawnBallOnPaddle() {
    this.balls.push({
      x: this.paddle.x + this.paddle.w / 2,
      y: PADDLE_Y - this.baseRadius - 1,
      vx: 0,
      vy: 0,
      r: this.baseRadius,
      stuck: true,
      stuckOffset: this.paddle.w / 2,
    });
  }

  // ---------- input ----------

  private bindInput() {
    const opts = { passive: false };
    this.canvas.addEventListener('touchstart', this.onTouchStart, opts);
    this.canvas.addEventListener('touchmove', this.onTouchMove, opts);
    this.canvas.addEventListener('touchend', this.onTouchEnd, opts);
    this.canvas.addEventListener('touchcancel', this.onTouchEnd, opts);
    // mouse fallback for desktop testing
    this.canvas.addEventListener('mousedown', (e) => this.zoneDown(e.clientX));
    window.addEventListener('mouseup', () => (this.moveDir = 0));
    window.addEventListener('mousemove', (e) => {
      if (e.buttons) this.moveDir = this.zoneOf(e.clientX);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.moveDir = -1;
      if (e.key === 'ArrowRight') this.moveDir = 1;
      if (e.key === ' ') this.tap();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.moveDir = 0;
    });
  }

  private toWorld(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / this.scale,
      y: (clientY - rect.top) / this.scale,
    };
  }

  private zoneOf(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    return clientX - rect.left < rect.width / 2 ? -1 : 1;
  }

  private zoneDown(clientX: number) {
    this.moveDir = this.zoneOf(clientX);
    this.tap();
  }

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const p = this.toWorld(t.clientX, t.clientY);
      this.touches.set(t.identifier, { x: p.x, y: p.y, t: performance.now() });
      // treat every new touch as a potential tap (sticky release / laser)
      if (performance.now() - (this.touches.get(t.identifier)?.t ?? 0) >= 0) this.tap();
    }
    this.updateMoveDir();
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const cur = this.touches.get(t.identifier);
      if (cur) {
        const p = this.toWorld(t.clientX, t.clientY);
        cur.x = p.x;
        cur.y = p.y;
      }
    }
    this.updateMoveDir();
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) this.touches.delete(t.identifier);
    this.updateMoveDir();
  };

  private updateMoveDir() {
    if (this.touches.size === 0) {
      this.moveDir = 0;
      return;
    }
    // average the zones of all active touches
    let sum = 0;
    for (const t of this.touches.values()) sum += t.x < WORLD_W / 2 ? -1 : 1;
    this.moveDir = sum === 0 ? 0 : sum > 0 ? 1 : -1;
  }

  /** tap = release sticky balls, fire laser */
  private tap() {
    if (this.ballOnPaddle) {
      this.launchStuck();
      this.ballOnPaddle = false;
      return;
    }
    if (this.effects.has('sticky')) {
      this.launchStuck();
    }
    if (this.effects.has('laser') && this.laserCooldown <= 0) {
      this.lasers.push({ x: this.paddle.x + 6, y: PADDLE_Y - 4 });
      this.lasers.push({ x: this.paddle.x + this.paddle.w - 6, y: PADDLE_Y - 4 });
      this.laserCooldown = 0.28;
      sfx.laser();
    }
  }

  private launchStuck() {
    const speed = this.baseSpeed * this.speedMult;
    for (const b of this.balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      const ang = (-60 + Math.random() * 120) * (Math.PI / 180);
      b.vx = Math.sin(ang) * speed;
      b.vy = -Math.abs(Math.cos(ang)) * speed;
      if (Math.abs(b.vy) < speed * 0.45) b.vy = -speed * 0.45;
    }
  }

  // ---------- loop ----------

  private loop = (t: number) => {
    if (!this.running) return;
    const dt = this.lastT ? Math.min((t - this.lastT) / 1000, 0.05) : 0.016;
    this.lastT = t;
    this.update(dt);
    this.render(t / 1000);
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // paddle
    this.paddle.x += this.moveDir * PADDLE_SPEED * dt;
    this.paddle.x = Math.max(6, Math.min(WORLD_W - 6 - this.paddle.w, this.paddle.x));

    // effect timers
    for (const [type, rem] of this.effects) {
      const left = rem - dt;
      if (left <= 0) this.expireEffect(type);
      else this.effects.set(type, left);
    }
    this.laserCooldown = Math.max(0, this.laserCooldown - dt);
    if (this.banner.t > 0) this.banner.t -= dt;

    // balls
    const speed = this.baseSpeed * this.speedMult;
    for (const b of this.balls) {
      if (b.stuck) {
        b.x = this.paddle.x + Math.min(Math.max(b.stuckOffset, 8), this.paddle.w - 8);
        b.y = PADDLE_Y - b.r - 1;
        continue;
      }
      // normalize speed (fast/slow powerups)
      const cur = Math.hypot(b.vx, b.vy) || 1;
      b.vx = (b.vx / cur) * speed;
      b.vy = (b.vy / cur) * speed;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // walls
      if (b.x - b.r < 6) {
        b.x = 6 + b.r;
        b.vx = Math.abs(b.vx);
        sfx.wall();
      }
      if (b.x + b.r > WORLD_W - 6) {
        b.x = WORLD_W - 6 - b.r;
        b.vx = -Math.abs(b.vx);
        sfx.wall();
      }
      if (b.y - b.r < HUD_H) {
        b.y = HUD_H + b.r;
        b.vy = Math.abs(b.vy);
        sfx.wall();
      }

      // paddle
      if (
        b.vy > 0 &&
        b.y + b.r >= PADDLE_Y &&
        b.y + b.r <= PADDLE_Y + PADDLE_H + 10 &&
        b.x >= this.paddle.x - b.r &&
        b.x <= this.paddle.x + this.paddle.w + b.r
      ) {
        if (this.effects.has('sticky')) {
          b.stuck = true;
          b.stuckOffset = b.x - this.paddle.x;
          b.vx = 0;
          b.vy = 0;
        } else {
          const rel = Math.max(-1, Math.min(1, (b.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2)));
          const maxAng = 62 * (Math.PI / 180);
          const ang = rel * maxAng;
          b.vx = Math.sin(ang) * speed;
          b.vy = -Math.cos(ang) * speed;
          b.y = PADDLE_Y - b.r - 0.5;
        }
        sfx.paddle();
      }

      // bricks
      for (const br of this.bricks) {
        if (br.hp <= 0) continue;
        if (
          b.x + b.r > br.x &&
          b.x - b.r < br.x + br.w &&
          b.y + b.r > br.y &&
          b.y - b.r < br.y + br.h
        ) {
          // resolve bounce axis by smallest penetration
          const overlapL = b.x + b.r - br.x;
          const overlapR = br.x + br.w - (b.x - b.r);
          const overlapT = b.y + b.r - br.y;
          const overlapB = br.y + br.h - (b.y - b.r);
          const minX = Math.min(overlapL, overlapR);
          const minY = Math.min(overlapT, overlapB);
          if (minX < minY) b.vx = overlapL < overlapR ? -Math.abs(b.vx) : Math.abs(b.vx);
          else b.vy = overlapT < overlapB ? -Math.abs(b.vy) : Math.abs(b.vy);
          this.hitBrick(br);
          break;
        }
      }
    }

    // remove dead balls
    this.balls = this.balls.filter((b) => b.y - b.r < WORLD_H + 20);
    if (this.balls.length === 0) {
      this.lives--;
      sfx.lose();
      this.effects.clear();
      this.speedMult = 1;
      this.paddle.w = PADDLE_W;
      this.powerups = [];
      this.lasers = [];
      if (this.lives <= 0) {
        this.running = false;
        this.events.onGameOver(this.score, this.level);
        return;
      }
      this.spawnBallOnPaddle();
      this.ballOnPaddle = true;
    }

    // powerups falling
    for (const p of this.powerups) {
      p.y += 140 * dt;
      if (
        p.y + 12 >= PADDLE_Y &&
        p.y - 12 <= PADDLE_Y + PADDLE_H &&
        p.x >= this.paddle.x - 12 &&
        p.x <= this.paddle.x + this.paddle.w + 12
      ) {
        p.y = WORLD_H + 999; // mark consumed
        this.applyPowerup(p.type);
      }
    }
    this.powerups = this.powerups.filter((p) => p.y < WORLD_H + 40);

    // lasers
    for (const l of this.lasers) {
      l.y -= 560 * dt;
      for (const br of this.bricks) {
        if (br.hp <= 0) continue;
        if (l.x > br.x && l.x < br.x + br.w && l.y > br.y && l.y < br.y + br.h) {
          l.y = -999;
          this.hitBrick(br);
          break;
        }
      }
    }
    this.lasers = this.lasers.filter((l) => l.y > HUD_H - 20);

    // particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // level complete
    if (this.bricks.every((b) => b.hp <= 0)) {
      this.score += this.level * 100;
      if (this.level >= MAX_LEVEL) {
        this.running = false;
        this.events.onWin(this.score);
        return;
      }
      this.level++;
      this.loadLevel();
    }
  }

  private hitBrick(br: Brick) {
    br.hp--;
    if (br.hp <= 0) {
      this.score += HP_SCORE[br.maxHp] ?? 50;
      this.burst(br.x + br.w / 2, br.y + br.h / 2, HP_COLORS[br.maxHp][0], 12);
      sfx.brick();
      if (Math.random() < 0.16) {
        this.powerups.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, type: this.randomPowerup() });
      }
    } else {
      this.burst(br.x + br.w / 2, br.y + br.h / 2, '#ffffff', 5);
      sfx.brickHard();
    }
  }

  private randomPowerup(): PowerupType {
    const table: [PowerupType, number][] = [
      ['expand', 0.18],
      ['multiball', 0.16],
      ['slow', 0.13],
      ['laser', 0.13],
      ['sticky', 0.12],
      ['life', 0.08],
      ['fast', 0.1],
      ['shrink', 0.1],
    ];
    let r = Math.random();
    for (const [t, w] of table) {
      r -= w;
      if (r <= 0) return t;
    }
    return 'expand';
  }

  private applyPowerup(type: PowerupType) {
    sfx.powerup();
    this.banner = { text: this.powerupName(type), t: 1.2 };
    switch (type) {
      case 'expand':
        this.effects.set('expand', EFFECT_DUR.expand!);
        this.effects.delete('shrink');
        this.paddle.w = PADDLE_W * 1.5;
        break;
      case 'shrink':
        this.effects.set('shrink', EFFECT_DUR.shrink!);
        this.effects.delete('expand');
        this.paddle.w = PADDLE_W * 0.6;
        break;
      case 'multiball': {
        const src = this.balls.filter((b) => !b.stuck);
        for (const b of src) {
          if (this.balls.length >= 6) break;
          for (const da of [-0.5, 0.5]) {
            const ang = Math.atan2(b.vy, b.vx) + da;
            const sp = Math.hypot(b.vx, b.vy);
            this.balls.push({ ...b, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
            if (this.balls.length >= 6) break;
          }
        }
        break;
      }
      case 'life':
        this.lives = Math.min(this.lives + 1, 5);
        break;
      case 'sticky':
        this.effects.set('sticky', EFFECT_DUR.sticky!);
        break;
      case 'fast':
        this.effects.set('fast', EFFECT_DUR.fast!);
        this.effects.delete('slow');
        this.speedMult = 1.35;
        break;
      case 'slow':
        this.effects.set('slow', EFFECT_DUR.slow!);
        this.effects.delete('fast');
        this.speedMult = 0.7;
        break;
      case 'laser':
        this.effects.set('laser', EFFECT_DUR.laser!);
        break;
    }
  }

  private expireEffect(type: PowerupType) {
    this.effects.delete(type);
    if (type === 'expand' || type === 'shrink') this.paddle.w = PADDLE_W;
    if (type === 'fast' || type === 'slow') this.speedMult = 1;
  }

  private powerupName(t: PowerupType): string {
    return (
      {
        expand: 'Větší pádlo!',
        shrink: 'Menší pádlo!',
        multiball: 'Multiball!',
        life: '+1 život!',
        sticky: 'Lepivé pádlo!',
        fast: 'Rychlý míček!',
        slow: 'Pomalý míček!',
        laser: 'Laser!',
      } as const
    )[t];
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        color,
        size: 2 + Math.random() * 3.5,
      });
    }
  }

  // ---------- render ----------

  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.scale = Math.min(vw / WORLD_W, vh / WORLD_H);
    const cssW = WORLD_W * this.scale;
    const cssH = WORLD_H * this.scale;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, 0, 0);
  };

  private render(t: number) {
    const c = this.ctx;
    // background
    const grad = c.createLinearGradient(0, 0, 0, WORLD_H);
    grad.addColorStop(0, '#241457');
    grad.addColorStop(1, '#1a1040');
    c.fillStyle = grad;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    // twinkling stars
    for (const s of this.bgStars) {
      c.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + s.tw);
      c.fillStyle = '#ffffff';
      c.fillRect(s.x, s.y, s.s, s.s);
    }
    c.globalAlpha = 1;

    // walls
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fillRect(0, HUD_H, 6, WORLD_H - HUD_H);
    c.fillRect(WORLD_W - 6, HUD_H, 6, WORLD_H - HUD_H);
    c.fillRect(0, HUD_H - 4, WORLD_W, 4);

    // touch zones hint (subtle)
    c.fillStyle = 'rgba(255,255,255,0.045)';
    c.fillRect(6, WORLD_H - 46, WORLD_W / 2 - 7, 40);
    c.fillRect(WORLD_W / 2 + 1, WORLD_H - 46, WORLD_W / 2 - 7, 40);
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.font = '600 13px system-ui';
    c.textAlign = 'center';
    c.fillText('◀ drž', WORLD_W / 4, WORLD_H - 21);
    c.fillText('drž ▶', (WORLD_W * 3) / 4, WORLD_H - 21);

    // bricks
    for (const br of this.bricks) {
      if (br.hp <= 0) continue;
      const [main, dark] = HP_COLORS[br.hp];
      c.fillStyle = main;
      this.roundRect(br.x, br.y, br.w, br.h, 5);
      c.fill();
      c.fillStyle = dark;
      this.roundRect(br.x, br.y + br.h - 6, br.w, 6, 4);
      c.fill();
      // gloss
      c.fillStyle = 'rgba(255,255,255,0.35)';
      this.roundRect(br.x + 2, br.y + 2, br.w - 4, 5, 3);
      c.fill();
      // hit dots for tough bricks
      if (br.maxHp > 1) {
        c.fillStyle = 'rgba(0,0,0,0.3)';
        for (let i = 0; i < br.hp; i++) {
          c.beginPath();
          c.arc(br.x + 8 + i * 8, br.y + br.h / 2 + 1, 2, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    // powerups
    for (const p of this.powerups) {
      const meta = POWERUP_META[p.type];
      c.fillStyle = meta.color;
      c.shadowColor = meta.color;
      c.shadowBlur = 10;
      c.beginPath();
      c.arc(p.x, p.y, 12, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = '#1a1040';
      c.font = '800 11px system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(meta.label, p.x, p.y + 0.5);
      c.textBaseline = 'alphabetic';
    }

    // lasers
    c.fillStyle = '#ffe66d';
    for (const l of this.lasers) {
      c.fillRect(l.x - 1.5, l.y - 10, 3, 12);
    }

    // paddle
    const laser = this.effects.has('laser');
    const sticky = this.effects.has('sticky');
    const pg = c.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
    pg.addColorStop(0, laser ? '#ffd23f' : sticky ? '#c77dff' : '#3fd2ff');
    pg.addColorStop(1, laser ? '#e6a800' : sticky ? '#8e44c9' : '#1b9ad6');
    c.fillStyle = pg;
    c.shadowColor = laser ? '#ffd23f' : '#3fd2ff';
    c.shadowBlur = 12;
    this.roundRect(this.paddle.x, PADDLE_Y, this.paddle.w, PADDLE_H, 7);
    c.fill();
    c.shadowBlur = 0;
    if (laser) {
      c.fillStyle = '#fff';
      c.fillRect(this.paddle.x + 3, PADDLE_Y - 5, 6, 6);
      c.fillRect(this.paddle.x + this.paddle.w - 9, PADDLE_Y - 5, 6, 6);
    }

    // balls
    for (const b of this.balls) {
      c.fillStyle = '#ffffff';
      c.shadowColor = '#ffffff';
      c.shadowBlur = 10;
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }

    // particles
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life / p.maxLife);
      c.fillStyle = p.color;
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    c.globalAlpha = 1;

    this.renderHUD();

    // banner
    if (this.banner.t > 0) {
      c.globalAlpha = Math.min(1, this.banner.t);
      c.fillStyle = '#ffffff';
      c.font = '900 34px system-ui';
      c.textAlign = 'center';
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 12;
      c.fillText(this.banner.text, WORLD_W / 2, WORLD_H / 2 - 40);
      c.shadowBlur = 0;
      c.globalAlpha = 1;
    }

    // launch hint
    if (this.ballOnPaddle) {
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.font = '600 15px system-ui';
      c.textAlign = 'center';
      c.fillText('Ťukni pro vypuštění míčku', WORLD_W / 2, PADDLE_Y - 40);
    }
  }

  private renderHUD() {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, 0, WORLD_W, HUD_H - 4);

    c.textAlign = 'left';
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '600 11px system-ui';
    c.fillText('SKÓRE', 14, 20);
    c.fillStyle = '#ffd23f';
    c.font = '800 22px system-ui';
    c.fillText(String(this.score), 14, 42);

    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '600 11px system-ui';
    c.fillText('LEVEL', WORLD_W / 2, 20);
    c.fillStyle = '#3fd2ff';
    c.font = '800 22px system-ui';
    c.fillText(`${this.level}`, WORLD_W / 2, 42);

    c.textAlign = 'right';
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '600 11px system-ui';
    c.fillText('ŽIVOTY', WORLD_W - 14, 20);

    // Lives as drawn vector hearts — emoji text measures unreliably across
    // platforms (multi-byte + U+FE0F) and overflowed the canvas on mobile.
    const heartSize = 16;
    const heartGap = 5;
    const slots = Math.max(START_LIVES, this.lives);
    const totalW = slots * heartSize + (slots - 1) * heartGap;
    const startX = WORLD_W - 14 - totalW;
    for (let i = 0; i < slots; i++) {
      this.drawHeart(startX + i * (heartSize + heartGap), 32, heartSize, i < this.lives);
    }
  }

  /** Draw a heart icon in a size×size box at (x, y). Filled = life remaining. */
  private drawHeart(x: number, y: number, s: number, filled: boolean) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + 0.5 * s, y + 0.3 * s);
    c.bezierCurveTo(x + 0.5 * s, y + 0.08 * s, x + 0.06 * s, y, x + 0.02 * s, y + 0.36 * s);
    c.bezierCurveTo(x, y + 0.58 * s, x + 0.26 * s, y + 0.78 * s, x + 0.5 * s, y + 0.95 * s);
    c.bezierCurveTo(x + 0.74 * s, y + 0.78 * s, x + s, y + 0.58 * s, x + 0.98 * s, y + 0.36 * s);
    c.bezierCurveTo(x + 0.94 * s, y, x + 0.5 * s, y + 0.08 * s, x + 0.5 * s, y + 0.3 * s);
    c.closePath();
    if (filled) {
      c.fillStyle = '#ff5d8f';
      c.shadowColor = '#ff5d8f';
      c.shadowBlur = 7;
      c.fill();
      c.shadowBlur = 0;
      // gloss highlight
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath();
      c.arc(x + 0.3 * s, y + 0.3 * s, s * 0.09, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = 'rgba(255,93,143,0.08)';
      c.fill();
      c.strokeStyle = 'rgba(255,93,143,0.35)';
      c.lineWidth = 1.5;
      c.stroke();
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
}
