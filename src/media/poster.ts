import { GROUP_LETTERS, STAGE_LABEL, STAGE_SHORT, TEAM_BY_ID, buildJourney, computeStats, formatMinute, isGoal, totals, type DerivedTournament, type JourneyStep } from '../engine';
import {
  bronzeGradient,
  drawEmblem,
  drawFlag,
  drawFlagCircle,
  drawStadium,
  drawTrophy,
  drawWavingFlag,
  goldGradient,
  hostStripe,
  panel,
  rr,
  silverGradient,
  text,
  type Ctx,
  type MediaAssets,
  type Palette,
} from './canvasKit';

export type PosterTemplate = 'champion' | 'runnerUp' | 'semis' | 'journey' | 'summary';
export type PosterStyle = 'gold' | 'crimson' | 'emerald' | 'hosts' | 'team' | 'white';
export type PosterFormat = 'portrait' | 'story' | 'square';

export const POSTER_SIZES: Record<PosterFormat, [number, number]> = {
  portrait: [2160, 2700],
  story: [2160, 3840],
  square: [2400, 2400],
};

export interface PosterOptions {
  template: PosterTemplate;
  teamId?: string;
  style: PosterStyle;
  format: PosterFormat;
  title?: string;
  subtitle?: string;
}

const hexA = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function posterPalette(style: PosterStyle, teamId?: string): Palette {
  const team = teamId ? TEAM_BY_ID[teamId] : undefined;
  switch (style) {
    case 'crimson':
      return { bg0: '#1a0307', bg1: '#5c0a14', glowA: 'rgba(255,77,91,0.4)', glowB: 'rgba(232,184,74,0.25)', accent: '#f6d77f', ink: '#ffffff', muted: 'rgba(255,230,230,0.65)', panel: 'rgba(0,0,0,0.32)', light: false };
    case 'emerald':
      return { bg0: '#01140b', bg1: '#06492c', glowA: 'rgba(61,220,151,0.35)', glowB: 'rgba(232,184,74,0.25)', accent: '#f6d77f', ink: '#ffffff', muted: 'rgba(220,255,240,0.65)', panel: 'rgba(0,0,0,0.3)', light: false };
    case 'hosts':
      return { bg0: '#070d1c', bg1: '#2a0a12', glowA: 'rgba(225,29,46,0.45)', glowB: 'rgba(16,178,108,0.4)', accent: '#ffc400', ink: '#ffffff', muted: 'rgba(255,255,255,0.65)', panel: 'rgba(5,9,20,0.45)', light: false };
    case 'team':
      return { bg0: '#05080f', bg1: team ? hexA(team.color, 1) : '#16244a', glowA: team ? hexA(team.color2, 0.45) : 'rgba(232,184,74,0.3)', glowB: team ? hexA(team.color, 0.5) : 'rgba(225,29,46,0.3)', accent: '#f6d77f', ink: '#ffffff', muted: 'rgba(255,255,255,0.7)', panel: 'rgba(0,0,0,0.38)', light: false };
    case 'white':
      return { bg0: '#e9e4d8', bg1: '#fbfaf6', glowA: 'rgba(225,29,46,0.12)', glowB: 'rgba(16,178,108,0.12)', accent: '#a87a1c', ink: '#0b1226', muted: 'rgba(11,18,38,0.6)', panel: 'rgba(255,255,255,0.75)', light: true };
    default:
      return { bg0: '#04070f', bg1: '#16244a', glowA: 'rgba(232,184,74,0.32)', glowB: 'rgba(76,195,255,0.18)', accent: '#f6d77f', ink: '#ffffff', muted: 'rgba(220,228,255,0.62)', panel: 'rgba(5,9,20,0.5)', light: false };
  }
}

type Name = (id: string | undefined) => string;

