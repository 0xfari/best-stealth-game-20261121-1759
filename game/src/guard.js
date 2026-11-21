// A guard: patrols a loop of waypoints, watches a cone of lamplight, and works through
// four states — patrol, suspicious, alert, search — driven by what it can see and hear.
// Suspicion is a meter, not a switch: it fills in the cone and drains in the dark, so a
// player who is spotted gets a chance to break line of sight and recover.

import { GUARD, TILE } from './config.js';
import { findPath, fitsAt, hasLineOfSight, inDark, inLight } from './level.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';

/** Half-angle of the vision cone, in radians. */
const CONE_HALF = 0.61;

function angleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function turnToward(current, target, maxTurn) {
  const diff = angleDiff(target, current);
  if (Math.abs(diff) <= maxTurn) return target;
  return current + Math.sign(diff) * maxTurn;
}

export function createGuard(level, def, index) {
  const start = def.waypoints[0];
  const state = {
    index,
    x: (start[0] + 0.5) * TILE,
    y: (start[1] + 0.5) * TILE,
    radius: GUARD.radius,
    facing: 0,
    mode: GUARD_PATROL,
    /** 0..1: how sure this guard is that someone is there. */
    suspicion: 0,
    waypoint: 1 % def.waypoints.length,
    pauseLeft: 0,
    /** Where this guard is walking to while suspicious or searching. */
    investigate: null,
    /** Where the player was last seen, in pixels. */
    lastSeen: null,
    /** Seconds since the player was last visible to this guard. */
    unseenFor: 0,
    /** Path of tile centres the guard is following (chase / investigate). */
    path: null,
    pathAt: 0,
    repathIn: 0,
    /** Seconds since the last footstep sound (drives the walk cycle and the audio). */
    stepIn: 0,
    stepPhase: 0,
    /** The guard's footstep just sounded (the loop turns it into audio). */
    stepped: false,
    speed: def.speed,
    cone: def.cone,
    pause: def.pause,
    waypoints: def.waypoints,
  };
  // Face the first leg of the patrol.
  const next = def.waypoints[state.waypoint];
  state.facing = Math.atan2((next[1] + 0.5) * TILE - state.y, (next[0] + 0.5) * TILE - state.x);

  function reset() {
    state.x = (start[0] + 0.5) * TILE;
    state.y = (start[1] + 0.5) * TILE;
    state.mode = GUARD_PATROL;
    state.suspicion = 0;
    state.waypoint = 1 % def.waypoints.length;
    state.pauseLeft = 0;
    state.investigate = null;
    state.lastSeen = null;
    state.unseenFor = 0;
    state.path = null;
    state.pathAt = 0;
    state.repathIn = 0;
    state.stepIn = 0;
    state.stepPhase = 0;
    state.stepped = false;
    const nextPoint = def.waypoints[state.waypoint];
    state.facing = Math.atan2((nextPoint[1] + 0.5) * TILE - state.y, (nextPoint[0] + 0.5) * TILE - state.x);
  }

  /** True when the point is inside this guard's cone and nothing blocks the view. */
  function canSee(x, y) {
    const dx = x - state.x;
    const dy = y - state.y;
    const distance = Math.hypot(dx, dy);
    if (distance > state.cone) return false;
    if (distance < 26) return hasLineOfSight(level, state.x, state.y, x, y);
    const angle = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(angle, state.facing)) > CONE_HALF) return false;
    return hasLineOfSight(level, state.x, state.y, x, y);
  }

  /** True when the tile centre is inside this guard's cone right now (autopilot costs). */
  function coneCoversTile(col, row) {
    const x = (col + 0.5) * TILE;
    const y = (row + 0.5) * TILE;
    const dx = x - state.x;
    const dy = y - state.y;
    const distance = Math.hypot(dx, dy);
    if (distance > state.cone) return false;
    if (distance < 26) return true;
    return Math.abs(angleDiff(Math.atan2(dy, dx), state.facing)) <= CONE_HALF;
  }

  function moveToward(targetX, targetY, speed, dt) {
    const dx = targetX - state.x;
    const dy = targetY - state.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 2) return true;
    const wanted = Math.atan2(dy, dx);
    state.facing = turnToward(state.facing, wanted, 5.5 * dt);
    const stepLength = Math.min(distance, speed * dt);
    const nextX = state.x + Math.cos(state.facing) * stepLength;
    const nextY = state.y + Math.sin(state.facing) * stepLength;
    if (fitsAt(level, nextX, state.y, state.radius)) state.x = nextX;
    if (fitsAt(level, state.x, nextY, state.radius)) state.y = nextY;
    state.stepPhase += dt * 7;
    state.stepIn -= dt;
    if (state.stepIn <= 0) {
      state.stepIn = 0.42;
      state.stepped = true;
    }
    return distance - stepLength < 4;
  }

  function followPath(dt, speed) {
    if (!state.path || state.pathAt >= state.path.length) return true;
    const target = state.path[state.pathAt];
    if (moveToward(target.x, target.y, speed, dt)) state.pathAt += 1;
    return state.pathAt >= state.path.length;
  }

  function planPathTo(col, row) {
    const fromCol = Math.floor(state.x / TILE);
    const fromRow = Math.floor(state.y / TILE);
    state.path = findPath(level, fromCol, fromRow, col, row, null);
    state.pathAt = 0;
  }

  /**
   * One fixed step. `player` is the player's state; `noise` is a noise pulse ({x, y} or
   * null) the player just made. Returns 'alert' the moment this guard goes fully alert,
   * 'spotted' while the player is visible, else null.
   */
  function step(dt, player, noise) {
    state.stepped = false;
    const visible = canSee(player.x, player.y);
    const distance = Math.hypot(player.x - state.x, player.y - state.y);

    if (visible) {
      state.lastSeen = { x: player.x, y: player.y };
      state.unseenFor = 0;
      // Closer is scarier; lamplight is scarier; sneaking and shadow buy time.
      const closeness = 0.55 + 0.9 * (1 - distance / state.cone);
      let rate = 1.15 * closeness;
      if (inLight(level, player.x, player.y)) rate *= 1.6;
      else if (inDark(level, player.x, player.y)) rate *= 0.5;
      if (player.sneaking) rate *= 0.6;
      state.suspicion = Math.min(1, state.suspicion + rate * dt);
    } else {
      state.unseenFor += dt;
      const drain = inDark(level, player.x, player.y) ? GUARD.drainInDark : GUARD.drain;
      state.suspicion = Math.max(0, state.suspicion - drain * dt);
    }

    if (state.suspicion >= 1 && state.mode !== GUARD_ALERT) {
      state.mode = GUARD_ALERT;
      state.path = null;
      return 'alert';
    }

    if (state.mode === GUARD_ALERT) {
      state.repathIn -= dt;
      if (state.repathIn <= 0 && state.lastSeen) {
        planPathTo(Math.floor(state.lastSeen.x / TILE), Math.floor(state.lastSeen.y / TILE));
        state.repathIn = 0.5;
      }
      if (visible) {
        moveToward(player.x, player.y, state.speed * 1.9, dt);
      } else if (state.path) {
        followPath(dt, state.speed * 1.6);
      }
      if (!visible && state.unseenFor > GUARD.loseSightAfter) {
        state.mode = GUARD_SEARCH;
        state.investigate = state.lastSeen;
        state.path = null;
        state.pauseLeft = GUARD.searchFor;
      }
      return visible ? 'spotted' : null;
    }

    if (noise && state.mode !== GUARD_ALERT) {
      const noiseDistance = Math.hypot(noise.x - state.x, noise.y - state.y);
      if (noiseDistance < 115 && state.mode === GUARD_PATROL) {
        state.mode = GUARD_SUSPICIOUS;
        state.investigate = { x: noise.x, y: noise.y };
        state.suspicion = Math.max(state.suspicion, GUARD.suspectAt);
        state.path = null;
      }
    }

    if (state.mode === GUARD_SUSPICIOUS) {
      if (state.suspicion >= GUARD.suspectAt && !visible) {
        if (state.investigate && !state.path) {
          planPathTo(Math.floor(state.investigate.x / TILE), Math.floor(state.investigate.y / TILE));
        }
        if (state.path && followPath(dt, state.speed * 1.25)) {
          state.path = null;
          state.pauseLeft = 2;
        }
        if (state.path === null && state.pauseLeft > 0) {
          state.pauseLeft -= dt;
          state.facing += dt * 1.4;
          if (state.pauseLeft <= 0) {
            state.mode = GUARD_PATROL;
            state.investigate = null;
            state.path = null;
          }
        }
      } else if (state.suspicion < GUARD.suspectAt) {
        state.mode = GUARD_PATROL;
        state.investigate = null;
        state.path = null;
      }
      return visible ? 'spotted' : null;
    }

    if (state.mode === GUARD_SEARCH) {
      if (state.investigate && !state.path) {
        planPathTo(Math.floor(state.investigate.x / TILE), Math.floor(state.investigate.y / TILE));
      }
      if (state.path && followPath(dt, state.speed * 1.25)) {
        state.path = null;
        state.pauseLeft = GUARD.searchFor;
      }
      if (state.path === null) {
        state.pauseLeft -= dt;
        state.facing += dt * 1.2;
        if (state.pauseLeft <= 0) {
          state.mode = GUARD_PATROL;
          state.investigate = null;
          state.suspicion = Math.max(0, state.suspicion - 0.5);
        }
      }
      return visible ? 'spotted' : null;
    }

    // Patrol: walk the loop, pausing at each waypoint to look around.
    if (state.pauseLeft > 0) {
      state.pauseLeft -= dt;
      state.facing += dt * 0.9;
      return visible ? 'spotted' : null;
    }
    const target = def.waypoints[state.waypoint];
    const targetX = (target[0] + 0.5) * TILE;
    const targetY = (target[1] + 0.5) * TILE;
    if (moveToward(targetX, targetY, state.speed, dt)) {
      state.waypoint = (state.waypoint + 1) % def.waypoints.length;
      state.pauseLeft = state.pause;
    }
    return visible ? 'spotted' : null;
  }

  return { state, reset, step, canSee, coneCoversTile };
}
