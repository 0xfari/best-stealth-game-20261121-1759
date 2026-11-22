// The coin toss (Q or C): the thief's one lure. A thrown coin flies a short way in
// the direction she faces, lands with a bright tink, and rings for a moment — every
// guard close enough leaves its patrol to investigate the landing spot, because the
// world's guards already walk to any noise they hear. One coin at a time, with a
// short cooldown, so it is a tool for opening a route, not a fire hose.
//
// The coin is pure state: no drawing and no browser in here except the canvas calls
// in drawCoins, which the renderer invokes with the world's coin set.

import { fitsAt } from './level.js';

/** How far a thrown coin flies, in pixels. */
const THROW_DISTANCE = 150;
/** Seconds the coin spends in the air. */
const FLIGHT_TIME = 0.45;
/** Seconds the landed coin keeps ringing. */
const RING_TIME = 1.2;
/** How far the ring carries: guards inside it come to look. */
const RING_RADIUS = 230;
/** Seconds before another coin can be thrown. */
const COOLDOWN = 1.6;

export function createDistraction() {
  const state = {
    /** The coin in flight, or null. */
    flying: null,
    /** The landed coin still ringing, or null. */
    ringing: null,
    /** Seconds until the next throw is allowed. */
    cooldownLeft: 0,
  };

  function reset() {
    state.flying = null;
    state.ringing = null;
    state.cooldownLeft = 0;
  }

  /**
   * Throw a coin from (fromX, fromY) in direction `facing` (radians). The landing
   * spot walks the flight path in small steps and stops at the last walkable point,
   * so a coin never lands inside a wall. Returns false while cooling down.
   */
  function throwCoin(level, fromX, fromY, facing) {
    if (state.cooldownLeft > 0 || state.flying || state.ringing) return false;
    const stepX = Math.cos(facing) * 10;
    const stepY = Math.sin(facing) * 10;
    let landX = fromX;
    let landY = fromY;
    for (let distance = 10; distance <= THROW_DISTANCE; distance += 10) {
      const nextX = fromX + stepX * (distance / 10);
      const nextY = fromY + stepY * (distance / 10);
      if (!fitsAt(level, nextX, nextY, 4)) break;
      landX = nextX;
      landY = nextY;
    }
    state.flying = { x: fromX, y: fromY, fromX, fromY, landX, landY, left: FLIGHT_TIME };
    state.cooldownLeft = COOLDOWN;
    return true;
  }

  /**
   * One fixed step. Returns { landed, ring }: landed is true on the step the coin
   * touches down, ring is the ringing coin's { x, y, radius } while it rings, so
   * the world can hand it to the guards as the noise they hear.
   */
  function step(dt) {
    let landed = false;
    if (state.cooldownLeft > 0) state.cooldownLeft -= dt;
    if (state.flying) {
      state.flying.left -= dt;
      const flown = 1 - Math.max(0, state.flying.left) / FLIGHT_TIME;
      state.flying.x = state.flying.fromX + (state.flying.landX - state.flying.fromX) * flown;
      state.flying.y = state.flying.fromY + (state.flying.landY - state.flying.fromY) * flown;
      if (state.flying.left <= 0) {
        state.ringing = { x: state.flying.landX, y: state.flying.landY, left: RING_TIME };
        state.flying = null;
        landed = true;
      }
    }
    if (state.ringing) {
      state.ringing.left -= dt;
      if (state.ringing.left <= 0) state.ringing = null;
    }
    const ring = state.ringing
      ? { x: state.ringing.x, y: state.ringing.y, radius: RING_RADIUS }
      : null;
    return { landed, ring };
  }

  /** True while a coin is in the air or still ringing. */
  function active() {
    return state.flying !== null || state.ringing !== null;
  }

  /** True while the landed coin is ringing (the HUD's hint uses this). */
  function ringing() {
    return state.ringing !== null;
  }

  /** The coins to draw: the flying one (with its arc) and the ringing one. */
  function list() {
    const coins = [];
    if (state.flying) coins.push({ ...state.flying, flying: true });
    if (state.ringing) {
      coins.push({
        x: state.ringing.x,
        y: state.ringing.y,
        flying: false,
        ringPhase: 1 - state.ringing.left / RING_TIME,
      });
    }
    return coins;
  }

  return { state, reset, throwCoin, step, active, ringing, list };
}

/** Draw the coins on a canvas context already transformed to playfield space. */
export function drawCoins(context, coins) {
  for (const coin of coins.list()) {
    if (coin.flying) {
      // A gold dot arcing to its landing spot, with a faint trail.
      context.fillStyle = 'rgba(242,201,76,0.35)';
      context.beginPath();
      context.arc(coin.x, coin.y - 6, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.arc(coin.x, coin.y - 6, 4, 0, Math.PI * 2);
      context.fill();
    } else {
      // Expanding sound rings from the landed coin, fading as the ring dies.
      const phase = coin.ringPhase;
      for (let ring = 0; ring < 2; ring += 1) {
        const p = (phase + ring * 0.5) % 1;
        context.strokeStyle = `rgba(242,201,76,${0.55 * (1 - p)})`;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(coin.x, coin.y, 6 + p * 44, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.arc(coin.x, coin.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }
}
