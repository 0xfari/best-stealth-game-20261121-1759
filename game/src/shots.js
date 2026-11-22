// The screenshot scenes behind ?shot=play|start|alarm|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by an autopilot that
// pathfinds around the guards' cones (a tile inside a cone costs far more than a safe
// one, so it waits for a safe moment instead of walking into the light), so the frame
// is what a short game really looks like and the same seed always gives the same frame.

import { STEP, TILE } from './config.js';
import { EVENT_ALERT, EVENT_CAUGHT, EVENT_LEVEL, EVENT_WIN } from './world.js';
import { findPath, hasLineOfSight } from './level.js';
import { SCREEN_LEVEL, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 12;
const ALARM_LIMIT_SECONDS = 60;
const WIN_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;
/** How often the autopilot replans its route, in seconds. */
const REPLAN_EVERY = 0.4;
/** Extra path cost of a tile a guard can see right now. */
const CONE_COST = 60;
/** Seconds the autopilot waits for a cone to move before it risks the crossing. */
const PATIENCE = 3;

/** The autopilot: pick a target, walk a cone-avoiding path to it, sneak near guards. */
export function createAutopilot(world) {
  let path = null;
  let pathAt = 0;
  let replanIn = 0;
  let waitFor = 0;
  let targetKey = '';

  function coneCost(level, guards) {
    return (col, row) => {
      const x = (col + 0.5) * TILE;
      const y = (row + 0.5) * TILE;
      for (const guard of guards) {
        if (guard.coneCoversTile(col, row) && hasLineOfSight(level, guard.state.x, guard.state.y, x, y)) {
          return CONE_COST;
        }
      }
      return 0;
    };
  }

  function chooseTarget() {
    const state = world.state;
    let best = null;
    let bestDistance = Infinity;
    for (const artifact of state.level.artifacts) {
      if (artifact.taken) continue;
      const distance = Math.hypot(artifact.x - state.player.state.x, artifact.y - state.player.state.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = artifact;
      }
    }
    if (best) return { x: best.x, y: best.y, key: `a${best.col},${best.row}` };
    return { x: state.level.exit.x, y: state.level.exit.y, key: 'exit' };
  }

  function replan() {
    const state = world.state;
    const target = chooseTarget();
    const fromCol = Math.floor(state.player.state.x / TILE);
    const fromRow = Math.floor(state.player.state.y / TILE);
    const toCol = Math.floor(target.x / TILE);
    const toRow = Math.floor(target.y / TILE);
    path = findPath(state.level, fromCol, fromRow, toCol, toRow, coneCost(state.level, state.guards));
    pathAt = 0;
    targetKey = target.key;
    replanIn = REPLAN_EVERY;
  }

  function nearestGuardDistance() {
    const player = world.state.player.state;
    let best = Infinity;
    for (const guard of world.state.guards) {
      best = Math.min(best, Math.hypot(guard.state.x - player.x, guard.state.y - player.y));
    }
    return best;
  }

  function tileInCone(col, row) {
    const state = world.state;
    const x = (col + 0.5) * TILE;
    const y = (row + 0.5) * TILE;
    for (const guard of state.guards) {
      if (guard.coneCoversTile(col, row) && hasLineOfSight(state.level, guard.state.x, guard.state.y, x, y)) {
        return true;
      }
    }
    return false;
  }

  /** One step of steering: where to walk and whether to sneak. */
  function decide(dt) {
    const state = world.state;
    const player = state.player.state;
    replanIn -= dt;
    const target = chooseTarget();
    if (!path || pathAt >= path.length || replanIn <= 0 || target.key !== targetKey) replan();
    if (!path || path.length === 0) return { vector: { x: 0, y: 0 }, sneak: true };
    const next = path[pathAt];
    const dx = next.x - player.x;
    const dy = next.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 10) {
      pathAt += 1;
      return { vector: { x: 0, y: 0 }, sneak: true };
    }
    // The next tile is lit by a cone: hold in shadow until it moves, then risk it.
    if (tileInCone(Math.floor(next.x / TILE), Math.floor(next.y / TILE))) {
      waitFor += dt;
      if (waitFor < PATIENCE) return { vector: { x: 0, y: 0 }, sneak: true };
    } else {
      waitFor = 0;
    }
    const sneak = nearestGuardDistance() < 220;
    return { vector: { x: dx / distance, y: dy / distance }, sneak };
  }

  return { decide };
}

