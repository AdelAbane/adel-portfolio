/**
 * Studio scenes for the project cards, rendered in the browser by scripts/render-project-art.mjs.
 * One small product shot per project, built from simple shapes (no logos): soft key light, a rim
 * light in the site's blue (#5CC8FF), RoomEnvironment reflections, a soft contact shadow, and a
 * navy (dark) or sky-blue (light) backdrop with a subtle glow. Rendered at 2× and downsampled by
 * the script, so the stills stay sharp on retina screens.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1600;
const H = 1000;
const SCALE = 2;
const BLUE = '#5CC8FF';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(SCALE);
renderer.setSize(W, H);
// Neutral keeps the backdrop and the brand blues true to their colours
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.append(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04).texture;
room.dispose();

// ---------- Helpers ----------

function canvasTexture(width, height, draw, srgb = true) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Backdrop: navy with a blue glow (dark), or soft sky blue (light) */
function backdrop(theme) {
  return canvasTexture(1600, 1000, (ctx, w, h) => {
    if (theme === 'dark') {
      ctx.fillStyle = '#050B1A';
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.55, h * 0.38, 0, w * 0.55, h * 0.38, w * 0.55);
      glow.addColorStop(0, 'rgba(37, 99, 235, 0.42)');
      glow.addColorStop(0.45, 'rgba(29, 78, 216, 0.14)');
      glow.addColorStop(1, 'rgba(5, 11, 26, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      const cyan = ctx.createRadialGradient(w * 0.82, h * 0.2, 0, w * 0.82, h * 0.2, w * 0.3);
      cyan.addColorStop(0, 'rgba(92, 200, 255, 0.12)');
      cyan.addColorStop(1, 'rgba(92, 200, 255, 0)');
      ctx.fillStyle = cyan;
      ctx.fillRect(0, 0, w, h);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#EAF4FF');
      sky.addColorStop(1, '#C9DFF6');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.55, h * 0.4, 0, w * 0.55, h * 0.4, w * 0.5);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      const blue = ctx.createRadialGradient(w * 0.8, h * 0.25, 0, w * 0.8, h * 0.25, w * 0.35);
      blue.addColorStop(0, 'rgba(92, 200, 255, 0.18)');
      blue.addColorStop(1, 'rgba(92, 200, 255, 0)');
      ctx.fillStyle = blue;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

const blobTexture = canvasTexture(256, 256, (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  g.addColorStop(0.55, 'rgba(0, 0, 0, 0.3)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
});

const glossy = (color, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, ...extra });
const metal = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.9, ...extra });
const matte = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra });
const glow = (color, intensity = 3) => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity });

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const rounded = (w, h, d, r = 0.04, s = 4) => new RoundedBoxGeometry(w, h, d, s, r);

/** Scene with the shared studio: backdrop, lights, shadow floor and a soft contact blob */
function studio(theme) {
  const dark = theme === 'dark';
  const scene = new THREE.Scene();
  scene.background = backdrop(theme);
  scene.environment = environment;
  scene.environmentIntensity = dark ? 0.55 : 0.85;

  const key = new THREE.DirectionalLight('#ffffff', dark ? 2.3 : 2.1);
  key.position.set(-3.5, 6, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 8;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
  scene.add(key);

  const rim = new THREE.DirectionalLight(BLUE, dark ? 3.6 : 1.8);
  rim.position.set(4.5, 3, -4.5);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(dark ? '#3A5BA0' : '#FFFFFF', dark ? '#05070F' : '#B8CDE6', dark ? 0.35 : 0.6));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: dark ? 0.55 : 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
  return { scene, camera, dark };
}

function contact(scene, w, d, x = 0, z = 0, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, opacity, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.002, z);
  scene.add(m);
}

// ---------- Scenes ----------

