/**
 * Three.js version of the START portal transition. Only ever loaded through a dynamic import(),
 * so three.js stays out of the main bundle (see Hero.astro).
 *
 * Timeline (seconds):
 *   0.0–0.4 sparks · 0.4–1.2 frame builds · 0.6–1.6 camera orbits to face the portal ·
 *   1.2–2.2 particles fill and speed up · 2.2–3.0 fly through the portal and a tunnel of rings ·
 *   3.0–3.2 canvas fades to the overlay's var(--bg), then everything is disposed
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';

export interface PortalOptions {
  /** The fixed overlay the canvas is drawn into */
  container: HTMLElement;
  /** The CSS sparks already played while three.js was loading: start the timeline at the frame build */
  skipSparks?: boolean;
}

export interface PortalRun {
  /** Resolves once the transition has finished and everything is disposed */
  done: Promise<void>;
  /** Stops early and disposes everything (safety net) */
  cancel: () => void;
}

const SPARKS_END = 0.4;
const FADE_START = 3.0;
const END = 3.2;

// Frame cells [row, column] of the 4 × 5 ring, in build order: around the frame from the bottom
const FRAME_CELLS = [
  [5, 2], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [1, 2],
  [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [5, 3],
];

const RINGS = 6;
const RING_SIZE = 5; // 5 × 5 cubes, so 16 edge cubes per ring
const RING_SPACING = 3.5;
const FIRST_RING_Z = -4;
const FLY_END_Z = FIRST_RING_Z - RING_SPACING * RINGS;

const PARTICLES = 150;
const SPARKS = 24;
const GRAVITY = -9;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInCubic = (t: number) => t * t * t;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// Overshoots to ~1.1 before settling at 1
const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
const random = (min: number, max: number) => min + Math.random() * (max - min);
const DEG = Math.PI / 180;

/** 4 × 4 pixels: #1E5FBF base, #0F3A80 spots, #8FD4FF and #FFFFFF speckles (same pattern as the CSS blocks) */
function createBlockTexture(): CanvasTexture {
  const colors: Record<string, string> = { B: '#1E5FBF', D: '#0F3A80', L: '#8FD4FF', W: '#FFFFFF' };
  const pixels = ['BLBD', 'DBBW', 'BDWB', 'LBBD'];
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  pixels.forEach((row, y) =>
    [...row].forEach((key, x) => {
      ctx.fillStyle = colors[key];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Camera distance at which the 4 × 5 portal fits the screen with margin on all sides */
function fitDistance(aspect: number): number {
  const visible = 2 * Math.tan(30 * DEG); // view height per unit of distance at fov 60
  return Math.max(5 / (visible * 0.55), 4 / (visible * aspect * 0.6));
}

export function playPortal({ container, skipSparks = false }: PortalOptions): PortalRun {
  const css = getComputedStyle(document.documentElement);
  const bg = new Color(css.getPropertyValue('--bg').trim() || '#0A1428');
  const accent = new Color(css.getPropertyValue('--accent').trim() || '#5CC8FF');
  const isPhone = window.innerWidth < 640;
  const useBloom = window.innerWidth > 1024 && window.devicePixelRatio <= 2;

  // Throws when WebGL isn't available; the caller falls back to the CSS portal
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(isPhone ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(bg);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; display: block;';
  container.append(canvas);

  const scene = new Scene();
  scene.background = bg;
  const camera = new PerspectiveCamera(60, 1, 0.05, 100);

  // ---------- Lights: low ambient so the glow stands out, a pulsing blue light in the portal ----------
  scene.add(new AmbientLight(0xffffff, 0.25));
  const light = new PointLight('#3D8BFF', 6, 0, 2);
  scene.add(light);

  // ---------- Frame and tunnel: cubes sharing one geometry, texture and look ----------
  const texture = createBlockTexture();
  const cube = new BoxGeometry(1, 1, 1);
  const frameMaterial = new MeshStandardMaterial({
    map: texture,
    emissive: '#5CC8FF',
    emissiveMap: texture,
    emissiveIntensity: 0.35,
    roughness: 0.6,
    metalness: 0.1,
  });
  const tunnelMaterial = frameMaterial.clone();
  tunnelMaterial.emissiveIntensity = 0.6;

  const frame = new InstancedMesh(cube, frameMaterial, FRAME_CELLS.length);
  const framePositions = FRAME_CELLS.map(([row, column]) => [column - 2.5, 3 - row, 0]);
  scene.add(frame);

  const ringPositions: number[][] = [];
  for (let ring = 0; ring < RINGS; ring++) {
    const z = FIRST_RING_Z - ring * RING_SPACING;
    const half = (RING_SIZE - 1) / 2;
    for (let i = 0; i < RING_SIZE; i++) {
      for (let j = 0; j < RING_SIZE; j++) {
        const edge = i === 0 || j === 0 || i === RING_SIZE - 1 || j === RING_SIZE - 1;
        if (edge) ringPositions.push([i - half, j - half, z, ring]);
      }
    }
  }
  const tunnel = new InstancedMesh(cube, tunnelMaterial, ringPositions.length);
  scene.add(tunnel);

  // ---------- Sparks: tiny bright cubes thrown from the bottom center, falling with gravity ----------
  const sparkCube = new BoxGeometry(0.07, 0.07, 0.07);
  const sparkMaterial = new MeshBasicMaterial();
  const sparks = new InstancedMesh(sparkCube, sparkMaterial, SPARKS);
  const sparkColors = [new Color('#FFFFFF'), new Color('#BFE0FF'), accent];
  const sparkVelocities = Array.from({ length: SPARKS }, (_, i) => {
    sparks.setColorAt(i, sparkColors[i % sparkColors.length]);
    const angle = random(20, 160) * DEG;
    const speed = random(2, 4.5);
    return [Math.cos(angle) * speed, Math.sin(angle) * speed, random(-1, 1.5)];
  });
  sparks.visible = !skipSparks;
  scene.add(sparks);

  // ---------- Particles swirling inside the 2 × 3 window, at different depths ----------
  const particlePositions = new Float32Array(PARTICLES * 3);
  const particleColors = new Float32Array(PARTICLES * 3);
  const purple = new Color('#7B5CFF');
  const particles = Array.from({ length: PARTICLES }, (_, i) => {
    (i % 2 ? purple : accent).toArray(particleColors, i * 3);
    return { angle: random(0, Math.PI * 2), speed: random(1.5, 3), phase: Math.random(), depth: random(-1.2, 0.6) };
  });
  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute('position', new BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new BufferAttribute(particleColors, 3));
  const particleMaterial = new PointsMaterial({
    size: isPhone ? 0.09 : 0.07,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  scene.add(new Points(particleGeometry, particleMaterial));

  // ---------- Optional bloom (desktop only), loaded on demand ----------
  let composer: { render: () => void; setSize: (w: number, h: number) => void; dispose: () => void } | null = null;
  let bloomDispose: (() => void) | null = null;
  if (useBloom) {
    Promise.all([
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/postprocessing/OutputPass.js'),
    ])
      .then(([{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }]) => {
        if (disposed) return;
        const effects = new EffectComposer(renderer);
        effects.addPass(new RenderPass(scene, camera));
        // Keep the background out of the bloom, even on the light theme
        const { l } = bg.getHSL({ h: 0, s: 0, l: 0 });
        const bloom = new UnrealBloomPass(new Vector2(width, height), 0.7, 0.25, Math.min(0.95, l + 0.15));
        effects.addPass(bloom);
        effects.addPass(new OutputPass());
        effects.setSize(width, height);
        composer = effects;
        bloomDispose = () => bloom.dispose();
      })
      .catch(() => {
        // No bloom: the emissive material carries the glow on its own
      });
  }

  // ---------- Size and resize ----------
  let width = 0;
  let height = 0;
  let distance = 10;
  const resize = () => {
    width = container.clientWidth;
    height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    distance = fitDistance(camera.aspect);
    composer?.setSize(width, height);
  };
  resize();
  window.addEventListener('resize', resize);

  // ---------- Animation ----------
  const dummy = new Object3D();
  const startTime = performance.now() - (skipSparks ? SPARKS_END * 1000 : 0);
  let lastTime = startTime;
  let swirl = 0;
  let lightPhase = 0;
  let fading = false;
  let disposed = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => (resolveDone = resolve));

  const placeInstances = (mesh: InstancedMesh, positions: number[][], scaleOf: (i: number) => number) => {
    positions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(Math.max(0.0001, scaleOf(i)));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  const updateCamera = (t: number) => {
    if (t < 2.2) {
      // From the left and slightly above, orbiting round to face the portal head-on
      const u = easeInOutCubic(clamp01((t - 0.6) / 1.0));
      const azimuth = lerp(-50, 0, u) * DEG;
      const elevation = lerp(18, 0, u) * DEG;
      const d = lerp(distance * 1.15, distance, u);
      camera.position.set(d * Math.cos(elevation) * Math.sin(azimuth), d * Math.sin(elevation), d * Math.cos(elevation) * Math.cos(azimuth));
      camera.lookAt(0, 0, 0);
    } else {
      // Fly through the window, then down the tunnel
      const f = easeInCubic(clamp01((t - 2.2) / 0.8));
      const z = lerp(distance, FLY_END_Z, f);
      camera.position.set(0, 0, z);
      camera.lookAt(0, 0, z - 10);
    }
  };

  const frameLoop = () => {
    const now = performance.now();
    const t = (now - startTime) / 1000;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    // Frame: each cube pops in with a slight overshoot, going around from the bottom
    placeInstances(frame, framePositions, (i) => {
      const start = 0.4 + i * (0.55 / (FRAME_CELLS.length - 1));
      return easeOutBack(clamp01((t - start) / 0.25));
    });

    // Tunnel rings pop in behind the portal while it fills, ready for the fly-through
    placeInstances(tunnel, ringPositions, (i) => {
      const start = 1.6 + ringPositions[i][3] * 0.06;
      return easeOutBack(clamp01((t - start) / 0.25));
    });

    // Sparks
    if (sparks.visible) {
      sparkVelocities.forEach(([vx, vy, vz], i) => {
        dummy.position.set(vx * t, -2.5 + vy * t + 0.5 * GRAVITY * t * t, 0.6 + vz * t);
        dummy.scale.setScalar(Math.max(0.0001, 1 - t / 0.7));
        dummy.updateMatrix();
        sparks.setMatrixAt(i, dummy.matrix);
      });
      sparks.instanceMatrix.needsUpdate = true;
      if (t > 0.7) sparks.visible = false;
    }

    // Particles: fade in at 1.2s and swirl faster until 2.2s, spiralling inwards
    const fill = clamp01((t - 1.2) / 1.0);
    particleMaterial.opacity = clamp01((t - 1.2) / 0.4);
    const speedUp = 1 + 1.5 * fill;
    swirl += dt * speedUp;
    particles.forEach((p, i) => {
      p.angle += dt * p.speed * speedUp;
      const r = 1 - ((p.phase + swirl * 0.35) % 1) * 0.85;
      particlePositions[i * 3] = Math.cos(p.angle) * r * 0.95;
      particlePositions[i * 3 + 1] = Math.sin(p.angle) * r * 1.45;
      particlePositions[i * 3 + 2] = p.depth + Math.sin(p.angle * 2) * 0.1;
    });
    particleGeometry.attributes.position.needsUpdate = true;

    // The light pulses faster as the portal fills; the blocks' glow flickers slightly
    lightPhase += dt * lerp(3, 12, fill);
    light.intensity = (4 + 3 * Math.sin(lightPhase)) * (1 + fill);
    frameMaterial.emissiveIntensity = 0.35 + 0.05 * Math.sin(t * 23) + 0.03 * Math.sin(t * 37);

    updateCamera(t);
    if (composer) composer.render();
    else renderer.render(scene, camera);

    // Fade the canvas out to the overlay's own var(--bg), then clean up
    if (t >= FADE_START && !fading) {
      fading = true;
      canvas.style.transition = `opacity ${END - FADE_START}s linear`;
      canvas.style.opacity = '0';
    }
    if (t >= END) dispose();
  };

  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    frame.dispose();
    tunnel.dispose();
    sparks.dispose();
    cube.dispose();
    sparkCube.dispose();
    particleGeometry.dispose();
    frameMaterial.dispose();
    tunnelMaterial.dispose();
    sparkMaterial.dispose();
    particleMaterial.dispose();
    texture.dispose();
    bloomDispose?.();
    composer?.dispose();
    renderer.dispose();
    // Release the GL context right away, so repeated clicks never pile up contexts
    renderer.forceContextLoss();
    canvas.remove();
    resolveDone();
  }

  renderer.setAnimationLoop(() => {
    try {
      frameLoop();
    } catch {
      dispose();
    }
  });

  return { done, cancel: dispose };
}
