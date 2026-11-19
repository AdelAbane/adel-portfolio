/**
 * Three.js version of the About garage. Only ever loaded through a dynamic import() from
 * About.astro, which keeps the CSS garage underneath as the fallback and keeps every bit of the
 * glass UI in HTML on top of this canvas.
 *
 * Units are metres. The room is 8 wide × 3 high × 7 deep, open towards the camera:
 * x −4…4, y 0…3, z −7…0. The house front (with the sectional door) stands at z = 0.
 *
 * The car is a glTF model (Draco geometry, WebP textures) that loads after the garage is already
 * on screen, then fades in. Its hood is part of the body, so "Pop the hood" shows a holographic
 * engine floating above it instead, with the four skill groups as labels around it.
 *
 * Arrival timeline (seconds):
 *   0.35–2.65 the door rises along its ceiling tracks · 1.3/1.65 the bulbs flicker on ·
 *   1.0–4.0 the camera eases from outside to its resting place · 3.3 the HTML UI fades back in
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Box3,
  Group,
  HalfFloatType,
  HemisphereLight,
  LatheGeometry,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  NeutralToneMapping,
  NoColorSpace,
  NormalBlending,
  Object3D,
  PCFShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Spherical,
  Sprite,
  SpriteMaterial,
  Texture,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  WireframeGeometry,
} from 'three';
import type { BufferGeometry as Geometry, MeshPhysicalMaterial } from 'three';
import { createFpsProbe, type QualitySettings } from './quality';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Theme = 'dark' | 'light';

/** A box in the canvas' CSS pixels */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the 3D car and tool chest land on screen, so the HTML buttons can sit on them */
export interface GarageLayout {
  car: Rect;
  chest: Rect;
  label: Rect;
  drawers: Rect[];
}

export interface GarageOptions {
  /** Element the canvas fills */
  container: HTMLElement;
  theme: Theme;
  /** What this device's tier allows: shadows, bloom, dust, pixel ratio… (see quality.ts) */
  quality: QualitySettings;
  /** No cursor: the camera sways slowly on its own */
  touch: boolean;
  /** Wide layout: the 3D car, tool chest and tires take over from the HTML ones */
  full: boolean;
  /** Start outside, facing the closed door */
  arrival: boolean;
  /** The car: a Draco-compressed .glb, and the folder holding the Draco decoder */
  modelUrl: string;
  dracoPath: string;
  /** Download progress of the car, 0…1 (null when the size isn't known) */
  onCarProgress?: (progress: number | null) => void;
  /** The car is in (or failed to load: false) */
  onCarReady?: (loaded: boolean) => void;
  /** The four skill groups, shown as labels round the holographic engine */
  skillLabels: string[];
  /** A skill label was clicked: open that toolbox card */
  onSkill?: (index: number) => void;
  onLayout?: (layout: GarageLayout) => void;
  /** The arrival is nearly over (or was skipped): time to show the HTML UI */
  onReveal?: () => void;
  /** The WebGL context was lost: go back to the CSS garage */
  onLost?: () => void;
  /** The first 3 seconds of rendering averaged under 40fps */
  onSlow?: (fps: number) => void;
}

export interface GarageScene {
  /** Applies a lower tier live (shadows, bloom, pixel ratio, dust, shimmer) */
  setQuality(quality: QualitySettings): void;
  /** Renderer stats for the ?debug overlay */
  stats(): { geometries: number; textures: number; calls: number; triangles: number };
  /** Starts the render loop (paused while the tab is hidden or the canvas is off screen) */
  start(): void;
  playArrival(): void;
  skipArrival(): void;
  /** Cursor position across the viewport, −1…1 */
  pointer(x: number, y: number): void;
  /** Is the tool chest under this point? Also drives its hover highlight */
  hover(clientX: number, clientY: number): boolean;
  setChestHover(on: boolean): void;
  setDrawer(index: number | null): void;
  setHood(open: boolean): void;
  setTheme(theme: Theme): void;
  setFull(full: boolean): void;
  /** Holds the arrival at a given second (null lets it run again); for screenshots */
  freeze(t: number | null): void;
  dispose(): void;
}

const DEG = Math.PI / 180;

// ---------- Timeline ----------

const DOOR_START = 0.35;
const DOOR_DURATION = 2.3;
const BULB_ON = [1.3, 1.65];
const CAMERA_START = 1.0;
const REVEAL = 3.3;
const END = 4.0;

// ---------- Room and props ----------

const ROOM = { halfWidth: 4, height: 3, depth: 7 };
const DOOR = { halfWidth: 3.6, panels: 5, panelHeight: 0.52, z: -0.26, radius: 0.28 };
const DOOR_HEIGHT = DOOR.panels * DOOR.panelHeight;
const DOOR_TRAVEL = DOOR_HEIGHT + (Math.PI / 2) * DOOR.radius;

// The car: centre, length, and how far it turns from facing the camera (its nose is −x in the file)
const CAR = { x: 0.1, z: -3.4, length: 4.5, turn: -20 * DEG };
// Hood mode, in the car's own space (nose towards +z): where the hood is, and where the camera goes
const HOOD = {
  point: [0, 0.86, 1.45],
  camera: { full: [0.8, 2.6, 5.3], phone: [0.4, 3.4, 6.6] },
  // Aimed to the right of the hologram, so it sits left of the spec sheet
  look: { full: [0.8, 1.05, 0.9], phone: [0, 0.75, 1.0] },
  scale: 1.15,
  // Seconds for the camera move and for the hologram to build in
  move: 1.0,
  build: 0.6,
} as const;
const HOLO = { dark: '#5CC8FF', light: '#0A7FC4' };
const CHEST = { x: -2.6, z: -1.9, turn: 0.2, width: 0.58, height: 0.8, depth: 0.44, base: 0.09 };
const TIRES = { x: 2.35, z: -2.1 };
// Tyre cross-section: outer and inner (bead) radius, half the width, shoulder radius
const TIRE = { outer: 0.32, inner: 0.2, half: 0.105, shoulder: 0.035 };

// x, z, cord length, sway speed, sway phase
const BULBS = [
  { x: -0.95, z: -3.3, cord: 0.78, speed: 1.05, phase: 0 },
  { x: 1.15, z: -4.1, cord: 0.62, speed: 0.87, phase: 1.7 },
];

const BULB_COLOR = '#FFD9A0';
const BULB_INTENSITY = 7;
const PORCH_INTENSITY = 5;

const PALETTES = {
  dark: {
    background: '#060a14',
    fog: { color: '#060a14', near: 10, far: 30 },
    back: '#3a5d99',
    side: '#2d4c82',
    ceiling: '#1c2a46',
    floor: '#6b7385',
    driveway: '#262b36',
    facade: '#3a4866',
    // The house front glows faintly at night, so it reads against the sky
    night: '#121a2c',
    opener: '#1c2740',
    rubber: '#14181f',
    trim: '#141c30',
    frame: '#3a5078',
    pegboard: '#34497a',
    shelf: '#41506e',
    // How much the studio reflection shows on the car's paint and glass
    carEnv: 0.35,
    exposure: 0.88,
    hemi: { sky: '#5d7fc0', ground: '#2a2016', intensity: 0.55 },
    sun: { color: '#6f9bff', intensity: 0.9, position: [-3.5, 2.6, -10] },
    bulbs: 1,
    cones: 0.06,
    dust: 0.75,
    stars: 1,
    porch: 1,
  },
  light: {
    background: '#bcd6ef',
    fog: { color: '#d4e4f2', near: 16, far: 60 },
    back: '#bfd9f6',
    side: '#a8c5e8',
    ceiling: '#dce8f5',
    floor: '#d8d0c3',
    driveway: '#a9a59c',
    facade: '#e3e9f0',
    night: '#000000',
    opener: '#eef3f9',
    rubber: '#3a404c',
    trim: '#9fb0c8',
    frame: '#8fa8c8',
    pegboard: '#e2ebf6',
    shelf: '#8fa3c2',
    carEnv: 0.8,
    exposure: 1,
    hemi: { sky: '#ffffff', ground: '#cbbb9f', intensity: 1.6 },
    sun: { color: '#fff3dc', intensity: 2.4, position: [-4, 6, -12] },
    bulbs: 0.25,
    cones: 0.015,
    dust: 0,
    stars: 0,
    porch: 0,
  },
} as const;

// ---------- Small helpers ----------

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const damp = (current: number, goal: number, rate: number, dt: number) => lerp(current, goal, 1 - Math.exp(-rate * dt));

/** Same numbers on every visit, so the textures never shimmer between loads */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A bulb coming on, or flickering: steps of brightness over ~0.5s */
const FLICKER_ON = [0, 0.7, 0.1, 0.5, 0.2, 1];
const FLICKER = [1, 0.35, 1, 0.55, 0.9, 1];
const steps = (pattern: readonly number[], t: number, duration: number) =>
  pattern[Math.min(pattern.length - 1, Math.max(0, Math.floor((t / duration) * pattern.length)))];

// ---------- Procedural textures (no image files) ----------

function makeTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  { repeat, pixel = false }: { repeat?: [number, number]; pixel?: boolean } = {},
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!, width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (repeat) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(...repeat);
  }
  if (pixel) {
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
  }
  return texture;
}

const grey = (v: number, a = 1) => `rgba(${v | 0}, ${v | 0}, ${v | 0}, ${a})`;

