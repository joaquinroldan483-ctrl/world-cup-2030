import {
  GROUP_LETTERS,
  HOST_IDS,
  STAGE_LABEL,
  STAGE_SHORT,
  TEAMS,
  TEAM_BY_ID,
  buildJourney,
  computeStats,
  eventPeriod,
  formatMinute,
  isGoal,
  sortEvents,
  stageMatches,
  totals,
  type DerivedTournament,
  type JourneyStep,
  type KnockoutStage,
  type MatchEvent,
  type MatchResult,
} from '../../engine';
import {
  clamp01,
  drawEmblem,
  drawFlag,
  drawFlagCircle,
  drawStadium,
  drawTrophy,
  drawWavingFlag,
  ease,
  goldGradient,
  HOST_STRIPES,
  hostStripe,
  panel,
  rr,
  seg,
  text,
  type Ctx,
  type MediaAssets,
  type Palette,
} from '../canvasKit';
import type { MusicCue, MusicStyle } from './music';
import { matchColors } from '../../lib/teamColors';
import { dominance } from '../../engine';

export interface RecapOptions {
  format: '16:9' | '9:16';
  duration: number;
  music: MusicStyle;
  crowd: boolean;
  mode: 'tournament' | 'team';
  teamId?: string;
  include: { minutes: boolean; scorers: boolean; cards: boolean; penalties: boolean };
  title: string;
  subtitle: string;
  credit: string;
}

export const VIDEO_SIZE: Record<RecapOptions['format'], [number, number]> = { '16:9': [1920, 1080], '9:16': [1080, 1920] };

type Name = (id: string | undefined) => string;

interface SC {
  ctx: Ctx;
  W: number;
  H: number;
  u: number;
  portrait: boolean;
  A: MediaAssets;
  d: DerivedTournament;
  name: Name;
  pal: Palette;
  o: RecapOptions;
}

interface Scene {
  key: string;
  label: string;
  weight: number;
  cue?: MusicCue['kind'];
  draw: (c: SC, p: number, t: number, dur: number) => void;
}

const PAL: Palette = {
  bg0: '#04070f',
  bg1: '#14224a',
  glowA: 'rgba(225,29,46,0.28)',
  glowB: 'rgba(16,178,108,0.24)',
  accent: '#f6d77f',
  ink: '#ffffff',
  muted: 'rgba(220,228,255,0.7)',
  panel: 'rgba(8,14,32,0.72)',
  light: false,
};

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function bg(c: SC, t: number, glow?: string) {
  drawStadium(c.ctx, c.W, c.H, t, c.pal, { particles: true, grain: c.A.grain, glowColor: glow });
}

/** Animated section title (eyebrow + headline). Returns the y below the title. */
function title(c: SC, p: number, eyebrow: string, headline: string, y?: number): number {
  const { ctx, W, u } = c;
  const e = ease.outCubic(seg(p, 0, 0.18));
  const ty = y ?? (c.portrait ? 230 * u : 170 * u);
  ctx.save();
  ctx.globalAlpha = e;
  const bw = 90 * u * e;
  hostStripe(ctx, W / 2 - bw / 2, ty - 142 * u, bw, 6 * u);
  text(ctx, eyebrow.toUpperCase(), W / 2, ty - 100 * u, { size: 28 * u, weight: 800, spacing: 12 * u, color: c.pal.accent, align: 'center' });
  text(ctx, headline.toUpperCase(), W / 2 + (1 - e) * 80 * u, ty + 26 * u, { font: 'display', size: (c.portrait ? 92 : 104) * u, color: goldGradient(ctx, ty - 70 * u, ty + 26 * u), align: 'center', maxWidth: W - 120 * u, shadow: true });
  ctx.restore();
  return ty + 70 * u;
}

function fadeOut(c: SC, p: number) {
  const a = seg(p, 0.93, 1);
  if (a <= 0) return;
  c.ctx.save();
  c.ctx.fillStyle = `rgba(4,7,15,${a * 0.35})`;
  c.ctx.fillRect(0, 0, c.W, c.H);
  c.ctx.restore();
}

/** Compact match card: two rows (flag, name, score), winner highlighted. */
function matchCard(c: SC, x: number, y: number, w: number, h: number, homeId: string | undefined, awayId: string | undefined, r: MatchResult | undefined, winnerId: string | undefined, a: number, label?: string) {
  const { ctx, u, A, name, pal } = c;
  ctx.save();
  ctx.globalAlpha *= a;
  panel(ctx, x, y, w, h, 14 * u, pal, winnerId ? 'rgba(232,184,74,0.35)' : undefined);
  const rows: [string | undefined, 'home' | 'away'][] = [[homeId, 'home'], [awayId, 'away']];
  const top = label ? 26 * u : 0;
  if (label) text(ctx, label, x + 14 * u, y + 20 * u, { size: 15 * u, weight: 800, spacing: 3 * u, color: pal.muted, maxWidth: w - 28 * u });
  const rh = (h - top) / 2;
  const tot = r ? totals(r) : null;
  rows.forEach(([id, side], i) => {
    const ry = y + top + i * rh;
    const win = !!id && id === winnerId;
    if (win) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, 'rgba(232,184,74,0.25)');
      g.addColorStop(1, 'rgba(232,184,74,0)');
      ctx.fillStyle = g;
      rr(ctx, x + 2 * u, ry + 2 * u, w - 4 * u, rh - 4 * u, 10 * u);
      ctx.fill();
    }
    const fh = Math.min(rh * 0.56, 46 * u);
    drawFlag(ctx, id ? A.flags[id] : undefined, x + 14 * u, ry + (rh - fh) / 2, fh * 4 / 3, fh, 4 * u);
    const fs = Math.min(rh * 0.42, 34 * u);
    text(ctx, id ? name(id).toUpperCase() : '—', x + 24 * u + fh * 4 / 3, ry + rh / 2 + fs * 0.36, { size: fs, weight: 800, color: win || !winnerId ? '#fff' : 'rgba(255,255,255,0.5)', maxWidth: w - fh * 4 / 3 - 110 * u });
    if (tot) {
      const pens = r?.penalties ? ` (${r.penalties[side]})` : '';
      text(ctx, `${tot[side]}${pens}`, x + w - 16 * u, ry + rh / 2 + fs * 0.45, { font: 'display', size: fs * 1.2, color: win ? '#f6d77f' : '#fff', align: 'right' });
    }
  });
  ctx.restore();
}

