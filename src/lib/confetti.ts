/** Lightweight canvas confetti (no dependency). */
interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  w: number;
  h: number;
  color: string;
  spin: number;
  life: number;
}

const PALETTE = ['#e8b84a', '#f8dd8b', '#e11d2e', '#10b26c', '#ffffff', '#ffc400', '#4cc3ff'];

export function fireConfetti(opts: { count?: number; colors?: string[]; origin?: { x: number; y: number }; spread?: number; duration?: number } = {}) {
  if (typeof document === 'undefined') return;
  if (document.documentElement.classList.contains('reduce-motion')) return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '9999' });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const colors = opts.colors ?? PALETTE;
  const count = opts.count ?? 180;
  const origin = opts.origin ?? { x: 0.5, y: 0.35 };
  const spread = opts.spread ?? 1;
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1 * spread;
    const speed = 7 + Math.random() * 11;
    pieces.push({
      x: origin.x * window.innerWidth,
      y: origin.y * window.innerHeight,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: Math.random() * Math.PI,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 9,
      color: colors[(Math.random() * colors.length) | 0],
      spin: (Math.random() - 0.5) * 0.35,
      life: 0,
    });
  }
  const maxLife = (opts.duration ?? 3200) / 16.6;
  let frame = 0;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of pieces) {
      p.life++;
      p.vy += 0.28;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.spin;
      const alpha = Math.max(0, 1 - p.life / maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.abs(Math.cos(p.r * 2)), p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      ctx.restore();
    }
    if (frame < maxLife) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

export function celebrationBurst(colors?: string[]) {
  fireConfetti({ origin: { x: 0.2, y: 0.6 }, count: 110, colors, spread: 0.7 });
  setTimeout(() => fireConfetti({ origin: { x: 0.8, y: 0.6 }, count: 110, colors, spread: 0.7 }), 180);
  setTimeout(() => fireConfetti({ origin: { x: 0.5, y: 0.45 }, count: 160, colors }), 380);
}