/** Speckles of lighter and darker grey over the whole canvas (written straight into the pixels: fast) */
function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, spread: number, random: () => number) {
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const dot = (x: number, y: number, v: number, a: number) => {
    if (x >= w || y >= h) return;
    const o = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) data[o + c] += (v - data[o + c]) * a;
  };
  for (let i = 0; i < count; i++) {
    const v = 128 + (random() - 0.5) * 2 * spread;
    const a = 0.18 + random() * 0.2;
    const s = random() < 0.9 ? 1 : 2;
    const x = Math.floor(random() * w);
    const y = Math.floor(random() * h);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) dot(x + dx, y + dy, v, a);
  }
  ctx.putImageData(image, 0, 0);
}

/** Vertical wood panels, 4 per 2 m tile, in greys (the material's colour tints them) */
function wallPanels() {
  const random = seeded(7);
  return makeTexture(
    256,
    384,
    (ctx, w, h) => {
      const plank = w / 4;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = grey(222 + (random() - 0.5) * 22);
        ctx.fillRect(i * plank, 0, plank, h);
        // Grain: faint streaks along the plank
        for (let g = 0; g < 14; g++) {
          ctx.fillStyle = grey(random() < 0.5 ? 190 : 245, 0.25);
          ctx.fillRect(i * plank + 4 + random() * (plank - 8), 0, 1, h);
        }
      }
      speckle(ctx, w, h, 900, 60, random);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = grey(110);
        ctx.fillRect(i * plank, 0, 3, h);
        ctx.fillStyle = grey(250, 0.6);
        ctx.fillRect(i * plank + 3, 0, 1, h);
      }
    },
    { repeat: [4, 1] },
  );
}

/** Concrete floor (8 × 7 m, back wall at the top): noise, faint 1 m tiles and an oil stain by the car */
function concreteFloor() {
  const random = seeded(11);
  return makeTexture(1024, 896, (ctx, w, h) => {
    ctx.fillStyle = grey(206);
    ctx.fillRect(0, 0, w, h);
    // Large soft patches, then fine grit
    for (let i = 0; i < 70; i++) {
      const r = 30 + random() * 90;
      const x = random() * w;
      const y = random() * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, grey(random() < 0.5 ? 180 : 230, 0.25));
      g.addColorStop(1, grey(206, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    speckle(ctx, w, h, 26000, 90, random);
    // Tile lines every metre (128 px)
    ctx.fillStyle = grey(150, 0.55);
    for (let x = 128; x < w; x += 128) ctx.fillRect(x - 1, 0, 2, h);
    for (let y = 0; y < h; y += 128) ctx.fillRect(0, y - 1, w, 2);
    // Oil stain front left of the car: a few overlapping blots
    const blots = [
      [397, 704, 70, 0.5],
      [440, 712, 46, 0.45],
      [356, 698, 34, 0.4],
      [470, 690, 22, 0.35],
    ];
    for (const [x, y, r, a] of blots) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.42);
      const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      g.addColorStop(0, grey(70, a));
      g.addColorStop(1, grey(70, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

/** Slightly rough plaster: noise only */
function roughNoise(seed: number, repeat: [number, number]) {
  const random = seeded(seed);
  return makeTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = grey(215);
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 9000, 80, random);
    },
    { repeat },
  );
}

/** Horizontal lap siding for the house front */
function siding() {
  const random = seeded(5);
  return makeTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = grey(220);
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 1500, 50, random);
      for (let y = 0; y < h; y += 16) {
        ctx.fillStyle = grey(150);
        ctx.fillRect(0, y + 14, w, 2);
        ctx.fillStyle = grey(245, 0.6);
        ctx.fillRect(0, y, w, 1);
      }
    },
    { repeat: [7, 9] },
  );
}

/** Pegboard: a grid of holes */
function pegHoles() {
  return makeTexture(
    64,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = grey(230);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = grey(70);
      for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) ctx.fillRect(x - 2, y - 2, 4, 4);
    },
    { repeat: [11, 5.5] },
  );
}

/** The back window: a pixel sky, 48 × 32 */
function windowSky(theme: Theme) {
  const random = seeded(3);
  return makeTexture(
    48,
    32,
    (ctx, w, h) => {
      if (theme === 'dark') {
        const bands = ['#040a18', '#071026', '#0a1631', '#0d1c3d'];
        bands.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(0, (i * h) / 4, w, h / 4 + 1);
        });
        for (let i = 0; i < 26; i++) {
          ctx.fillStyle = random() < 0.3 ? '#8fd4ff' : '#e6f3ff';
          ctx.fillRect((random() * w) | 0, (random() * h * 0.8) | 0, 1, 1);
        }
        // Crescent moon
        ctx.fillStyle = '#f3ead2';
        ctx.fillRect(7, 5, 6, 6);
        ctx.fillStyle = bands[0];
        ctx.fillRect(9, 4, 5, 5);
      } else {
        const bands = ['#6fb8ff', '#8cc8ff', '#acd8ff', '#cfe9ff'];
        bands.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(0, (i * h) / 4, w, h / 4 + 1);
        });
        ctx.fillStyle = '#fff2b8';
        ctx.fillRect(34, 5, 7, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(6, 20, 16, 3);
        ctx.fillRect(9, 17, 8, 3);
        ctx.fillRect(12, 15, 4, 2);
        ctx.fillRect(26, 24, 10, 2);
      }
    },
    { pixel: true },
  );
}

/** One sectional door panel: four pressed sections, or (top row) four windows */
function doorPanel(theme: Theme, windows: boolean) {
  const base = theme === 'dark' ? '#22447f' : '#e2eaf4';
  const edge = theme === 'dark' ? '#142c58' : '#a9bcd6';
  const glass = theme === 'dark' ? '#0b1830' : '#9ec6ec';
  return makeTexture(1024, 74, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = edge;
    ctx.fillRect(0, h - 6, w, 6);
    const section = w / 4;
    for (let i = 0; i < 4; i++) {
      const x = i * section + section * 0.06;
      const sw = section * 0.88;
      if (windows) {
        ctx.fillStyle = edge;
        ctx.fillRect(x, 10, sw, h - 24);
        ctx.fillStyle = glass;
        ctx.fillRect(x + 6, 16, sw - 12, h - 36);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.beginPath();
        ctx.moveTo(x + 6, 16);
        ctx.lineTo(x + sw * 0.35, 16);
        ctx.lineTo(x + sw * 0.2, h - 20);
        ctx.lineTo(x + 6, h - 20);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(x, 12, sw, 3);
        ctx.fillRect(x, 12, 3, h - 30);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(x + 3, 15, sw - 3, h - 33);
      }
    }
  });
}

/** A soft round blob: shadows under things, dust motes, glows */
function softDot(size: number, inner: string, outer: string) {
  return makeTexture(size, size, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

/**
 * Tyre profile for a LatheGeometry, going round the cross-section: bead, lower sidewall (slightly
 * bulged), shoulder, flat tread, shoulder, upper sidewall, back to the bead. Also returns where the
 * tread sits along the profile (the lathe's v coordinate), so the groove texture lands on it.
 */
function tireProfile() {
  const { outer: R, inner: r, half: h, shoulder: s } = TIRE;
  const points: Vector2[] = [];
  const add = (x: number, y: number) => points.push(new Vector2(x, y));
  add(r, -h + 0.02);
  for (let i = 0; i <= 4; i++) {
    const k = i / 4;
    add(lerp(r + 0.01, R - s, k), -h - Math.sin(k * Math.PI) * 0.01 + (1 - k) * 0.012);
  }
  for (let i = 1; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    add(R - s + Math.cos(a) * s, -h + s + Math.sin(a) * s);
  }
  const treadStart = points.length - 1;
  for (let i = 1; i <= 6; i++) add(R, lerp(-h + s, h - s, i / 6));
  const treadEnd = points.length - 1;
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    add(R - s + Math.cos(a) * s, h - s + Math.sin(a) * s);
  }
  for (let i = 1; i <= 4; i++) {
    const k = i / 4;
    add(lerp(R - s, r + 0.01, k), h + Math.sin((1 - k) * Math.PI) * 0.01 - k * 0.012);
  }
  add(r, h - 0.02);
  add(r, -h + 0.02);
  const last = points.length - 1;
  return { points, tread: [treadStart / last, treadEnd / last] as const };
}

/** Bump map for the tread: grooves round the tyre and slanted sipes; flat (mid grey) elsewhere */
function treadBump([from, to]: readonly [number, number]) {
  const texture = makeTexture(
    64,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = grey(200);
      ctx.fillRect(0, 0, w, h);
      // The canvas' top is v = 1
      const top = (1 - to) * h;
      const bottom = (1 - from) * h;
      const band = bottom - top;
      ctx.fillStyle = grey(235);
      ctx.fillRect(0, top, w, band);
      ctx.fillStyle = grey(40);
      for (const k of [0.3, 0.7]) ctx.fillRect(0, top + band * k - 2, w, 4);
      ctx.lineWidth = 5;
      ctx.strokeStyle = grey(60);
      for (const [y0, y1] of [
        [0.02, 0.28],
        [0.32, 0.68],
        [0.72, 0.98],
      ]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.15, top + band * y0);
        ctx.lineTo(w * 0.75, top + band * y1);
        ctx.stroke();
      }
    },
    { repeat: [36, 1] },
  );
  // Height data, not colour
  texture.colorSpace = NoColorSpace;
  texture.wrapT = RepeatWrapping;
  return texture;
}

/**
 * A stylised inline-six for the hologram, from simple shapes merged into one geometry: block and
 * sump, head, valve cover with six coil packs, six intake runners curving out to round throttle
 * bodies, front pulleys, and a strut brace across the bay. Length runs along z, like the car.
 */
