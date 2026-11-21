// The museum floor: one level's grid, what blocks movement and sight, where the light
// falls, and the pathfinding both the guards and the screenshot autopilot walk on.
// No drawing and no browser in here — pure geometry over the map strings in config.js.

import { COLS, ROWS, TILE } from './config.js';

export const TILE_WALL = '#';
export const TILE_FLOOR = '.';
export const TILE_DARK = ',';
export const TILE_LAMP = 'L';
export const TILE_COVER = 'C';
export const TILE_ARTIFACT = 'A';
export const TILE_EXIT = 'E';
export const TILE_PLAYER = 'P';

/** A tile that stops feet and eyes: walls and crates/cases. */
export function isSolid(tile) {
  return tile === TILE_WALL || tile === TILE_COVER;
}

export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  const artifacts = [];
  const lamps = [];
  let playerStart = { x: TILE * 1.5, y: TILE * 1.5 };
  let exit = { x: TILE * 30.5, y: TILE * 1.5 };
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const tile = grid[row][col];
      const centre = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
      if (tile === TILE_ARTIFACT) artifacts.push({ ...centre, col, row, taken: false });
      else if (tile === TILE_LAMP) lamps.push(centre);
      else if (tile === TILE_PLAYER) playerStart = centre;
      else if (tile === TILE_EXIT) exit = centre;
    }
  }
  return { def, grid, artifacts, lamps, playerStart, exit };
}

export function tileAt(level, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return TILE_WALL;
  return level.grid[row][col];
}

export function tileAtPx(level, x, y) {
  return tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function walkableAtPx(level, x, y) {
  return !isSolid(tileAtPx(level, x, y));
}

/** True when a circle of `radius` at (x, y) fits without touching a solid tile. */
export function fitsAt(level, x, y, radius) {
  return (
    walkableAtPx(level, x - radius, y - radius) &&
    walkableAtPx(level, x + radius, y - radius) &&
    walkableAtPx(level, x - radius, y + radius) &&
    walkableAtPx(level, x + radius, y + radius)
  );
}

/** True when the point stands in a lamp's pool of light (a circle around a lamp tile). */
export function inLight(level, x, y) {
  for (const lamp of level.lamps) {
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    if (dx * dx + dy * dy < 110 * 110) return true;
  }
  return false;
}

/** True when the point stands on a shadow tile. */
export function inDark(level, x, y) {
  return tileAtPx(level, x, y) === TILE_DARK;
}

/**
 * Line of sight: sample the segment every few pixels; blocked when a sample lands in a
 * solid tile. Cheap, and exact enough for cones and chase checks at this scale.
 */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    if (!walkableAtPx(level, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/**
 * Breadth-first path over walkable tiles, from tile (fromCol, fromRow) to (toCol, toRow).
 * `extraCost(col, row)` adds a penalty per tile (the autopilot charges for tiles inside a
 * guard's cone, so it waits for a safe moment instead of walking into the light). Returns
 * a list of tile centres in pixels, or null when no route exists.
 */
export function findPath(level, fromCol, fromRow, toCol, toRow, extraCost) {
  if (isSolid(tileAt(level, toCol, toRow))) return null;
  const startKey = fromRow * COLS + fromCol;
  const goalKey = toRow * COLS + toCol;
  const cameFrom = new Map();
  const cost = new Map([[startKey, 0]]);
  const open = [startKey];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (open.length > 0) {
    // Cheapest first (a tiny priority queue by linear scan: the grid is small).
    let bestIndex = 0;
    for (let index = 1; index < open.length; index += 1) {
      if (cost.get(open[index]) < cost.get(open[bestIndex])) bestIndex = index;
    }
    const current = open.splice(bestIndex, 1)[0];
    if (current === goalKey) break;
    const col = current % COLS;
    const row = Math.floor(current / COLS);
    for (const [dc, dr] of directions) {
      const nextCol = col + dc;
      const nextRow = row + dr;
      if (isSolid(tileAt(level, nextCol, nextRow))) continue;
      const nextKey = nextRow * COLS + nextCol;
      const stepCost = 1 + (extraCost ? extraCost(nextCol, nextRow) : 0);
      const nextCost = cost.get(current) + stepCost;
      if (cost.has(nextKey) && cost.get(nextKey) <= nextCost) continue;
      cost.set(nextKey, nextCost);
      cameFrom.set(nextKey, current);
      open.push(nextKey);
    }
  }
  if (!cameFrom.has(goalKey) && goalKey !== startKey) return null;
  const tiles = [];
  let key = goalKey;
  while (key !== startKey) {
    tiles.push({ x: (key % COLS + 0.5) * TILE, y: (Math.floor(key / COLS) + 0.5) * TILE });
    key = cameFrom.get(key);
  }
  tiles.reverse();
  return tiles;
}
