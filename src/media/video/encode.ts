import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

export interface EncodeJob {
  width: number;
  height: number;
  fps: number;
  duration: number;
  render: (ctx: CanvasRenderingContext2D, t: number) => void;
  audio: AudioBuffer | null;
  onProgress: (fraction: number, stage: string) => void;
  signal: AbortSignal;
  /** AudioContext created in the user's tap (needed on iOS for real-time recording). */
  audioCtx?: AudioContext | null;
}

export interface EncodeResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
  videoCodec: string;
  audioCodec: string | null;
  seconds: number;
}

export class EncodeAbort extends Error {}

export const canUseWebCodecs = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window && 'AudioEncoder' in window && 'AudioData' in window;

async function pickVideoCodec(width: number, height: number, fps: number) {
  const bitrate = Math.round(width * height * fps * 0.17); // ≈10.5 Mbps for 1080p30
  const candidates: { codec: string; mux: 'avc' | 'vp9' | 'av1'; label: string }[] = [
    { codec: 'avc1.640028', mux: 'avc', label: 'H.264 High' },
    { codec: 'avc1.4d0028', mux: 'avc', label: 'H.264 Main' },
    { codec: 'avc1.42e028', mux: 'avc', label: 'H.264 Baseline' },
    { codec: 'vp09.00.40.08', mux: 'vp9', label: 'VP9' },
    { codec: 'av01.0.08M.08', mux: 'av1', label: 'AV1' },
  ];
  for (const c of candidates) {
    const config: VideoEncoderConfig = { codec: c.codec, width, height, bitrate, framerate: fps, ...(c.mux === 'avc' ? { avc: { format: 'avc' } } : {}) } as VideoEncoderConfig;
    try {
      const s = await VideoEncoder.isConfigSupported(config);
      if (s.supported) return { config, mux: c.mux, label: c.label };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function pickAudioCodec(sampleRate: number, channels: number) {
  if (!('AudioEncoder' in window)) return null;
  const candidates: { codec: string; mux: 'aac' | 'opus'; label: string }[] = [
    { codec: 'mp4a.40.2', mux: 'aac', label: 'AAC' },
    { codec: 'opus', mux: 'opus', label: 'Opus' },
  ];
  for (const c of candidates) {
    const config: AudioEncoderConfig = { codec: c.codec, sampleRate, numberOfChannels: channels, bitrate: 192000 };
    try {
      const s = await AudioEncoder.isConfigSupported(config);
      if (s.supported) return { config, mux: c.mux, label: c.label };
    } catch {
      /* next */
    }
  }
  return null;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Offline, faster-than-real-time MP4 export using WebCodecs + mp4-muxer. */
export async function encodeMp4(job: EncodeJob): Promise<EncodeResult> {
  const started = performance.now();
  const v = await pickVideoCodec(job.width, job.height, job.fps);
  if (!v) throw new Error('Este navegador no puede codificar vídeo con WebCodecs.');
  const a = job.audio ? await pickAudioCodec(job.audio.sampleRate, job.audio.numberOfChannels) : null;
  if (job.audio && !a) throw new Error('Sin codificador de audio WebCodecs');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: v.mux, width: job.width, height: job.height, frameRate: job.fps },
    ...(a && job.audio ? { audio: { codec: a.mux, sampleRate: job.audio.sampleRate, numberOfChannels: job.audio.numberOfChannels } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let failure: Error | null = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e as Error) });
  venc.configure(v.config);

  // --- Audio
  if (a && job.audio) {
    job.onProgress(0, 'Codificando audio');
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => (failure = e as Error) });
    aenc.configure(a.config);
    const buf = job.audio;
    const frames = 1024;
    const chans = buf.numberOfChannels;
    const data = Array.from({ length: chans }, (_, c) => buf.getChannelData(c));
    for (let off = 0; off < buf.length; off += frames) {
      const n = Math.min(frames, buf.length - off);
      const planar = new Float32Array(n * chans);
      for (let c = 0; c < chans; c++) planar.set(data[c].subarray(off, off + n), c * n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: buf.sampleRate, numberOfFrames: n, numberOfChannels: chans, timestamp: Math.round((off / buf.sampleRate) * 1e6), data: planar });
      aenc.encode(ad);
      ad.close();
      if (job.signal.aborted) throw new EncodeAbort();
    }
    await aenc.flush();
    aenc.close();
  }

  // --- Video
  const canvas = document.createElement('canvas');
  canvas.width = job.width;
  canvas.height = job.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const total = Math.round(job.duration * job.fps);
  const frameDur = 1e6 / job.fps;
  for (let i = 0; i < total; i++) {
    if (job.signal.aborted) {
      venc.close();
      throw new EncodeAbort();
    }
    if (failure) throw failure;
    ctx.save();
    job.render(ctx, i / job.fps);
    ctx.restore();
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameDur), duration: Math.round(frameDur) });
    venc.encode(frame, { keyFrame: i % (job.fps * 2) === 0 });
    frame.close();
    while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
    if (i % 6 === 0) {
      job.onProgress(i / total, `Renderizando fotograma ${i + 1} de ${total}`);
      await tick();
    }
  }
  job.onProgress(1, 'Finalizando el archivo MP4');
  await venc.flush();
  venc.close();
  if (failure) throw failure;
  muxer.finalize();
  return {
    blob: new Blob([target.buffer], { type: 'video/mp4' }),
    ext: 'mp4',
    videoCodec: v.label,
    audioCodec: a?.label ?? null,
    seconds: (performance.now() - started) / 1000,
  };
}

