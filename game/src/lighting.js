// Lighting: what the dark means. The floor already paints lamp pools warm; this
// module paints the other half of the bargain — shadow tiles read as cool dark blue,
// so the player can tell at a glance where it is safe to stand — and a near-miss
// pulse when the exposure bar climbs past 70%: a red vignette that beats with the
// moment, so a near miss feels like one.
//
// Both functions take a canvas context already transformed to playfield space and
// the world's state; neither keeps state of its own.

import { FIELD, TILE } from './config.js';
import { TILE_DARK } from './level.js';

/** Cool blue over every shadow tile, so safe ground reads safe. */
export function drawLighting(context, level) {
  context.fillStyle = 'rgba(38,58,120,0.16)';
  for (let row = 0; row < 18; row += 1) {
    for (let col = 0; col < 32; col += 1) {
      if (level.grid[row][col] !== TILE_DARK) continue;
      context.fillRect(col * TILE, row * TILE, TILE, TILE);
    }
  }
  // A warm halo over each lamp pool, so lit ground reads dangerous.
  for (const lamp of level.lamps) {
    const halo = context.createRadialGradient(lamp.x, lamp.y, 20, lamp.x, lamp.y, 110);
    halo.addColorStop(0, 'rgba(255,184,77,0.10)');
    halo.addColorStop(1, 'rgba(255,184,77,0)');
    context.fillStyle = halo;
    context.fillRect(lamp.x - 110, lamp.y - 110, 220, 220);
  }
}

/**
 * The near-miss pulse: while exposure is past 0.7, a red vignette closes in and
 * beats — faster the closer the guard is to a full alert. Pure presentation: it
 * never changes the rules, only how the moment feels.
 */
export function drawNearMiss(context, exposure) {
  if (exposure <= 0.7) return;
  const depth = (exposure - 0.7) / 0.3;
  const beat = 0.5 + 0.5 * Math.sin(performance.now() / (240 - depth * 120));
  const alpha = 0.08 + depth * 0.14 * beat;
  const gradient = context.createRadialGradient(
    FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.32,
    FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
  );
  gradient.addColorStop(0, 'rgba(255,40,30,0)');
  gradient.addColorStop(1, `rgba(255,40,30,${alpha})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, FIELD.width, FIELD.height);
}