function eventsLine(c: SC, r: MatchResult, teamId?: string): string {
  const parts: string[] = [];
  for (const e of sortEvents(r.events)) {
    if (teamId && e.teamId !== teamId) continue;
    const goal = isGoal(e) && eventPeriod(e) !== 'shootout';
    const card = c.o.include.cards && (e.type === 'red' || e.type === 'yellow');
    const pen = c.o.include.penalties && e.type === 'penalty_miss';
    if (!goal && !card && !pen) continue;
    const icon = goal ? (e.type === 'own_goal' ? '(a.g.)' : e.type === 'penalty_goal' ? '(p)' : '') : e.type === 'red' ? '■' : e.type === 'yellow' ? '▪' : '✗';
    const who = c.o.include.scorers && e.player ? e.player : '';
    const min = c.o.include.minutes ? formatMinute(e) : '';
    parts.push([min, who, icon].filter(Boolean).join(' ') || '●');
  }
  return parts.join('   ·   ');
}


/** Momentum band: bars above the line for the home team, below for the away team, revealed left to right. */
function drawMomentum(c: SC, x: number, y: number, w: number, h: number, r: MatchResult, reveal: number) {
  const values = r.momentum;
  if (!values?.length || reveal <= 0) return;
  const { ctx, u } = c;
  const col = matchColors(r.homeId, r.awayId);
  const n = values.length;
  const bw = w / n;
  const mid = y + h / 2;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, reveal * 3);
  panel(ctx, x - 14 * u, y - 10 * u, w + 28 * u, h + 20 * u, 14 * u, c.pal);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, mid - 1 * u, w, 2 * u);
  const shown = Math.floor(n * reveal);
  for (let i = 0; i < shown; i++) {
    const v = values[i];
    if (!v) continue;
    const bh = (Math.abs(v) / 100) * (h / 2 - 4 * u);
    ctx.fillStyle = v > 0 ? col.home : col.away;
    rr(ctx, x + i * bw + 1.5 * u, v > 0 ? mid - bh : mid, bw - 3 * u, bh, 3 * u);
    ctx.fill();
  }
  const d = dominance(values);
  text(ctx, `${d.home}%`, x - 24 * u, mid - 6 * u, { size: 24 * u, weight: 800, color: col.home, align: 'right' });
  text(ctx, `${d.away}%`, x - 24 * u, mid + 26 * u, { size: 24 * u, weight: 800, color: col.away, align: 'right' });
  text(ctx, 'MOMENTUM', x + w + 24 * u, mid + 8 * u, { size: 20 * u, weight: 800, spacing: 4 * u, color: c.pal.muted });
  ctx.restore();
}

/** Big versus card with waving flags, animated score reveal and the goal story. */
function versus(c: SC, p: number, t: number, homeId: string, awayId: string, r: MatchResult | undefined, winnerId: string | undefined, stage: string, big = false) {
  const { ctx, W, H, u, A, name, portrait } = c;
  const cy = portrait ? H * 0.42 : H * 0.5;
  const fw = (portrait ? 420 : big ? 560 : 500) * u;
  const fh = fw * 0.75;
  const slide = ease.outExpo(seg(p, 0.05, 0.35));
  const gap = portrait ? 0 : (big ? 230 : 210) * u;
  if (portrait) {
    drawWavingFlag(ctx, A.flags[homeId], W / 2 - fw / 2 - (1 - slide) * W, cy - fh - 230 * u, fw, fh, t);
    drawWavingFlag(ctx, A.flags[awayId], W / 2 - fw / 2 + (1 - slide) * W, cy + 220 * u, fw, fh, t + 0.6);
    text(ctx, name(homeId).toUpperCase(), W / 2, cy - 160 * u, { font: 'display', size: 64 * u, color: '#fff', align: 'center', maxWidth: W - 100 * u, shadow: true, alpha: slide });
    text(ctx, name(awayId).toUpperCase(), W / 2, cy + 190 * u, { font: 'display', size: 64 * u, color: '#fff', align: 'center', maxWidth: W - 100 * u, shadow: true, alpha: slide });
  } else {
    drawWavingFlag(ctx, A.flags[homeId], W / 2 - gap - fw - (1 - slide) * W * 0.6, cy - fh / 2 - 40 * u, fw, fh, t);
    drawWavingFlag(ctx, A.flags[awayId], W / 2 + gap + (1 - slide) * W * 0.6, cy - fh / 2 - 40 * u, fw, fh, t + 0.6);
    text(ctx, name(homeId).toUpperCase(), W / 2 - gap - fw / 2, cy + fh / 2 + 50 * u, { font: 'display', size: 62 * u, color: winnerId && winnerId !== homeId ? 'rgba(255,255,255,0.55)' : '#fff', align: 'center', maxWidth: fw + 60 * u, shadow: true, alpha: slide });
    text(ctx, name(awayId).toUpperCase(), W / 2 + gap + fw / 2, cy + fh / 2 + 50 * u, { font: 'display', size: 62 * u, color: winnerId && winnerId !== awayId ? 'rgba(255,255,255,0.55)' : '#fff', align: 'center', maxWidth: fw + 60 * u, shadow: true, alpha: slide });
  }
  const sp = seg(p, 0.35, 0.5);
  const scoreY = portrait ? cy + 55 * u : cy + 10 * u;
  if (!r || sp <= 0) {
    text(ctx, 'VS', W / 2, scoreY, { font: 'display', size: 120 * u, color: goldGradient(ctx, scoreY - 110 * u, scoreY), align: 'center', alpha: slide * (1 - sp), shadow: true });
  }
  if (r && sp > 0) {
    const tot = totals(r);
    const s = 1 + (1 - ease.outBack(sp)) * 0.6;
    ctx.save();
    ctx.translate(W / 2, scoreY - 50 * u);
    ctx.scale(s, s);
    text(ctx, `${tot.home} - ${tot.away}`, 0, 50 * u, { font: 'display', size: (big ? 190 : 160) * u, color: goldGradient(ctx, -100 * u, 50 * u), align: 'center', shadow: true, alpha: sp });
    ctx.restore();
    if (sp < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,240,200,${(1 - sp) * 0.5})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const extra = [r.extraTime ? 'PRÓRROGA' : '', r.penalties && c.o.include.penalties !== false ? `PENALES ${r.penalties.home}-${r.penalties.away}` : ''].filter(Boolean).join(' · ');
    if (extra) text(ctx, extra, W / 2, scoreY + 60 * u, { size: 34 * u, weight: 800, spacing: 6 * u, color: '#f6d77f', align: 'center', alpha: sp });
    const ev = seg(p, 0.55, 0.7);
    if (ev > 0) {
      const lh = eventsLine(c, r, homeId);
      const la = eventsLine(c, r, awayId);
      const ly = portrait ? cy + 220 * u + fh + 60 * u : r.momentum?.length ? H - 118 * u : H - 150 * u;
      if (portrait) {
        if (lh) text(ctx, lh, W / 2, cy - fh - 260 * u, { size: 28 * u, weight: 700, color: c.pal.muted, align: 'center', maxWidth: W - 80 * u, alpha: ev });
        if (la) text(ctx, la, W / 2, ly, { size: 28 * u, weight: 700, color: c.pal.muted, align: 'center', maxWidth: W - 80 * u, alpha: ev });
      } else {
        if (lh) text(ctx, lh, W / 2 - gap - fw / 2, ly, { size: 28 * u, weight: 700, color: c.pal.muted, align: 'center', maxWidth: fw + 120 * u, alpha: ev });
        if (la) text(ctx, la, W / 2 + gap + fw / 2, ly, { size: 28 * u, weight: 700, color: c.pal.muted, align: 'center', maxWidth: fw + 120 * u, alpha: ev });
      }
    }
    if (r.momentum?.length) {
      const mw = (portrait ? 760 : 900) * u;
      const my = portrait ? H - 330 * u : cy + fh / 2 + 82 * u;
      drawMomentum(c, (W - mw) / 2, my, mw, (portrait ? 120 : 76) * u, r, ease.outCubic(seg(p, 0.5, 0.75)));
    }
    if (winnerId) {
      const wp = seg(p, 0.7, 0.85);
      if (wp > 0) {
        const wy = portrait ? H - 130 * u : r.momentum?.length ? H - 42 * u : H - 70 * u;
        const label = stage === 'F' ? `${name(winnerId).toUpperCase()} · CAMPEÓN DEL MUNDO` : stage === '3P' ? `${name(winnerId).toUpperCase()} · TERCER PUESTO` : `${name(winnerId).toUpperCase()} AVANZA`;
        text(ctx, label, W / 2, wy, { size: 40 * u, weight: 800, spacing: 8 * u, color: '#fff', align: 'center', alpha: ease.outCubic(wp), maxWidth: W - 100 * u, shadow: true });
      }
    }
  }
}

