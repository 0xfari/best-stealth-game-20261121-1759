// The Cellar — the fourth wing of Lamplight Heist (v2). A low vaulted cellar under
// the museum: wine racks for cover, pools of shadow between the lamps, one long
// south corridor and a lamp-lit hall where a Lookout slowly turns its wide cone.
//
// Map legend (same as config.js): # wall, . floor, , shadow, L lamp, C crate/case,
// A artifact, E exit, P player start. Every guard patrol walks a straight line, so
// each pair of consecutive waypoints is a clear row or column with no solid tile
// between them — the Runner runs the open south corridor, the two regular guards
// walk clear rows, and the Lookout stands alone by the hall lamp.

import { guardDef } from './guardtypes.js';

export const CELLAR_LEVEL = {
  name: 'The Cellar',
  sub: 'A Lookout turns by the lamp, a Runner works the south corridor. Shadows are deep here.',
  map: [
    '################################',
    '#....LL......C......A....LL....#',
    '#..P...,,....C.............C...#',
    '#..####..,,...C....####....C...#',
    '#..#..#......C.....#..#........#',
    '#..#..#..C.........#..#..C.....#',
    '#..####..C....,,...####..C.....#',
    '#........C....,,.......C....E..#',
    '#..C....L....C.........C.......#',
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
    // The Lookout: one waypoint by the hall lamp, turning its 330 px cone.
    guardDef('lookout', [[10, 8]]),
    // The Runner: the whole south corridor, fast, narrow cone, quick to suspect.
    guardDef('runner', [[4, 16], [27, 16]]),
    // Two regular guards on clear rows through the racks.
    { waypoints: [[4, 2], [12, 2]], speed: 74, cone: 280, pause: 1.0 },
    { waypoints: [[5, 9], [12, 9]], speed: 74, cone: 280, pause: 1.0 },
    { waypoints: [[11, 15], [24, 15]], speed: 74, cone: 280, pause: 1.0 },
  ],
};
