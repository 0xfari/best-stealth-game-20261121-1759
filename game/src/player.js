// The thief: one body on the floor, two speeds, and the noise she makes.
// Movement is axis-separated so she slides along walls instead of sticking on corners.

import { PLAYER } from './config.js';
import { fitsAt } from './level.js';

export function createPlayer(level) {
  const state = {
    x: level.playerStart.x,
    y: level.playerStart.y,
    radius: PLAYER.radius,
    facing: 0,
    moving: false,
    sneaking: false,
    /** Seconds until the next footstep sound / noise pulse. */
    stepIn: 0,
    /** Seconds since the last footstep (drives the walk-cycle drawing). */
    stepPhase: 0,
  };

  function reset() {
    state.x = level.playerStart.x;
    state.y = level.playerStart.y;
    state.facing = 0;
    state.moving = false;
    state.sneaking = false;
    state.stepIn = 0;
    state.stepPhase = 0;
  }

  /**
   * One fixed step. `vector` is a unit steering vector (or zero), `sneak` is Shift.
   * Returns true when a noise pulse goes out (a walking footstep guards can hear).
   */
  function step(dt, vector, sneak) {
    const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const moving = vector.x !== 0 || vector.y !== 0;
    state.moving = moving;
    state.sneaking = sneak && moving;
    let madeNoise = false;
    if (moving) {
      state.facing = Math.atan2(vector.y, vector.x);
      state.stepPhase += dt * (sneak ? 5 : 9);
      const nextX = state.x + vector.x * speed * dt;
      const nextY = state.y + vector.y * speed * dt;
      if (fitsAt(level, nextX, state.y, state.radius)) state.x = nextX;
      if (fitsAt(level, state.x, nextY, state.radius)) state.y = nextY;
      state.stepIn -= dt;
      if (!sneak && state.stepIn <= 0) {
        state.stepIn = PLAYER.noiseEvery;
        madeNoise = true;
      }
    } else {
      state.stepIn = 0;
    }
    return madeNoise;
  }

  return { state, reset, step };
}