function confetti(c: SC, t: number, amount = 1) {
  const { ctx, W, H, u } = c;
  const colors = ['#f6d77f', '#e8b84a', '#ffffff', '#e11d2e', '#10b26c'];
  ctx.save();
  for (let i = 0; i < 160 * amount; i++) {
    const s = i * 12.9898;
    const x0 = (Math.sin(s) * 43758.5453) % 1;
    const sp = 0.25 + ((i * 7) % 10) / 20;
    const y = ((t * sp * 0.35 + ((i * 37) % 100) / 100) % 1.2) - 0.1;
    const x = (Math.abs(x0) + Math.sin(t * 2 + i) * 0.02) * W;
    ctx.save();
    ctx.translate(x, y * H);
    ctx.rotate(t * 3 + i);
    ctx.fillStyle = colors[i % colors.length];
    const sz = (8 + (i % 5) * 3) * u;
    ctx.fillRect(-sz / 2, (-sz / 4) * Math.abs(Math.cos(t * 5 + i)), sz, (sz / 2) * Math.abs(Math.cos(t * 5 + i)) + 1);
    ctx.restore();
  }
  ctx.restore();
}

function grid(n: number, cols: number, x: number, y: number, w: number, h: number, gapX: number, gapY: number) {
  const rows = Math.ceil(n / cols);
  const cw = (w - gapX * (cols - 1)) / cols;
  const ch = (h - gapY * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => ({ x: x + (i % cols) * (cw + gapX), y: y + Math.floor(i / cols) * (ch + gapY), w: cw, h: ch }));
}

/* ------------------------------------------------------------------ SCENES */

const introScene = (): Scene => ({
  key: 'intro',
  label: 'Presentación',
  weight: 1.6,
  cue: 'whistle',
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, portrait } = c;
    bg(c, t);
    const e = ease.outBack(seg(p, 0, 0.3));
    const er = (portrait ? 170 : 115) * u * Math.max(0.01, e);
    const ey = portrait ? H * 0.28 : H * 0.25;
    drawEmblem(ctx, W / 2, ey, er, A.trophy, seg(p, 0.05, 0.4));
    const tp = ease.outCubic(seg(p, 0.25, 0.5));
    ctx.save();
    ctx.globalAlpha = tp;
    text(ctx, 'WORLD CUP', W / 2, ey + (portrait ? 170 : 115) * u + 75 * u, { size: 64 * u, weight: 800, spacing: (40 - tp * 26) * u, color: '#fff', align: 'center' });
    ctx.restore();
    const yp = ease.outExpo(seg(p, 0.35, 0.6));
    const y2030 = ey + (portrait ? 170 : 115) * u + (portrait ? 320 : 290) * u;
    if (yp > 0) {
      ctx.save();
      ctx.translate(W / 2, y2030);
      ctx.scale(0.8 + yp * 0.2, 0.8 + yp * 0.2);
      text(ctx, '2030', 0, 0, { font: 'display', size: (portrait ? 260 : 230) * u, color: goldGradient(ctx, -220 * u, 0), align: 'center', alpha: yp, shadow: true });
      ctx.restore();
    }
    const fp = seg(p, 0.55, 0.8);
    if (fp > 0) {
      const fw = (portrait ? 230 : 200) * u;
      const fh = fw * 0.75;
      const total = fw * 3 + 60 * u * 2;
      const fy = portrait ? H * 0.76 : H * 0.8;
      HOST_IDS.forEach((id, i) => {
        const a = ease.outCubic(seg(fp, i * 0.2, i * 0.2 + 0.5));
        const fx = W / 2 - total / 2 + i * (fw + 60 * u);
        ctx.save();
        ctx.globalAlpha = a;
        drawWavingFlag(ctx, A.flags[id], fx, fy - fh / 2 + (1 - a) * 40 * u, fw, fh, t + i);
        ctx.restore();
      });
    }
    const st = seg(p, 0.7, 0.9);
    if (st > 0) text(ctx, (c.o.title || 'THE ROAD TO GLORY').toUpperCase(), W / 2, portrait ? H * 0.88 : H * 0.95, { size: 38 * u, weight: 800, spacing: 14 * u, color: c.pal.accent, align: 'center', alpha: st, maxWidth: W - 100 * u });
    // light sweep
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sx = -W * 0.5 + seg(p, 0.3, 0.75) * W * 2;
    const g = ctx.createLinearGradient(sx - 200 * u, 0, sx + 200 * u, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,240,200,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
});

