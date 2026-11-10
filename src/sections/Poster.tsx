import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_TEAM_IDS, TEAMS, TEAM_BY_ID } from '../engine';
import { Icon, type IconName } from '../components/Icon';
import { Button, Card, cx, EmptyState, SectionHeader, Segmented, Select, TextInput } from '../components/ui';
import { canShareFiles, downloadBlob, formatBytes, isIOS, shareFile, slugify } from '../lib/download';
import { navigate } from '../lib/router';
import { loadAssets, type MediaAssets } from '../media/canvasKit';
import { POSTER_SIZES, posterPalette, renderPoster, type PosterFormat, type PosterOptions, type PosterStyle, type PosterTemplate } from '../media/poster';
import { useDerived, useTeamName } from '../store/tournament';
import { toast } from '../store/ui';

const TEMPLATES: { id: PosterTemplate; title: string; desc: string; icon: IconName }[] = [
  { id: 'champion', title: 'Campeón del mundo', desc: 'Trofeo, bandera y el camino completo hacia la gloria.', icon: 'trophy' },
  { id: 'runnerUp', title: 'Subcampeón', desc: 'El recorrido del finalista, con medalla de plata.', icon: 'star' },
  { id: 'semis', title: 'Hasta semifinales', desc: 'Para los semifinalistas: bronce y su camino.', icon: 'bracket' },
  { id: 'journey', title: 'Cualquier selección', desc: 'El recorrido completo de la selección que elijas.', icon: 'road' },
  { id: 'summary', title: 'Resumen del torneo', desc: 'Campeón, podio, final, cifras y ganadores de grupo.', icon: 'stats' },
];

const STYLES: { id: PosterStyle; label: string }[] = [
  { id: 'gold', label: 'Noche dorada' },
  { id: 'hosts', label: 'Anfitriones' },
  { id: 'team', label: 'Colores del equipo' },
  { id: 'crimson', label: 'Carmesí' },
  { id: 'emerald', label: 'Esmeralda' },
  { id: 'white', label: 'Edición blanca' },
];

