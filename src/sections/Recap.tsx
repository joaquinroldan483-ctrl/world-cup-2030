import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_TEAM_IDS, TEAMS, TEAM_BY_ID } from '../engine';
import { Flag } from '../components/brand';
import { Icon } from '../components/Icon';
import { Button, Card, Chip, cx, EmptyState, IconButton, ProgressBar, SectionHeader, Segmented, Select, TextInput, Toggle } from '../components/ui';
import { canShareFiles, downloadBlob, formatBytes, isIOS, keepAwake, shareFile, slugify, unlockAudio } from '../lib/download';
import { navigate } from '../lib/router';
import { loadAssets, type MediaAssets } from '../media/canvasKit';
import { canUseWebCodecs, encodeMp4, EncodeAbort, recordRealtime, type EncodeResult } from '../media/video/encode';
import { MUSIC_STYLES, renderSoundtrack } from '../media/video/music';
import { buildTimeline, VIDEO_SIZE, type RecapOptions } from '../media/video/scenes';
import { useDerived, useStore, useTeamName } from '../store/tournament';
import { toast } from '../store/ui';

const DURATIONS = [30, 60, 90, 120];

export default function Recap({ param }: { param?: string }) {
  const d = useDerived();
  const name = useTeamName();
  const tName = useStore((s) => s.t.name);
  const [assets, setAssets] = useState<MediaAssets | null>(null);
  const [opts, setOpts] = useState<RecapOptions>(() => ({
    format: '16:9',
    duration: 60,
    music: 'epic',
    crowd: true,
    mode: param && TEAM_BY_ID[param] ? 'team' : 'tournament',
    teamId: param && TEAM_BY_ID[param] ? param : undefined,
    include: { minutes: true, scorers: true, cards: false, penalties: true },
    title: 'The Road to Glory',
    subtitle: '',
    credit: '',
  }));
  const set = (p: Partial<RecapOptions>) => setOpts((o) => ({ ...o, ...p }));

  useEffect(() => {
    loadAssets(ALL_TEAM_IDS).then(setAssets).catch((e) => toast({ kind: 'error', title: 'No se pudieron cargar los recursos', message: (e as Error).message }));
  }, []);

  const teamId = opts.mode === 'team' ? opts.teamId ?? d.champion ?? d.groups[0]?.teamIds[0] : undefined;
  const effective = useMemo(() => ({ ...opts, teamId }), [opts, teamId]);

  if (!d.drawn)
    return (
      <>
        <SectionHeader eyebrow="Cinematic Recap · Vídeo épico" title="Cinematic Recap" accent="crimson" />
        <EmptyState icon="film" title="Todavía no hay historia que contar" message="Hacé el sorteo y cargá resultados: el vídeo resume el Mundial completo o el recorrido de una selección." action={<Button variant="gold" onClick={() => navigate('draw')}>Ir al sorteo</Button>} />
      </>
    );

  return (
    <div>
      <SectionHeader
        eyebrow="Cinematic Recap · Vídeo épico"
        title="Cinematic Recap"
        accent="crimson"
        subtitle="Generá un vídeo MP4 real, en 1080p, con transiciones, banderas animadas, marcadores, efectos de estadio y música instrumental original creada en tu navegador."
      />
      {opts.mode === 'tournament' && !d.champion && (
        <Card className="mb-5 flex items-center gap-3 border-gold/30 p-4 text-sm text-gold-light">
          <Icon name="info" /> El torneo todavía no tiene campeón: el vídeo incluirá solo las fases ya jugadas. Completá el Mundial para el recap definitivo.
        </Card>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Options opts={opts} set={set} teamId={teamId} />
        <div className="min-w-0 space-y-5">
          {assets ? <Player opts={effective} assets={assets} /> : <Card className="flex aspect-video items-center justify-center text-white/50">Cargando banderas y tipografías…</Card>}
          {assets && <Exporter opts={effective} assets={assets} filename={`${slugify(opts.mode === 'team' && teamId ? `recorrido-${name(teamId)}` : tName) || 'world-cup-2030'}-${opts.format === '9:16' ? 'vertical' : 'horizontal'}`} />}
          <Card className="p-4 text-xs leading-relaxed text-white/50">
            <b className="text-white/80">Cómo se genera:</b> cada fotograma se dibuja en un canvas y se codifica en el propio navegador con WebCodecs (H.264 + AAC/Opus) y se empaqueta en MP4 con mp4-muxer. No se necesita servidor, Remotion ni FFmpeg. Requiere Chrome/Edge 94+ o Safari 16.4+; en otros navegadores se usa una grabación WebM en tiempo real. La música es una composición procedural original (sin canciones comerciales).
          </Card>
        </div>
      </div>
    </div>
  );
}

function Options({ opts, set, teamId }: { opts: RecapOptions; set: (p: Partial<RecapOptions>) => void; teamId?: string }) {
  const name = useTeamName();
  const d = useDerived();
  const [previewing, setPreviewing] = useState(false);
  const previewMusic = async () => {
    const ctx = unlockAudio();
    if (!ctx) return;
    setPreviewing(true);
    try {
      const buf = await renderSoundtrack({ style: opts.music, duration: 10, crowd: opts.crowd, cues: [{ time: 0.2, kind: 'boom' }, { time: 6, kind: 'climax' }] });
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      src.onended = () => {
        void ctx.close();
        setPreviewing(false);
      };
    } catch {
      setPreviewing(false);
    }
  };
  return (
    <Card className="space-y-5 p-5 xl:sticky xl:top-8 xl:max-h-[calc(100dvh-4rem)] xl:self-start xl:overflow-y-auto">
      <div>
        <div className="label mb-2">Contenido</div>
        <Segmented value={opts.mode} onChange={(mode) => set({ mode })} options={[{ value: 'tournament', label: 'Todo el Mundial' }, { value: 'team', label: 'Una selección' }]} />
        {opts.mode === 'team' && (
          <Select
            className="mt-3"
            value={teamId ?? ''}
            onChange={(v) => set({ teamId: v })}
            options={TEAMS.filter((x) => d.groups.some((g) => g.teamIds.includes(x.id))).map((x) => ({ value: x.id, label: `${name(x.id)}${x.id === d.champion ? ' 🏆' : ''}` }))}
          />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div>
          <div className="label mb-2">Formato</div>
          <Segmented value={opts.format} onChange={(format) => set({ format })} options={[{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }]} />
        </div>
        <div>
          <div className="label mb-2">Duración</div>
          <Segmented value={String(opts.duration)} onChange={(v) => set({ duration: Number(v) })} options={DURATIONS.map((x) => ({ value: String(x), label: `${x}s` }))} />
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="label">Música original</div>
          <Button size="sm" variant="ghost" icon={previewing ? 'volume' : 'play'} disabled={previewing} onClick={previewMusic}>{previewing ? 'Sonando…' : 'Escuchar'}</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MUSIC_STYLES.map((m) => (
            <button key={m.id} onClick={() => set({ music: m.id })} className={cx('rounded-xl border p-3 text-left transition', opts.music === m.id ? 'border-gold/60 bg-gold/12' : 'border-white/10 hover:border-white/25')}>
              <div className="font-cond text-sm font-bold uppercase tracking-wide">{m.label}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-white/45">{m.desc}</div>
            </button>
          ))}
        </div>
        <Toggle checked={opts.crowd} onChange={(crowd) => set({ crowd })} label="Sonido de público y celebraciones" />
      </div>
      <div>
        <div className="label mb-1">Acontecimientos a incluir</div>
        <Toggle checked={opts.include.minutes} onChange={(v) => set({ include: { ...opts.include, minutes: v } })} label="Minutos de los goles" />
        <Toggle checked={opts.include.scorers} onChange={(v) => set({ include: { ...opts.include, scorers: v } })} label="Nombres de los goleadores" />
        <Toggle checked={opts.include.penalties} onChange={(v) => set({ include: { ...opts.include, penalties: v } })} label="Penales (tandas y errados)" />
        <Toggle checked={opts.include.cards} onChange={(v) => set({ include: { ...opts.include, cards: v } })} label="Tarjetas" />
      </div>
      <div className="space-y-3">
        <div className="label">Textos personalizados</div>
        <TextInput placeholder="Lema de la presentación" value={opts.title} maxLength={50} onChange={(e) => set({ title: e.target.value })} />
        <TextInput placeholder="Subtítulo de la imagen final" value={opts.subtitle} maxLength={60} onChange={(e) => set({ subtitle: e.target.value })} />
        <TextInput placeholder="Créditos (p. ej. «Simulado por …»)" value={opts.credit} maxLength={60} onChange={(e) => set({ credit: e.target.value })} />
      </div>
    </Card>
  );
}

function Player({ opts, assets }: { opts: RecapOptions; assets: MediaAssets }) {
  const d = useDerived();
  const name = useTeamName();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [W, H] = VIDEO_SIZE[opts.format];
  const PW = W / 2;
  const PH = H / 2;
  const tl = useMemo(() => buildTimeline(d, opts, name, assets, PW, PH), [d, opts, name, assets, PW, PH]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [withMusic, setWithMusic] = useState(true);
  const audio = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);
  const musicCache = useRef<{ key: string; buf: AudioBuffer } | null>(null);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const clock = useRef({ start: 0, offset: 0 });

  const stopAudio = () => {
    if (audio.current) {
      try {
        audio.current.src.stop();
      } catch {
        /* already stopped */
      }
      void audio.current.ctx.close();
      audio.current = null;
    }
  };

  useEffect(() => {
    setTime(0);
    setPlaying(false);
    stopAudio();
  }, [tl]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) {
      ctx.save();
      tl.render(ctx, Math.min(time, tl.duration - 0.001));
      ctx.restore();
    }
  }, [time, tl]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const t = clock.current.offset + (performance.now() - clock.current.start) / 1000;
      if (t >= tl.duration) {
        setTime(tl.duration - 0.001);
        setPlaying(false);
        return;
      }
      setTime(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, tl]);

  useEffect(() => () => stopAudio(), []);

  const play = async () => {
    const from = time >= tl.duration - 0.05 ? 0 : time;
    const ctx = withMusic ? unlockAudio() : null; // must be created inside the tap (iOS)
    if (withMusic && ctx) {
      const key = `${opts.music}|${opts.crowd}|${tl.duration}|${tl.cues.map((c) => c.time.toFixed(2) + c.kind).join()}`;
      if (musicCache.current?.key !== key) {
        setLoadingMusic(true);
        const buf = await renderSoundtrack({ style: opts.music, duration: tl.duration, crowd: opts.crowd, cues: tl.cues, sampleRate: 44100 });
        musicCache.current = { key, buf };
        setLoadingMusic(false);
      }
      const src = ctx.createBufferSource();
      src.buffer = musicCache.current!.buf;
      src.connect(ctx.destination);
      src.start(0, from);
      audio.current = { ctx, src };
    }
    clock.current = { start: performance.now(), offset: from };
    setTime(from);
    setPlaying(true);
  };
  const pause = () => {
    setPlaying(false);
    stopAudio();
  };
  const seek = (t: number) => {
    pause();
    setTime(Math.max(0, Math.min(tl.duration - 0.001, t)));
  };
  const current = tl.scenes.findIndex((s) => time < s.start + s.dur);

  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className={cx('relative mx-auto overflow-hidden rounded-xl bg-black shadow-2xl', opts.format === '9:16' ? 'max-w-[360px]' : 'w-full')}>
        <canvas ref={canvas} width={PW} height={PH} className="block h-auto w-full" />
        {!playing && (
          <button onClick={play} className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/10" aria-label="Reproducir vista previa">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-night-950 shadow-[0_0_40px_rgba(232,184,74,0.6)]">
              <Icon name="play" size={28} />
            </span>
          </button>
        )}
        {loadingMusic && <div className="absolute inset-x-0 bottom-0 bg-black/70 py-2 text-center text-xs text-white/80">Componiendo la música…</div>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pausa' : 'Reproducir'} onClick={playing ? pause : play} />
        <input type="range" min={0} max={tl.duration} step={0.05} value={time} onChange={(e) => seek(Number(e.target.value))} className="flex-1 accent-[#e8b84a]" aria-label="Posición" />
        <span className="w-24 text-right font-cond text-sm tabular text-white/60">
          {fmt(time)} / {fmt(tl.duration)}
        </span>
        <IconButton icon={withMusic ? 'volume' : 'mute'} label={withMusic ? 'Silenciar vista previa' : 'Activar música'} active={withMusic} onClick={() => { pause(); setWithMusic((v) => !v); }} />
      </div>
      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
        {tl.scenes.map((s, i) => (
          <button key={s.scene.key + i} onClick={() => seek(s.start + 0.6)} className={cx('shrink-0 rounded-lg border px-2.5 py-1 font-cond text-[11px] font-bold uppercase tracking-wider', i === current ? 'border-gold/60 bg-gold/15 text-gold-light' : 'border-white/8 text-white/50 hover:text-white')}>
            {i + 1}. {s.scene.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/35">Vista previa a media resolución. El archivo exportado se genera en {W}×{H}.</p>
    </Card>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Exporter({ opts, assets, filename }: { opts: RecapOptions; assets: MediaAssets; filename: string }) {
  const d = useDerived();
  const name = useTeamName();
  const [state, setState] = useState<{ phase: 'idle' | 'working' | 'done' | 'error'; progress: number; stage: string; result?: EncodeResult & { url: string }; error?: string }>({ phase: 'idle', progress: 0, stage: '' });
  const abort = useRef<AbortController | null>(null);
  const [W, H] = VIDEO_SIZE[opts.format];
  const webcodecs = canUseWebCodecs();

  useEffect(() => () => {
    abort.current?.abort();
    if (state.result) URL.revokeObjectURL(state.result.url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    const audioCtx = webcodecs ? null : unlockAudio(); // real-time path needs a tap-created context (iOS)
    const release = await keepAwake();
    abort.current = new AbortController();
    if (state.result) URL.revokeObjectURL(state.result.url);
    setState({ phase: 'working', progress: 0, stage: 'Preparando escenas' });
    try {
      const tl = buildTimeline(d, opts, name, assets, W, H);
      setState((s) => ({ ...s, stage: 'Componiendo la música original' }));
      const audio = await renderSoundtrack({ style: opts.music, duration: tl.duration, crowd: opts.crowd, cues: tl.cues });
      const job = {
        width: W,
        height: H,
        fps: 30,
        duration: tl.duration,
        render: tl.render,
        audio,
        signal: abort.current.signal,
        audioCtx,
        onProgress: (progress: number, stage: string) => setState((s) => ({ ...s, progress, stage })),
      };
      let result: EncodeResult;
      try {
        result = webcodecs ? await encodeMp4(job) : await recordRealtime(job);
      } catch (e) {
        if (e instanceof EncodeAbort || !webcodecs) throw e;
        console.warn('WebCodecs falló, usando MediaRecorder', e);
        result = await recordRealtime({ ...job, audioCtx: unlockAudio() });
      }
      setState({ phase: 'done', progress: 1, stage: 'Listo', result: { ...result, url: URL.createObjectURL(result.blob) } });
      toast({ kind: 'success', title: 'Vídeo generado', message: `${result.ext.toUpperCase()} · ${formatBytes(result.blob.size)}` });
    } catch (e) {
      if (e instanceof EncodeAbort) setState({ phase: 'idle', progress: 0, stage: '' });
      else setState({ phase: 'error', progress: 0, stage: '', error: (e as Error).message });
    } finally {
      release();
    }
  };
  const ios = isIOS();
  const saveVideo = async () => {
    const r = state.result!;
    const file = `${filename}.${r.ext}`;
    if (canShareFiles(r.blob.type) && (await shareFile(r.blob, file, 'World Cup 2030 — Cinematic Recap'))) return;
    downloadBlob(r.blob, file);
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-2xl uppercase">Exportar vídeo</div>
          <div className="text-sm text-white/55">
            {W}×{H} · 30 fps · {opts.duration}s · {webcodecs ? 'MP4 (H.264)' : 'grabación en tiempo real'}
          </div>
        </div>
        {state.phase === 'working' ? (
          <Button variant="danger" icon="x" onClick={() => abort.current?.abort()}>Cancelar</Button>
        ) : (
          <Button variant="primary" size="lg" icon="film" onClick={run}>{state.phase === 'done' ? 'Generar de nuevo' : 'Generar vídeo'}</Button>
        )}
      </div>
      {state.phase === 'working' && (
        <div className="mt-4">
          {!webcodecs && <p className="mb-2 text-xs text-gold-light">El vídeo se graba en tiempo real ({opts.duration}s): dejá la app abierta y la pantalla encendida.</p>}
          <div className="mb-1.5 flex justify-between text-xs text-white/60">
            <span>{state.stage}</span>
            <span className="tabular">{Math.round(state.progress * 100)}%</span>
          </div>
          <ProgressBar value={state.progress} tone="crimson" />
        </div>
      )}
      {state.phase === 'error' && <p className="mt-4 text-sm text-crimson-light">No se pudo generar el vídeo: {state.error}</p>}
      {state.phase === 'done' && state.result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid gap-4 md:grid-cols-[1fr_260px]">
          <video src={state.result.url} controls playsInline className={cx('w-full rounded-xl bg-black', opts.format === '9:16' && 'mx-auto max-h-[520px] w-auto')} />
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="emerald">{state.result.ext.toUpperCase()}</Chip>
              <Chip>{W}×{H}</Chip>
              <Chip>{state.result.videoCodec}</Chip>
              {state.result.audioCodec && <Chip>{state.result.audioCodec}</Chip>}
              <Chip>{formatBytes(state.result.blob.size)}</Chip>
            </div>
            <p className="text-xs text-white/45">Generado en {state.result.seconds.toFixed(1)} s.</p>
            <Button variant="gold" className="w-full" icon="download" onClick={ios ? saveVideo : () => downloadBlob(state.result!.blob, `${filename}.${state.result!.ext}`)}>
              {ios ? 'Guardar en Fotos' : 'Descargar vídeo'}
            </Button>
            {ios && <p className="text-[11px] text-white/45">Se abre el menú de compartir: elegí «Guardar vídeo».</p>}
            <Button
              variant="outline"
              className="w-full"
              icon="share"
              onClick={async () => {
                const ok = await shareFile(state.result!.blob, `${filename}.${state.result!.ext}`, 'World Cup 2030 — Cinematic Recap');
                if (!ok) {
                  downloadBlob(state.result!.blob, `${filename}.${state.result!.ext}`);
                  toast({ kind: 'info', title: 'Compartir no disponible', message: 'Se descargó el archivo para que lo compartas.' });
                }
              }}
            >
              Compartir
            </Button>
          </div>
        </motion.div>
      )}
      {opts.mode === 'team' && opts.teamId && (
        <div className="mt-4 flex items-center gap-2 text-xs text-white/45">
          <Flag id={opts.teamId} className="w-5" /> Recorrido de {name(opts.teamId)}
        </div>
      )}
    </Card>
  );
}