const teamsScene = (): Scene => ({
  key: 'teams',
  label: 'Selecciones',
  weight: 1.2,
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, portrait } = c;
    bg(c, t);
    const y0 = title(c, p, '6 confederaciones', '64 selecciones');
    const cols = portrait ? 8 : 16;
    const area = grid(64, cols, 70 * u, y0 + 40 * u, W - 140 * u, (portrait ? H - y0 - 260 * u : H - y0 - 140 * u), 16 * u, 16 * u);
    TEAMS.forEach((tm, i) => {
      const cell = area[i];
      const k = seg(p, 0.1 + (i / 64) * 0.5, 0.2 + (i / 64) * 0.5);
      const r = Math.min(cell.w, cell.h) * 0.42 * ease.outBack(k);
      if (r <= 0.5) return;
      drawFlagCircle(ctx, A.flags[tm.id], cell.x + cell.w / 2, cell.y + cell.h / 2, r, 'rgba(255,255,255,0.5)');
    });
    const counts = ['UEFA 21', 'CAF 13', 'AFC 12', 'CONMEBOL 8', 'CONCACAF 8', 'OFC 2'].join('   ·   ');
    text(ctx, counts, W / 2, H - (portrait ? 160 : 60) * u, { size: 30 * u, weight: 800, spacing: 3 * u, color: c.pal.muted, align: 'center', alpha: seg(p, 0.5, 0.7), maxWidth: W - 100 * u });
    fadeOut(c, p);
  },
});

const drawScene = (): Scene => ({
  key: 'draw',
  label: 'Sorteo',
  weight: 1.4,
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, d, portrait } = c;
    bg(c, t);
    const y0 = title(c, p, 'Draw Ceremony', 'El sorteo');
    const cols = portrait ? 4 : 8;
    const cells = grid(16, cols, 60 * u, y0 + 30 * u, W - 120 * u, H - y0 - (portrait ? 160 : 70) * u, 16 * u, 16 * u);
    d.groups.forEach((g, gi) => {
      const k = ease.outCubic(seg(p, 0.12 + gi * 0.035, 0.22 + gi * 0.035));
      if (k <= 0) return;
      const cell = cells[gi];
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(0, (1 - k) * 40 * u);
      panel(ctx, cell.x, cell.y, cell.w, cell.h, 16 * u, c.pal);
      text(ctx, `GRUPO ${g.letter}`, cell.x + cell.w / 2, cell.y + 42 * u, { font: 'display', size: 34 * u, color: '#f6d77f', align: 'center' });
      const rh = (cell.h - 60 * u) / 4;
      g.teamIds.forEach((id, i) => {
        const ry = cell.y + 56 * u + i * rh;
        const fh = Math.min(rh * 0.62, 40 * u);
        drawFlag(ctx, A.flags[id], cell.x + 14 * u, ry + (rh - fh) / 2, fh * 4 / 3, fh, 4 * u);
        text(ctx, id, cell.x + 24 * u + fh * 4 / 3, ry + rh / 2 + 10 * u, { size: Math.min(28 * u, rh * 0.5), weight: 800, color: '#fff' });
      });
      ctx.restore();
    });
    fadeOut(c, p);
  },
});

const groupStageScene = (): Scene => ({
  key: 'groups',
  label: 'Fase de grupos',
  weight: 2.2,
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, d, name, portrait } = c;
    bg(c, t);
    const y0 = title(c, p, '96 partidos · 16 grupos', 'Fase de grupos');
    const page = Math.min(3, Math.floor(p * 4));
    const pp = p * 4 - page;
    const groups = d.groups.slice(page * 4, page * 4 + 4);
    const cells = grid(4, portrait ? 1 : 4, 60 * u, y0 + 40 * u, W - 120 * u, H - y0 - (portrait ? 140 : 90) * u, 24 * u, 20 * u);
    const inA = ease.outCubic(seg(pp, 0, 0.2));
    const outA = 1 - seg(pp, 0.88, 1);
    groups.forEach((g, i) => {
      const cell = cells[i];
      const k = ease.outCubic(seg(pp, i * 0.05, 0.2 + i * 0.05));
      ctx.save();
      ctx.globalAlpha = Math.min(k, page === 3 ? 1 : outA) * inA;
      ctx.translate((1 - k) * 80 * u, 0);
      panel(ctx, cell.x, cell.y, cell.w, cell.h, 18 * u, c.pal);
      text(ctx, `GRUPO ${g.letter}`, cell.x + 20 * u, cell.y + 46 * u, { font: 'display', size: 38 * u, color: '#f6d77f' });
      text(ctx, 'PTS', cell.x + cell.w - 20 * u, cell.y + 44 * u, { size: 20 * u, weight: 800, color: c.pal.muted, align: 'right' });
      const rh = (cell.h - 70 * u) / 4;
      g.table.rows.forEach((r, ri) => {
        const ry = cell.y + 62 * u + ri * rh;
        if (ri < 2) {
          ctx.fillStyle = 'rgba(16,178,108,0.16)';
          rr(ctx, cell.x + 8 * u, ry + 3 * u, cell.w - 16 * u, rh - 6 * u, 10 * u);
          ctx.fill();
        }
        const fh = Math.min(rh * 0.55, 42 * u);
        text(ctx, String(r.position), cell.x + 22 * u, ry + rh / 2 + 10 * u, { size: 28 * u, weight: 800, color: ri < 2 ? '#3ddc97' : c.pal.muted });
        drawFlag(ctx, A.flags[r.teamId], cell.x + 52 * u, ry + (rh - fh) / 2, fh * 4 / 3, fh, 4 * u);
        text(ctx, name(r.teamId).toUpperCase(), cell.x + 64 * u + fh * 4 / 3, ry + rh / 2 + 10 * u, { size: Math.min(28 * u, rh * 0.42), weight: 800, color: '#fff', maxWidth: cell.w - 160 * u - fh * 4 / 3 });
        text(ctx, String(r.points), cell.x + cell.w - 20 * u, ry + rh / 2 + 13 * u, { font: 'display', size: 38 * u, color: '#fff', align: 'right' });
      });
      ctx.restore();
    });
    fadeOut(c, p);
  },
});

