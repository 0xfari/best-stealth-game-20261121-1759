// Two new guard archetypes for Lamplight Heist v2 — the patrols you can learn.
// A guard's kind is just a preset of the numbers createGuard already reads
// (speed, patrolSpeed, cone, pause, detectRate); the archetype table is the only
// place those presets live, so a level def stays one short line.

/** A stationary watcher: never walks its patrol, slowly turns its wide cone. */
export const LOOKOUT = {
  kind: 'lookout',
  /** Chase speed when fully alert (patrol speed is 0 — it stands still). */
  speed: 70,
  /** Patrol speed 0 + a single waypoint = stands on the spot, turning. */
  patrolSpeed: 0,
  /** A long, wide cone: it sees far, so its sweep is the puzzle. */
  cone: 330,
  /** Seconds it keeps turning before the patrol cycle re-arms. */
  pause: 6,
  /** Suspicion fills at the normal rate. */
  detectRate: 1,
};

/** A fast patroller: narrow cone, quick feet, and it gets suspicious fast. */
export const RUNNER = {
  kind: 'runner',
  speed: 108,
  patrolSpeed: 108,
  /** Short, narrow cone: easy to slip behind, deadly when it faces you. */
  cone: 210,
  /** Barely pauses at waypoints — it is always moving. */
  pause: 0.5,
  /** Suspicion fills half again as fast as a regular guard's. */
  detectRate: 1.5,
};

export const GUARD_ARCHETYPES = { lookout: LOOKOUT, runner: RUNNER };

/**
 * A guard definition for a level: the archetype's numbers plus its waypoints.
 * Regular guards keep the plain object shape ({ waypoints, speed, cone, pause })
 * and default to kind 'patrol' with detectRate 1.
 */
export function guardDef(kind, waypoints) {
  const archetype = GUARD_ARCHETYPES[kind];
  return {
    kind,
    waypoints,
    speed: archetype.speed,
    patrolSpeed: archetype.patrolSpeed,
    cone: archetype.cone,
    pause: archetype.pause,
    detectRate: archetype.detectRate,
  };
}
