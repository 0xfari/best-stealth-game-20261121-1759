// Lamplight Heist — every tuning number, colour and level in one place.
// The playfield is a fixed 1280x720 logical area (32x18 tiles of 40 px); the renderer
// scales it to the window, so no rule below depends on the screen size.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 205,
  sneakSpeed: 112,
  /** Noise radius while walking; sneaking is silent. */
  noiseRadius: 115,
  /** Seconds between noise pulses while walking. */
  noiseEvery: 0.4,
  /** How far a thrown coin flies, in pixels (distraction.js). */
  coinThrow: 150,
};

export const GUARD = {
  radius: 14,
  /** Metres of suspicion a guard needs before it walks over to look (0..1). */
  suspectAt: 0.35,
  /** Seconds a guard keeps chasing after losing sight before it gives up and searches. */
  loseSightAfter: 3.5,
  /** Seconds a guard searches the last-seen spot before going back to patrol. */
  searchFor: 2.5,
  /** How fast suspicion drains while the player is unseen (per second). */
  drain: 0.3,
  /** Drain is faster while the player stands in shadow. */
  drainInDark: 0.65,
  /** How far a guard's footstep sound carries (px); volume fades with distance. */
  stepAudible: 320,
};

/** Detection fill, per second, before the light and stance multipliers. */
export const DETECT = {
  base: 1.15,
  /** In a lamp's pool the fill is multiplied by this; in shadow by dark. */
  light: 1.6,
  dark: 0.5,
  /** Sneaking multiplies the fill by this; walking briskly by run. */
  sneak: 0.6,
  run: 1.25,
};

export const LIVES = 3;

export const SCORE = {
  artifact: 100,
  levelClear: 200,
  /** Time bonus: 300 minus 2 per second spent on the level, never below 0. */
  timeBonus: 300,
  timePenalty: 2,
  /** Bonus for clearing a level without ever being fully spotted. */
  ghost: 250,
};

export const PALETTE = {
  backdrop: '#0b0d12',
  floorA: '#23202a',
  floorB: '#201d27',
  floorDark: '#17141f',
  grout: '#2e2a38',
  wall: '#3a3348',
  wallTop: '#574d6e',
  crate: '#6b4f2a',
  crateEdge: '#8a6a3c',
  caseGlass: '#1d2f3a',
  caseGold: '#c9a227',
  lampGlow: '#ffb84d',
  lampCore: '#ffe9b0',
  player: '#20242e',
  playerTrim: '#e8e4d8',
  guard: '#2c3e6e',
  guardTrim: '#d8b25a',
  guardCap: '#1d2a4d',
  coneCalm: '255,214,90',
  coneSuspect: '255,150,40',
  coneAlert: '255,60,50',
  artifactJade: '#3ddc97',
  artifactPearl: '#f2f0e4',
  artifactGold: '#f2c94c',
  exitOn: '#3ddc97',
  exitOff: '#8b2f2f',
  text: '#eef1f5',
  muted: '#9aa0b0',
  danger: '#ff5a4e',
  warn: '#ffb84d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lamplight-heist.best';

// The wings: three in v1, a fourth — The Cellar — in v2 (wing4.js).
import { CELLAR_LEVEL } from './wing4.js';

/**
 * Map legend (one character per tile, 32 columns x 18 rows):
 *   # wall — blocks movement and sight
 *   . floor
 *   , shadow floor — detection fills half as fast here
 *   L lamp — a pool of warm light; detection fills faster here
 *   C crate or display case — blocks movement and sight, cover to hide behind
 *   A artifact pedestal (floor; an artifact sits on it)
 *   E exit (floor; opens once every artifact is taken)
 *   P player start (floor)
 * Guard waypoints are tile coordinates in each level's `guards` list.
 */
export const LEVELS = [
  {
    name: 'The Foyer',
    sub: 'Two guards. Learn their patrols, mind the lamplight.',
    map: [
      '################################',
      '#......LL.........C.....A......#',
      '#.......,,........C............#',
      '#..C.....####.....C....####....#',
      '#..C.....#..#..........#..#....#',
      '#........#..#...C......#..#....#',
      '#..A.....#..#...C......#..#..E.#',
      '#........#..#..........#..#....#',
      '#..####..#..#...####...#..#....#',
      '#..#..#......#..#..#......#....#',
      '#..#..#..C.......#..#..C.......#',
      '#..#..#..C...,,..#..#..C.......#',
      '#..####......,,...####....C....#',
      '#..........,,...........C......#',
      '#..C....A......C......C........#',
      '#P.C...........C......C........#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { waypoints: [[2, 2], [2, 13]], speed: 62, cone: 250, pause: 1.4 },
      { waypoints: [[28, 2], [28, 14]], speed: 62, cone: 250, pause: 1.4 },
    ],
  },
  {
    name: 'The Gallery',
    sub: 'Three guards, longer cones. Shadows are your friends.',
    map: [
      '################################',
      '#....LL.......C.....A.....LL...#',
      '#..P....,,....C............C...#',
      '#..####..,,...C....####....C...#',
      '#..#..#......C.....#..#........#',
      '#..#..#..C.........#..#........#',
      '#..####..C....,,...####........#',
      '#........C....,,.......C....E..#',
      '#..C.........C.........C.......#',
      '#..C....A....C....C............#',
      '#..C.........C....C....####....#',
      '#.......,,........C....#..#....#',
      '#..####..,,...C........#..#....#',
      '#..#..#.......C....C...#..#....#',
      '#..#..#..C.........C.......C...#',
      '#..#..#..C....A..........C.....#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { waypoints: [[8, 2], [8, 15]], speed: 70, cone: 270, pause: 1.1 },
      { waypoints: [[18, 3], [18, 15]], speed: 70, cone: 270, pause: 1.1 },
      { waypoints: [[24, 2], [24, 15]], speed: 70, cone: 270, pause: 1.1 },
    ],
  },
  {
    name: 'The Vault Wing',
    sub: 'Four guards, fast feet, sharp eyes. Take it slow.',
    map: [
      '################################',
      '#.....LL....C......A.....LL....#',
      '#P......,,...C............C....#',
      '#..####..,,..C....####....C....#',
      '#..#..#......C....#..#.........#',
      '#..#..#..C........#..#..C......#',
      '#..####..C....,,..####..C......#',
      '#........C....,,......C.....E..#',
      '#..C.........C.....C...........#',
      '#..C....A....C.....C....####...#',
      '#..C.........C.....C....#..#...#',
      '#.......,,.......C.....#..#....#',
      '#..####..,,..C.........#..#....#',
      '#..#..#......C....C....#..#....#',
      '#..#..#..C........C.......C....#',
      '#..#..#..C....A.........C......#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { waypoints: [[8, 2], [8, 14]], speed: 78, cone: 290, pause: 0.9 },
      { waypoints: [[14, 2], [14, 15]], speed: 78, cone: 290, pause: 0.9 },
      { waypoints: [[22, 3], [22, 15]], speed: 78, cone: 290, pause: 0.9 },
      { waypoints: [[28, 2], [28, 14]], speed: 78, cone: 290, pause: 0.9 },
    ],
  },
  CELLAR_LEVEL,
];
