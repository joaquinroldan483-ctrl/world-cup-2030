import { TEAM_BY_ID } from '../engine';
import { flagUrlForTeam } from '../lib/flags';
import { useTeamName } from '../store/tournament';
import { cx } from './ui';

export function Flag({ id, className, shape = 'rect', title }: { id?: string; className?: string; shape?: 'rect' | 'circle' | 'square'; title?: string }) {
  const name = useTeamName();
  if (!id) {
    return <span className={cx('inline-block shrink-0 bg-white/8 ring-1 ring-white/10', shape === 'circle' ? 'aspect-square rounded-full' : shape === 'square' ? 'aspect-square rounded-md' : 'aspect-[4/3] rounded-[4px]', className)} />;
  }
  return (
    <img
      src={flagUrlForTeam(id)}
      alt={title ?? name(id)}
      title={title ?? name(id)}
      loading="lazy"
      draggable={false}
      className={cx(
        'inline-block shrink-0 object-cover shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-1 ring-white/15',
        shape === 'circle' ? 'aspect-square rounded-full' : shape === 'square' ? 'aspect-square rounded-md' : 'aspect-[4/3] rounded-[4px]',
        className,
      )}
    />
  );
}

/** Custom crest generated from the team's identity colours. */
export function Crest({ id, size = 56, className }: { id: string; size?: number; className?: string }) {
  const t = TEAM_BY_ID[id];
  if (!t) return null;
  const gid = `crest-${id}`;
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${gid}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.color} />
          <stop offset="0.55" stopColor={t.color} />
          <stop offset="0.55" stopColor={t.color2} />
          <stop offset="1" stopColor={t.color2} />
        </linearGradient>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.5" stopColor="#e8b84a" />
          <stop offset="1" stopColor="#8a6214" />
        </linearGradient>
        <linearGradient id={`${gid}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${gid}-c`}>
          <path d="M50 8 88 20v38c0 26-18 42-38 50C30 100 12 84 12 58V20z" />
        </clipPath>
      </defs>
      <path d="M50 3 93 16v42c0 30-21 48-43 56C28 106 7 88 7 58V16z" fill={`url(#${gid}-g)`} />
      <path d="M50 8 88 20v38c0 26-18 42-38 50C30 100 12 84 12 58V20z" fill={`url(#${gid}-a)`} />
      <g clipPath={`url(#${gid}-c)`}>
        <image href={flagUrlForTeam(id)} x="22" y="30" width="56" height="42" preserveAspectRatio="xMidYMid slice" />
        <rect x="22" y="30" width="56" height="42" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" />
        <rect x="0" y="0" width="100" height="115" fill={`url(#${gid}-s)`} />
      </g>
      <path d="M50 14l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill={`url(#${gid}-g)`} />
      <text x="50" y="94" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="17" letterSpacing="2" fill="#fff" stroke="#000" strokeOpacity="0.35" strokeWidth="0.6">
        {id}
      </text>
    </svg>
  );
}

export function TeamLabel({ id, placeholder, className, flagClass, reverse, bold, short }: { id?: string; placeholder?: string; className?: string; flagClass?: string; reverse?: boolean; bold?: boolean; short?: boolean }) {
  const name = useTeamName();
  return (
    <span className={cx('flex min-w-0 items-center gap-2.5', reverse && 'flex-row-reverse text-right', className)}>
      <Flag id={id} className={cx('w-7', flagClass)} />
      <span className={cx('truncate', id ? 'text-white' : 'italic text-white/40', bold && 'font-semibold')}>
        {id ? (short ? id : name(id)) : placeholder ?? 'Por definir'}
      </span>
    </span>
  );
}

/** Original WORLD CUP 2030 emblem: a ring in the hosts' colours around the trophy. */
export function Emblem({ size = 48, className }: { size?: number; className?: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const seg = c / 3;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-label="Emblema World Cup 2030">
      <defs>
        <linearGradient id="emb-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.45" stopColor="#e8b84a" />
          <stop offset="1" stopColor="#9a6c12" />
        </linearGradient>
        <radialGradient id="emb-bg" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#1a2a58" />
          <stop offset="1" stopColor="#060b18" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#emb-bg)" />
      <g transform="rotate(-90 50 50)" fill="none" strokeWidth="7" strokeLinecap="round">
        <circle cx="50" cy="50" r={r} stroke="#e11d2e" strokeDasharray={`${seg - 7} ${c - seg + 7}`} strokeDashoffset="0" />
        <circle cx="50" cy="50" r={r} stroke="#ffc400" strokeDasharray={`${seg - 7} ${c - seg + 7}`} strokeDashoffset={-seg} />
        <circle cx="50" cy="50" r={r} stroke="#10b26c" strokeDasharray={`${seg - 7} ${c - seg + 7}`} strokeDashoffset={-2 * seg} />
      </g>
      <g transform="translate(31 18) scale(0.19)">
        <path d={TROPHY_BODY} fill="url(#emb-gold)" />
        <circle cx="100" cy="78" r="46" fill="url(#emb-gold)" />
        <rect x="60" y="262" width="80" height="44" rx="6" fill="url(#emb-gold)" />
        <rect x="58" y="276" width="84" height="18" fill="#0a7a4a" />
      </g>
    </svg>
  );
}