export function renderPoster(ctx: Ctx, W: number, H: number, o: PosterOptions, d: DerivedTournament, name: Name, A: MediaAssets) {
  const p = posterPalette(o.style, o.teamId ?? d.champion);
  const u = W / 1080;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const glowTeam = o.teamId ?? d.champion;
  drawStadium(ctx, W, H, 1.7, p, { particles: true, grain: A.grain, glowColor: glowTeam && o.style !== 'white' ? hexA(TEAM_BY_ID[glowTeam].color, 0.28) : undefined });
  if (o.template === 'summary') summaryPoster(ctx, W, H, u, o, d, name, A, p);
  else journeyPoster(ctx, W, H, u, o, d, name, A, p);
  ctx.restore();
}

function header(ctx: Ctx, W: number, u: number, A: MediaAssets, p: Palette, right: string) {
  hostStripe(ctx, 0, 0, W, 12 * u);
  drawEmblem(ctx, 92 * u, 98 * u, 46 * u, A.trophy);
  text(ctx, 'WORLD CUP 2030', 156 * u, 92 * u, { size: 38 * u, weight: 800, spacing: 6 * u, color: p.ink });
  text(ctx, 'THE ROAD TO GLORY', 158 * u, 124 * u, { size: 21 * u, weight: 700, spacing: 7 * u, color: p.accent });
  if (right) text(ctx, right, W - 60 * u, 106 * u, { size: 22 * u, weight: 700, spacing: 4 * u, color: p.muted, align: 'right', maxWidth: 380 * u });
}

function footer(ctx: Ctx, W: number, H: number, u: number, p: Palette, subtitle?: string) {
  text(ctx, 'ESPAÑA · PORTUGAL · MAROC', W / 2, H - 70 * u, { size: 24 * u, weight: 800, spacing: 12 * u, color: p.ink, align: 'center' });
  text(ctx, subtitle || 'Simulación personalizada · Fan edition', W / 2, H - 38 * u, { size: 17 * u, weight: 600, spacing: 3 * u, color: p.muted, align: 'center', maxWidth: 900 * u });
  hostStripe(ctx, 0, H - 12 * u, W, 12 * u);
}

function headlineFor(o: PosterOptions, kind: string, reachedLabel: string) {
  if (o.title?.trim()) return o.title.trim().toUpperCase();
  if (o.template === 'champion' || kind === 'champion') return 'CAMPEÓN DEL MUNDO';
  if (o.template === 'runnerUp' || kind === 'runnerUp') return 'SUBCAMPEÓN DEL MUNDO';
  if (o.template === 'semis') return 'RECORRIDO HASTA SEMIFINALES';
  if (kind === 'third') return 'TERCER PUESTO DEL MUNDO';
  return reachedLabel.toUpperCase();
}

