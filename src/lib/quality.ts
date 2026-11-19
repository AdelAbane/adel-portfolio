/**
 * Picks how much the site renders, once per page, so it stays smooth (and the tab well under
 * 500 MB) on weak devices:
 *
 *   LOW     no three.js at all: a simple fade instead of the portal, the CSS garage on /about, a
 *           pre-rendered galaxy image, and simple fades instead of the scroll story
 *   MEDIUM  the 3D garage and portal, without shadows, bloom or the hologram's shimmer; 60 dust
 *           motes, pixel ratio 1.25, textures ≤ 1024 px
 *   HIGH    everything (shadows 1024, bloom, 150 dust motes, pixel ratio up to 2)
 *
 * "Lite mode" (the header toggle) forces LOW. A 3D scene that averages under 40fps over its first
 * 3 seconds drops the device one tier, remembered in localStorage.
 */

export type Tier = 'low' | 'medium' | 'high';

const TIERS: Tier[] = ['low', 'medium', 'high'];
const LITE_KEY = 'lite-mode';
const CAP_KEY = 'quality-cap';

export interface QualitySettings {
  tier: Tier;
  /** three.js at all (portal and garage) */
  three: boolean;
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  antialias: boolean;
  dust: number;
  pixelRatio: number;
  maxTextureSize: number;
  /** The hologram's scanline shimmer and full segment counts */
  shimmer: boolean;
  /** The hero's galaxy: animated canvas, or the pre-rendered image */
  galaxyAnimated: boolean;
  /** Pinned, scrubbed scroll story on the homepage (simple fades otherwise) */
  scrollStory: boolean;
}

const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  },
};

/** WebGL support and the largest texture the GPU takes (0 without WebGL); the context is released */
function probeWebGL(): { ok: boolean; maxTexture: number } {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    if (!gl) return { ok: false, maxTexture: 0 };
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, maxTexture };
  } catch {
    return { ok: false, maxTexture: 0 };
  }
}

/** What the device looks able to do, before any measuring */
function detect(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';
  if (nav.connection?.saveData) return 'low';
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return 'low';
  const gl = probeWebGL();
  if (!gl.ok) return 'low';
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (touch) return 'medium';
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) return 'medium';
  if ((nav.hardwareConcurrency || 8) <= 4) return 'medium';
  if (gl.maxTexture < 8192) return 'medium';
  return 'high';
}

const lower = (a: Tier, b: Tier) => TIERS[Math.min(TIERS.indexOf(a), TIERS.indexOf(b))];

let current: Tier | undefined;

export const isLiteMode = () => storage.get(LITE_KEY) === '1';

/** The tier for this page: Lite mode, then the detected tier, capped by any earlier downgrade */
export function getTier(): Tier {
  if (current) return current;
  const forced = new URLSearchParams(window.location.search).get('tier') as Tier | null;
  if (forced && TIERS.includes(forced)) current = forced;
  else if (isLiteMode()) current = 'low';
  else {
    const cap = storage.get(CAP_KEY) as Tier | null;
    current = cap && TIERS.includes(cap) ? lower(detect(), cap) : detect();
  }
  document.documentElement.dataset.tier = current;
  return current;
}

export function settingsFor(tier: Tier): QualitySettings {
  const dpr = window.devicePixelRatio || 1;
  if (tier === 'high') {
    return {
      tier,
      three: true,
      shadows: true,
      shadowMapSize: 1024,
      bloom: true,
      antialias: true,
      dust: 150,
      pixelRatio: Math.min(dpr, 2),
      maxTextureSize: 1024,
      shimmer: true,
      galaxyAnimated: true,
      scrollStory: true,
    };
  }
  if (tier === 'medium') {
    return {
      tier,
      three: true,
      shadows: false,
      shadowMapSize: 0,
      bloom: false,
      antialias: false,
      dust: 60,
      pixelRatio: Math.min(dpr, 1.25),
      maxTextureSize: 1024,
      shimmer: false,
      galaxyAnimated: true,
      scrollStory: true,
    };
  }
  return {
    tier,
    three: false,
    shadows: false,
    shadowMapSize: 0,
    bloom: false,
    antialias: false,
    dust: 0,
    pixelRatio: 1,
    maxTextureSize: 1024,
    shimmer: false,
    galaxyAnimated: false,
    scrollStory: false,
  };
}

export const getSettings = () => settingsFor(getTier());

/** One tier down, remembered for later pages; returns the new tier */
export function downgrade(): Tier {
  const next = TIERS[Math.max(0, TIERS.indexOf(getTier()) - 1)];
  current = next;
  storage.set(CAP_KEY, next);
  document.documentElement.dataset.tier = next;
  return next;
}

/** Lite mode on or off (the page reloads to apply it everywhere) */
export function setLiteMode(on: boolean) {
  storage.set(LITE_KEY, on ? '1' : null);
}

/**
 * Average frame rate over the first `seconds` of a scene's visible frames. Call tick() once per
 * rendered frame; it resolves `done` once enough time has passed. Gaps (hidden tab) are skipped.
 */
export function createFpsProbe(seconds = 3) {
  let previous = 0;
  let total = 0;
  let frames = 0;
  let resolve!: (fps: number) => void;
  const done = new Promise<number>((r) => (resolve = r));
  let finished = false;
  return {
    done,
    tick(now: number) {
      if (finished) return;
      if (previous) {
        const delta = now - previous;
        if (delta < 250) {
          total += delta;
          frames++;
        }
      }
      previous = now;
      if (total >= seconds * 1000) {
        finished = true;
        resolve((frames * 1000) / total);
      }
    },
  };
}