/** A floating browser window showing a tiny garage with a blue car inside */
function website(theme) {
  const { scene, camera, dark } = studio(theme);
  const win = new THREE.Group();
  win.position.set(0, 1.3, 0);
  win.rotation.set(-0.06, -0.38, 0);

  win.add(mesh(rounded(3.1, 2.0, 0.12, 0.09, 6), glossy(dark ? '#16233F' : '#F4F8FF')));
  win.add(mesh(rounded(2.98, 0.24, 0.03, 0.05), glossy(dark ? '#22355C' : '#DDE9F7'), [0, 0.83, 0.06]));
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) =>
    win.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24), glossy(c), [-1.33 + i * 0.13, 0.83, 0.08], [Math.PI / 2, 0, 0])),
  );
  win.add(mesh(rounded(1.6, 0.12, 0.02, 0.05), glossy(dark ? '#0B1630' : '#FFFFFF'), [0.15, 0.83, 0.08]));

  // The page: a night (or daytime) sky, a garage with its door open and a blue car inside
  const page = canvasTexture(1400, 760, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, dark ? '#081430' : '#7EC2FF');
    sky.addColorStop(1, dark ? '#1B2F6B' : '#D7ECFF');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    if (dark) {
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 70; i++) ctx.fillRect((i * 197) % w, (i * 83) % (h * 0.55), i % 5 === 0 ? 4 : 2, i % 5 === 0 ? 4 : 2);
    }
    ctx.fillStyle = dark ? '#0A1124' : '#9DB6D4';
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
    // Garage
    const gx = w * 0.27;
    const gw = w * 0.46;
    const gy = h * 0.34;
    ctx.fillStyle = dark ? '#162547' : '#E8EEF6';
    ctx.beginPath();
    ctx.moveTo(gx - 30, gy);
    ctx.lineTo(gx + gw / 2, gy - h * 0.14);
    ctx.lineTo(gx + gw + 30, gy);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(gx, gy, gw, h * 0.52);
    const door = { x: gx + gw * 0.1, y: gy + h * 0.1, w: gw * 0.8, h: h * 0.42 };
    const light = ctx.createLinearGradient(0, door.y, 0, door.y + door.h);
    light.addColorStop(0, '#FFE2B0');
    light.addColorStop(1, '#F4B26A');
    ctx.fillStyle = light;
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.fillStyle = dark ? '#22447F' : '#B8CBE4';
    ctx.fillRect(door.x, door.y - 26, door.w, 34);
    // The car, front three-quarter silhouette in Laguna Seca Blue
    const cx = door.x + door.w / 2;
    const cy = door.y + door.h - 18;
    ctx.fillStyle = '#2A6BB5';
    ctx.beginPath();
    ctx.moveTo(cx - 200, cy - 20);
    ctx.quadraticCurveTo(cx - 205, cy - 92, cx - 150, cy - 102);
    ctx.lineTo(cx - 95, cy - 160);
    ctx.quadraticCurveTo(cx, cy - 182, cx + 95, cy - 160);
    ctx.lineTo(cx + 150, cy - 102);
    ctx.quadraticCurveTo(cx + 205, cy - 92, cx + 200, cy - 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0E1A33';
    ctx.beginPath();
    ctx.moveTo(cx - 82, cy - 108);
    ctx.lineTo(cx - 62, cy - 148);
    ctx.quadraticCurveTo(cx, cy - 162, cx + 62, cy - 148);
    ctx.lineTo(cx + 82, cy - 108);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFF3C4';
    ctx.fillRect(cx - 170, cy - 74, 60, 16);
    ctx.fillRect(cx + 110, cy - 74, 60, 16);
    ctx.fillStyle = '#0B0F1A';
    ctx.fillRect(cx - 190, cy - 18, 60, 30);
    ctx.fillRect(cx + 130, cy - 18, 60, 30);
    ctx.fillRect(cx - 60, cy - 66, 120, 26);
  });
  const screen = mesh(
    new THREE.PlaneGeometry(2.96, 1.62),
    new THREE.MeshStandardMaterial({ map: page, emissive: '#ffffff', emissiveMap: page, emissiveIntensity: dark ? 0.55 : 0.35, roughness: 0.35 }),
    [0, -0.12, 0.062],
  );
  screen.castShadow = false;
  win.add(screen);
  scene.add(win);
  contact(scene, 3.4, 1.4, 0, 0.1, 0.5);

  camera.position.set(1.8, 2.0, 6.3);
  camera.lookAt(0.05, 1.2, 0);
  return { scene, camera };
}

