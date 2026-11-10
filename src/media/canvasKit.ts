import { TROPHY_DATA_URL } from '../components/brand';
import { loadAllFlags } from '../lib/flags';

export type Ctx = CanvasRenderingContext2D;

export interface MediaAssets {
  flags: Record<string, HTMLCanvasElement>;
  trophy: HTMLImageElement;
  grain: HTMLCanvasElement;
}

export const FONT = {
  display: '"Anton", Impact, sans-serif',
  cond: '"Barlow Condensed", "Arial Narrow", sans-serif',
  sans: '"Inter Variable", Inter, system-ui, sans-serif',
};

export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(`400 64px ${FONT.display}`),
    document.fonts.load(`700 64px ${FONT.cond}`),
    document.fonts.load(`800 64px ${FONT.cond}`),
    document.fonts.load(`600 64px ${FONT.cond}`),
    document.fonts.load(`500 32px ${FONT.sans}`),
    document.fonts.load(`700 32px ${FONT.sans}`),
  ]);
  await document.fonts.ready;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar una imagen'));
    img.src = src;
  });
}

let assetsCache: Promise<MediaAssets> | null = null;

export function loadAssets(teamIds: string[]): Promise<MediaAssets> {
  if (!assetsCache) {
    assetsCache = (async () => {
      await ensureFonts();
      const [flags, trophy] = await Promise.all([loadAllFlags(teamIds), loadImage(TROPHY_DATA_URL)]);
      const grain = document.createElement('canvas');
      grain.width = grain.height = 256;
      const g = grain.getContext('2d')!;
      const img = g.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 22;
      }
      g.putImageData(img, 0, 0);
      return { flags, trophy, grain };
    })();
    assetsCache.catch(() => (assetsCache = null));
  }
  return assetsCache;
}

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function drawFlag(ctx: Ctx, flag: HTMLCanvasElement | undefined, x: number, y: number, w: number, h: number, r = 6, opts: { shadow?: boolean; border?: string; alpha?: number } = {}) {
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = Math.max(4, h * 0.18);
    ctx.shadowOffsetY = h * 0.05;
  }
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = '#1b2547';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  if (flag) {
    // cover-fit 4:3 source
    const sr = flag.width / flag.height;
    const dr = w / h;
    let sw = flag.width;
    let sh = flag.height;
    if (dr > sr) sh = flag.width / dr;
    else sw = flag.height * dr;
    ctx.drawImage(flag, (flag.width - sw) / 2, (flag.height - sh) / 2, sw, sh, x, y, w, h);
    const sheen = ctx.createLinearGradient(x, y, x, y + h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  if (opts.border) {
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = Math.max(1, h * 0.03);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawFlagCircle(ctx: Ctx, flag: HTMLCanvasElement | undefined, cx: number, cy: number, r: number, ring = 'rgba(255,255,255,0.6)') {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = r * 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1b2547';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  if (flag) ctx.drawImage(flag, (flag.width - flag.height) / 2, 0, flag.height, flag.height, cx - r, cy - r, r * 2, r * 2);
  const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.5, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
}

/** Animated waving flag: vertical strips displaced by a travelling sine wave with shading. */
export function drawWavingFlag(ctx: Ctx, flag: HTMLCanvasElement | undefined, x: number, y: number, w: number, h: number, t: number, amp = 0.06) {
  if (!flag) return;
  const strips = 48;
  const sw = flag.width / strips;
  const dw = w / strips;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = h * 0.12;
  ctx.shadowOffsetY = h * 0.06;
  for (let i = 0; i < strips; i++) {
    const k = i / strips;
    const phase = k * Math.PI * 2.4 - t * 4.2;
    const dy = Math.sin(phase) * h * amp * (0.25 + k);
    const scale = 1 - Math.cos(phase) * 0.02 * k;
    ctx.drawImage(flag, i * sw, 0, sw + 1, flag.height, x + i * dw, y + dy + (h - h * scale) / 2, dw + 1, h * scale);
    if (i === 0) ctx.shadowColor = 'transparent';
    const shade = Math.cos(phase) * 0.22 * (0.3 + k);
    ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade * 0.6})` : `rgba(0,0,0,${-shade})`;
    ctx.fillRect(x + i * dw, y + dy + (h - h * scale) / 2, dw + 1, h * scale);
  }
  ctx.restore();
}

export interface TextOpts {
  font?: keyof typeof FONT;
  weight?: number | string;
  size: number;
  color?: string | CanvasGradient;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
  spacing?: number;
  shadow?: boolean;
  alpha?: number;
  stroke?: string;
}

export function text(ctx: Ctx, str: string, x: number, y: number, o: TextOpts): number {
  ctx.save();
  let size = o.size;
  const set = () => {
    ctx.font = `${o.weight ?? (o.font === 'display' ? 400 : 700)} ${size}px ${FONT[o.font ?? 'cond']}`;
    if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${(o.spacing ?? 0) * (size / o.size)}px`;
  };
  set();
  if (o.maxWidth) {
    while (ctx.measureText(str).width > o.maxWidth && size > 6) {
      size *= 0.94;
      set();
    }
  }
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = size * 0.06;
  }
  if (o.stroke) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = size * 0.08;
    ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color ?? '#fff';
  ctx.fillText(str, x, y);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

export function goldGradient(ctx: Ctx, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff6d2');
  g.addColorStop(0.4, '#f2cf6b');
  g.addColorStop(0.72, '#c8951f');
  g.addColorStop(1, '#f8dd8b');
  return g;
}

export function silverGradient(ctx: Ctx, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#cfd6e6');
  g.addColorStop(0.75, '#8b95ad');
  g.addColorStop(1, '#e6ebf5');
  return g;
}

export function bronzeGradient(ctx: Ctx, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#ffe2c4');
  g.addColorStop(0.45, '#d9924e');
  g.addColorStop(0.75, '#8f5527');
  g.addColorStop(1, '#f0b98a');
  return g;
}

export const HOST_STRIPES = ['#c60b1e', '#ffc400', '#c60b1e', '#046a38', '#da291c', '#c1272d', '#006233'];

export function hostStripe(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const parts = [0.22, 0.11, 0.11, 0.11, 0.11, 0.17, 0.17];
  let cx = x;
  parts.forEach((p, i) => {
    ctx.fillStyle = HOST_STRIPES[i];
    ctx.fillRect(cx, y, w * p + 0.5, h);
    cx += w * p;
  });
}

export interface Palette {
  bg0: string;
  bg1: string;
  glowA: string;
  glowB: string;
  accent: string;
  ink: string;
  muted: string;
  panel: string;
  light: boolean;
}

/** Cinematic stadium background: gradient sky, sweeping floodlights, pitch perspective and vignette. */
export function drawStadium(ctx: Ctx, w: number, h: number, t: number, p: Palette, opts: { beams?: boolean; pitch?: boolean; particles?: boolean; grain?: HTMLCanvasElement; glowColor?: string } = {}) {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, p.bg1);
  g.addColorStop(1, p.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const m = Math.max(w, h);
  const glow = (cx: number, cy: number, r: number, c: string) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  };
  glow(w * 0.12, h * 0.05, m * 0.55, p.glowA);
  glow(w * 0.9, h * 0.1, m * 0.5, p.glowB);
  if (opts.glowColor) glow(w * 0.5, h * 0.45, m * 0.5, opts.glowColor);
  if (opts.pitch !== false && !p.light) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    const horizon = h * 0.62;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = Math.max(1, m * 0.0012);
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * w * 0.02, horizon);
      ctx.lineTo(w / 2 + i * w * 0.22, h);
      ctx.stroke();
    }
    for (let j = 0; j < 9; j++) {
      const yy = horizon + (h - horizon) * Math.pow(j / 8, 1.7);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    const pg = ctx.createLinearGradient(0, horizon, 0, h);
    pg.addColorStop(0, 'rgba(16,178,108,0)');
    pg.addColorStop(1, 'rgba(16,178,108,0.16)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.restore();
  }
  if (opts.beams !== false) {
    ctx.save();
    ctx.globalCompositeOperation = p.light ? 'source-over' : 'lighter';
    const beams = [
      { x: w * 0.08, a: -0.35, s: 0.7 },
      { x: w * 0.3, a: -0.12, s: 0.9 },
      { x: w * 0.7, a: 0.12, s: 0.8 },
      { x: w * 0.92, a: 0.35, s: 0.6 },
    ];
    for (const b of beams) {
      ctx.save();
      ctx.translate(b.x, -h * 0.05);
      ctx.rotate(b.a + Math.sin(t * 0.5 * b.s + b.x) * 0.12);
      const bg = ctx.createLinearGradient(0, 0, 0, h * 1.1);
      bg.addColorStop(0, p.light ? 'rgba(255,255,255,0.35)' : 'rgba(255,248,225,0.16)');
      bg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-m * 0.01, 0);
      ctx.lineTo(m * 0.01, 0);
      ctx.lineTo(m * 0.12, h * 1.1);
      ctx.lineTo(-m * 0.12, h * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  if (opts.particles) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const seed = i * 97.13;
      const px = ((Math.sin(seed) * 0.5 + 0.5) * w + t * (8 + (i % 7) * 4) * (w / 1000)) % w;
      const py = (((Math.cos(seed * 1.7) * 0.5 + 0.5) * h - t * (12 + (i % 5) * 6) * (h / 1000)) % h + h) % h;
      const r = (1 + (i % 4)) * (m / 1400);
      ctx.fillStyle = i % 5 === 0 ? 'rgba(232,184,74,0.55)' : 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, m * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, p.light ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  if (opts.grain) {
    ctx.save();
    ctx.globalAlpha = p.light ? 0.4 : 0.6;
    const pat = ctx.createPattern(opts.grain, 'repeat');
    if (pat) {
      ctx.translate(((t * 997) % 256) | 0, ((t * 613) % 256) | 0);
      ctx.fillStyle = pat;
      ctx.fillRect(-256, -256, w + 512, h + 512);
    }
    ctx.restore();
  }
}

/** The 2030 emblem ring (Spain red, gold, Morocco/Portugal green) around the trophy. */
export function drawEmblem(ctx: Ctx, cx: number, cy: number, r: number, trophy: HTMLImageElement, progress = 1) {
  ctx.save();
  const bg = ctx.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r);
  bg.addColorStop(0, '#1a2a58');
  bg.addColorStop(1, '#060b18');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const colors = ['#e11d2e', '#ffc400', '#10b26c'];
  ctx.lineWidth = r * 0.15;
  ctx.lineCap = 'round';
  const gap = 0.32;
  colors.forEach((c, i) => {
    const a0 = -Math.PI / 2 + (i * Math.PI * 2) / 3 + gap / 2;
    const a1 = a0 + ((Math.PI * 2) / 3 - gap) * Math.min(1, Math.max(0, progress * 3 - i));
    if (a1 <= a0) return;
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, a0, a1);
    ctx.stroke();
  });
  const th = r * 1.2;
  const tw = th * (200 / 320);
  ctx.globalAlpha = Math.min(1, progress * 1.5);
  ctx.drawImage(trophy, cx - tw / 2, cy - th / 2, tw, th);
  ctx.restore();
}

export function drawTrophy(ctx: Ctx, trophy: HTMLImageElement, cx: number, bottom: number, height: number, glow = true) {
  const w = height * (200 / 320);
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, bottom - height * 0.62, 0, cx, bottom - height * 0.55, height * 0.75);
    g.addColorStop(0, 'rgba(255,214,120,0.55)');
    g.addColorStop(0.5, 'rgba(232,184,74,0.15)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - height, bottom - height * 1.4, height * 2, height * 1.6);
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = height * 0.08;
  ctx.shadowOffsetY = height * 0.03;
  ctx.drawImage(trophy, cx - w / 2, bottom - height, w, height);
  ctx.restore();
}

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, p: Palette, border?: string) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = p.panel;
  ctx.fill();
  ctx.strokeStyle = border ?? (p.light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)');
  ctx.lineWidth = Math.max(1, h * 0.006);
  ctx.stroke();
  ctx.restore();
}

export const ease = {
  outCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
  outExpo: (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Progress of a sub-interval [a, b] within [0, 1]. */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
