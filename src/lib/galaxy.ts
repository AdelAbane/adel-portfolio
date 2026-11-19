/**
 * The hero's pixel-art sky, drawn at a low resolution and scaled up with image-rendering: pixelated.
 * Back to front: dithered colour bands, drifting nebula clouds, a ringed planet, a slowly turning
 * spiral galaxy (pixel clouds at dawn in the light theme) and shooting stars on the sky canvas,
 * then 3 star layers on their own canvases so the hero can move them for the parallax.
 * Every blend is ordered dithering (4 × 4 Bayer), never a smooth gradient.
 */

type RGB = readonly [number, number, number];

interface Cloud {
  /** Center, as a share of the sky's width and height */
  x: number;
  y: number;
  /** Radii, as a share of the sky's shorter side */
  rx: number;
  ry: number;
  edge: RGB;
  core: RGB;
  seed: number;
  phase: number;
}

interface Palette {
  bands: { at: number; color: RGB }[];
  nebula: Cloud[];
  planet: { lit: RGB; body: RGB; shade: RGB; ring: RGB; ringBack: RGB };
  /** Behind the heading: darker at night, lighter at dawn */
  focus: RGB;
  /** Per layer (far, mid, near): bright and dim (twinkle) colours, and how many stars */
  stars: { bright: string; dim: string; density: number }[];
  /** Stars only in the top part of the sky (dawn) */
  starsTop: number;
  shooting: string[];
  dawn: boolean;
  /** The bottom of the sky dithers into this, the colour the About section's sky starts with */
  fade: RGB;
}

/** Bottom quarter of the sky: 0 above it, rising to 1 at the very bottom */
const FADE_FROM = 0.75;
const fadeAt = (t: number) => Math.max(0, (t - FADE_FROM) / (1 - FADE_FROM));

const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

const NIGHT: Palette = {
  bands: [
    { at: 0, color: rgb('#050B1A') },
    { at: 0.38, color: rgb('#0A1630') },
    { at: 0.82, color: rgb('#1B1F5E') },
    { at: 1, color: rgb('#3B1F6B') },
  ],
  nebula: [
    { x: 0.16, y: 0.86, rx: 0.55, ry: 0.24, edge: rgb('#312E81'), core: rgb('#1D4ED8'), seed: 1, phase: 0 },
    { x: 0.62, y: 0.54, rx: 0.26, ry: 0.11, edge: rgb('#1D4ED8'), core: rgb('#0EA5E9'), seed: 7, phase: 2.1 },
    { x: 0.46, y: 0.06, rx: 0.3, ry: 0.1, edge: rgb('#312E81'), core: rgb('#6D28D9'), seed: 13, phase: 4.2 },
  ],
  planet: { lit: rgb('#3557C4'), body: rgb('#1E2F7A'), shade: rgb('#0A1030'), ring: rgb('#8FA6E8'), ringBack: rgb('#4A5FA8') },
  focus: rgb('#050B1A'),
  stars: [
    { bright: '#5A6B9A', dim: '#2A3768', density: 1 / 220 },
    { bright: '#BFE0FF', dim: '#5A6B9A', density: 1 / 650 },
    { bright: '#FFFFFF', dim: '#8FA6E8', density: 1 / 1800 },
  ],
  starsTop: 1,
  shooting: ['#FFFFFF', '#BFE0FF', '#5CC8FF', '#1D4ED8', '#312E81'],
  dawn: false,
  fade: rgb('#050B1A'),
};

