import { TEAM_BY_ID } from '../engine';

const modules = import.meta.glob('../assets/flags/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const FLAG_URL: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const code = path.split('/').pop()!.replace('.svg', '');
  FLAG_URL[code] = url;
}

export const flagUrlForTeam = (teamId: string) => FLAG_URL[TEAM_BY_ID[teamId]?.flag ?? ''] ?? '';

const bitmapCache = new Map<string, Promise<HTMLCanvasElement>>();

/**
 * Rasterises a flag SVG to a canvas (640×480) for use in canvas-based exports
 * (posters and video). SVGs without intrinsic size are given explicit dimensions.
 */
export function loadFlagBitmap(teamId: string, width = 640, height = 480): Promise<HTMLCanvasElement> {
  const key = `${teamId}:${width}x${height}`;
  if (!bitmapCache.has(key)) {
    bitmapCache.set(
      key,
      (async () => {
        const url = flagUrlForTeam(teamId);
        const text = await (await fetch(url)).text();
        const sized = text.replace('<svg', `<svg width="${width}" height="${height}" preserveAspectRatio="none"`);
        const blobUrl = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
        try {
          const img = new Image();
          img.decoding = 'async';
          img.src = blobUrl;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = width;
          c.height = height;
          c.getContext('2d')!.drawImage(img, 0, 0, width, height);
          return c;
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      })(),
    );
  }
  return bitmapCache.get(key)!;
}

export async function loadAllFlags(teamIds: string[]): Promise<Record<string, HTMLCanvasElement>> {
  const entries = await Promise.all(teamIds.map(async (id) => [id, await loadFlagBitmap(id)] as const));
  return Object.fromEntries(entries);
}
