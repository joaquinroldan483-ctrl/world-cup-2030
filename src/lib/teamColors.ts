import { TEAM_BY_ID } from '../engine';

const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const dist = (a: string, b: string) => {
  const x = rgb(a);
  const y = rgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** Two readable, distinguishable colours (on a dark background) for a match's home and away teams. */
export function matchColors(homeId: string, awayId: string): { home: string; away: string } {
  const pick = (id: string) => {
    const t = TEAM_BY_ID[id];
    if (!t) return ['#e8b84a', '#4cc3ff'];
    return [t.color, t.color2].filter((c) => lum(c) > 0.12);
  };
  const h = pick(homeId);
  const a = pick(awayId);
  const home = h[0] ?? '#e8b84a';
  const away = a.find((c) => dist(c, home) > 110) ?? (dist('#e8e8ee', home) > 110 ? '#e8e8ee' : '#4cc3ff');
  return { home, away };
}
