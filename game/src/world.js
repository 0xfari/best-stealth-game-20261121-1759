// The game's rules and state, with no drawing and no browser in it: the thief, the
// guards, the artifacts, the exit, lives and score across three levels. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react —
// sounds, screens, announcements — without the world knowing about any of them.

import { LEVELS, LIVES, SCORE } from './config.js';
import { parseLevel } from './level.js';
import { createPlayer } from './player.js';
import { createGuard, GUARD_ALERT } from './guard.js';

export const EVENT_PICKUP = 1;
export const EVENT_ALERT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;

const ARTIFACT_NAMES = ['the Jade Fox', 'the Moon Pearl', 'the Gilded Mask'];

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: null,
    player: null,
    guards: [],
    score: 0,
    lives: LIVES,
    /** Seconds spent on the current level (drives the time bonus). */
    elapsed: 0,
    /** Seconds spent across the whole run (shown on the win screen). */
    totalElapsed: 0,
    artifactsTaken: 0,
    artifactsTotal: 0,
    exitOpen: false,
    /** True once any guard went fully alert on this level (kills the ghost bonus). */
    everAlerted: false,
    /** The highest suspicion of any guard right now (the HUD's exposure bar). */
    exposure: 0,
    /** Score when the current level began (a caught thief loses this level's gains). */
    levelStartScore: 0,
    /** True once the last wing is cleared: the run is over and nothing scores again. */
    finished: false,
    /** The name of the artifact just taken, for the announcement. */
    lastPickup: '',
    /** The guard whose footstep just sounded, with its distance and pan. */
    guardStep: null,
    /** True on the step the player's footstep sounded (drives the audio). */
    playerStepped: false,
    /** The wing just cleared, and whether it was cleared unseen (the level panel). */
    clearedName: '',
    clearedGhost: false,
  };

  function loadLevel(index) {
    state.levelIndex = index;
    state.finished = false;
    state.level = parseLevel(LEVELS[index]);
    state.player = createPlayer(state.level);
    state.guards = state.level.def.guards.map((def, guardIndex) => createGuard(state.level, def, guardIndex));
    state.elapsed = 0;
    state.artifactsTaken = 0;
    state.artifactsTotal = state.level.artifacts.length;
    state.exitOpen = false;
    state.everAlerted = false;
    state.exposure = 0;
    state.levelStartScore = state.score;
    state.lastPickup = '';
    state.guardStep = null;
    for (const artifact of state.level.artifacts) artifact.taken = false;
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.totalElapsed = 0;
    loadLevel(0);
  }

  /**
   * One fixed step. `vector` is the player's steering vector, `sneak` is Shift.
   * With `harmless` set (the title screen's backdrop) the world moves but nothing is
   * collected, no guard can catch the player and the clock does not run.
   */
  function step(dt, vector, sneak, harmless) {
    let events = 0;
    const player = state.player.state;
    const madeNoise = state.player.step(dt, vector, sneak);
    state.playerStepped = madeNoise && !harmless;
    const noise = madeNoise && !harmless ? { x: player.x, y: player.y } : null;

    state.guardStep = null;
    for (const guard of state.guards) {
      const result = guard.step(dt, player, noise);
      if (result === 'alert') {
        state.everAlerted = true;
        events |= EVENT_ALERT;
      }
      if (guard.state.stepped) {
        const distance = Math.hypot(guard.state.x - player.x, guard.state.y - player.y);
        const pan = (guard.state.x - player.x) / 340;
        state.guardStep = { distance, pan };
      }
    }
    // Exposure is the highest suspicion of any guard right now.
    state.exposure = state.guards.reduce((max, guard) => Math.max(max, guard.state.suspicion), 0);

    if (!harmless) {
      state.elapsed += dt;
      state.totalElapsed += dt;

      for (let index = 0; index < state.level.artifacts.length; index += 1) {
        const artifact = state.level.artifacts[index];
        if (artifact.taken) continue;
        const distance = Math.hypot(artifact.x - player.x, artifact.y - player.y);
        if (distance < 28) {
          artifact.taken = true;
          state.artifactsTaken += 1;
          state.score += SCORE.artifact;
          state.lastPickup = ARTIFACT_NAMES[index % ARTIFACT_NAMES.length];
          events |= EVENT_PICKUP;
          if (state.artifactsTaken === state.artifactsTotal) state.exitOpen = true;
        }
      }

      if (state.exitOpen && !state.finished) {
        const distance = Math.hypot(state.level.exit.x - player.x, state.level.exit.y - player.y);
        if (distance < 30) {
          const timeBonus = Math.max(0, SCORE.timeBonus - Math.floor(state.elapsed) * SCORE.timePenalty);
          state.score += SCORE.levelClear + timeBonus + (state.everAlerted ? 0 : SCORE.ghost);
          if (state.levelIndex + 1 >= LEVELS.length) {
            state.finished = true;
            events |= EVENT_WIN;
          } else {
            events |= EVENT_LEVEL;
            state.clearedName = LEVELS[state.levelIndex].name;
            state.clearedGhost = !state.everAlerted;
            loadLevel(state.levelIndex + 1);
          }
          return events;
        }
      }

      if (!state.finished) {
        for (const guard of state.guards) {
          if (guard.state.mode !== GUARD_ALERT) continue;
          const distance = Math.hypot(guard.state.x - player.x, guard.state.y - player.y);
          if (distance < 26) {
            state.lives -= 1;
            state.score = state.levelStartScore;
            events |= EVENT_CAUGHT;
            if (state.lives <= 0) {
              events |= EVENT_OVER;
            } else {
              loadLevel(state.levelIndex);
            }
            return events;
          }
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, loadLevel };
}
