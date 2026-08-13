import { loadGoogleFont } from 'workers-og'

/**
 * The site's own type, so anything this worker renders looks like the page behind it.
 * Without this satori falls back to a serif, which reads as somebody else's product.
 *
 * Two families and only two, exactly as the site loads: Archivo carries every piece of
 * structure and IBM Plex Mono carries anything that is data. Two weights of each,
 * because the design leans on the distance between 500 and 800.
 *
 * Cached in module scope: a warm isolate renders every subsequent image without
 * re-fetching, and the fetch itself is only four requests on a cold start. It lives in
 * its own module so the share card and the token art share that one cache rather than
 * paying for a set each.
 */
export type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 800 }

let fontCache: Promise<LoadedFont[]> | null = null

export function loadFonts(): Promise<LoadedFont[]> {
  if (!fontCache) {
    fontCache = Promise.all([
      loadGoogleFont({ family: 'Archivo', weight: 500 }),
      loadGoogleFont({ family: 'Archivo', weight: 800 }),
      loadGoogleFont({ family: 'IBM Plex Mono', weight: 400 }),
      loadGoogleFont({ family: 'IBM Plex Mono', weight: 600 }),
    ]).then(([archivo, archivoBold, mono, monoBold]) => [
      { name: 'Archivo', data: archivo, weight: 500 as const },
      { name: 'Archivo', data: archivoBold, weight: 800 as const },
      { name: 'IBM Plex Mono', data: mono, weight: 400 as const },
      { name: 'IBM Plex Mono', data: monoBold, weight: 600 as const },
    ])
    // A failed fetch must not poison the cache for the life of the isolate.
    fontCache.catch(() => {
      fontCache = null
    })
  }
  return fontCache
}
