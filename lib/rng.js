/**
 * Mulberry32 Seeded Pseudo-Random Number Generator
 * Deterministic generation so synthetic data remains reproducible across restarts.
 */

function createRng(seed = 428392) {
  let s = seed >>> 0;

  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[int(0, arr.length - 1)];
  }

  function float(min, max, decimals = 2) {
    const val = min + next() * (max - min);
    return Number(val.toFixed(decimals));
  }

  function bool(chance = 0.5) {
    return next() < chance;
  }

  function date(startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const ts = start + next() * (end - start);
    return new Date(ts).toISOString().split('T')[0];
  }

  return { next, int, pick, float, bool, date };
}

const defaultRng = createRng(948215);

module.exports = {
  createRng,
  rng: defaultRng
};