export default function Poster({ param }: { param?: string }) {
  const d = useDerived();
  const name = useTeamName();
  const [assets, setAssets] = useState<MediaAssets | null>(null);
  const initialTeam = param && TEAM_BY_ID[param] ? param : undefined;
  const [o, setO] = useState<PosterOptions>(() => ({
    template: initialTeam ? (initialTeam === d.champion ? 'champion' : 'journey') : d.champion ? 'champion' : 'journey',
    teamId: initialTeam,
    style: 'gold',
    format: 'portrait',
    title: '',
    subtitle: '',
  }));
  const set = (p: Partial<PosterOptions>) => setO((x) => ({ ...x, ...p }));
  const canvas = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadAssets(ALL_TEAM_IDS).then(setAssets).catch((e) => toast({ kind: 'error', title: 'Error al cargar recursos', message: (e as Error).message }));
  }, []);

  const semifinalists = useMemo(() => ['SF-1', 'SF-2'].flatMap((id) => [d.ko[id]?.homeId, d.ko[id]?.awayId]).filter(Boolean) as string[], [d]);
  const drawnTeams = d.groups.flatMap((g) => g.teamIds);

  const teamId = useMemo(() => {
    if (o.template === 'summary') return undefined;
    if (o.template === 'champion') return d.champion;
    if (o.template === 'runnerUp') return d.runnerUp;
    if (o.template === 'semis') return o.teamId && semifinalists.includes(o.teamId) ? o.teamId : semifinalists[0];
    return o.teamId ?? d.champion ?? drawnTeams[0];
  }, [o.template, o.teamId, d, semifinalists, drawnTeams]);

  const unavailable =
    (o.template === 'champion' && !d.champion) || (o.template === 'runnerUp' && !d.runnerUp) || (o.template === 'semis' && semifinalists.length === 0);

  const [W, H] = POSTER_SIZES[o.format];
  useEffect(() => {
    if (!assets || !canvas.current || unavailable) return;
    const id = requestAnimationFrame(() => {
      const ctx = canvas.current!.getContext('2d')!;
      renderPoster(ctx, W, H, { ...o, teamId }, d, name, assets);
    });
    return () => cancelAnimationFrame(id);
  }, [assets, o, teamId, d, name, W, H, unavailable]);

  if (!d.drawn)
    return (
      <>
        <SectionHeader eyebrow="Legendary Poster · Póster" title="Legendary Poster" />
        <EmptyState icon="poster" title="Necesitamos una historia" message="El póster se arma con los resultados del torneo. Empezá por el sorteo." action={<Button variant="gold" onClick={() => navigate('draw')}>Ir al sorteo</Button>} />
      </>
    );

  const fileBase = slugify(`wc2030-${o.template}-${teamId ? name(teamId) : 'resumen'}`);
  const toBlob = (type: 'image/png' | 'image/jpeg') =>
    new Promise<Blob>((resolve, reject) => canvas.current!.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), type, 0.95));

  const download = async (type: 'image/png' | 'image/jpeg') => {
    setBusy(true);
    try {
      const blob = await toBlob(type);
      if (isIOS() && canShareFiles(type) && (await shareFile(blob, `${fileBase}.${type === 'image/png' ? 'png' : 'jpg'}`, 'World Cup 2030 — Legendary Poster'))) return;
      downloadBlob(blob, `${fileBase}.${type === 'image/png' ? 'png' : 'jpg'}`);
      toast({ kind: 'success', title: 'Póster descargado', message: `${W}×${H} · ${formatBytes(blob.size)}` });
    } catch (e) {
      toast({ kind: 'error', title: 'Error', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    setBusy(true);
    try {
      const blob = await toBlob('image/png');
      if (await shareFile(blob, `${fileBase}.png`, 'World Cup 2030 — Legendary Poster')) return;
      if (navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast({ kind: 'success', title: 'Imagen copiada al portapapeles' });
      } else {
        downloadBlob(blob, `${fileBase}.png`);
        toast({ kind: 'info', title: 'Compartir no disponible', message: 'Se descargó la imagen.' });
      }
    } catch (e) {
      toast({ kind: 'error', title: 'No se pudo compartir', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const teamOptions =
    o.template === 'semis' ? semifinalists : drawnTeams.length ? TEAMS.map((t) => t.id).filter((id) => drawnTeams.includes(id)) : [];

  return (
    <div>
      <SectionHeader eyebrow="Legendary Poster · Póster" title="Legendary Poster" subtitle="Diseñá un póster cinematográfico en alta resolución con el recorrido de una selección o el resumen del Mundial. Se genera como imagen real, lista para descargar y compartir." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="space-y-5 p-5 xl:sticky xl:top-8 xl:self-start">
          <div>
            <div className="label mb-2">Plantilla</div>
            <div className="grid gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => set({ template: t.id })} className={cx('flex items-center gap-3 rounded-xl border p-3 text-left transition', o.template === t.id ? 'border-gold/60 bg-gold/12' : 'border-white/10 hover:border-white/25')}>
                  <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', o.template === t.id ? 'bg-gold text-night-950' : 'bg-white/6 text-white/60')}>
                    <Icon name={t.icon} size={18} />
                  </span>
                  <span>
                    <span className="block font-cond text-[15px] font-bold uppercase tracking-wide">{t.title}</span>
                    <span className="block text-[11px] text-white/45">{t.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {(o.template === 'journey' || o.template === 'semis') && teamOptions.length > 0 && (
            <Select label="Selección" value={teamId ?? ''} onChange={(v) => set({ teamId: v })} options={teamOptions.map((id) => ({ value: id, label: name(id) }))} />
          )}
          <div>
            <div className="label mb-2">Estilo visual</div>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => {
                const p = posterPalette(s.id, teamId ?? d.champion);
                return (
                  <button key={s.id} onClick={() => set({ style: s.id })} className={cx('overflow-hidden rounded-xl border text-left', o.style === s.id ? 'border-gold ring-1 ring-gold/50' : 'border-white/10')}>
                    <div className="h-10" style={{ background: `linear-gradient(135deg, ${p.bg1}, ${p.bg0})` }}>
                      <div className="h-1 host-stripe" />
                    </div>
                    <div className="px-2 py-1.5 font-cond text-[11px] font-bold uppercase tracking-wide">{s.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="label mb-2">Formato</div>
            <Segmented value={o.format} onChange={(format: PosterFormat) => set({ format })} options={[{ value: 'portrait', label: 'Póster 4:5' }, { value: 'story', label: 'Historia 9:16' }, { value: 'square', label: 'Cuadrado' }]} />
          </div>
          <div className="space-y-2">
            <div className="label">Textos personalizados</div>
            <TextInput placeholder="Titular (opcional)" value={o.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} />
            <TextInput placeholder="Subtítulo (opcional)" value={o.subtitle} maxLength={70} onChange={(e) => set({ subtitle: e.target.value })} />
          </div>
        </Card>
        <div className="min-w-0">
          <Card className="p-3 sm:p-5">
            {unavailable ? (
              <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 text-center text-white/55">
                <Icon name="trophy" size={40} className="text-gold-light" />
                <p className="max-w-xs text-sm">Esta plantilla estará disponible cuando se juegue {o.template === 'semis' ? 'hasta las semifinales' : 'la gran final'}.</p>
                <Button size="sm" variant="outline" onClick={() => navigate('knockout')}>Ir a eliminatorias</Button>
              </div>
            ) : !assets ? (
              <div className="flex aspect-[4/5] items-center justify-center text-white/50">Cargando recursos…</div>
            ) : (
              <canvas ref={canvas} width={W} height={H} className={cx('mx-auto block h-auto rounded-xl shadow-2xl', o.format === 'story' ? 'max-w-[420px]' : 'max-w-[640px]', 'w-full')} />
            )}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="gold" icon="download" disabled={busy || unavailable || !assets} onClick={() => download('image/png')}>{isIOS() ? 'Guardar en Fotos' : 'Descargar PNG'}</Button>
              <Button variant="outline" icon="download" disabled={busy || unavailable || !assets} onClick={() => download('image/jpeg')}>JPG</Button>
              <Button variant="outline" icon="share" disabled={busy || unavailable || !assets} onClick={share}>Compartir</Button>
            </div>
            <p className="mt-2 text-center text-[11px] text-white/35">Resolución de exportación: {W}×{H} px</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