const DAWN: Palette = {
  bands: [
    { at: 0, color: rgb('#8EC3EF') },
    { at: 0.35, color: rgb('#B4D7F6') },
    { at: 0.72, color: rgb('#D5D3F3') },
    { at: 1, color: rgb('#EFCBE2') },
  ],
  nebula: [
    { x: 0.2, y: 0.85, rx: 0.6, ry: 0.26, edge: rgb('#E2D0F2'), core: rgb('#F3D6EA'), seed: 1, phase: 0 },
    { x: 0.7, y: 0.28, rx: 0.4, ry: 0.2, edge: rgb('#C6DDF7'), core: rgb('#DCEBFB'), seed: 7, phase: 2.1 },
  ],
  planet: { lit: rgb('#F4F7FE'), body: rgb('#CAD6F2'), shade: rgb('#9FB0DE'), ring: rgb('#FFFFFF'), ringBack: rgb('#B9C6EA') },
  focus: rgb('#D6E9FC'),
  stars: [
    { bright: '#DCEBFB', dim: '#C2DCF5', density: 1 / 700 },
    { bright: '#F2F8FF', dim: '#CFE3F8', density: 1 / 1400 },
    { bright: '#FFFFFF', dim: '#D8E8FA', density: 1 / 3000 },
  ],
  starsTop: 0.45,
  shooting: ['#FFFFFF', '#F4F8FF', '#E6EFFC', '#D6E6FA'],
  dawn: true,
  fade: rgb('#CFE3F8'),
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in 0…1 */
function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(xi, yi, seed) * (1 - sx) + hash(xi + 1, yi, seed) * sx;
  const bottom = hash(xi, yi + 1, seed) * (1 - sx) + hash(xi + 1, yi + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Seeded random numbers, so a redraw puts every star back in the same place */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEBULA_CYCLE = 60_000;
const GALAXY_TURN = 180_000;
const FRAME = 1000 / 30;

interface Star {
  x: number;
  y: number;
  big: boolean;
  /** Twinkle period in ms (0: steady) */
  period: number;
  phase: number;
  /** Random 0–1: in the bottom fade, stars below this share are dropped */
  keep: number;
}

interface Shooting {
  x: number;
  y: number;
  dx: number;
  start: number;
}

export interface GalaxyOptions {
  host: HTMLElement;
  sky: HTMLCanvasElement;
  /** Far, mid and near star canvases */
  starLayers: HTMLCanvasElement[];
  /** Text kept readable: the sky is dithered darker (lighter at dawn) behind these */
  focus: HTMLElement[];
}

export function createGalaxy({ host, sky, starLayers, focus }: GalaxyOptions) {
  const ctx = sky.getContext('2d')!;
  const starCtx = starLayers.map((canvas) => canvas.getContext('2d')!);
  // Star canvases overhang the hero by this many sky pixels, so the parallax never shows an edge
  const MARGIN = 6;

  let palette = NIGHT;
  let still = false;
  let w = 0;
  let h = 0;
  let px = 4;
  let background: ImageData | undefined;
  let backgroundKey = '';
  let stars: Star[][] = [];
  let arms: { r: number; a: number; color: string }[] = [];
  let dawnClouds: { sprite: HTMLCanvasElement; x: number; y: number; phase: number }[] = [];
  let lastFrame = -Infinity;
  let shooting: Shooting | undefined;
  let nextShooting = 0;

  const short = () => Math.min(w, h);

  // ---------- Layout ----------

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    // Whole CSS pixels per sky pixel, so every pixel is the same size: ~320 across on desktop
    px = Math.max(3, Math.round(width / 320));
    w = Math.ceil(width / px);
    h = Math.ceil(height / px);

    sky.width = w;
    sky.height = h;
    sky.style.width = `${w * px}px`;
    sky.style.height = `${h * px}px`;
    starLayers.forEach((canvas) => {
      canvas.width = w + MARGIN * 2;
      canvas.height = h + MARGIN * 2;
      canvas.style.width = `${(w + MARGIN * 2) * px}px`;
      canvas.style.height = `${(h + MARGIN * 2) * px}px`;
      canvas.style.left = canvas.style.top = `${-MARGIN * px}px`;
    });
    rebuild();
  }

  /** Everything that depends on the size or the palette */
  function rebuild() {
    background = undefined;
    backgroundKey = '';

    const rand = random(42);
    stars = palette.stars.map((layer) => {
      const count = Math.round((w + MARGIN * 2) * (h + MARGIN * 2) * layer.density * palette.starsTop);
      return Array.from({ length: count }, () => ({
        x: Math.floor(rand() * (w + MARGIN * 2)),
        y: Math.floor(rand() * (h + MARGIN * 2) * palette.starsTop),
        big: rand() < 0.12,
        period: rand() < 0.35 ? 1800 + rand() * 2600 : 0,
        phase: rand(),
        keep: rand(),
      })).filter((star) => fadeAt((star.y - MARGIN) / h) < star.keep);
    });

    // Two arms of dots, brightest near the core
    const armRand = random(7);
    const colors = ['#FFFFFF', '#BFE0FF', '#5CC8FF', '#1D4ED8', '#312E81'];
    arms = [];
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 140; i++) {
        const s = i / 140;
        arms.push({
          r: 0.14 + s * 0.86 + (armRand() - 0.5) * 0.06,
          a: arm * Math.PI + s * 3.6 + (armRand() - 0.5) * 0.35,
          color: colors[Math.min(colors.length - 1, Math.floor(s * 4 + armRand() * 1.4))],
        });
      }
    }

    dawnClouds = palette.dawn
      ? [
          { sprite: cloudSprite(30, 9, 3), x: 0.72, y: 0.38, phase: 0 },
          { sprite: cloudSprite(20, 7, 5), x: 0.86, y: 0.56, phase: 2 },
          { sprite: cloudSprite(16, 6, 9), x: 0.62, y: 0.6, phase: 4 },
        ]
      : [];
    lastFrame = -Infinity;
  }

  // ---------- Background: bands, nebula, the planet and the readability mask ----------

  function nebulaOffset(cloud: Cloud, now: number) {
    const angle = (now / NEBULA_CYCLE) * Math.PI * 2 + cloud.phase;
    return [Math.round(Math.sin(angle) * 5), Math.round(Math.cos(angle) * 2)];
  }

  function renderBackground(now: number) {
    const image = ctx.createImageData(w, h);
    const data = image.data;
    const offsets = palette.nebula.map((cloud) => nebulaOffset(cloud, now));
    const bands = palette.bands;
    const s = short();

    const hostBox = host.getBoundingClientRect();
    const areas = focus.map((el) => {
      const box = el.getBoundingClientRect();
      return {
        x: (box.left + box.width / 2 - hostBox.left) / px,
        y: (box.top + box.height / 2 - hostBox.top) / px,
        rx: box.width / 2 / px + 10,
        ry: box.height / 2 / px + 5,
      };
    });

    for (let y = 0; y < h; y++) {
      // Colour bands: dither between the two stops around this row
      const t = y / Math.max(1, h - 1);
      let band = 0;
      while (band < bands.length - 2 && t > bands[band + 1].at) band++;
      const from = bands[band];
      const to = bands[band + 1];
      const mix = (t - from.at) / (to.at - from.at);

      for (let x = 0; x < w; x++) {
        const b = bayer(x, y);
        let color = mix > b ? to.color : from.color;

        palette.nebula.forEach((cloud, i) => {
          const nx = x - offsets[i][0];
          const ny = y - offsets[i][1];
          const dx = (nx - cloud.x * w) / (cloud.rx * s);
          const dy = (ny - cloud.y * h) / (cloud.ry * s);
          const ragged = noise(nx / 10, ny / 10, cloud.seed) * 0.65 + noise(nx / 4, ny / 4, cloud.seed + 1) * 0.35;
          const density = 1 - (dx * dx + dy * dy) + (ragged - 0.5) * 0.9;
          // Mostly a sparse dither of the edge colour, with a small solid-ish core
          if (density > 0.68 + b * 0.4) color = cloud.core;
          else if (density * 0.85 > b + 0.08) color = cloud.edge;
        });

        // Behind the text: a rounded, dithered patch of the darkest (dawn: lightest) colour
        for (const area of areas) {
          const ex = (x - area.x) / area.rx;
          const ey = (y - area.y) / area.ry;
          const inFocus = 1 - Math.sqrt(Math.sqrt(ex ** 4 + ey ** 4));
          if (inFocus > 0 && Math.min(1, inFocus * 3) * 0.55 > b) color = palette.focus;
        }

        // Bottom quarter: dithered into the colour the next section starts with, so there's no edge
        if (fadeAt(t) * 1.06 > b) color = palette.fade;

        const o = (y * w + x) * 4;
        data[o] = color[0];
        data[o + 1] = color[1];
        data[o + 2] = color[2];
        data[o + 3] = 255;
      }
    }

    drawPlanet(data);
    background = image;
  }

  /** Top-left, lit from the upper left, with a dithered terminator and a tilted ring */
  function drawPlanet(data: Uint8ClampedArray) {
    const r = Math.max(5, Math.round(short() * 0.05));
    const cx = Math.round(Math.max(r * 2 + 2, w * 0.06));
    const cy = Math.round(Math.max(r * 2 + 4, h * 0.2));
    const { lit, body, shade, ring, ringBack } = palette.planet;
    const set = (x: number, y: number, c: RGB) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const o = (y * w + x) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
    };

    const tilt = -0.35;
    const ringPoints = (front: boolean) => {
      for (const scale of [1.9, 1.75]) {
        for (let a = 0; a < Math.PI * 2; a += 0.02) {
          if (Math.sin(a) > 0 !== front) continue;
          const ex = Math.cos(a) * r * scale;
          const ey = Math.sin(a) * r * scale * 0.32;
          set(Math.round(cx + ex * Math.cos(tilt) - ey * Math.sin(tilt)), Math.round(cy + ex * Math.sin(tilt) + ey * Math.cos(tilt)), front ? ring : ringBack);
        }
      }
    };

    ringPoints(false);
    const light = [-0.62, -0.5, 0.6];
    const norm = Math.hypot(light[0], light[1], light[2]);
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = (x * x + y * y) / (r * r);
        if (d > 1) continue;
        const z = Math.sqrt(1 - d);
        const v = (x / r * light[0] + y / r * light[1] + z * light[2]) / norm;
        const b = bayer(cx + x, cy + y);
        let color = shade;
        if (v > 0.72) color = lit;
        else if (v > 0.25) color = body;
        else if (v > -0.15) color = (v + 0.15) / 0.4 > b ? body : shade;
        set(cx + x, cy + y, color);
      }
    }
    ringPoints(true);
  }

  // ---------- Moving parts ----------

  function drawGalaxy(now: number) {
    const landscape = w > h;
    const cx = Math.round(w * (landscape ? 0.86 : 0.74));
    const cy = Math.round(h * (landscape ? 0.58 : 0.52));
    const size = short() * (landscape ? 0.22 : 0.24);
    const turn = still ? 0 : (now / GALAXY_TURN) * Math.PI * 2;

    // Group by colour: one fillStyle per colour
    const byColor = new Map<string, [number, number][]>();
    arms.forEach(({ r, a, color }) => {
      const angle = a + turn;
      const radius = r * size;
      const x = Math.round(cx + Math.cos(angle) * radius);
      const y = Math.round(cy + Math.sin(angle) * radius * 0.55);
      if (!byColor.has(color)) byColor.set(color, []);
      byColor.get(color)!.push([x, y]);
    });
    byColor.forEach((points, color) => {
      ctx.fillStyle = color;
      points.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
    });

    // Core: a dithered halo around a white center
    for (let y = -4; y <= 4; y++) {
      for (let x = -5; x <= 5; x++) {
        const d = Math.hypot(x / 1.25, y);
        if (d > 4) continue;
        let color = '';
        if (d < 1.2) color = '#FFFFFF';
        else if (d < 2.4) color = '#BFE0FF';
        else if ((4 - d) / 1.6 > bayer(cx + x, cy + y)) color = '#5CC8FF';
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  /** A puffy pixel cloud: white on top, dithered shade underneath, flat bottom */
  function cloudSprite(width: number, height: number, seed: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const c = canvas.getContext('2d')!;
    const rand = random(seed);
    const puffs = Array.from({ length: 4 }, (_, i) => ({
      x: width * (0.2 + i * 0.2) + (rand() - 0.5) * 3,
      y: height * (0.55 + (rand() - 0.5) * 0.3),
      r: height * (0.35 + rand() * 0.25),
    }));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inside = y < height - 1 && puffs.some((p) => Math.hypot(x - p.x, (y - p.y) * 1.2) < p.r) || (y >= height - 3 && y < height - 1 && x > width * 0.12 && x < width * 0.88);
        if (!inside) continue;
        const shade = (y / height - 0.45) * 2.2;
        c.fillStyle = shade > bayer(x, y) ? '#DCE5F8' : '#FFFFFF';
        c.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }

  function drawDawnClouds(now: number) {
    dawnClouds.forEach(({ sprite, x, y, phase }) => {
      const drift = still ? 0 : Math.round(Math.sin((now / NEBULA_CYCLE) * Math.PI * 2 + phase) * 6);
      ctx.drawImage(sprite, Math.round(x * w - sprite.width / 2) + drift, Math.round(y * h - sprite.height / 2));
    });
  }

  /** A short diagonal streak every 8–15s: the head runs ahead of a tail that fades, then shrinks away */
  function drawShooting(now: number) {
    if (!nextShooting) nextShooting = now + 4000 + Math.random() * 6000;
    if (!shooting && now >= nextShooting) {
      shooting = {
        x: Math.round(w * (0.15 + Math.random() * 0.7)),
        y: Math.round(h * (0.05 + Math.random() * 0.25)),
        dx: Math.random() < 0.5 ? -1 : 1,
        start: now,
      };
      nextShooting = now + 8000 + Math.random() * 7000;
    }
    if (!shooting) return;

    const DURATION = 700;
    const progress = (now - shooting.start) / DURATION;
    if (progress >= 1) {
      shooting = undefined;
      return;
    }
    const head = Math.round(progress * 34);
    const tail = palette.shooting.length;
    // The tail shrinks over the last third
    const shown = progress < 0.66 ? tail : Math.ceil(tail * (1 - progress) * 3);
    for (let i = 0; i < Math.min(shown, head + 1); i++) {
      const step = head - i;
      ctx.fillStyle = palette.shooting[tail - shown + i] ?? palette.shooting[tail - 1];
      ctx.fillRect(shooting.x + shooting.dx * step * 2, shooting.y + step, 2, 1);
    }
  }

  function drawStars(now: number) {
    starCtx.forEach((c, layer) => {
      const { bright, dim } = palette.stars[layer];
      c.clearRect(0, 0, w + MARGIN * 2, h + MARGIN * 2);
      for (const color of [bright, dim]) {
        c.fillStyle = color;
        stars[layer].forEach((star) => {
          const on = still || !star.period || ((now / star.period + star.phase) % 1) < 0.7;
          if ((on ? bright : dim) !== color) return;
          c.fillRect(star.x, star.y, 1, 1);
          // Near bright stars get a little pixel cross
          if (star.big && layer === 2 && on) {
            c.fillRect(star.x - 1, star.y, 3, 1);
            c.fillRect(star.x, star.y - 1, 1, 3);
          } else if (star.big && layer === 1) {
            c.fillRect(star.x, star.y, 2, 1);
          }
        });
      }
    });
  }

  // ---------- Public ----------

  function draw(now: number) {
    if (!w) return;
    const key = palette.nebula.map((cloud) => nebulaOffset(cloud, still ? 0 : now).join()).join();
    if (!background || key !== backgroundKey) {
      renderBackground(still ? 0 : now);
      backgroundKey = key;
    }
    ctx.putImageData(background!, 0, 0);
    if (palette.dawn) drawDawnClouds(now);
    else drawGalaxy(now);
    if (!still) drawShooting(now);
    drawStars(now);
  }

  return {
    resize() {
      resize();
      draw(performance.now());
    },
    setTheme(dawn: boolean) {
      if ((palette === DAWN) === dawn) return;
      palette = dawn ? DAWN : NIGHT;
      rebuild();
      draw(performance.now());
    },
    /** Reduced motion: one static frame, redrawn only on resize or a theme change */
    setStill(value: boolean) {
      still = value;
      shooting = undefined;
      draw(performance.now());
    },
    /** Called from the hero's frame loop; draws at most 30 times a second */
    frame(now: number) {
      // A little slack, so 60Hz frames that land a hair early don't drop us to 20fps
      if (still || now - lastFrame < FRAME - 4) return;
      lastFrame = now;
      draw(now);
    },
  };
}
