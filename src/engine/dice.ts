/**
 * Seeded dice. A roll is fixed by the game, the turn and what is rolled for,
 * so playing a turn again, or reloading the save before it, casts the same
 * dice: an election lost stays lost. The server that writes the turn's prompt
 * and the browser that applies its answer roll alike.
 */

/** A 32-bit hash of a string (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number in [0, 1) from a 32-bit seed (one step of mulberry32). */
function unit(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The roll for one thing in one turn of one game, in [0, 1). */
export function roll(game: string, turn: number, key: string): number {
  return unit(hash(`${game}|${turn}|${key}`));
}

/** Whether something with this chance (0–1) happens, by the roll for it. */
export const happens = (chance: number, game: string, turn: number, key: string): boolean => roll(game, turn, key) < chance;

/** A fixed number in [0, 1) for a key alone, the same in every game: where a country's term stands when none is known. */
export const fixed = (key: string): number => unit(hash(key));
