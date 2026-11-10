export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Shares a file with the Web Share API when available. Returns false if sharing is unsupported. */
export async function shareFile(blob: Blob, filename: string, title: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return true;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return true;
    }
  }
  return false;
}

export function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const isIOS = () =>
  typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** True when the system share sheet can receive a file of this type (iOS: "Guardar imagen/vídeo" en Fotos). */
export function canShareFiles(type: string): boolean {
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    return !!nav.share && !!nav.canShare?.({ files: [new File([new Blob([''], { type })], 'x', { type })] });
  } catch {
    return false;
  }
}

/** Creates (and resumes) an AudioContext synchronously inside a tap handler, as iOS requires. */
export function unlockAudio(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Keeps the screen on during long exports when the browser allows it. */
export async function keepAwake(): Promise<() => void> {
  try {
    const wl = await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen');
    return () => void wl?.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}