const highlightsScene = (): Scene => ({
  key: 'highlights',
  label: 'Resultados destacados',
  weight: 1.3,
  draw: (c, p, t) => {
    const { ctx, W, H, u, d, portrait } = c;
    bg(c, t);
    const y0 = title(c, p, 'Los partidos que marcaron el torneo', 'Resultados destacados');
    const s = computeStats(d);
    const picks = [...s.biggestWins.slice(0, 2), ...s.highestScoring.slice(0, 4)].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i).slice(0, 4);
    const cells = grid(picks.length || 1, portrait ? 1 : 2, 100 * u, y0 + 40 * u, W - 200 * u, H - y0 - (portrait ? 220 : 110) * u, 30 * u, 26 * u);
    picks.forEach((m, i) => {
      const k = ease.outBack(seg(p, 0.15 + i * 0.12, 0.35 + i * 0.12));
      const cell = cells[i];
      const label = m.stage === 'GROUP' ? `GRUPO ${GROUP_LETTERS[m.group ?? 0]}` : STAGE_LABEL[m.stage].toUpperCase();
      matchCard(c, cell.x, cell.y + (1 - k) * 50 * u, cell.w, cell.h, m.homeId, m.awayId, m.result, m.winnerId, clamp01(k), label);
    });
    if (!picks.length) text(ctx, 'Sin resultados todavía', W / 2, H / 2, { font: 'display', size: 60 * u, align: 'center', color: '#fff' });
    fadeOut(c, p);
  },
});

const qualifiedScene = (): Scene => ({
  key: 'qualified',
  label: 'Clasificados',
  weight: 1.1,
  cue: 'boom',
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, d, portrait } = c;
    bg(c, t);
    const y0 = title(c, p, 'Rumbo a dieciseisavos', 'Los 32 clasificados');
    const cols = portrait ? 4 : 8;
    const cells = grid(32, cols, 80 * u, y0 + 30 * u, W - 160 * u, H - y0 - (portrait ? 150 : 60) * u, 14 * u, 10 * u);
    d.qualified.forEach((id, i) => {
      const k = ease.outBack(seg(p, 0.12 + i * 0.012, 0.25 + i * 0.012));
      const cell = cells[i];
      const r = Math.min(cell.w * 0.3, cell.h * 0.34) * Math.max(0, k);
      if (r < 1) return;
      drawFlagCircle(ctx, A.flags[id], cell.x + cell.w / 2, cell.y + cell.h * 0.42, r, '#3ddc97');
      text(ctx, id, cell.x + cell.w / 2, cell.y + cell.h * 0.42 + r + 30 * u, { size: 24 * u, weight: 800, color: '#fff', align: 'center', alpha: clamp01(k) });
    });
    fadeOut(c, p);
  },
});

const roundScene = (stage: KnockoutStage): Scene => ({
  key: stage,
  label: STAGE_LABEL[stage],
  weight: stage === 'R32' ? 1.5 : stage === 'R16' ? 1.2 : 1.1,
  cue: 'boom',
  draw: (c, p, t) => {
    const { W, H, u, d, portrait } = c;
    bg(c, t);
    const ms = stageMatches(d, stage);
    const y0 = title(c, p, `${ms.length * 2} selecciones · ${ms.length} partidos`, STAGE_LABEL[stage]);
    const cols = portrait ? (stage === 'R32' ? 2 : stage === 'R16' ? 2 : 1) : stage === 'R32' ? 4 : stage === 'R16' ? 4 : 2;
    const cells = grid(ms.length, cols, 70 * u, y0 + 30 * u, W - 140 * u, H - y0 - (portrait ? 150 : 60) * u, 20 * u, 14 * u);
    ms.forEach((m, i) => {
      const k = ease.outCubic(seg(p, 0.12 + i * (0.4 / ms.length), 0.3 + i * (0.4 / ms.length)));
      const cell = cells[i];
      matchCard(c, cell.x + (1 - k) * 60 * u, cell.y, cell.w, cell.h, m.homeId, m.awayId, m.result, m.winnerId, k);
    });
    fadeOut(c, p);
  },
});

const versusScene = (stage: KnockoutStage, matchIds: string[]): Scene => ({
  key: `vs-${stage}-${matchIds.join()}`,
  label: STAGE_LABEL[stage],
  weight: stage === 'F' ? 1.8 : 1.2,
  cue: stage === 'F' ? 'roar' : 'boom',
  draw: (c, p, t) => {
    const { d, u, W, H } = c;
    const n = matchIds.length;
    const idx = Math.min(n - 1, Math.floor(p * n));
    const lp = p * n - idx;
    const m = d.ko[matchIds[idx]];
    bg(c, t, m?.winnerId && lp > 0.7 ? hexA(TEAM_BY_ID[m.winnerId].color, 0.3) : undefined);
    const head = stage === 'SF' && n > 1 ? `${STAGE_LABEL[stage]} · ${idx + 1}` : STAGE_LABEL[stage];
    title(c, lp, stage === 'F' ? 'World Cup 2030' : 'Knockout', head, c.portrait ? 170 * u : 130 * u);
    if (m?.homeId && m.awayId) versus(c, lp, t, m.homeId, m.awayId, m.result, m.winnerId, stage, stage === 'F');
    else text(c.ctx, 'POR DEFINIR', W / 2, H / 2, { font: 'display', size: 90 * u, align: 'center', color: '#fff' });
    if (lp > 0.93 && idx === n - 1) fadeOut(c, lp);
  },
});

