export const PLAYERS = [
  { name: 'Táta', color: '#3fd2ff' },
  { name: 'Máma', color: '#ff5d8f' },
  { name: 'Laura', color: '#c77dff' },
  { name: 'Honza', color: '#ffd23f' },
  { name: 'Maty', color: '#06d6a0' },
  { name: 'Tobi', color: '#ff9f1c' },
  { name: 'Miku', color: '#8ecae6' },
] as const;

export type PlayerName = (typeof PLAYERS)[number]['name'];

// Logical game world size (canvas is scaled to fit the screen)
export const WORLD_W = 420;
export const WORLD_H = 740;

export const HUD_H = 64;
export const BRICK_AREA_TOP = 96;
export const BRICK_COLS = 10;
export const BRICK_GAP = 4;
export const BRICK_H = 22;

export const PADDLE_Y = WORLD_H - 96;
export const PADDLE_W = 84;
export const PADDLE_H = 14;
export const PADDLE_SPEED = 620; // px/s while a touch zone is held

export const MAX_LEVEL = 50;
export const START_LIVES = 3;