function engineGeometry(lite: boolean) {
  const parts: Geometry[] = [];
  const radial = lite ? 6 : 12;
  const add = (geometry: Geometry, [x, y, z]: number[], rotate?: (g: Geometry) => void) => {
    rotate?.(geometry);
    parts.push(geometry.translate(x, y, z));
  };
  add(new BoxGeometry(0.34, 0.26, 0.8), [0, 0.13, 0]);
  add(new BoxGeometry(0.28, 0.08, 0.7), [0, -0.04, 0]);
  add(new BoxGeometry(0.32, 0.1, 0.82), [0, 0.31, 0]);
  add(new BoxGeometry(0.24, 0.08, 0.76), [0, 0.4, 0]);
  for (let i = 0; i < 6; i++) {
    const z = -0.3 + i * 0.12;
    add(new CylinderGeometry(0.025, 0.025, 0.05, radial), [0, 0.465, z]);
    // Runner: out from the head's side, curving up to its throttle body
    const runner = new QuadraticBezierCurve3(new Vector3(0.16, 0.3, z), new Vector3(0.42, 0.3, z), new Vector3(0.44, 0.5, z));
    parts.push(new TubeGeometry(runner, lite ? 6 : 12, 0.028, lite ? 5 : 8, false));
    add(new CylinderGeometry(0.042, 0.042, 0.07, radial), [0.44, 0.54, z]);
    add(new TorusGeometry(0.046, 0.008, 4, radial), [0.44, 0.58, z], (g) => g.rotateX(Math.PI / 2));
  }
  for (const [y, r] of [
    [0.06, 0.08],
    [0.24, 0.05],
  ]) {
    add(new CylinderGeometry(r, r, 0.03, radial * 2), [0, y, 0.43], (g) => g.rotateX(Math.PI / 2));
  }
  // Strut brace: across the bay in front of the engine, between two tower plates
  add(new CylinderGeometry(0.018, 0.018, 0.9, radial), [0, 0.56, 0.5], (g) => g.rotateZ(Math.PI / 2));
  for (const x of [-0.45, 0.45]) add(new CylinderGeometry(0.06, 0.06, 0.02, radial), [x, 0.56, 0.5]);
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

/** Hologram shader: one flat colour, a sweeping scan band and fine scanlines (unless lite) */
function hologramMaterial(opacity: number, lite: boolean) {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(HOLO.dark) },
      uOpacity: { value: 0 },
      uBase: { value: opacity },
      uGlow: { value: 1 },
      uTime: { value: 0 },
      uShimmer: { value: lite ? 0 : 1 },
    },
    vertexShader: /* glsl */ `
      varying float vHeight;
      void main() {
        vHeight = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uBase;
      uniform float uGlow;
      uniform float uTime;
      uniform float uShimmer;
      varying float vHeight;
      void main() {
        float sweep = fract(uTime * 0.45) * 0.9 - 0.15;
        float band = exp(-pow((vHeight - sweep) * 10.0, 2.0));
        float lines = 0.75 + 0.25 * step(0.5, fract(vHeight * 70.0 - uTime * 2.0));
        float shimmer = mix(1.0, lines + band * 1.5, uShimmer);
        gl_FragColor = vec4(uColor * uGlow, uBase * uOpacity * shimmer);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

// ---------- The scene ----------

export async function createGarage(options: GarageOptions): Promise<GarageScene> {
  const { container } = options;
  let { quality } = options;
  const { touch } = options;
  let { theme, full } = options;

  const renderer = new WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
  // Counted per frame (bloom renders several passes), for the ?debug overlay
  renderer.info.autoReset = false;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(46, 1.5, 0.05, 80);
  const textures: Texture[] = [];
  const track = <T extends Texture>(texture: T) => (textures.push(texture), texture);

  // A small studio environment for the car's paint, glass and chrome (and the spare wheel's rim)
  const pmrem = new PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const envMap = pmrem.fromScene(environment, 0.04).texture;
  environment.dispose();
  pmrem.dispose();
  track(envMap);

  // ---------- Materials ----------

  const panels = track(wallPanels());
  const sidePanels = track(panels.clone());
  sidePanels.repeat.set(3.5, 1);
  const floorTexture = track(concreteFloor());
  const ceilingTexture = track(roughNoise(13, [4, 3.5]));
  const drivewayTexture = track(roughNoise(17, [10, 7]));
  const sidingTexture = track(siding());
  const pegTexture = track(pegHoles());
  const skies = { dark: track(windowSky('dark')), light: track(windowSky('light')) };
  const doorTextures = {
    dark: [track(doorPanel('dark', false)), track(doorPanel('dark', true))],
    light: [track(doorPanel('light', false)), track(doorPanel('light', true))],
  };
  const blobTexture = track(softDot(128, 'rgba(0, 0, 0, 0.85)', 'rgba(0, 0, 0, 0)'));
  const dustTexture = track(softDot(32, 'rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0)'));
  const glowTexture = track(softDot(64, 'rgba(255, 217, 160, 0.9)', 'rgba(255, 217, 160, 0)'));
  const profile = tireProfile();
  const tread = { profile, bump: track(treadBump(profile.tread)) };

  const standard = (color: string, extra: Partial<MeshStandardMaterial> = {}) =>
    Object.assign(new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }), extra);

  const materials = {
    back: standard('#ffffff', { map: panels }),
    side: standard('#ffffff', { map: sidePanels }),
    ceiling: standard('#ffffff', { map: ceilingTexture, roughness: 1 }),
    floor: standard('#ffffff', { map: floorTexture, roughness: 0.75 }),
    driveway: standard('#ffffff', { map: drivewayTexture, roughness: 1 }),
    facade: standard('#ffffff', { map: sidingTexture, emissive: new Color('#000000') }),
    trim: standard('#ffffff'),
    frame: standard('#ffffff', { roughness: 0.6 }),
    pegboard: standard('#ffffff', { map: pegTexture }),
    shelf: standard('#ffffff'),
    door: [0, 1].map(() => standard('#ffffff', { roughness: 0.6, emissive: new Color('#000000') })),
    track: standard('#3a4560', { metalness: 0.6, roughness: 0.45 }),
    opener: standard('#ffffff', { roughness: 0.5 }),
    chest: standard('#1a3f80', { metalness: 0.1, roughness: 0.45, emissive: new Color('#1a3f80'), emissiveIntensity: 0 }),
    chestDark: standard('#102d60', { metalness: 0.1, roughness: 0.5, emissive: new Color('#102d60'), emissiveIntensity: 0 }),
    drawer: standard('#2a62be', { metalness: 0.1, roughness: 0.4, emissive: new Color('#2a62be'), emissiveIntensity: 0 }),
    handle: standard('#9cc4ff', { metalness: 0.2, roughness: 0.6 }),
    rubber: standard('#ffffff', { roughness: 0.95 }),
    tire: standard('#151515', { roughness: 0.9, bumpMap: tread.bump, bumpScale: 3 }),
    rim: standard('#c9ced6', { metalness: 0.8, roughness: 0.3, envMap, envMapIntensity: 0.8, side: DoubleSide }),
    wood: standard('#8a6440', { roughness: 0.8 }),
    woodDark: standard('#5e4128', { roughness: 0.85 }),
    radio: standard('#2a3b5a', { roughness: 0.5 }),
    speaker: standard('#111827', { roughness: 0.9 }),
    mug: standard('#e6f3ff', { roughness: 0.4 }),
    toolA: standard('#8fb3d9', { metalness: 0.7, roughness: 0.35 }),
    toolB: standard('#6e8bb8', { metalness: 0.7, roughness: 0.35 }),
    accent: standard('#4a9eff', { roughness: 0.5 }),
    bottlePale: standard('#bfe0ff', { roughness: 0.3 }),
    bottleRed: standard('#d0453a', { roughness: 0.35 }),
    box: standard('#5a6a88'),
    boxDark: standard('#4c5c7a'),
    boxTan: standard('#b08a5a'),
    lamp: standard('#141a26', { metalness: 0.5, roughness: 0.5 }),
    lampGlass: new MeshStandardMaterial({ color: '#fff1d6', emissive: new Color(BULB_COLOR), emissiveIntensity: 3 }),
    bulb: [0, 1].map(() => new MeshStandardMaterial({ color: '#fff1d6', emissive: new Color(BULB_COLOR), emissiveIntensity: 0 })),
    cord: new MeshBasicMaterial({ color: '#05070c' }),
    led: new MeshBasicMaterial({ color: '#4aa8ff' }),
    window: new MeshBasicMaterial({ map: skies.dark, toneMapped: false, fog: false }),
    blob: new MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, opacity: 0.85 }),
  };

  // ---------- Mesh helpers ----------

  const boxGeometries = new Map<string, BoxGeometry>();
  function box(
    parent: Object3D,
    material: Material | Material[],
    [w, h, d]: [number, number, number],
    [x, y, z]: [number, number, number],
    { cast = true, receive = true } = {},
  ) {
    const key = `${w}|${h}|${d}`;
    let geometry = boxGeometries.get(key);
    if (!geometry) boxGeometries.set(key, (geometry = new BoxGeometry(w, h, d)));
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  function plane(parent: Object3D, material: Material, w: number, h: number, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) {
    const mesh = new Mesh(new PlaneGeometry(w, h), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function blob(parent: Object3D, w: number, d: number, x: number, z: number) {
    const mesh = plane(parent, materials.blob, w, d, [x, 0.004, z], [-Math.PI / 2, 0, 0]);
    mesh.receiveShadow = false;
    mesh.renderOrder = 1;
    return mesh;
  }

  // ---------- Room ----------

  const { halfWidth: RW, height: RH, depth: RD } = ROOM;
  plane(scene, materials.floor, RW * 2, RD, [0, 0, -RD / 2], [-Math.PI / 2, 0, 0]);
  plane(scene, materials.ceiling, RW * 2, RD, [0, RH, -RD / 2], [Math.PI / 2, 0, 0]);
  plane(scene, materials.back, RW * 2, RH, [0, RH / 2, -RD]);
  plane(scene, materials.side, RD, RH, [-RW, RH / 2, -RD / 2], [0, Math.PI / 2, 0]);
  plane(scene, materials.side, RD, RH, [RW, RH / 2, -RD / 2], [0, -Math.PI / 2, 0]);

  // Skirting where the walls meet the floor
  box(scene, materials.trim, [RW * 2, 0.08, 0.03], [0, 0.04, -RD + 0.015], { cast: false });
  box(scene, materials.trim, [0.03, 0.08, RD], [-RW + 0.015, 0.04, -RD / 2], { cast: false });
  box(scene, materials.trim, [0.03, 0.08, RD], [RW - 0.015, 0.04, -RD / 2], { cast: false });

  // Back window: frame, mullion and the pixel sky
  const win = { x: -2.35, y: 2.2, w: 1.15, h: 0.8, z: -RD + 0.02 };
  plane(scene, materials.window, win.w, win.h, [win.x, win.y, win.z]);
  for (const [w, h, x, y] of [
    [win.w + 0.12, 0.06, win.x, win.y + win.h / 2 + 0.03],
    [win.w + 0.12, 0.08, win.x, win.y - win.h / 2 - 0.04],
    [0.06, win.h, win.x - win.w / 2 - 0.03, win.y],
    [0.06, win.h, win.x + win.w / 2 + 0.03, win.y],
    [0.04, win.h, win.x, win.y],
  ] as const) {
    box(scene, materials.frame, [w, h, 0.06], [x, y, win.z + 0.02], { cast: false });
  }

  // Pegboard with tools, over the workbench (back right)
  const peg = { x: 2.5, y: 1.9, z: -RD + 0.03 };
  box(scene, materials.pegboard, [2.2, 1.1, 0.03], [peg.x, peg.y, peg.z], { cast: false });
  const toolZ = peg.z + 0.04;
  // Screwdrivers and spanners hanging in a row, a hammer, pliers, a saw
  [
    [1.55, 0.05, 0.5, materials.toolA],
    [1.7, 0.04, 0.42, materials.toolA],
    [1.83, 0.035, 0.34, materials.toolA],
  ].forEach(([x, w, h, m]) => box(scene, m as Material, [w as number, h as number, 0.025], [x as number, 2.05 - (h as number) / 2 + 0.15, toolZ]));
  box(scene, materials.toolB, [0.38, 0.09, 0.03], [2.25, 2.18, toolZ]);
  box(scene, materials.woodDark, [0.05, 0.42, 0.03], [2.25, 1.93, toolZ]);
  const pliers = new Group();
  pliers.position.set(2.72, 1.98, toolZ);
  box(pliers, materials.toolB, [0.04, 0.42, 0.025], [-0.04, 0, 0]).rotation.z = 0.12;
  box(pliers, materials.toolB, [0.04, 0.42, 0.025], [0.04, 0, 0]).rotation.z = -0.12;
  box(pliers, materials.accent, [0.12, 0.1, 0.03], [0, -0.2, 0.005]);
  scene.add(pliers);
  box(scene, materials.toolA, [0.05, 0.48, 0.025], [3.12, 1.96, toolZ]);
  box(scene, materials.accent, [0.09, 0.13, 0.04], [3.12, 2.18, toolZ + 0.005]);
  box(scene, materials.toolA, [0.5, 0.16, 0.012], [3.2, 1.56, toolZ]);
  box(scene, materials.woodDark, [0.12, 0.14, 0.03], [2.9, 1.56, toolZ]);

  // Workbench with a radio and a mug
  const bench = { x: 2.55, z: -RD + 0.38, w: 2.3, d: 0.66, top: 0.9 };
  box(scene, materials.wood, [bench.w, 0.06, bench.d], [bench.x, bench.top, bench.z]);
  box(scene, materials.wood, [bench.w - 0.1, 0.03, bench.d - 0.1], [bench.x, 0.25, bench.z]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(scene, materials.woodDark, [0.07, bench.top, 0.07], [bench.x + sx * (bench.w / 2 - 0.08), bench.top / 2, bench.z + sz * (bench.d / 2 - 0.08)]);
    }
  }
  const radio = new Group();
  radio.position.set(2.05, bench.top + 0.03, bench.z + 0.05);
  radio.rotation.y = 0.15;
  box(radio, materials.radio, [0.44, 0.25, 0.17], [0, 0.125, 0]);
  const speaker = new Mesh(new CylinderGeometry(0.075, 0.075, 0.02, 20), materials.speaker);
  speaker.rotation.x = Math.PI / 2;
  speaker.position.set(-0.1, 0.12, 0.09);
  radio.add(speaker);
  box(radio, materials.accent, [0.12, 0.04, 0.01], [0.11, 0.17, 0.088], { cast: false });
  box(radio, materials.handle, [0.015, 0.3, 0.015], [0.18, 0.4, -0.04]).rotation.z = -0.35;
  scene.add(radio);
  const mug = new Group();
  mug.position.set(2.62, bench.top + 0.03, bench.z + 0.1);
  const cup = new Mesh(new CylinderGeometry(0.05, 0.045, 0.11, 18), materials.mug);
  cup.position.y = 0.055;
  cup.castShadow = true;
  mug.add(cup);
  const mugHandle = new Mesh(new TorusGeometry(0.03, 0.008, 6, 12), materials.mug);
  mugHandle.position.set(0.055, 0.06, 0);
  mug.add(mugHandle);
  scene.add(mug);
  box(scene, materials.boxDark, [0.3, 0.18, 0.24], [3.3, bench.top + 0.12, bench.z - 0.08]);

  // Shelves with bottles and boxes (back left, under the window)
  const shelf = { x: -2.5, z: -RD + 0.22, w: 1.7, d: 0.4 };
  for (const sx of [-1, 1]) box(scene, materials.shelf, [0.04, 1.58, shelf.d], [shelf.x + sx * (shelf.w / 2), 0.79, shelf.z]);
  for (const y of [0.4, 0.9, 1.4]) box(scene, materials.shelf, [shelf.w, 0.03, shelf.d], [shelf.x, y, shelf.z]);
  const bottle = (x: number, y: number, r: number, h: number, material: Material) => {
    const body = new Mesh(new CylinderGeometry(r, r, h, 14), material);
    body.position.set(x, y + h / 2, shelf.z);
    body.castShadow = true;
    scene.add(body);
    const neck = new Mesh(new CylinderGeometry(r * 0.35, r * 0.45, h * 0.3, 10), material);
    neck.position.set(x, y + h * 1.15, shelf.z);
    scene.add(neck);
  };
  bottle(-3.15, 1.415, 0.06, 0.24, materials.accent);
  bottle(-2.98, 1.415, 0.055, 0.2, materials.bottlePale);
  box(scene, materials.box, [0.42, 0.28, 0.3], [-2.55, 1.555, shelf.z]);
  box(scene, materials.boxTan, [0.3, 0.2, 0.26], [-2.0, 1.515, shelf.z]);
  box(scene, materials.boxDark, [0.5, 0.32, 0.32], [-3.0, 1.075, shelf.z]);
  bottle(-2.45, 0.915, 0.065, 0.26, materials.bottleRed);
  bottle(-2.28, 0.915, 0.05, 0.2, materials.accent);
  box(scene, materials.box, [0.36, 0.22, 0.3], [-1.9, 1.025, shelf.z]);
  box(scene, materials.boxTan, [0.6, 0.3, 0.34], [-2.8, 0.565, shelf.z]);
  box(scene, materials.boxDark, [0.4, 0.26, 0.3], [-2.1, 0.545, shelf.z]);

  // Door tracks: up the sides of the opening, round a curve, then along the ceiling
  const trackY = DOOR_HEIGHT + DOOR.radius;
  for (const sx of [-1, 1]) {
    const x = sx * (DOOR.halfWidth + 0.06);
    box(scene, materials.track, [0.05, DOOR_HEIGHT, 0.05], [x, DOOR_HEIGHT / 2, DOOR.z], { cast: false });
    const curve = new Mesh(new TorusGeometry(DOOR.radius, 0.025, 6, 10, Math.PI / 2), materials.track);
    curve.rotation.y = -Math.PI / 2;
    curve.position.set(x, DOOR_HEIGHT, DOOR.z - DOOR.radius);
    scene.add(curve);
    box(scene, materials.track, [0.05, 0.05, 2.9], [x, trackY, DOOR.z - DOOR.radius - 1.45], { cast: false });
    box(scene, materials.track, [0.03, RH - trackY, 0.03], [x, (RH + trackY) / 2, DOOR.z - DOOR.radius - 2.8], { cast: false });
  }

  // Door opener on the ceiling with its blinking blue LED
  const opener = { z: -3.35 };
  box(scene, materials.opener, [0.42, 0.16, 0.6], [0, RH - 0.2, opener.z], { cast: false });
  box(scene, materials.track, [0.05, 0.04, 3.0], [0, RH - 0.14, opener.z + 1.6], { cast: false });
  box(scene, materials.track, [0.03, 0.12, 0.03], [0, RH - 0.06, opener.z], { cast: false });
  const led = new Mesh(new SphereGeometry(0.014, 8, 6), materials.led);
  led.position.set(0.14, RH - 0.25, opener.z + 0.3);
  scene.add(led);
  const ledLight = new PointLight('#4aa8ff', 0, 1.6, 2);
  ledLight.position.copy(led.position).add(new Vector3(0, -0.05, 0.05));
  scene.add(ledLight);

  // ---------- The sectional door: 5 panels following the track ----------

  const doorGroup = new Group();
  const doorPanels: Mesh[] = [];
  const doorPanelGeometry = new BoxGeometry(DOOR.halfWidth * 2, DOOR.panelHeight - 0.01, 0.05);
  for (let i = 0; i < DOOR.panels; i++) {
    const panel = new Mesh(doorPanelGeometry, i === DOOR.panels - 1 ? materials.door[1] : materials.door[0]);
    panel.castShadow = false;
    panel.receiveShadow = true;
    doorGroup.add(panel);
    doorPanels.push(panel);
  }
  scene.add(doorGroup);

  /** Panel centre at arc length s along the track: up, round the curve, then along the ceiling */
  function placeDoorPanel(panel: Mesh, s: number) {
    const { z: z0, radius: r } = DOOR;
    if (s <= DOOR_HEIGHT) {
      panel.position.set(0, s, z0);
      panel.rotation.x = 0;
    } else if (s <= DOOR_TRAVEL) {
      const a = (s - DOOR_HEIGHT) / r;
      panel.position.set(0, DOOR_HEIGHT + r * Math.sin(a), z0 - r * (1 - Math.cos(a)));
      panel.rotation.x = -a;
    } else {
      panel.position.set(0, trackY, z0 - r - (s - DOOR_TRAVEL));
      panel.rotation.x = -Math.PI / 2;
    }
  }

  function placeDoor(open: number) {
    doorPanels.forEach((panel, i) => placeDoorPanel(panel, (i + 0.5) * DOOR.panelHeight + open * DOOR_TRAVEL));
  }

  // ---------- Outside: the house front, the driveway, porch lights and a few stars ----------

  const outside = new Group();
  const FW = 7;
  const FH = 4.4;
  box(outside, materials.facade, [FW - DOOR.halfWidth, FH, 0.22], [-(FW + DOOR.halfWidth) / 2, FH / 2, -0.11], { cast: false });
  box(outside, materials.facade, [FW - DOOR.halfWidth, FH, 0.22], [(FW + DOOR.halfWidth) / 2, FH / 2, -0.11], { cast: false });
  box(outside, materials.facade, [DOOR.halfWidth * 2, FH - DOOR_HEIGHT, 0.22], [0, (FH + DOOR_HEIGHT) / 2, -0.11], { cast: false });
  box(outside, materials.trim, [FW * 2 + 0.6, 0.3, 0.7], [0, FH + 0.12, 0.1], { cast: false });
  box(outside, materials.trim, [0.12, DOOR_HEIGHT + 0.1, 0.06], [-DOOR.halfWidth - 0.06, DOOR_HEIGHT / 2, 0.02], { cast: false });
  box(outside, materials.trim, [0.12, DOOR_HEIGHT + 0.1, 0.06], [DOOR.halfWidth + 0.06, DOOR_HEIGHT / 2, 0.02], { cast: false });
  box(outside, materials.trim, [DOOR.halfWidth * 2 + 0.24, 0.12, 0.06], [0, DOOR_HEIGHT + 0.06, 0.02], { cast: false });
  plane(outside, materials.driveway, 40, 24, [0, 0, 12], [-Math.PI / 2, 0, 0]);

  const porchLights: PointLight[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * 3.98;
    box(outside, materials.lamp, [0.18, 0.3, 0.12], [x, 2.15, 0.06], { cast: false });
    box(outside, materials.lampGlass, [0.11, 0.18, 0.09], [x, 2.13, 0.1], { cast: false });
    const light = new PointLight(BULB_COLOR, 0, 7, 2);
    light.position.set(x, 2.1, 0.45);
    outside.add(light);
    porchLights.push(light);
  }

  const starCount = 140;
  const starPositions = new Float32Array(starCount * 3);
  const starRandom = seeded(23);
  for (let i = 0; i < starCount; i++) {
    starPositions.set([(starRandom() - 0.5) * 70, 5 + starRandom() * 22, -30 - starRandom() * 10], i * 3);
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3));
  const starMaterial = new PointsMaterial({ color: '#dbe9ff', size: 2, sizeAttenuation: false, transparent: true, fog: false });
  outside.add(new Points(starGeometry, starMaterial));
  scene.add(outside);

  // ---------- Tool chest (front left): 4 drawers that slide out ----------

  const chest = new Group();
  chest.position.set(CHEST.x, 0, CHEST.z);
  chest.rotation.y = CHEST.turn;
  const { width: CW, height: CH, depth: CD, base: CB } = CHEST;
  box(chest, materials.chest, [CW, CH, CD], [0, CB + CH / 2, 0]);
  box(chest, materials.chestDark, [CW + 0.03, 0.035, CD + 0.03], [0, CB + CH + 0.017, 0]);
  const front = CD / 2;
  const labelHeight = 0.11;
  const inset = 0.03;
  const labelBand = box(chest, materials.chestDark, [CW - inset * 2, labelHeight, 0.012], [0, CB + CH - inset - labelHeight / 2, front + 0.006], { cast: false });
  const drawerGap = 0.028;
  const drawerHeight = (CH - inset * 2 - labelHeight - drawerGap * 4) / 4;
  const drawerWidth = CW - inset * 2;
  const drawers = Array.from({ length: 4 }, (_, i) => {
    const group = new Group();
    const top = CB + CH - inset - labelHeight - drawerGap * (i + 1) - drawerHeight * i;
    group.position.set(0, top - drawerHeight / 2, 0);
    const face = box(group, materials.drawer, [drawerWidth, drawerHeight, 0.024], [0, 0, front + 0.012]);
    box(group, materials.chestDark, [drawerWidth - 0.03, drawerHeight - 0.03, CD - 0.06], [0, -0.005, front - (CD - 0.06) / 2], { cast: false });
    box(group, materials.handle, [0.09, 0.016, 0.02], [drawerWidth / 2 - 0.075, 0, front + 0.034], { cast: false });
    chest.add(group);
    return { group, face, open: 0 };
  });
  for (const [x, z] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const caster = new Mesh(new CylinderGeometry(0.04, 0.04, 0.03, 12), materials.rubber);
    caster.rotation.z = Math.PI / 2;
    caster.position.set(x * (CW / 2 - 0.07), 0.04, z * (CD / 2 - 0.07));
    chest.add(caster);
  }
  scene.add(chest);
  const chestBlob = blob(scene, 1.0, 0.75, CHEST.x, CHEST.z + 0.05);

  // ---------- Tyres: a stack of 3 lying flat (front right), and a spare wheel against the right wall ----------

  const tireGeometry = new LatheGeometry(tread.profile.points, 48);
  const tires = new Group();
  tires.position.set(TIRES.x, 0, TIRES.z);
  [
    [0, 0, 0, 0],
    [0.05, -0.03, 0.9, 0.012],
    [-0.03, 0.04, 2.1, -0.015],
  ].forEach(([dx, dz, turn, tilt], i) => {
    const tire = new Mesh(tireGeometry, materials.tire);
    tire.position.set(dx, TIRE.half + 0.01 + i * (TIRE.half * 2 + 0.004), dz);
    tire.rotation.set(tilt, turn, -tilt);
    tire.castShadow = tire.receiveShadow = true;
    tires.add(tire);
  });
  scene.add(tires);
  const tiresBlob = blob(scene, 1.0, 1.0, TIRES.x, TIRES.z);

  /** A 5-spoke rim, axis along y like the lathe, its face at +y */
  function fiveSpokeRim() {
    const rim = new Group();
    const radius = TIRE.inner - 0.005;
    const barrel = new Mesh(new CylinderGeometry(radius, radius, TIRE.half * 1.8, 32, 1, true), materials.rim);
    rim.add(barrel);
    const lip = new Mesh(new TorusGeometry(radius, 0.012, 8, 40), materials.rim);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = TIRE.half * 0.75;
    rim.add(lip);
    const hub = new Mesh(new CylinderGeometry(0.055, 0.06, 0.05, 20), materials.rim);
    hub.position.y = TIRE.half * 0.55;
    rim.add(hub);
    for (let i = 0; i < 5; i++) {
      const spoke = new Group();
      spoke.rotation.y = (i / 5) * Math.PI * 2;
      const bar = box(spoke, materials.rim, [radius - 0.05, 0.022, 0.04], [(radius + 0.05) / 2, TIRE.half * 0.6, 0]);
      bar.rotation.z = 0.08;
      rim.add(spoke);
    }
    rim.traverse((object) => ((object as Mesh).castShadow = true));
    return rim;
  }

  // Standing on its tread, its face to the room, leaning back on the wall by ~10°
  const spare = new Group();
  const spareTire = new Mesh(tireGeometry, materials.tire);
  spareTire.castShadow = spareTire.receiveShadow = true;
  spare.add(spareTire, fiveSpokeRim());
  const lean = 10 * DEG;
  spare.rotation.set(0, 0, Math.PI / 2 - lean);
  spare.position.set(RW - TIRE.half * Math.cos(lean) - TIRE.outer * Math.sin(lean) - 0.02, TIRE.outer * Math.cos(lean) + 0.005, -4.7);
  scene.add(spare);

  // ---------- The car: a glTF model, on the floor in the middle, turned ~20° towards the camera ----------

  const carRoot = new Group();
  carRoot.position.set(CAR.x, 0, CAR.z);
  // The model's nose points to +z (the camera): just the 3/4 angle
  carRoot.rotation.y = CAR.turn;
  scene.add(carRoot);
  // Until the model is in: a box the size of an E46, for the layout and the hood button
  const carBox = new Box3(new Vector3(-CAR.length / 2, 0, -0.92), new Vector3(CAR.length / 2, 1.38, 0.92));

  const car = {
    model: null as Group | null,
    materials: [] as { material: MeshStandardMaterial; transparent: boolean; opacity: number }[],
    fade: 0,
  };

  async function loadCar() {
    const draco = new DRACOLoader().setDecoderPath(options.dracoPath);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    try {
      const gltf = await loader.loadAsync(options.modelUrl, (event) => {
        options.onCarProgress?.(event.lengthComputable && event.total ? event.loaded / event.total : null);
      });
      if (disposed) return;
      const model = gltf.scene;

      // Node and material names (dev only)
      if (import.meta.env.DEV) {
        const names: string[] = [];
        model.traverse((object) => object.name && names.push(object.name));
        console.info('[garage] car nodes:', names.join(', '));
      }

      // The file comes with a showroom backdrop (material "back"): not in our garage
      const backdrop: Object3D[] = [];
      model.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.isMesh && (mesh.material as Material).name === 'back') backdrop.push(mesh);
      });
      backdrop.forEach((object) => object.removeFromParent());

      // Scale to ~4.5 m long (its baked floor shadow left out of the measure), on the floor, centred
      const bounds = new Box3();
      model.updateMatrixWorld(true);
      model.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.isMesh && (mesh.material as Material).name !== 'carshadow') bounds.expandByObject(mesh);
      });
      const scale = CAR.length / (bounds.max.z - bounds.min.z);
      model.scale.setScalar(scale);
      model.position.set(-((bounds.min.x + bounds.max.x) / 2) * scale, -bounds.min.y * scale, -((bounds.min.z + bounds.max.z) / 2) * scale);
      model.updateMatrixWorld(true);

      // Shadows (desktop), the studio reflection, and a fade-in
      model.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as MeshPhysicalMaterial;
        const shadowPlane = material.name === 'carshadow';
        mesh.castShadow = !material.transparent && !shadowPlane;
        mesh.receiveShadow = !shadowPlane;
        // Glass: plain see-through instead of transmission (which re-renders the scene every frame)
        if (material.transmission) {
          material.transmission = 0;
          material.transparent = true;
          material.opacity = Math.min(material.opacity, 0.35);
        }
        if (material.name === 'paint') {
          // Laguna Seca Blue stays as it comes; just a softer, deeper coat
          material.roughness = 0.32;
          material.clearcoat = 0.45;
          material.clearcoatRoughness = 0.15;
        } else if (material.metalness > 0.5) {
          // Mirror-smooth chrome turns the bulbs into blinding points
          material.roughness = Math.max(material.roughness, 0.15);
        }
        if (!car.materials.some((m) => m.material === material)) {
          car.materials.push({ material, transparent: material.transparent, opacity: material.opacity });
        }
        material.envMap = envMap;
        material.needsUpdate = true;
      });
      applyCarEnv();

      // Measured before it joins the scene, so the box is in the car's own space (shadow plane left out)
      carBox.makeEmpty();
      model.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh.isMesh && (mesh.material as Material).name !== 'carshadow') carBox.expandByObject(mesh);
      });
      // Compile its shaders off the main thread where the GPU allows it, both as it ends up (opaque)
      // and as it fades in (transparent), so neither the fade nor its end stalls a frame. Meanwhile
      // it sits on a layer the camera doesn't draw.
      model.traverse((object) => object.layers.set(1));
      carRoot.add(model);
      await renderer.compileAsync(model, camera, scene);
      for (const { material } of car.materials) {
        material.transparent = true;
        material.opacity = 0;
        material.needsUpdate = true;
      }
      await renderer.compileAsync(model, camera, scene);
      if (disposed) return;
      model.traverse((object) => object.layers.set(0));
      car.model = model;
      lastLayout = '';
      options.onCarReady?.(true);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[garage] car failed to load', error);
      options.onCarReady?.(false);
    } finally {
      draco.dispose();
    }
  }

  function applyCarEnv() {
    for (const { material } of car.materials) material.envMapIntensity = PALETTES[theme].carEnv;
  }

  // ---------- Hood mode: a holographic engine ~20 cm above the hood, with the skills round it ----------

  const hologram = new Group();
  hologram.position.set(HOOD.point[0], HOOD.point[1] + 0.2 + 0.05, HOOD.point[2]);
  hologram.visible = false;
  carRoot.add(hologram);
  const engine = new Group();
  const engineShape = engineGeometry(!quality.shimmer);
  const holoFill = hologramMaterial(0.14, !quality.shimmer);
  const holoWire = hologramMaterial(0.5, !quality.shimmer);
  const holoWireGeometry = new WireframeGeometry(engineShape);
  engine.add(new Mesh(engineShape, holoFill), new LineSegments(holoWireGeometry, holoWire));
  engine.children.forEach((child) => (child.renderOrder = 3));
  hologram.add(engine);

  // The labels are HTML (CSS2DRenderer): real buttons, drawn over the canvas
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'holo-labels';
  container.append(labelRenderer.domElement);
  // Round the engine: two on each side, one high and one low
  const labelSpots = [
    [-0.68, 0.72, 0.2],
    [0.72, 0.74, 0.1],
    [-0.66, 0.02, -0.1],
    [0.7, 0.04, -0.2],
  ];
  const labels = options.skillLabels.map((text, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'holo-label';
    button.textContent = text;
    button.setAttribute('aria-controls', `drawer-${i}`);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => options.onSkill?.(i));
    const label = new CSS2DObject(button);
    label.position.set(labelSpots[i][0], labelSpots[i][1], labelSpots[i][2]);
    hologram.add(label);
    return { label, button, y: labelSpots[i][1] };
  });

  const hood = { open: false, move: 0, build: 0 };

  function applyHologramTheme() {
    for (const material of [holoFill, holoWire]) {
      material.uniforms.uColor.value.set(HOLO[theme]);
      // Additive glow over the dark garage; over daylight it would wash out, so it's drawn normally
      material.blending = theme === 'dark' ? AdditiveBlending : NormalBlending;
      material.uniforms.uGlow.value = theme === 'dark' && material === holoWire ? 1.25 : 1;
      material.needsUpdate = true;
    }
  }

  // ---------- Lights ----------

  const hemi = new HemisphereLight('#5d7fc0', '#2a2016', 0.5);
  scene.add(hemi);
  const sun = new DirectionalLight('#6f9bff', 1);
  sun.target.position.set(0.5, 0, -2);
  scene.add(sun, sun.target);

  const bulbs = BULBS.map((spec, i) => {
    const pivot = new Group();
    pivot.position.set(spec.x, RH, spec.z);
    const cord = new Mesh(new CylinderGeometry(0.005, 0.005, spec.cord, 5), materials.cord);
    cord.position.y = -spec.cord / 2;
    pivot.add(cord);
    const socket = new Mesh(new CylinderGeometry(0.022, 0.026, 0.05, 10), materials.lamp);
    socket.position.y = -spec.cord - 0.02;
    pivot.add(socket);
    const glass = new Mesh(new SphereGeometry(0.05, 16, 12), materials.bulb[i]);
    glass.scale.set(1, 1.3, 1);
    glass.position.y = -spec.cord - 0.095;
    pivot.add(glass);

    const light = new PointLight(BULB_COLOR, 0, 0, 2);
    light.position.y = glass.position.y;
    light.castShadow = quality.shadows;
    light.shadow.mapSize.set(quality.shadowMapSize || 1024, quality.shadowMapSize || 1024);
    light.shadow.radius = 5;
    light.shadow.bias = -0.004;
    light.shadow.normalBias = 0.02;
    light.shadow.camera.near = 0.08;
    light.shadow.camera.far = 9;
    pivot.add(light);

    const halo = new Sprite(new SpriteMaterial({ map: glowTexture, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 }));
    halo.scale.setScalar(0.5);
    halo.position.y = glass.position.y;
    pivot.add(halo);

    // The cone of light: brighter at the bulb, fading to the floor
    const coneLength = RH + glass.position.y;
    const coneGeometry = new ConeGeometry(1.05, coneLength, 32, 1, true);
    coneGeometry.translate(0, -coneLength / 2, 0);
    const positions = coneGeometry.attributes.position;
    const shade = new Float32Array(positions.count * 3);
    for (let v = 0; v < positions.count; v++) {
      const k = 1 - (-positions.getY(v) / coneLength) * 0.8;
      shade.set([k, k, k], v * 3);
    }
    coneGeometry.setAttribute('color', new BufferAttribute(shade, 3));
    const coneMaterial = new MeshBasicMaterial({
      color: BULB_COLOR,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    });
    const cone = new Mesh(coneGeometry, coneMaterial);
    cone.position.y = glass.position.y;
    cone.renderOrder = 2;
    pivot.add(cone);

    scene.add(pivot);
    return { spec, pivot, light, halo, cone, coneLength, glassY: glass.position.y, power: 0, flickerAt: 4 + i * 3, flickerStart: -10 };
  });

  // ---------- Dust drifting up inside the cones ----------

  const dustCount = Math.max(1, quality.dust);
  const dustRandom = Math.random;
  const motes = Array.from({ length: dustCount }, (_, i) => ({
    bulb: i % bulbs.length,
    depth: dustRandom(),
    angle: dustRandom() * Math.PI * 2,
    radius: Math.sqrt(dustRandom()) * 0.85,
    speed: 0.025 + dustRandom() * 0.04,
    wobble: dustRandom() * Math.PI * 2,
  }));
  const dustPositions = new Float32Array(dustCount * 3);
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3));
  const dustMaterial = new PointsMaterial({
    color: '#ffe2b8',
    map: dustTexture,
    size: 0.022,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const dust = new Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------- Bloom (desktop, dark theme) ----------

  let composer: { render: () => void; setSize: (w: number, h: number) => void; setPixelRatio: (r: number) => void; dispose: () => void } | null = null;
  let bloomPass: { dispose: () => void; resolution: Vector2 } | null = null;
  let composerTarget: WebGLRenderTarget | null = null;
  let bloomOn = quality.bloom;
  if (quality.bloom) {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
        import('three/examples/jsm/postprocessing/OutputPass.js'),
      ]);
      // Multisampled, so the bloomed image keeps its antialiasing
      composerTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
      const effects = new EffectComposer(renderer, composerTarget);
      effects.addPass(new RenderPass(scene, camera));
      // Only what's brighter than white blooms (bulbs, LED, lamps), not the car's reflections
      const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.6, 0.45, 1.4);
      effects.addPass(bloom);
      effects.addPass(new OutputPass());
      composer = effects;
      bloomPass = bloom;
    } catch {
      // No bloom: the halos carry the glow on their own
    }
  }

  // ---------- Theme ----------

  function applyTheme() {
    const p = PALETTES[theme];
    scene.background = new Color(p.background);
    scene.fog = new Fog(p.fog.color, p.fog.near, p.fog.far);
    materials.back.color.set(p.back);
    materials.side.color.set(p.side);
    materials.ceiling.color.set(p.ceiling);
    materials.floor.color.set(p.floor);
    materials.driveway.color.set(p.driveway);
    materials.facade.color.set(p.facade);
    materials.facade.emissive.set(p.night);
    materials.opener.color.set(p.opener);
    materials.rubber.color.set(p.rubber);
    materials.trim.color.set(p.trim);
    materials.frame.color.set(p.frame);
    materials.pegboard.color.set(p.pegboard);
    materials.shelf.color.set(p.shelf);
    applyCarEnv();
    applyHologramTheme();
    renderer.toneMappingExposure = p.exposure;
    materials.window.map = skies[theme];
    materials.window.needsUpdate = true;
    materials.door.forEach((m, i) => {
      m.map = doorTextures[theme][i];
      m.emissive.set(p.night);
      m.needsUpdate = true;
    });
    hemi.color.set(p.hemi.sky);
    hemi.groundColor.set(p.hemi.ground);
    hemi.intensity = p.hemi.intensity;
    sun.color.set(p.sun.color);
    sun.intensity = p.sun.intensity;
    sun.position.set(...p.sun.position);
    starMaterial.opacity = p.stars;
    materials.lampGlass.emissiveIntensity = theme === 'dark' ? 3 : 0;
  }

  const useBloom = () => !!composer && bloomOn && theme === 'dark';

  // ---------- Camera ----------

  const look = { yaw: 0, pitch: 0, goalX: 0, goalY: 0 };
  const spherical = new Spherical();
  const offset = new Vector3();
  const restPosition = new Vector3();
  const restTarget = new Vector3();
  const startPosition = new Vector3();
  const startTarget = new Vector3(0, 1.35, 0);
  const cameraTarget = new Vector3();
  const hoodPosition = new Vector3();
  const hoodTarget = new Vector3();
  const hoodOffset = new Vector3();

  /** Resting framing: from the driveway, looking at the car from slightly above */
  function frame(aspect: number) {
    if (full) {
      // Keep enough of the room in view on narrow windows
      camera.fov = Math.max(46, (2 * Math.atan(0.64 / aspect)) / DEG);
      restPosition.set(0, 2.0, 3.0);
      restTarget.set(0, 0.75, -3.3);
      startPosition.set(0, 1.55, 9);
    } else {
      // Phones: the car sits in the top half, above the scrolling column
      camera.fov = 60;
      restPosition.set(0, 2.3, 5.2);
      restTarget.set(0, -0.5, -3.2);
      startPosition.set(0, 1.55, 14);
    }
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  /** `position` turned round `target` by the cursor (a share of ±12° across, ±5° up and down) */
  function orbit(out: Vector3, position: Vector3, target: Vector3, share: number) {
    out.copy(position).sub(target);
    spherical.setFromVector3(out);
    spherical.theta += look.yaw * share;
    spherical.phi += look.pitch * share;
    return out.setFromSpherical(spherical).add(target);
  }

  function placeCamera(t: number) {
    orbit(offset, restPosition, restTarget, 1);
    const u = easeInOutCubic(clamp01((t - CAMERA_START) / (END - CAMERA_START)));
    camera.position.copy(startPosition).lerp(offset, u);
    cameraTarget.copy(startTarget).lerp(restTarget, u);

    // Hood mode: ease to the front of the car, looking down at the hood (the cursor still moves it a little)
    const h = easeInOutCubic(hood.move);
    if (h > 0) {
      const layout = full ? 'full' : 'phone';
      hoodPosition.set(...HOOD.camera[layout]);
      hoodTarget.set(...HOOD.look[layout]);
      carRoot.localToWorld(hoodPosition);
      carRoot.localToWorld(hoodTarget);
      orbit(hoodOffset, hoodPosition, hoodTarget, 0.4);
      camera.position.lerp(hoodOffset, h);
      cameraTarget.lerp(hoodTarget, h);
    }
    camera.lookAt(cameraTarget);
  }

  // ---------- Layout for the HTML buttons ----------

  const corner = new Vector3();
  const size = { width: 1, height: 1 };

  /** Screen box of the car: its 8 corners, projected */
  function projectCar(): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const x of [carBox.min.x, carBox.max.x]) {
      for (const y of [carBox.min.y, carBox.max.y]) {
        for (const z of [carBox.min.z, carBox.max.z]) {
          corner.set(x, y, z).applyMatrix4(carRoot.matrixWorld).project(camera);
          minX = Math.min(minX, ((corner.x + 1) / 2) * size.width);
          maxX = Math.max(maxX, ((corner.x + 1) / 2) * size.width);
          minY = Math.min(minY, ((1 - corner.y) / 2) * size.height);
          maxY = Math.max(maxY, ((1 - corner.y) / 2) * size.height);
        }
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function project(mesh: Object3D, w: number, h: number, z: number, centred = true): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const sx of [-0.5, 0.5]) {
      for (const sy of centred ? [-0.5, 0.5] : [0, 1]) {
        corner.set(sx * w, sy * h, z).applyMatrix4(mesh.matrixWorld).project(camera);
        const x = ((corner.x + 1) / 2) * size.width;
        const y = ((1 - corner.y) / 2) * size.height;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  let lastLayout = '';
  function reportLayout() {
    if (!options.onLayout) return;
    scene.updateMatrixWorld();
    const layout: GarageLayout = {
      car: projectCar(),
      chest: project(chest, CW, CH + CB, front, false),
      label: project(labelBand, CW - inset * 2, labelHeight, 0.006),
      drawers: drawers.map(({ face }) => project(face, drawerWidth, drawerHeight, 0.012)),
    };
    const key = JSON.stringify(layout, (_, v) => (typeof v === 'number' ? Math.round(v * 2) / 2 : v));
    if (key === lastLayout) return;
    lastLayout = key;
    options.onLayout(layout);
  }

  // ---------- Size ----------

  function resize() {
    size.width = Math.max(1, container.clientWidth);
    size.height = Math.max(1, container.clientHeight);
    renderer.setSize(size.width, size.height, false);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(size.width, size.height);
    }
    labelRenderer.setSize(size.width, size.height);
    frame(size.width / size.height);
    lastLayout = '';
  }

  // ---------- Animation ----------

  let arrivalTime = options.arrival ? 0 : END;
  let arriving = false;
  let frozen: number | null = null;
  let revealed = !options.arrival;
  let clock = 0;
  let last = performance.now();
  let hover = false;
  let hoverButtons = false;
  let openDrawer: number | null = null;

  function update(dt: number) {
    clock += dt;
    if (arriving && frozen === null) {
      arrivalTime = Math.min(END, arrivalTime + dt);
      if (arrivalTime >= END) arriving = false;
    }
    const t = frozen ?? arrivalTime;
    if (!revealed && t >= REVEAL) {
      revealed = true;
      options.onReveal?.();
    }
    const p = PALETTES[theme];

    // Door and the outside
    placeDoor(easeInOutCubic(clamp01((t - DOOR_START) / DOOR_DURATION)));
    // Hidden once the camera is nearly in place (its lintel would peek in at the top)
    outside.visible = t < 3.5;
    const porch = PORCH_INTENSITY * p.porch * (1 - clamp01((t - 3) / 1));
    porchLights.forEach((light) => (light.intensity = porch));

    // Bulbs: flicker on during the arrival, sway, and now and then flicker
    bulbs.forEach((bulb, i) => {
      const since = t - BULB_ON[i];
      let power = since < 0 ? 0 : since < 0.5 ? steps(FLICKER_ON, since, 0.5) : 1;
      if (t >= END) {
        if (clock > bulb.flickerAt) {
          bulb.flickerStart = clock;
          bulb.flickerAt = clock + 5 + Math.random() * 8;
        }
        const f = clock - bulb.flickerStart;
        if (f < 0.35) power *= steps(FLICKER, f, 0.35);
      }
      bulb.power = power;
      const sway = clock * bulb.spec.speed + bulb.spec.phase;
      bulb.pivot.rotation.z = 0.035 * Math.sin(sway);
      bulb.pivot.rotation.x = 0.02 * Math.sin(sway * 0.73 + 1);
      bulb.light.intensity = BULB_INTENSITY * p.bulbs * power;
      materials.bulb[i].emissiveIntensity = (theme === 'dark' ? 4 : 1.2) * power;
      (bulb.halo.material as SpriteMaterial).opacity = power * (useBloom() ? 0.25 : theme === 'dark' ? 0.6 : 0.25);
      (bulb.cone.material as MeshBasicMaterial).opacity = p.cones * power;
    });

    // Dust: rises inside each cone, wraps back to the floor
    const dustPower = (bulbs[0].power + bulbs[1].power) / 2;
    dustMaterial.opacity = p.dust * dustPower;
    if (dustMaterial.opacity > 0) {
      scene.updateMatrixWorld();
      motes.forEach((mote, i) => {
        mote.depth -= mote.speed * dt * 0.5;
        if (mote.depth < 0.1) mote.depth = 1;
        const bulb = bulbs[mote.bulb];
        const r = mote.radius * 1.05 * mote.depth;
        corner
          .set(
            Math.cos(mote.angle) * r + 0.03 * Math.sin(clock * 0.6 + mote.wobble),
            bulb.glassY - mote.depth * bulb.coneLength * 0.95,
            Math.sin(mote.angle) * r,
          )
          .applyMatrix4(bulb.pivot.matrixWorld);
        dustPositions.set([corner.x, corner.y, corner.z], i * 3);
      });
      dustGeometry.attributes.position.needsUpdate = true;
    }

    // LED: a short blink every 1.6 s
    const blink = clock % 1.6 < 0.5 ? 1 : 0.15;
    materials.led.color.setRGB(0.29 * blink * 3, 0.66 * blink * 3, blink * 3);
    ledLight.intensity = 0.25 * blink;

    // Tool chest: hover glow and sliding drawers
    const glow = hover || hoverButtons ? 0.35 : 0;
    for (const m of [materials.chest, materials.chestDark, materials.drawer]) m.emissiveIntensity = damp(m.emissiveIntensity, glow, 10, dt);
    drawers.forEach((drawer, i) => {
      drawer.open = damp(drawer.open, openDrawer === i ? 1 : 0, 9, dt);
      drawer.group.position.z = drawer.open * 0.16;
    });

    // Camera: follows the cursor (or sways on touch screens), pushes in while the hood is open
    if (touch) {
      look.goalX = 0.5 * Math.sin(clock * 0.13);
      look.goalY = 0.35 * Math.sin(clock * 0.09 + 1);
    }
    look.yaw = damp(look.yaw, -look.goalX * 12 * DEG, 3, dt);
    look.pitch = damp(look.pitch, look.goalY * 5 * DEG, 3, dt);
    // Hood mode: the camera moves (1 s), the hologram builds in (0.6 s); closing plays it backwards
    const direction = hood.open ? 1 : -1;
    hood.move = clamp01(hood.move + (direction * dt) / HOOD.move);
    hood.build = clamp01(hood.build + (direction * dt) / HOOD.build);
    placeCamera(t);
    updateHologram(dt);

    // The car fades in once loaded; its hood swings open on the hinge (0.8 s, eased)
    if (car.model && car.fade < 1) {
      car.fade = Math.min(1, car.fade + dt / 0.8);
      for (const entry of car.materials) {
        entry.material.opacity = entry.opacity * car.fade;
        if (car.fade === 1) {
          entry.material.transparent = entry.transparent;
          entry.material.needsUpdate = true;
        }
      }
    }

    reportLayout();
  }

  let labelsShown = false;
  function updateHologram(dt: number) {
    const b = easeInOutCubic(hood.build);
    hologram.visible = b > 0;
    if (b > 0) {
      hologram.scale.setScalar((0.6 + 0.4 * b) * HOOD.scale);
      engine.rotation.y += dt * 0.35;
      for (const material of [holoFill, holoWire]) {
        material.uniforms.uOpacity.value = b;
        material.uniforms.uTime.value = clock;
      }
      labels.forEach(({ label, button, y }, i) => {
        label.position.y = y + 0.035 * Math.sin(clock * 1.6 + i * 1.3);
        button.style.opacity = String(b);
      });
    }
    labelsShown = b > 0;
  }

  let labelsDrawn = false;
  function render() {
    renderer.info.reset();
    if (useBloom()) composer!.render();
    else renderer.render(scene, camera);
    // The labels only need placing while the hologram is up (and once more, to hide them)
    if (labelsShown || labelsDrawn) labelRenderer.render(scene, camera);
    labelsDrawn = labelsShown;
  }

  // The first 3 seconds of rendering decide whether this device keeps its tier
  const probe = createFpsProbe(3);
  probe.done.then((fps) => {
    if (!disposed && fps < 40) options.onSlow?.(fps);
  });

  function frameLoop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    probe.tick(now);
  }

  // ---------- Running only while visible ----------

  let started = false;
  let onScreen = true;
  let disposed = false;

  function updateLoop() {
    const run = started && !disposed && onScreen && !document.hidden;
    if (run) last = performance.now();
    renderer.setAnimationLoop(run ? frameLoop : null);
  }

  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    updateLoop();
  });
  visibility.observe(container);
  document.addEventListener('visibilitychange', updateLoop);

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (!started) render();
  });

  const lost = (event: Event) => {
    event.preventDefault();
    options.onLost?.();
  };
  canvas.addEventListener('webglcontextlost', lost);

  // ---------- Start ----------

  container.append(canvas);
  applyTheme();
  resize();
  resizeObserver.observe(container);
  update(0);
  // Every shader up front (the hologram's too), asynchronously where the GPU allows it
  hologram.visible = true;
  await renderer.compileAsync(scene, camera);
  hologram.visible = false;
  render();

  const raycaster = new Raycaster();
  const ndc = new Vector2();

  const api: GarageScene = {
    setQuality(next) {
      quality = next;
      bloomOn = next.bloom;
      renderer.setPixelRatio(next.pixelRatio);
      resize();
      if (!next.shadows && renderer.shadowMap.enabled) {
        renderer.shadowMap.enabled = false;
        bulbs.forEach((bulb) => (bulb.light.castShadow = false));
        // Shadow-receiving shaders have to be rebuilt without shadows
        scene.traverse((object) => {
          const material = (object as Mesh).material as Material | Material[] | undefined;
          (Array.isArray(material) ? material : material ? [material] : []).forEach((m) => (m.needsUpdate = true));
        });
      }
      dustGeometry.setDrawRange(0, Math.min(dustCount, next.dust));
      for (const material of [holoFill, holoWire]) material.uniforms.uShimmer.value = next.shimmer ? 1 : 0;
    },
    stats() {
      const { memory, render: frame } = renderer.info;
      return { geometries: memory.geometries, textures: memory.textures, calls: frame.calls, triangles: frame.triangles };
    },
    start() {
      started = true;
      updateLoop();
    },
    playArrival() {
      arrivalTime = 0;
      arriving = true;
      revealed = false;
    },
    skipArrival() {
      arriving = false;
      arrivalTime = END;
      frozen = null;
      if (!revealed) {
        revealed = true;
        options.onReveal?.();
      }
    },
    pointer(x, y) {
      if (touch) return;
      look.goalX = x;
      look.goalY = y;
    },
    hover(clientX, clientY) {
      if (!full) return false;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      hover = raycaster.intersectObject(chest, true).length > 0;
      return hover;
    },
    setChestHover(on) {
      hoverButtons = on;
    },
    setDrawer(index) {
      openDrawer = index;
      labels.forEach(({ button }, i) => {
        button.setAttribute('aria-expanded', String(i === index));
        button.classList.toggle('is-open', i === index);
      });
    },
    setHood(open) {
      hood.open = open;
    },
    setTheme(next) {
      theme = next;
      applyTheme();
    },
    setFull(next) {
      full = next;
      for (const object of [chest, chestBlob, tires, tiresBlob, spare]) object.visible = full;
      lastLayout = '';
      frame(size.width / size.height);
    },
    freeze(t) {
      frozen = t;
      if (t !== null) {
        if (t >= REVEAL && !revealed) {
          revealed = true;
          options.onReveal?.();
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      visibility.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', updateLoop);
      canvas.removeEventListener('webglcontextlost', lost);
      scene.traverse((object) => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as Material | Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
        if (object instanceof PointLight) object.shadow.map?.dispose();
      });
      Object.values(materials)
        .flat()
        .forEach((m) => m.dispose());
      textures.forEach((texture) => texture.dispose());
      bloomPass?.dispose();
      composer?.dispose();
      composerTarget?.dispose();
      holoWireGeometry.dispose();
      labelRenderer.domElement.remove();
      renderer.dispose();
      // Release the GL context right away
      renderer.forceContextLoss();
      canvas.remove();
    },
  };

  api.setFull(full);
  loadCar();
  return api;
}