const championScene = (teamId: string): Scene => ({
  key: 'champion',
  label: 'Campeón',
  weight: 1.8,
  cue: 'climax',
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, name, portrait } = c;
    const team = TEAM_BY_ID[teamId];
    drawStadium(ctx, W, H, t, { ...c.pal, bg1: team.color, glowA: hexA(team.color2, 0.5), glowB: 'rgba(232,184,74,0.45)' }, { particles: true, grain: A.grain });
    const fw = (portrait ? W * 0.9 : W * 0.62);
    const fh = fw * 0.75;
    ctx.save();
    ctx.globalAlpha = 0.85 * ease.outCubic(seg(p, 0, 0.25));
    drawWavingFlag(ctx, A.flags[teamId], (W - fw) / 2, portrait ? H * 0.08 : H * 0.06, fw, fh, t, 0.05);
    ctx.restore();
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(4,7,15,0.1)');
    shade.addColorStop(0.55, 'rgba(4,7,15,0.55)');
    shade.addColorStop(1, 'rgba(4,7,15,0.95)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
    const tr = ease.outExpo(seg(p, 0.15, 0.5));
    const th = (portrait ? 760 : 620) * u;
    drawTrophy(ctx, A.trophy, W / 2, (portrait ? H * 0.68 : H * 0.72) + (1 - tr) * H * 0.6, th);
    const tp = ease.outBack(seg(p, 0.4, 0.6));
    if (tp > 0) {
      text(ctx, 'CAMPEONES DEL MUNDO', W / 2, portrait ? H * 0.76 : H * 0.8, { size: 54 * u, weight: 800, spacing: (30 - tp * 16) * u, color: '#fff', align: 'center', alpha: clamp01(tp), shadow: true, maxWidth: W - 80 * u });
      ctx.save();
      ctx.translate(W / 2, portrait ? H * 0.86 : H * 0.95);
      ctx.scale(0.7 + tp * 0.3, 0.7 + tp * 0.3);
      text(ctx, name(teamId).toUpperCase(), 0, 0, { font: 'display', size: (portrait ? 150 : 170) * u, color: goldGradient(ctx, -160 * u, 0), align: 'center', alpha: clamp01(tp), shadow: true, maxWidth: W - 100 * u });
      ctx.restore();
    }
    if (p > 0.4) confetti(c, t, 1);
  },
});

const pathScene = (teamId: string, label = 'El camino del campeón'): Scene => ({
  key: 'path',
  label: 'Recorrido',
  weight: 1.6,
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, d, name, portrait } = c;
    bg(c, t, hexA(TEAM_BY_ID[teamId].color, 0.25));
    const j = buildJourney(d, teamId);
    const y0 = title(c, p, name(teamId), label);
    const steps: JourneyStep[] = [...j.groupSteps, ...j.knockoutSteps];
    const rowsH = H - y0 - (portrait ? 160 : 60) * u;
    const rh = Math.min(rowsH / Math.max(steps.length, 1), 110 * u);
    const x = portrait ? 50 * u : W * 0.18;
    const w = portrait ? W - 100 * u : W * 0.64;
    steps.forEach((s, i) => {
      const k = ease.outCubic(seg(p, 0.12 + i * 0.07, 0.25 + i * 0.07));
      if (k <= 0) return;
      const y = y0 + 20 * u + i * rh;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate((1 - k) * -80 * u, 0);
      const win = s.stage === 'GROUP' ? s.outcome === 'W' : s.advanced;
      panel(ctx, x, y, w, rh - 12 * u, 16 * u, c.pal, win ? 'rgba(61,220,151,0.5)' : s.outcome === 'L' || s.advanced === false ? 'rgba(255,77,91,0.45)' : undefined);
      const mid = y + (rh - 12 * u) / 2;
      text(ctx, s.stage === 'GROUP' ? `GRUPO · J${s.matchday}` : STAGE_SHORT[s.stage].toUpperCase(), x + 24 * u, mid + 10 * u, { size: 28 * u, weight: 800, color: c.pal.accent, maxWidth: 200 * u });
      const fh = Math.min(rh * 0.5, 48 * u);
      let cx = x + (portrait ? 230 : 260) * u;
      drawFlag(ctx, A.flags[teamId], cx, mid - fh / 2, fh * 4 / 3, fh, 4 * u);
      cx += fh * 4 / 3 + 16 * u;
      const sw = text(ctx, s.outcome === 'pending' ? 'vs' : `${s.goalsFor}-${s.goalsAgainst}`, cx, mid + 18 * u, { font: 'display', size: 52 * u, color: '#fff' });
      cx += sw + 16 * u;
      if (s.opponentId) drawFlag(ctx, A.flags[s.opponentId], cx, mid - fh / 2, fh * 4 / 3, fh, 4 * u);
      cx += fh * 4 / 3 + 16 * u;
      const extra = s.result?.penalties ? ` (pen. ${s.isHome ? s.result.penalties.home : s.result.penalties.away}-${s.isHome ? s.result.penalties.away : s.result.penalties.home})` : s.result?.extraTime ? ' (pró.)' : '';
      text(ctx, `${s.opponentId ? name(s.opponentId).toUpperCase() : '—'}${extra}`, cx, mid + 11 * u, { size: 32 * u, weight: 800, color: '#fff', maxWidth: x + w - cx - 24 * u });
      ctx.restore();
    });
    fadeOut(c, p);
  },
});

const teamIntroScene = (teamId: string): Scene => ({
  key: 'team-intro',
  label: 'Selección',
  weight: 1.4,
  cue: 'boom',
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, d, name, portrait } = c;
    const team = TEAM_BY_ID[teamId];
    drawStadium(ctx, W, H, t, { ...c.pal, bg1: team.color, glowA: hexA(team.color2, 0.45) }, { particles: true, grain: A.grain });
    const fw = portrait ? W * 0.8 : W * 0.42;
    const fh = fw * 0.75;
    const k = ease.outExpo(seg(p, 0, 0.35));
    drawWavingFlag(ctx, A.flags[teamId], (W - fw) / 2, (portrait ? H * 0.16 : H * 0.12) + (1 - k) * 100 * u, fw, fh, t);
    const j = buildJourney(d, teamId);
    const tp = ease.outCubic(seg(p, 0.3, 0.55));
    const ny = portrait ? H * 0.16 + fh + 200 * u : H * 0.12 + fh + 170 * u;
    text(ctx, name(teamId).toUpperCase(), W / 2, ny, { font: 'display', size: 170 * u, color: goldGradient(ctx, ny - 160 * u, ny), align: 'center', alpha: tp, shadow: true, maxWidth: W - 100 * u });
    text(ctx, `${team.confederation} · GRUPO ${j.groupIndex !== undefined ? GROUP_LETTERS[j.groupIndex] : '—'}`, W / 2, ny + 70 * u, { size: 40 * u, weight: 800, spacing: 12 * u, color: '#fff', align: 'center', alpha: tp });
    text(ctx, 'THE ROAD TO GLORY', W / 2, ny + 130 * u, { size: 30 * u, weight: 800, spacing: 14 * u, color: c.pal.accent, align: 'center', alpha: seg(p, 0.5, 0.7) });
    fadeOut(c, p);
  },
});