/** A single-board computer next to a small server tower with glowing LED strips */
function homelab(theme) {
  const { scene, camera, dark } = studio(theme);

  // ---------- Single-board computer ----------
  const board = new THREE.Group();
  board.position.set(-1.05, 0, 0.55);
  board.rotation.y = 0.55;
  const pcb = mesh(rounded(1.7, 0.06, 1.12, 0.03, 2), glossy('#0E6B3A', { roughness: 0.4, clearcoat: 0.8 }), [0, 0.13, 0]);
  board.add(pcb);
  for (const [x, z] of [[-0.75, -0.48], [0.75, -0.48], [-0.75, 0.48], [0.75, 0.48]]) {
    board.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), metal('#C9A44C'), [x, 0.05, z]));
  }
  const top = 0.16;
  // SoC with a little fan on a heatsink
  board.add(mesh(rounded(0.46, 0.05, 0.46, 0.01), matte('#16181D'), [-0.15, top + 0.025, 0]));
  board.add(mesh(rounded(0.44, 0.08, 0.44, 0.02), metal('#AEB6C4', { roughness: 0.35 }), [-0.15, top + 0.09, 0]));
  board.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 40), matte('#111318'), [-0.15, top + 0.16, 0]));
  board.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 20), glossy('#22262E'), [-0.15, top + 0.17, 0]));
  for (let i = 0; i < 7; i++) {
    const blade = mesh(new THREE.BoxGeometry(0.15, 0.01, 0.05), matte('#2A2F3A'), [0, 0, 0], [0.35, 0, 0]);
    const arm = new THREE.Group();
    arm.position.set(-0.15, top + 0.19, 0);
    arm.rotation.y = (i / 7) * Math.PI * 2;
    blade.position.x = 0.1;
    arm.add(blade);
    board.add(arm);
  }
  // RAM and smaller chips
  board.add(mesh(rounded(0.32, 0.04, 0.22, 0.01), matte('#1C1F26'), [0.32, top + 0.02, -0.22]));
  board.add(mesh(rounded(0.16, 0.03, 0.16, 0.01), matte('#1C1F26'), [0.36, top + 0.015, 0.18]));
  // Ports along the edge: USB stacks and Ethernet
  for (const z of [-0.33, 0.02]) {
    board.add(mesh(rounded(0.3, 0.22, 0.24, 0.015), metal('#C7CDD8'), [0.72, top + 0.11, z]));
    board.add(mesh(new THREE.BoxGeometry(0.02, 0.05, 0.16), glossy('#2B6CDB'), [0.87, top + 0.16, z]));
    board.add(mesh(new THREE.BoxGeometry(0.02, 0.05, 0.16), glossy('#2B6CDB'), [0.87, top + 0.06, z]));
  }
  board.add(mesh(rounded(0.3, 0.2, 0.24, 0.015), metal('#C7CDD8'), [0.72, top + 0.1, 0.36]));
  // GPIO header: two rows of gold pins on a black strip
  board.add(mesh(new THREE.BoxGeometry(1.0, 0.06, 0.1), matte('#121419'), [-0.15, top + 0.03, -0.46]));
  const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.12, 0.018), metal('#E3B341', { roughness: 0.25 }), 40);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 40; i++) {
    dummy.position.set(-0.62 + (i % 20) * 0.049, top + 0.08, -0.48 + Math.floor(i / 20) * 0.045);
    dummy.updateMatrix();
    pins.setMatrixAt(i, dummy.matrix);
  }
  pins.castShadow = true;
  board.add(pins);
  board.add(mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), glow('#4ADE80', 4), [-0.7, top + 0.01, 0.42]));
  board.add(mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), glow('#F87171', 4), [-0.62, top + 0.01, 0.42]));
  scene.add(board);
  contact(scene, 2.2, 1.6, -1.05, 0.55, 0.6);

  // ---------- Server tower ----------
  const tower = new THREE.Group();
  tower.position.set(0.95, 0, -0.25);
  tower.rotation.y = -0.32;
  tower.add(mesh(rounded(0.95, 1.95, 1.3, 0.06, 5), metal(dark ? '#1B2232' : '#2A3346', { roughness: 0.35, metalness: 0.7 }), [0, 0.975, 0]));
  tower.add(mesh(rounded(0.82, 1.78, 0.04, 0.03), glossy('#0A0F1A', { roughness: 0.15, clearcoat: 1 }), [0, 0.98, 0.65]));
  for (let i = 0; i < 9; i++) tower.add(mesh(new THREE.BoxGeometry(0.6, 0.018, 0.02), matte('#05080F'), [0, 0.32 + i * 0.07, 0.68]));
  for (let i = 0; i < 3; i++) {
    tower.add(mesh(rounded(0.62, 0.14, 0.03, 0.015), metal('#3A4560'), [0, 1.3 + i * 0.18, 0.68]));
    tower.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), glow(i === 1 ? '#4ADE80' : BLUE, 5), [0.24, 1.3 + i * 0.18, 0.7]));
  }
  // The glowing strips
  tower.add(mesh(new THREE.BoxGeometry(0.025, 1.7, 0.02), glow(BLUE, 6), [-0.36, 0.98, 0.68]));
  tower.add(mesh(new THREE.BoxGeometry(0.025, 1.7, 0.02), glow(BLUE, 6), [0.36, 0.98, 0.68]));
  tower.add(mesh(new THREE.BoxGeometry(0.62, 0.025, 0.02), glow(BLUE, 5), [0, 1.86, 0.68]));
  tower.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 32), glow(BLUE, 6), [0, 1.12, 0.69]));
  scene.add(tower);
  contact(scene, 1.6, 1.9, 0.95, -0.25, 0.7);

  camera.position.set(2.6, 2.5, 6.6);
  camera.lookAt(0, 0.75, 0);
  return { scene, camera };
}