export const TROPHY_BODY =
  'M76 262 C78 240 72 222 60 198 C46 170 36 142 44 118 C50 100 72 114 100 116 C128 114 150 100 156 118 C164 142 154 170 140 198 C128 222 122 240 124 262 Z';

/** Original golden trophy illustration (SVG markup, reused for DOM and canvas exports). */
export function trophySvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320" width="400" height="640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7a5310"/><stop offset="0.28" stop-color="#e8b84a"/><stop offset="0.45" stop-color="#fff3c4"/>
      <stop offset="0.62" stop-color="#e8b84a"/><stop offset="1" stop-color="#6b470b"/>
    </linearGradient>
    <radialGradient id="b" cx="0.36" cy="0.3" r="0.75">
      <stop offset="0" stop-color="#fffbe6"/><stop offset="0.35" stop-color="#f3cf6a"/><stop offset="0.8" stop-color="#a87a1c"/><stop offset="1" stop-color="#5f3f08"/>
    </radialGradient>
    <linearGradient id="e" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#033d26"/><stop offset="0.5" stop-color="#12b26e"/><stop offset="1" stop-color="#033d26"/>
    </linearGradient>
  </defs>
  <path d="${TROPHY_BODY}" fill="url(#g)"/>
  <g fill="none" stroke="#6b470b" stroke-width="3" stroke-linecap="round" opacity="0.75">
    <path d="M62 202 C92 192 124 168 152 126"/>
    <path d="M70 232 C98 216 128 192 142 172"/>
    <path d="M50 150 C78 150 112 140 132 116"/>
    <path d="M90 116 C70 150 76 200 96 258"/>
  </g>
  <g fill="none" stroke="#fff6d0" stroke-width="1.6" stroke-linecap="round" opacity="0.65">
    <path d="M64 198 C94 188 124 164 150 124"/>
    <path d="M52 146 C80 146 110 136 130 113"/>
  </g>
  <circle cx="100" cy="78" r="48" fill="url(#b)"/>
  <g fill="none" stroke="#6b470b" stroke-width="2.2" opacity="0.7">
    <path d="M100 52 L122 68 L114 94 L86 94 L78 68 Z"/>
    <path d="M100 52 L100 32 M122 68 L142 60 M114 94 L126 114 M86 94 L74 114 M78 68 L58 60"/>
  </g>
  <ellipse cx="84" cy="58" rx="14" ry="9" fill="#fff" opacity="0.35" transform="rotate(-30 84 58)"/>
  <rect x="62" y="260" width="76" height="14" rx="4" fill="url(#g)"/>
  <rect x="58" y="274" width="84" height="28" fill="url(#e)"/>
  <rect x="58" y="274" width="84" height="3" fill="#fff3c4" opacity="0.5"/>
  <rect x="54" y="302" width="92" height="14" rx="4" fill="url(#g)"/>
</svg>`;
}

export const TROPHY_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trophySvg())}`;

export function Trophy({ className, glow = true }: { className?: string; glow?: boolean }) {
  return (
    <div className={cx('relative', className)}>
      {glow && <div className="absolute inset-[-20%] rounded-full bg-[radial-gradient(circle,rgba(232,184,74,0.45),transparent_62%)] blur-xl" />}
      <img src={TROPHY_DATA_URL} alt="Trofeo" className="relative h-full w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" draggable={false} />
    </div>
  );
}

/** Fixed cinematic stadium backdrop: night sky, floodlight beams, pitch glow and grain. */
export function StadiumBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#16244a_0%,#070d1c_45%,#04070f_100%)]" />
      <div className="absolute -left-[10%] top-[-20%] h-[90vh] w-[38vw] origin-top bg-[linear-gradient(180deg,rgba(255,255,255,0.13),transparent_70%)] blur-2xl [--beam-from:-24deg] [--beam-to:-8deg] animate-beam" />
      <div className="absolute right-[-10%] top-[-20%] h-[90vh] w-[38vw] origin-top bg-[linear-gradient(180deg,rgba(255,255,255,0.11),transparent_70%)] blur-2xl [--beam-from:22deg] [--beam-to:6deg] animate-beam [animation-delay:-4s]" />
      <div className="absolute left-1/2 top-[-25%] h-[70vh] w-[24vw] -translate-x-1/2 origin-top bg-[linear-gradient(180deg,rgba(232,184,74,0.12),transparent_70%)] blur-3xl" />
      <div className="absolute inset-x-0 bottom-[-30vh] h-[60vh] bg-[radial-gradient(60%_60%_at_50%_100%,rgba(16,178,108,0.22),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[38vh] pitch-lines [mask-image:linear-gradient(to_top,black,transparent)] [transform:perspective(600px)_rotateX(55deg)] origin-bottom" />
      <div className="absolute left-0 top-0 h-[40vh] w-[40vw] bg-[radial-gradient(circle_at_0%_0%,rgba(225,29,46,0.16),transparent_60%)]" />
      <div className="absolute right-0 top-0 h-[40vh] w-[40vw] bg-[radial-gradient(circle_at_100%_0%,rgba(16,178,108,0.14),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]" />
    </div>
  );
}