const teamGroupScene = (teamId: string): Scene => ({
  key: 'team-group',
  label: 'Fase de grupos',
  weight: 1.6,
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, d, name, portrait } = c;
    bg(c, t, hexA(TEAM_BY_ID[teamId].color, 0.25));
    const j = buildJourney(d, teamId);
    const g = j.groupIndex !== undefined ? d.groups[j.groupIndex] : undefined;
    const y0 = title(c, p, name(teamId), `Grupo ${g?.letter ?? ''}`);
    if (!g) return;
    const tableW = portrait ? W - 120 * u : W * 0.4;
    const tableH = portrait ? 420 * u : H - y0 - 120 * u;
    const tx = portrait ? 60 * u : 90 * u;
    panel(ctx, tx, y0 + 30 * u, tableW, tableH, 20 * u, c.pal);
    const rh = (tableH - 30 * u) / 4;
    g.table.rows.forEach((r, i) => {
      const k = ease.outCubic(seg(p, 0.15 + i * 0.06, 0.3 + i * 0.06));
      const ry = y0 + 45 * u + i * rh;
      ctx.save();
      ctx.globalAlpha = k;
      if (r.teamId === teamId) {
        ctx.fillStyle = 'rgba(232,184,74,0.18)';
        rr(ctx, tx + 10 * u, ry, tableW - 20 * u, rh - 8 * u, 12 * u);
        ctx.fill();
      }
      text(ctx, String(r.position), tx + 30 * u, ry + rh / 2 + 8 * u, { size: 34 * u, weight: 800, color: i < 2 ? '#3ddc97' : c.pal.muted });
      drawFlag(ctx, A.flags[r.teamId], tx + 70 * u, ry + rh / 2 - 26 * u, 64 * u, 48 * u, 5 * u);
      text(ctx, name(r.teamId).toUpperCase(), tx + 150 * u, ry + rh / 2 + 10 * u, { size: 32 * u, weight: 800, color: '#fff', maxWidth: tableW - 260 * u });
      text(ctx, `${r.points}`, tx + tableW - 30 * u, ry + rh / 2 + 14 * u, { font: 'display', size: 46 * u, color: '#fff', align: 'right' });
      ctx.restore();
    });
    const mx = portrait ? 60 * u : tx + tableW + 50 * u;
    const my = portrait ? y0 + 30 * u + tableH + 30 * u : y0 + 30 * u;
    const mw = portrait ? W - 120 * u : W - mx - 90 * u;
    const mh = portrait ? H - my - 180 * u : tableH;
    j.groupSteps.forEach((s, i) => {
      const k = ease.outBack(seg(p, 0.35 + i * 0.1, 0.55 + i * 0.1));
      const ch = (mh - 40 * u) / 3;
      const f = g.table.fixtures.find((x) => x.id === s.matchId)!;
      matchCard(c, mx, my + i * (ch + 20 * u) + (1 - clamp01(k)) * 40 * u, mw, ch, f.homeId, f.awayId, s.result, s.result ? (s.outcome === 'W' ? teamId : s.outcome === 'L' ? s.opponentId : undefined) : undefined, clamp01(k), `JORNADA ${s.matchday}`);
    });
    fadeOut(c, p);
  },
});

const endOfRoadScene = (teamId: string): Scene => ({
  key: 'team-end',
  label: 'Final del camino',
  weight: 1.3,
  cue: 'boom',
  draw: (c, p, t) => {
    const { W, H, u, A, d, name, portrait, ctx } = c;
    bg(c, t, hexA(TEAM_BY_ID[teamId].color, 0.3));
    const j = buildJourney(d, teamId);
    const y0 = title(c, p, name(teamId), j.status.kind === 'alive' ? 'El camino continúa' : 'Fin del camino');
    const k = ease.outBack(seg(p, 0.15, 0.4));
    drawFlagCircle(ctx, A.flags[teamId], W / 2, y0 + (portrait ? 260 : 200) * u, 150 * u * Math.max(0.01, k), '#f6d77f');
    text(ctx, j.status.label.toUpperCase(), W / 2, y0 + (portrait ? 500 : 420) * u, { size: 50 * u, weight: 800, spacing: 6 * u, color: '#fff', align: 'center', alpha: seg(p, 0.3, 0.5), maxWidth: W - 100 * u });
    const stats = `${j.wins}G · ${j.draws}E · ${j.losses}P   ·   ${j.goalsFor} GOLES A FAVOR · ${j.goalsAgainst} EN CONTRA`;
    text(ctx, stats, W / 2, y0 + (portrait ? 580 : 490) * u, { size: 32 * u, weight: 700, color: c.pal.muted, align: 'center', alpha: seg(p, 0.4, 0.6), maxWidth: W - 100 * u });
    if (j.scorers.length && c.o.include.scorers) text(ctx, `GOLEADORES: ${j.scorers.slice(0, 4).map((s) => `${s.player} (${s.goals})`).join(' · ')}`, W / 2, y0 + (portrait ? 650 : 550) * u, { size: 30 * u, weight: 700, color: c.pal.accent, align: 'center', alpha: seg(p, 0.5, 0.7), maxWidth: W - 100 * u });
    void H;
    fadeOut(c, p);
  },
});