/** A modern game controller with floating cubes around it */
function roblox(theme) {
  const { scene, camera, dark } = studio(theme);
  // Graphite in both themes: it would vanish against the light backdrop in white
  const body = glossy(dark ? '#1C2436' : '#2A3348', { roughness: 0.22, clearcoat: 1 });
  const grip = glossy(dark ? '#161D2C' : '#222A3C', { roughness: 0.35, clearcoat: 0.6 });

  const pad = new THREE.Group();
  pad.position.set(0, 1.0, 0.2);
  pad.rotation.set(0.62, -0.25, 0);
  pad.add(mesh(rounded(2.0, 0.4, 1.0, 0.18, 6), body));
  for (const s of [-1, 1]) {
    const handle = mesh(new THREE.CapsuleGeometry(0.33, 0.55, 12, 32), grip, [s * 0.74, -0.08, 0.42], [1.25, 0, s * 0.32]);
    pad.add(handle);
  }
  const top = 0.2;
  // Two sticks
  for (const [x, z] of [[-0.45, -0.08], [0.28, 0.22]]) {
    pad.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 40), metal('#2A3142', { roughness: 0.4 }), [x, top + 0.02, z]));
    pad.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 20), matte('#11151E'), [x, top + 0.08, z]));
    pad.add(mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.05, 40), matte('#0D1017', { roughness: 0.85 }), [x, top + 0.15, z]));
  }
  // D-pad
  pad.add(mesh(rounded(0.3, 0.05, 0.09, 0.02), matte('#0F131B', { roughness: 0.5 }), [-0.62, top + 0.02, 0.22]));
  pad.add(mesh(rounded(0.09, 0.05, 0.3, 0.02), matte('#0F131B', { roughness: 0.5 }), [-0.62, top + 0.02, 0.22]));
  // Face buttons
  [['#5CC8FF', 0, -0.13], ['#818CF8', 0.13, 0], ['#FBBF24', 0, 0.13], ['#F87171', -0.13, 0]].forEach(([c, dx, dz]) =>
    pad.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 32), glossy(c, { roughness: 0.15, clearcoat: 1 }), [0.62 + dx, top + 0.02, -0.06 + dz])),
  );
  // Light bar
  pad.add(mesh(rounded(0.5, 0.03, 0.06, 0.015), glow(BLUE, 4), [-0.08, top - 0.02, -0.5]));
  pad.add(mesh(rounded(0.36, 0.02, 0.22, 0.02), glossy('#0B0F18', { roughness: 0.1, clearcoat: 1 }), [-0.08, top + 0.005, -0.18]));
  scene.add(pad);
  contact(scene, 2.8, 1.6, 0, 0.4, 0.55);

  // Floating cubes
  [
    ['#5CC8FF', 0.42, [-1.75, 1.85, -0.5], [0.4, 0.7, 0.2]],
    ['#2B6CDB', 0.36, [1.7, 2.05, -0.7], [0.8, 0.3, 0.5]],
    ['#818CF8', 0.3, [-1.45, 0.55, 1.0], [0.2, 0.9, 0.4]],
    ['#FBBF24', 0.32, [1.65, 0.75, 0.9], [0.6, 0.2, 0.9]],
    [dark ? '#E6F3FF' : '#FFFFFF', 0.26, [0.15, 2.35, -1.1], [0.9, 0.5, 0.2]],
  ].forEach(([c, s, p, r]) => scene.add(mesh(rounded(s, s, s, s * 0.14, 4), glossy(c, { roughness: 0.2, clearcoat: 1 }), p, r)));

  camera.position.set(2.2, 2.9, 7.0);
  camera.lookAt(0, 1.15, 0);
  return { scene, camera };
}