function journeyPoster(ctx: Ctx, W: number, H: number, u: number, o: PosterOptions, d: DerivedTournament, name: Name, A: MediaAssets, p: Palette) {
  const teamId = o.teamId ?? d.champion;
  const Hu = H / u;
  if (!teamId) {
    header(ctx, W, u, A, p, '');
    text(ctx, 'Elegí una selección', W / 2, H / 2, { font: 'display', size: 90 * u, align: 'center', color: p.ink });
    footer(ctx, W, H, u, p);
    return;
  }
  const j = buildJourney(d, teamId);
  const team = TEAM_BY_ID[teamId];
  const kind = j.status.kind;
  const metal = kind === 'champion' || o.template === 'champion' ? 'gold' : kind === 'runnerUp' || o.template === 'runnerUp' ? 'silver' : kind === 'third' || o.template === 'semis' ? 'bronze' : 'gold';
  const metalGrad = (y0: number, y1: number) => (metal === 'gold' ? goldGradient(ctx, y0, y1) : metal === 'silver' ? silverGradient(ctx, y0, y1) : bronzeGradient(ctx, y0, y1));

  const reachedLabel = `Fase alcanzada: ${kind === 'champion' ? 'Campeón' : STAGE_LABEL[j.reached]}`;
  header(ctx, W, u, A, p, reachedLabel.toUpperCase());

  // giant watermark
  ctx.save();
  ctx.globalAlpha = p.light ? 0.06 : 0.07;
  text(ctx, '2030', W + 40 * u, 760 * u * Math.min(1, Hu / 1350), { font: 'display', size: 560 * u, color: p.ink, align: 'right' });
  ctx.restore();

  // HERO
  const tall = Hu > 1600;
  const roomy = Hu > 1200;
  const heroTop = 175 * u;
  const heroH = (tall ? Math.min(620, Math.max(300, Hu * 0.3)) : roomy ? 400 : 330) * u;
  const fh = heroH * (tall ? 0.82 : 0.78);
  const fw = fh * (4 / 3);
  if (kind === 'champion' || o.template === 'champion') {
    drawWavingFlag(ctx, A.flags[teamId], 70 * u, heroTop + heroH * 0.04, fw, fh, 1.1, 0.05);
    drawTrophy(ctx, A.trophy, W - 230 * u, heroTop + heroH + (tall ? 30 : -10) * u, heroH * (tall ? 1.15 : 1.05));
  } else {
    drawWavingFlag(ctx, A.flags[teamId], (W - fw) / 2 - 60 * u, heroTop + heroH * 0.04, fw, fh, 1.1, 0.05);
    const mx = W - 170 * u;
    const my = heroTop + heroH * 0.45;
    const mr = (tall ? 105 : 85) * u;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 30 * u;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = metalGrad(my - mr, my + mr);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(mx, my, mr * 0.82, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 4 * u;
    ctx.stroke();
    const medalText = kind === 'runnerUp' ? '2º' : kind === 'third' ? '3º' : kind === 'fourth' ? '4º' : STAGE_SHORT[j.reached].toUpperCase();
    text(ctx, medalText, mx, my + mr * 0.26, { font: 'display', size: (medalText.length > 3 ? 0.44 : 0.8) * mr, color: '#1a1206', align: 'center', maxWidth: mr * 1.5 });
  }

  // NAME BLOCK (overlaps the bottom of the hero in compact formats, like a film poster)
  let y: number;
  if (!tall) {
    const fadeTop = heroTop + heroH * 0.4;
    const fade = ctx.createLinearGradient(0, fadeTop, 0, heroTop + heroH + 40 * u);
    fade.addColorStop(0, p.light ? 'rgba(251,250,246,0)' : 'rgba(4,7,15,0)');
    fade.addColorStop(0.55, p.light ? 'rgba(251,250,246,0.8)' : 'rgba(4,7,15,0.7)');
    fade.addColorStop(1, p.light ? 'rgba(251,250,246,0.96)' : 'rgba(4,7,15,0.9)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, fadeTop, W, heroTop + heroH + 40 * u - fadeTop);
    y = heroTop + heroH - (roomy ? 120 : 105) * u;
  } else y = heroTop + heroH + 95 * u;
  const headline = headlineFor(o, kind, reachedLabel);
  const hs = tall ? 48 : 40;
  text(ctx, headline, W / 2, y, { size: hs * u, weight: 800, spacing: 14 * u, color: p.light ? p.accent : metalGrad(y - hs * u, y), align: 'center', maxWidth: 980 * u, shadow: !p.light });
  const ns = tall ? 180 : roomy ? 150 : 132;
  y += (ns - 12) * u;
  text(ctx, name(teamId).toUpperCase(), W / 2, y, { font: 'display', size: ns * u, color: kind === 'champion' ? goldGradient(ctx, y - ns * u, y) : p.ink, align: 'center', maxWidth: 1000 * u, shadow: !p.light });
  y += 48 * u;
  const sub = `${team.confederation} · Grupo ${j.groupIndex !== undefined ? GROUP_LETTERS[j.groupIndex] : '—'} · ${j.wins}G ${j.draws}E ${j.losses}P · ${j.goalsFor}-${j.goalsAgainst} en goles`;
  text(ctx, (o.subtitle?.trim() || sub).toUpperCase(), W / 2, y, { size: 24 * u, weight: 700, spacing: 5 * u, color: p.muted, align: 'center', maxWidth: 960 * u });

  // STATS CHIPS (skipped in the square format, where the subtitle carries them)
  if (roomy) {
    y += 30 * u;
    const chips: [string, number][] = [
      ['PJ', j.wins + j.draws + j.losses],
      ['G', j.wins],
      ['E', j.draws],
      ['P', j.losses],
      ['GF', j.goalsFor],
      ['GC', j.goalsAgainst],
    ];
    const ch = (tall ? 92 : 76) * u;
    const cw = 140 * u;
    const cg = 14 * u;
    let cx = (W - (chips.length * cw + (chips.length - 1) * cg)) / 2;
    for (const [l, v] of chips) {
      panel(ctx, cx, y, cw, ch, 18 * u, p);
      text(ctx, String(v), cx + cw / 2, y + ch * 0.6, { font: 'display', size: ch * 0.52, color: p.ink, align: 'center' });
      text(ctx, l, cx + cw / 2, y + ch * 0.88, { size: 18 * u, weight: 800, spacing: 4 * u, color: p.accent, align: 'center' });
      cx += cw + cg;
    }
    y += ch + 26 * u;
  } else y += 26 * u;

  // PATH
  const bottom = H - 150 * u;
  const scorersLine = j.scorers.length ? `GOLEADORES: ${j.scorers.slice(0, 4).map((s) => `${s.player.toUpperCase()} (${s.goals})`).join(' · ')}` : '';
  const pathBottom = scorersLine ? bottom - 60 * u : bottom;
  const avail = pathBottom - y;
  const ko = j.knockoutSteps;
  if (tall) {
    const rows = j.groupSteps.length + ko.length;
    const rowH = Math.min(118 * u, (avail - 70 * u) / Math.max(rows, 1));
    y = pathSection(ctx, 60 * u, y, W - 120 * u, rowH, `FASE DE GRUPOS · GRUPO ${GROUP_LETTERS[j.groupIndex ?? 0]} · ${j.groupRow?.position ?? '-'}º`, j.groupSteps, teamId, name, A, p, u, true);
    if (ko.length) pathSection(ctx, 60 * u, y + 20 * u, W - 120 * u, rowH, 'ELIMINATORIAS', ko, teamId, name, A, p, u, true);
  } else {
    const colW = (W - 120 * u - 24 * u) / 2;
    const rowH = Math.min(96 * u, (avail - 50 * u) / Math.max(5, ko.length));
    pathSection(ctx, 60 * u, y, colW, rowH, `GRUPO ${GROUP_LETTERS[j.groupIndex ?? 0]} · ${j.groupRow?.position ?? '-'}º · ${j.groupRow?.points ?? 0} PTS`, j.groupSteps, teamId, name, A, p, u, false);
    pathSection(ctx, 60 * u + colW + 24 * u, y, colW, rowH, 'ELIMINATORIAS', ko.length ? ko : [], teamId, name, A, p, u, false);
  }
  if (scorersLine) text(ctx, scorersLine, W / 2, bottom - 14 * u, { size: 26 * u, weight: 800, spacing: 3 * u, color: p.accent, align: 'center', maxWidth: 980 * u });
  footer(ctx, W, H, u, p);
}

function pathSection(ctx: Ctx, x: number, y: number, w: number, rowH: number, title: string, steps: JourneyStep[], teamId: string, name: Name, A: MediaAssets, p: Palette, u: number, wide: boolean): number {
  text(ctx, title, x + 4 * u, y + 26 * u, { size: 24 * u, weight: 800, spacing: 5 * u, color: p.accent, maxWidth: w });
  y += 42 * u;
  if (!steps.length) {
    panel(ctx, x, y, w, rowH, 16 * u, p);
    text(ctx, 'SIN ELIMINATORIAS', x + w / 2, y + rowH / 2 + 9 * u, { size: 24 * u, weight: 700, color: p.muted, align: 'center' });
    return y + rowH;
  }
  for (const s of steps) {
    const h = rowH - 10 * u;
    const k = Math.min(1, h / (76 * u));
    const tb = 34 * u * Math.max(0.75, k);
    const win = s.stage === 'GROUP' ? s.outcome === 'W' : s.advanced;
    const lose = s.stage === 'GROUP' ? s.outcome === 'L' : s.advanced === false;
    panel(ctx, x, y, w, h, 16 * u, p, win ? 'rgba(61,220,151,0.55)' : lose ? 'rgba(255,77,91,0.5)' : undefined);
    const label = s.stage === 'GROUP' ? `J${s.matchday}` : STAGE_SHORT[s.stage].toUpperCase();
    const pad = 16 * u;
    const fh = Math.min(h * 0.5, 44 * u);
    const fw = fh * 4 / 3;
    const mid = y + h / 2;
    text(ctx, label, x + pad, mid + 9 * u * k, { size: (wide ? 26 : 22) * u * k, weight: 800, spacing: 2 * u, color: p.muted, maxWidth: (wide ? 150 : 90) * u });
    let cx = x + pad + (wide ? 160 : 92) * u;
    drawFlag(ctx, A.flags[teamId], cx, mid - fh / 2, fw, fh, 5 * u);
    cx += fw + 12 * u;
    const score = s.outcome === 'pending' ? 'vs' : `${s.goalsFor}-${s.goalsAgainst}`;
    const sw = text(ctx, score, cx, mid + 15 * u * k, { font: 'display', size: (wide ? 50 : 42) * u * k, color: p.ink });
    cx += sw + 12 * u;
    if (s.opponentId) drawFlag(ctx, A.flags[s.opponentId], cx, mid - fh / 2, fw, fh, 5 * u);
    cx += fw + 12 * u;
    const tagW = s.result?.penalties || s.result?.extraTime ? (wide ? 150 : 74) * u : 44 * u;
    const nameMax = x + w - cx - tagW - pad;
    const opp = s.opponentId ? name(s.opponentId).toUpperCase() : 'POR DEFINIR';
    const goals = s.events.filter((e) => e.mine && isGoal(e)).sort((a, b) => a.minute * 100 + (a.added ?? 0) - (b.minute * 100 + (b.added ?? 0)));
    const goalTxt = goals.length ? goals.map((e) => `${formatMinute(e)}${e.player ? ' ' + e.player : ''}`).join(' · ') : '';
    const showGoals = !!goalTxt && h > 72 * u;
    text(ctx, opp, cx, mid + (showGoals ? 0 : 9 * u * k), { size: (wide ? 28 : 24) * u * k, weight: 700, color: p.ink, maxWidth: nameMax });
    if (showGoals) text(ctx, goalTxt, cx, mid + 26 * u, { size: 17 * u, weight: 600, color: p.muted, maxWidth: nameMax, font: 'cond' });
    // result tag
    const tag = s.outcome === 'pending' ? '·' : s.stage === 'GROUP' ? (s.outcome === 'W' ? 'G' : s.outcome === 'D' ? 'E' : 'P') : s.advanced ? '✓' : '✗';
    const extra = s.result?.penalties ? `PEN ${s.isHome ? s.result.penalties.home : s.result.penalties.away}-${s.isHome ? s.result.penalties.away : s.result.penalties.home}` : s.result?.extraTime ? 'PRÓ.' : '';
    if (extra) text(ctx, extra, x + w - pad - tb - 10 * u, mid + 7 * u * k, { size: (wide ? 22 : 17) * u * k, weight: 800, color: p.accent, align: 'right' });
    rr(ctx, x + w - pad - tb, mid - tb / 2, tb, tb, 8 * u);
    ctx.fillStyle = win ? '#10b26c' : lose ? '#e11d2e' : p.light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    text(ctx, tag, x + w - pad - tb / 2, mid + tb * 0.26, { size: tb * 0.7, weight: 800, color: '#fff', align: 'center' });
    y += rowH;
  }
  return y;
}

function summaryPoster(ctx: Ctx, W: number, H: number, u: number, o: PosterOptions, d: DerivedTournament, name: Name, A: MediaAssets, p: Palette) {
  const Hu = H / u;
  const s = computeStats(d);
  header(ctx, W, u, A, p, `${s.matches}/128 PARTIDOS`);
  const showWinners = Hu > 1600;
  const showTiles = Hu > 1200;
  const nameS = Hu > 1600 ? 160 : Hu > 1200 ? 130 : 110;
  const fixed = 270 + 60 + (nameS - 10) + 30 + (d.ko.F?.result ? 134 : 0) + 30 + 150 + (showTiles ? 170 : 0) + 150 + (showWinners ? 330 : 0);
  let y = 230 * u;
  text(ctx, (o.title?.trim() || 'RESUMEN DEL TORNEO').toUpperCase(), W / 2, y, { size: 50 * u, weight: 800, spacing: 16 * u, color: goldGradient(ctx, y - 50 * u, y), align: 'center', maxWidth: 980 * u });
  y += 40 * u;
  // Champion block
  const heroH = Math.min(560, Math.max(170, Hu - fixed)) * u;
  drawTrophy(ctx, A.trophy, W / 2, y + heroH, heroH);
  if (d.champion) {
    const fw = 300 * u;
    const fh = fw * 0.75;
    drawWavingFlag(ctx, A.flags[d.champion], 60 * u, y + heroH * 0.25, fw, fh, 0.6, 0.05);
    if (d.runnerUp) drawWavingFlag(ctx, A.flags[d.runnerUp], W - 60 * u - fw * 0.75, y + heroH * 0.38, fw * 0.75, fh * 0.75, 1.4, 0.05);
  }
  y += heroH + 60 * u;
  text(ctx, 'CAMPEÓN', W / 2, y, { size: 32 * u, weight: 800, spacing: 14 * u, color: p.accent, align: 'center' });
  y += (nameS - 10) * u;
  text(ctx, (d.champion ? name(d.champion) : 'POR DEFINIR').toUpperCase(), W / 2, y, { font: 'display', size: nameS * u, color: goldGradient(ctx, y - nameS * u, y), align: 'center', maxWidth: 1000 * u, shadow: !p.light });
  y += 30 * u;
  // Final
  const f = d.ko.F;
  if (f?.result && f.homeId && f.awayId) {
    const t = totals(f.result);
    const extra = f.result.penalties ? ` · PEN. ${f.result.penalties.home}-${f.result.penalties.away}` : f.result.extraTime ? ' · PRÓRROGA' : '';
    y += 24 * u;
    panel(ctx, 140 * u, y, W - 280 * u, 110 * u, 22 * u, p);
    drawFlag(ctx, A.flags[f.homeId], 175 * u, y + 25 * u, 80 * u, 60 * u, 6 * u);
    drawFlag(ctx, A.flags[f.awayId], W - 255 * u, y + 25 * u, 80 * u, 60 * u, 6 * u);
    text(ctx, `${t.home} - ${t.away}`, W / 2, y + 72 * u, { font: 'display', size: 64 * u, color: p.ink, align: 'center' });
    text(ctx, name(f.homeId).toUpperCase(), 275 * u, y + 66 * u, { size: 26 * u, weight: 800, color: p.ink, maxWidth: 220 * u });
    text(ctx, name(f.awayId).toUpperCase(), W - 275 * u, y + 66 * u, { size: 26 * u, weight: 800, color: p.ink, align: 'right', maxWidth: 220 * u });
    text(ctx, `GRAN FINAL${extra}`, W / 2, y + 100 * u, { size: 18 * u, weight: 800, spacing: 5 * u, color: p.muted, align: 'center' });
    y += 110 * u;
  }
  y += 30 * u;
  // Podium
  const pod: [string, string | undefined][] = [['SUBCAMPEÓN', d.runnerUp], ['TERCERO', d.third], ['CUARTO', d.fourth]];
  const pw = (W - 120 * u - 40 * u) / 3;
  pod.forEach(([l, id], i) => {
    const px = 60 * u + i * (pw + 20 * u);
    panel(ctx, px, y, pw, 124 * u, 20 * u, p);
    drawFlagCircle(ctx, id ? A.flags[id] : undefined, px + 62 * u, y + 62 * u, 38 * u);
    text(ctx, l, px + 120 * u, y + 52 * u, { size: 20 * u, weight: 800, spacing: 4 * u, color: p.accent, maxWidth: pw - 135 * u });
    text(ctx, id ? name(id).toUpperCase() : '—', px + 120 * u, y + 88 * u, { size: 30 * u, weight: 800, color: p.ink, maxWidth: pw - 135 * u });
  });
  y += 150 * u;
  // Stats tiles
  const top = s.topScorers[0];
  const tiles: [string, string, string][] = [
    ['GOLES', String(s.goals), `${s.avgGoals.toFixed(2)} por partido`],
    ['PARTIDOS', String(s.matches), `${s.extraTimeMatches} prórrogas · ${s.shootouts} penales`],
    ['GOLEADOR', top ? String(top.goals) : '–', top ? `${top.player} (${top.teamId})` : 'Sin datos de jugadores'],
    ['MAYOR GOLEADA', s.biggestWins[0] ? `${Math.max(s.biggestWins[0].total.home, s.biggestWins[0].total.away)}-${Math.min(s.biggestWins[0].total.home, s.biggestWins[0].total.away)}` : '–', s.biggestWins[0] ? `${s.biggestWins[0].homeId} vs ${s.biggestWins[0].awayId}` : ''],
  ];
  const tw = (W - 120 * u - 3 * 16 * u) / 4;
  if (showTiles) tiles.forEach(([l, v, sub], i) => {
    const tx = 60 * u + i * (tw + 16 * u);
    panel(ctx, tx, y, tw, 170 * u, 20 * u, p);
    text(ctx, l, tx + tw / 2, y + 40 * u, { size: 19 * u, weight: 800, spacing: 4 * u, color: p.accent, align: 'center', maxWidth: tw - 20 * u });
    text(ctx, v, tx + tw / 2, y + 112 * u, { font: 'display', size: 68 * u, color: p.ink, align: 'center', maxWidth: tw - 20 * u });
    text(ctx, sub, tx + tw / 2, y + 146 * u, { size: 17 * u, weight: 600, color: p.muted, align: 'center', maxWidth: tw - 20 * u });
  });
  if (showTiles) y += 200 * u;
  // Group winners
  const remaining = H - 140 * u - y;
  if (showWinners && remaining > 160 * u && d.groups.length) {
    text(ctx, 'GANADORES DE GRUPO', W / 2, y + 20 * u, { size: 24 * u, weight: 800, spacing: 8 * u, color: p.accent, align: 'center' });
    y += 44 * u;
    const cols = 8;
    const gw = (W - 120 * u) / cols;
    const r = Math.min(40 * u, gw * 0.36, (remaining - 80 * u) / 5.2);
    d.groups.forEach((g, i) => {
      const gx = 60 * u + (i % cols) * gw + gw / 2;
      const gy = y + Math.floor(i / cols) * (r * 2 + 50 * u) + r;
      const winner = g.table.complete ? g.table.rows[0].teamId : undefined;
      drawFlagCircle(ctx, winner ? A.flags[winner] : undefined, gx, gy, r);
      text(ctx, `1${g.letter}`, gx, gy + r + 28 * u, { size: 20 * u, weight: 800, color: p.muted, align: 'center' });
    });
  }
  footer(ctx, W, H, u, p, o.subtitle);
}