/** Fallback: real-time capture with MediaRecorder (MP4 on Safari/iPhone, WebM elsewhere). */
export async function recordRealtime(job: EncodeJob): Promise<EncodeResult> {
  const started = performance.now();
  const canvas = document.createElement('canvas');
  canvas.width = job.width;
  canvas.height = job.height;
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(job.fps);
  let actx: AudioContext | null = null;
  let src: AudioBufferSourceNode | null = null;
  if (job.audio) {
    actx = job.audioCtx ?? new AudioContext();
    if (actx.state === 'suspended') await actx.resume().catch(() => undefined);
    const dest = actx.createMediaStreamDestination();
    src = actx.createBufferSource();
    src.buffer = job.audio;
    src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }
  const mime =
    ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const isMp4 = mime.startsWith('video/mp4');
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10_000_000 } : { videoBitsPerSecond: 10_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  job.render(ctx, 0);
  rec.start(500);
  const t0 = performance.now();
  src?.start();
  await new Promise<void>((resolve, reject) => {
    const loop = () => {
      if (job.signal.aborted) {
        rec.stop();
        reject(new EncodeAbort());
        return;
      }
      const t = (performance.now() - t0) / 1000;
      if (t >= job.duration) {
        resolve();
        return;
      }
      job.render(ctx, t);
      job.onProgress(t / job.duration, 'Grabando en tiempo real: mantené la pantalla encendida');
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  rec.stop();
  await done;
  try {
    src?.stop();
  } catch {
    /* already ended */
  }
  await actx?.close().catch(() => undefined);
  const type = isMp4 ? 'video/mp4' : 'video/webm';
  return {
    blob: new Blob(chunks, { type }),
    ext: isMp4 ? 'mp4' : 'webm',
    videoCodec: mime.includes('avc1') ? 'H.264' : mime.includes('vp9') ? 'VP9' : mime.includes('vp8') ? 'VP8' : isMp4 ? 'MP4' : 'WebM',
    audioCodec: job.audio ? (mime.includes('mp4a') ? 'AAC' : mime.includes('opus') ? 'Opus' : 'audio') : null,
    seconds: (performance.now() - started) / 1000,
  };
}