/** The nearest guard's state, by distance from the player. */
function nearestGuard(world) {
  const player = world.state.player.state;
  let best = null;
  let bestDistance = Infinity;
  for (const guard of world.state.guards) {
    const distance = Math.hypot(guard.state.x - player.x, guard.state.y - player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = guard.state;
    }
  }
  return best;
}

/**
 * Walk to a point in front of a guard — inside its cone — and stand there until the
 * guard goes fully alert. The point is recomputed as the guard patrols, and the walk
 * repaths around walls, so the player ends up lit by lamplight in the cone, not
 * creeping up behind the guard where it can never be seen.
 */
function stageAlarm(world, pilot) {
  const guard = nearestGuard(world);
  if (!guard) return false;
  let path = null;
  let pathAt = 0;
  let replanIn = 0;
  let stoodFor = 0;
  for (let index = 0; index < ALARM_LIMIT_SECONDS / STEP; index += 1) {
    const state = world.state;
    const player = state.player.state;
    const targetX = guard.x + Math.cos(guard.facing) * 120;
    const targetY = guard.y + Math.sin(guard.facing) * 120;
    const distance = Math.hypot(targetX - player.x, targetY - player.y);
    let move;
    if (distance < 14) {
      // In the cone: stand still and let the guard's suspicion fill.
      stoodFor += STEP;
      move = { vector: { x: 0, y: 0 }, sneak: false };
    } else {
      stoodFor = 0;
      replanIn -= STEP;
      if (!path || pathAt >= path.length || replanIn <= 0) {
        const fromCol = Math.floor(player.x / TILE);
        const fromRow = Math.floor(player.y / TILE);
        path = findPath(state.level, fromCol, fromRow, Math.floor(targetX / TILE), Math.floor(targetY / TILE), null);
        pathAt = 0;
        replanIn = 0.5;
      }
      if (!path || path.length === 0) return false;
      const next = path[pathAt];
      const dx = next.x - player.x;
      const dy = next.y - player.y;
      const leg = Math.hypot(dx, dy);
      if (leg < 10) {
        pathAt += 1;
        move = { vector: { x: 0, y: 0 }, sneak: false };
      } else {
        move = { vector: { x: dx / leg, y: dy / leg }, sneak: false };
      }
    }
    const events = world.step(STEP, move.vector, move.sneak, false);
    if (events & EVENT_ALERT) return true;
    if (events & (EVENT_LEVEL | EVENT_WIN | EVENT_CAUGHT)) return false;
    if (stoodFor > 12) return false;
  }
  return false;
}

/**
 * Set `world` to the named scene (play, start, alarm or win) and return the screen to
 * draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const pilot = createAutopilot(world);
  if (name === 'start') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      const move = pilot.decide(STEP);
      world.step(STEP, move.vector, move.sneak, false);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'alarm') {
    // Play sensibly for a couple of seconds, then step into a guard's cone and get
    // spotted — then run for cover while the alarm is still red.
    for (let index = 0; index < 2 / STEP; index += 1) {
      const move = pilot.decide(STEP);
      world.step(STEP, move.vector, move.sneak, false);
    }
    if (stageAlarm(world, pilot)) {
      for (let extra = 0; extra < 0.8 / STEP; extra += 1) {
        const flee = pilot.decide(STEP);
        world.step(STEP, flee.vector, false, false);
      }
      return { screen: SCREEN_PLAY, best: world.state.score };
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    // Play the whole museum through: all three wings, to the final win screen.
    let cleared = false;
    for (let index = 0; index < WIN_LIMIT_SECONDS / STEP; index += 1) {
      const move = pilot.decide(STEP);
      const events = world.step(STEP, move.vector, move.sneak, false);
      if (events & EVENT_LEVEL) cleared = true;
      if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    }
    return { screen: cleared ? SCREEN_LEVEL : SCREEN_PLAY, best: world.state.score };
  }
  // play: a good stretch of real play in the new wing, cones and cover in frame.
  // The cover shows The Cellar: a coin tossed late in the stretch, so it is still
  // ringing when the frame is taken, with a guard turning toward the ring.
  world.loadLevel(3);
  const throwAt = Math.floor(11.3 / STEP);
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    const move = pilot.decide(STEP);
    if (index === throwAt) world.throwCoin();
    world.step(STEP, move.vector, move.sneak, false);
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