const outroScene = (): Scene => ({
  key: 'outro',
  label: 'Imagen final',
  weight: 1.4,
  draw: (c, p, t) => {
    const { ctx, W, H, u, A, d, name, portrait } = c;
    bg(c, t, 'rgba(232,184,74,0.25)');
    // rays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(W / 2, H * 0.42);
    ctx.rotate(t * 0.08);
    for (let i = 0; i < 18; i++) {
      ctx.rotate((Math.PI * 2) / 18);
      const g = ctx.createLinearGradient(0, 0, 0, -Math.max(W, H));
      g.addColorStop(0, 'rgba(255,220,140,0.12)');
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-60 * u, -Math.max(W, H));
      ctx.lineTo(60 * u, -Math.max(W, H));
      ctx.fill();
    }
    ctx.restore();
    const k = ease.outCubic(seg(p, 0, 0.4));
    const th = (portrait ? 900 : 640) * u * (0.85 + k * 0.15);
    drawTrophy(ctx, A.trophy, W / 2, (portrait ? H * 0.62 : H * 0.7), th);
    const tp = seg(p, 0.25, 0.5);
    const champ = c.o.mode === 'team' ? c.o.teamId : d.champion;
    text(ctx, 'WORLD CUP 2030', W / 2, portrait ? H * 0.72 : H * 0.8, { font: 'display', size: (portrait ? 130 : 120) * u, color: goldGradient(ctx, H * 0.7, H * 0.8), align: 'center', alpha: tp, shadow: true });
    text(ctx, (c.o.subtitle || (champ ? `${name(champ)} · ${c.o.mode === 'team' ? 'The Road to Glory' : 'Campeón del mundo'}` : 'The Road to Glory')).toUpperCase(), W / 2, portrait ? H * 0.77 : H * 0.87, { size: 40 * u, weight: 800, spacing: 10 * u, color: '#fff', align: 'center', alpha: seg(p, 0.35, 0.55), maxWidth: W - 100 * u });
    text(ctx, 'ESPAÑA · PORTUGAL · MAROC', W / 2, portrait ? H * 0.82 : H * 0.92, { size: 28 * u, weight: 800, spacing: 12 * u, color: c.pal.accent, align: 'center', alpha: seg(p, 0.45, 0.65) });
    if (c.o.credit) text(ctx, c.o.credit, W / 2, H - (portrait ? 120 : 40) * u, { size: 24 * u, weight: 600, color: c.pal.muted, align: 'center', alpha: seg(p, 0.55, 0.75), maxWidth: W - 100 * u });
    hostStripe(ctx, 0, H - 10 * u, W * seg(p, 0.3, 0.8), 10 * u);
    const fo = seg(p, 0.9, 1);
    if (fo > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fo})`;
      ctx.fillRect(0, 0, W, H);
    }
  },
});

/* ------------------------------------------------------------------ TIMELINE */

export interface Timeline {
  duration: number;
  scenes: { scene: Scene; start: number; dur: number }[];
  cues: MusicCue[];
  render: (ctx: Ctx, t: number) => void;
}

export function buildTimeline(d: DerivedTournament, o: RecapOptions, name: Name, A: MediaAssets, W: number, H: number): Timeline {
  const scenes: Scene[] = [introScene()];
  if (o.mode === 'team' && o.teamId) {
    const j = buildJourney(d, o.teamId);
    scenes.push(teamIntroScene(o.teamId));
    if (j.groupIndex !== undefined) scenes.push(teamGroupScene(o.teamId));
    for (const s of j.knockoutSteps) if (s.result) scenes.push(versusScene(s.stage as KnockoutStage, [s.matchId]));
    if (j.status.kind === 'champion') {
      scenes.push(championScene(o.teamId));
      scenes.push(pathScene(o.teamId, 'El camino del campeón'));
    } else {
      scenes.push(pathScene(o.teamId, 'Su recorrido'));
      scenes.push(endOfRoadScene(o.teamId));
    }
  } else {
    scenes.push(teamsScene());
    if (d.drawn) scenes.push(drawScene(), groupStageScene());
    const any = Object.keys(d.t.results).length > 0;
    if (any) scenes.push(highlightsScene());
    if (d.qualified.length === 32) scenes.push(qualifiedScene());
    for (const st of ['R32', 'R16', 'QF'] as KnockoutStage[]) if (stageMatches(d, st).some((m) => m.result)) scenes.push(roundScene(st));
    if (stageMatches(d, 'SF').some((m) => m.result)) scenes.push(versusScene('SF', ['SF-1', 'SF-2']));
    if (d.ko['3P'].result) scenes.push(versusScene('3P', ['3P']));
    if (d.ko.F.result) scenes.push(versusScene('F', ['F']));
    if (d.champion) scenes.push(championScene(d.champion), pathScene(d.champion));
  }
  scenes.push(outroScene());

  const totalW = scenes.reduce((n, s) => n + s.weight, 0);
  const placed: Timeline['scenes'] = [];
  let acc = 0;
  for (const s of scenes) {
    const dur = (s.weight / totalW) * o.duration;
    placed.push({ scene: s, start: acc, dur });
    acc += dur;
  }
  const cues: MusicCue[] = [];
  placed.forEach((p, i) => {
    if (i > 0) cues.push({ time: p.start, kind: 'whoosh' });
    if (p.scene.cue) cues.push({ time: p.start + (p.scene.cue === 'climax' || p.scene.cue === 'roar' ? p.dur * 0.42 : 0), kind: p.scene.cue });
  });
  if (!cues.some((c) => c.kind === 'climax')) {
    const last = placed[placed.length - 1];
    cues.push({ time: last.start, kind: 'climax' });
  }

  const u = Math.min(W, H) / 1080;
  const sc = (ctx: Ctx): SC => ({ ctx, W, H, u, portrait: H > W, A, d, name, pal: PAL, o });
  const TRANS = 0.55;

  const render = (ctx: Ctx, t: number) => {
    const c = sc(ctx);
    let i = placed.findIndex((p) => t < p.start + p.dur);
    if (i < 0) i = placed.length - 1;
    const cur = placed[i];
    const lt = t - cur.start;
    const p = clamp01(lt / cur.dur);
    const tr = Math.min(TRANS, cur.dur * 0.3);
    if (i > 0 && lt < tr) {
      const prev = placed[i - 1];
      ctx.save();
      prev.scene.draw(c, 1, prev.start + prev.dur, prev.dur);
      ctx.restore();
      const e = ease.inOutCubic(lt / tr);
      const skew = H * 0.35;
      const edge = -skew + e * (W + skew * 2);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(edge + skew, 0);
      ctx.lineTo(edge - skew, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.clip();
      cur.scene.draw(c, p, t, cur.dur);
      ctx.restore();
      // host stripes along the wipe edge
      const sw = 26 * u;
      HOST_STRIPES.slice(0, 4).forEach((col, k) => {
        ctx.save();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.95;
        const off = edge + k * sw;
        ctx.beginPath();
        ctx.moveTo(off + skew, 0);
        ctx.lineTo(off + skew + sw, 0);
        ctx.lineTo(off - skew + sw, H);
        ctx.lineTo(off - skew, H);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    } else {
      cur.scene.draw(c, p, t, cur.dur);
    }
  };

  return { duration: o.duration, scenes: placed, cues: cues.sort((a, b) => a.time - b.time), render };
}

export type { MatchEvent };