/** Two open laptops facing each other, linked by a glowing tube with a padlock */
function wireguard(theme) {
  const { scene, camera, dark } = studio(theme);
  const terminal = (lines) =>
    canvasTexture(800, 520, (ctx, w, h) => {
      ctx.fillStyle = '#071225';
      ctx.fillRect(0, 0, w, h);
      ctx.font = '600 30px ui-monospace, Menlo, monospace';
      lines.forEach(([text, color], i) => {
        ctx.fillStyle = color;
        ctx.fillText(text, 36, 70 + i * 52);
      });
    });
  const screens = [
    terminal([['[Interface]', BLUE], ['Address = 10.0.0.1/24', '#BFE0FF'], ['ListenPort = 51820', '#BFE0FF'], ['[Peer]', BLUE], ['AllowedIPs = 10.0.0.2', '#BFE0FF'], ['$ wg show', '#4ADE80'], ['  handshake: 2s ago', '#4ADE80']]),
    terminal([['[Interface]', BLUE], ['Address = 10.0.0.2/24', '#BFE0FF'], ['[Peer]', BLUE], ['Endpoint = home:51820', '#BFE0FF'], ['PersistentKeepalive = 25', '#BFE0FF'], ['$ ping 10.0.0.1', '#4ADE80'], ['  64 bytes: time=9 ms', '#4ADE80']]),
  ];

  function laptop(screen) {
    const group = new THREE.Group();
    const shell = metal(dark ? '#9AA3B5' : '#C3CAD6', { roughness: 0.32, metalness: 0.85 });
    group.add(mesh(rounded(1.5, 0.07, 1.0, 0.03, 4), shell, [0, 0.035, 0]));
    group.add(mesh(new THREE.BoxGeometry(1.3, 0.005, 0.5), matte('#1A1F2A', { roughness: 0.6 }), [0, 0.072, -0.12]));
    group.add(mesh(new THREE.BoxGeometry(0.5, 0.004, 0.28), glossy(dark ? '#8A93A5' : '#B4BCC9', { roughness: 0.3 }), [0, 0.072, 0.3]));
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.07, -0.49);
    hinge.rotation.x = -0.28;
    hinge.add(mesh(rounded(1.5, 1.0, 0.04, 0.03, 4), shell, [0, 0.5, 0]));
    const display = mesh(
      new THREE.PlaneGeometry(1.36, 0.86),
      new THREE.MeshStandardMaterial({ map: screen, emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: 1.1, roughness: 0.2 }),
      [0, 0.52, 0.022],
    );
    display.castShadow = false;
    hinge.add(display);
    group.add(hinge);
    return group;
  }

  const left = laptop(screens[0]);
  left.position.set(-1.6, 0, 0.1);
  left.rotation.y = 0.95;
  const right = laptop(screens[1]);
  right.position.set(1.6, 0, 0.1);
  right.rotation.y = -0.95;
  scene.add(left, right);
  contact(scene, 2.0, 1.5, -1.6, 0.1, 0.55);
  contact(scene, 2.0, 1.5, 1.6, 0.1, 0.55);

  // The tunnel: a glowing tube with a soft halo, arching between the screens
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.15, 0.75, 0.0),
    new THREE.Vector3(-0.6, 1.25, 0.2),
    new THREE.Vector3(0, 1.4, 0.25),
    new THREE.Vector3(0.6, 1.25, 0.2),
    new THREE.Vector3(1.15, 0.75, 0.0),
  ]);
  const core = mesh(new THREE.TubeGeometry(curve, 96, 0.055, 24), new THREE.MeshStandardMaterial({ color: '#BFEFFF', emissive: BLUE, emissiveIntensity: dark ? 5 : 2.4 }));
  core.castShadow = false;
  scene.add(core);
  const halo = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, 0.13, 24),
    new THREE.MeshPhysicalMaterial({ color: BLUE, transparent: true, opacity: dark ? 0.22 : 0.3, roughness: 0.1, transmission: 0, depthWrite: false }),
  );
  scene.add(halo);

  // Padlock at the top of the arc
  const lock = new THREE.Group();
  lock.position.set(0, 1.3, 0.3);
  lock.rotation.y = -0.15;
  const gold = metal('#E0B04F', { roughness: 0.22 });
  lock.add(mesh(rounded(0.36, 0.3, 0.14, 0.05, 4), gold, [0, 0, 0]));
  lock.add(mesh(new THREE.TorusGeometry(0.11, 0.028, 16, 40, Math.PI), metal('#D7DCE4', { roughness: 0.2 }), [0, 0.15, 0]));
  lock.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20), matte('#3A2A0A'), [0, 0.02, 0.075], [Math.PI / 2, 0, 0]));
  lock.add(mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), matte('#3A2A0A'), [0, -0.03, 0.075]));
  scene.add(lock);

  camera.position.set(1.4, 2.6, 7.6);
  camera.lookAt(0, 0.75, 0);
  return { scene, camera };
}

