// A tiny seeded random source (mulberry32), so a seed always replays the same night.
// The game never needs Math.random: every roll comes through here.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [min, max). */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}

/** One item from a list, by a roll. */
export function randomPick(random, list) {
  return list[Math.floor(random() * list.length)];
}
