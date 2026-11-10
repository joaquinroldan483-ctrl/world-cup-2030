/** Random number helpers. `secureRandom` is used for real draws; seeded RNGs for tests and reproducibility. */

export type RNG = () => number;

/** Cryptographically secure uniform random in [0, 1). Falls back to Math.random when crypto is unavailable. */
export const secureRandom: RNG = () => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
};

/** Deterministic PRNG (mulberry32). */
export function seededRandom(seed: number | string): RNG {
  let a = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Unbiased Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: RNG = secureRandom): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uid(prefix = ''): string {
  const r = Math.floor(secureRandom() * 1e9).toString(36);
  return `${prefix}${Date.now().toString(36)}${r}`;
}