/** A ceramic bowl with a magnifying glass leaning on it */
function mealFinder(theme) {
  const { scene, camera, dark } = studio(theme);
  const profile = [
    [0.0, 0.0], [0.42, 0.0], [0.44, 0.04], [0.42, 0.08], [0.55, 0.12], [0.75, 0.24], [0.9, 0.42], [0.99, 0.62], [1.02, 0.72],
    [1.0, 0.75], [0.95, 0.72], [0.9, 0.6], [0.78, 0.42], [0.6, 0.27], [0.35, 0.18], [0.0, 0.16],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const ceramic = glossy(dark ? '#EEF1F6' : '#FBFBF8', { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  const bowl = mesh(new THREE.LatheGeometry(profile, 128), ceramic);
  const band = mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0.905, 0.43), new THREE.Vector2(0.94, 0.5), new THREE.Vector2(0.965, 0.56)].map((v) => v.multiplyScalar(1.004)), 128),
    glossy('#2B6CDB', { roughness: 0.2, clearcoat: 1 }),
  );
  scene.add(bowl, band);
  contact(scene, 2.6, 2.6, 0, 0, 0.6);

  // Something good inside: a warm broth with greens, tomatoes and croutons
  scene.add(mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.02, 96), glossy('#E39A4C', { roughness: 0.35, clearcoat: 0.6 }), [0, 0.55, 0]));
  const greens = matte('#3FA34D', { roughness: 0.6 });
  [[-0.35, 0.12, 0.6], [0.1, -0.3, 0.9], [0.4, 0.25, 0.3], [-0.15, 0.42, 1.4]].forEach(([x, z, r]) => {
    const leaf = mesh(new THREE.SphereGeometry(0.16, 24, 16), greens, [x, 0.57, z], [0, r, 0]);
    leaf.scale.set(1.3, 0.25, 0.8);
    scene.add(leaf);
  });
  [[0.2, 0.1], [-0.4, -0.25], [0.5, -0.1]].forEach(([x, z]) => scene.add(mesh(new THREE.SphereGeometry(0.08, 24, 16), glossy('#E5484D', { roughness: 0.2 }), [x, 0.6, z])));
  [[-0.1, -0.05], [0.25, 0.42], [-0.5, 0.3]].forEach(([x, z], i) => scene.add(mesh(rounded(0.1, 0.08, 0.1, 0.02), matte('#D9A65A'), [x, 0.6, z], [0, i, 0])));

  // The magnifying glass, leaning against the bowl's rim
  const glass = new THREE.Group();
  glass.position.set(1.12, 0.62, 0.55);
  glass.rotation.set(0.15, -0.55, -0.62);
  const rim = metal('#2B3550', { roughness: 0.25, metalness: 0.8 });
  glass.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 24, 96), rim, [0, 0.55, 0]));
  const lens = mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.03, 96),
    new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0, metalness: 0, transmission: 1, thickness: 0.15, ior: 1.5, transparent: true }),
    [0, 0.55, 0],
    [Math.PI / 2, 0, 0],
  );
  lens.castShadow = false;
  glass.add(lens);
  glass.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 24), metal('#C9CFD9'), [0, 0.08, 0]));
  glass.add(mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.8, 32), glossy('#1A2236', { roughness: 0.35 }), [0, -0.38, 0]));
  scene.add(glass);

  camera.position.set(2.1, 2.6, 5.6);
  camera.lookAt(0.3, 0.5, 0);
  return { scene, camera };
}

const scenes = {
  'this-website': website,
  homelab,
  'roblox-games': roblox,
  'wireguard-vpn-lab': wireguard,
  'meal-finder': mealFinder,
};

/** Renders one project's still and returns it as a PNG data URL (3200 × 2000) */
window.renderArt = (slug, theme) => {
  const { scene, camera } = scenes[slug](theme);
  const target = new THREE.WebGLRenderTarget(W * SCALE, H * SCALE, { type: THREE.HalfFloatType, samples: 8 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(SCALE);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  // Dark only, and only what's brighter than any lit surface (LEDs, the tube, the light bar) glows
  if (theme === 'dark') composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.45, 1.6));
  composer.addPass(new OutputPass());
  composer.render();
  const url = renderer.domElement.toDataURL('image/png');
  scene.traverse((object) => {
    object.geometry?.dispose();
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => m?.dispose());
  });
  scene.background?.dispose();
  composer.dispose();
  target.dispose();
  return url;
};

window.artReady = true;
