#!/usr/bin/env node
/**
 * The site icon: a blue E46 in pixel art (3/4 front view) on a dark rounded square.
 *
 * The car is a few boxes (body, cabin, wheels, spoiler) in a small 3D space, projected onto a
 * 32 × 32 grid one cell at a time, then outlined. Writes public/favicon.svg (crisp rects),
 * favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192.png and icon-512.png.
 *
 *   node scripts/render-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (name) => path.join(root, 'public', name);

const GRID = 32;
const C = {
  K: '#070B16', // outline
  B: '#2A6BB5', // Laguna Seca Blue
  L: '#5CA8F0', // lit top
  H: '#9FD0FF', // highlight
  D: '#1A4A8C', // side in shade
  E: '#123566', // deep shade
  W: '#1E2533', // glass
  G: '#56627A', // glass glare
  Y: '#FFE38A', // headlights
  R: '#E5484D', // tail light
  T: '#14171E', // tyre
  M: '#A9B3C4', // rim
  X: '#0B1222', // grille, intakes
};

// ---------- Projection: +x to the rear (up-right), +z to the near side (down-right), +y up ----------
const project = ([x, y, z]) => [x * 0.86 + z * 0.52, -x * 0.38 + z * 0.44 - y];

/** A flat 3D quad (or polygon) in one colour, drawn in order (later ones on top) */
const faces = [];
const face = (color, ...points) => faces.push({ color, points: points.map(project) });

// Body: front at x = -8, rear at +8, half-width 4; hood at 3.6, deck at 4.1
face('D', [-8, 0.8, 4], [8, 0.8, 4], [8, 4.1, 4], [-8, 3.6, 4]); // near side
face('B', [-8, 0.8, -4], [-8, 0.8, 4], [-8, 3.6, 4], [-8, 3.6, -4]); // front
face('B', [-8, 3.6, -4], [-8, 3.6, 4], [8, 4.1, 4], [8, 4.1, -4]); // hood and deck
// Light catching the hood's centre and the shoulder line
face('L', [-8, 3.6, -1.6], [-8, 3.6, 1.6], [-3, 3.75, 1.6], [-3, 3.75, -1.6]);
face('L', [-8, 3.6, 2.8], [-8, 3.6, 4], [8, 4.1, 4], [8, 4.1, 2.8]);
face('H', [-8, 3.3, 4], [8, 3.8, 4], [8, 4.1, 4], [-8, 3.6, 4]);
// Front: grille (two kidneys), headlights, lower intake
face('X', [-8, 1.9, -1.3], [-8, 1.9, -0.15], [-8, 3.0, -0.15], [-8, 3.0, -1.3]);
face('X', [-8, 1.9, 0.15], [-8, 1.9, 1.3], [-8, 3.0, 1.3], [-8, 3.0, 0.15]);
face('Y', [-8, 2.5, -3.6], [-8, 2.5, -2.0], [-8, 3.2, -2.0], [-8, 3.2, -3.6]);
face('Y', [-8, 2.5, 2.0], [-8, 2.5, 3.6], [-8, 3.2, 3.6], [-8, 3.2, 2.0]);
face('X', [-8, 1.1, -2.8], [-8, 1.1, 2.8], [-8, 1.6, 2.8], [-8, 1.6, -2.8]);
// Side: a darker sill, the tail light
face('E', [-8, 0.8, 4], [8, 0.8, 4], [8, 1.5, 4], [-8, 1.5, 4]);
face('R', [7.2, 3.0, 4], [8, 3.0, 4], [8, 3.7, 4], [7.2, 3.6, 4]);

// Cabin: windscreen, side windows with a pillar, roof
face('W', [-3, 3.8, -3.4], [-3, 3.8, 3.4], [-0.8, 6.4, 3.0], [-0.8, 6.4, -3.0]); // windscreen
face('G', [-2.6, 4.2, -2.4], [-2.2, 4.2, -1.2], [-0.9, 6.0, -0.9], [-1.3, 6.0, -2.1]); // glare
face('W', [-3, 3.8, 3.4], [5.2, 3.9, 3.4], [3.4, 6.4, 3.0], [-0.8, 6.4, 3.0]); // side windows
face('D', [1.1, 3.85, 3.4], [1.7, 3.85, 3.4], [1.5, 6.4, 3.0], [0.9, 6.4, 3.0]); // B-pillar
face('B', [-0.8, 6.4, -3.0], [-0.8, 6.4, 3.0], [3.4, 6.4, 3.0], [3.4, 6.4, -3.0]); // roof
face('L', [-0.6, 6.4, -2.4], [-0.6, 6.4, 1.6], [1.2, 6.4, 1.6], [1.2, 6.4, -2.4]); // roof shine
// Mirror
face('B', [-2.6, 4.2, 4], [-1.8, 4.2, 4], [-1.8, 4.8, 4.7], [-2.6, 4.8, 4.7]);

// Spoiler on the boot lid
face('E', [6.4, 3.9, -4], [6.4, 3.9, 4], [6.6, 4.9, 4], [6.6, 4.9, -4]);
face('B', [6.6, 4.9, -4], [6.6, 4.9, 4], [8, 5.0, 4], [8, 5.0, -4]);

// Wheels on the near side: tyre, then rim (ellipses in the side's plane)
function wheel(cx, r) {
  const ring = (radius, color) => {
    const points = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      points.push([cx + Math.cos(a) * radius, 1.3 + Math.sin(a) * radius, 4.05]);
    }
    face(color, ...points);
  };
  ring(r, 'T');
  ring(r * 0.55, 'M');
}
wheel(-5, 1.75);
wheel(5, 1.75);

// ---------- Rasterize: fit to the grid, one colour per cell centre ----------
const all = faces.flatMap((f) => f.points);
const minX = Math.min(...all.map((p) => p[0]));
const maxX = Math.max(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1]));
const maxY = Math.max(...all.map((p) => p[1]));
const margin = 3;
const scale = Math.min((GRID - margin * 2) / (maxX - minX), (GRID - margin * 2) / (maxY - minY));
const offsetX = (GRID - (maxX - minX) * scale) / 2 - minX * scale;
const offsetY = (GRID - (maxY - minY) * scale) / 2 - minY * scale;

const inside = (x, y, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

const cells = Array.from({ length: GRID }, () => Array(GRID).fill(null));
for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    const x = (gx + 0.5 - offsetX) / scale;
    const y = (gy + 0.5 - offsetY) / scale;
    for (const f of faces) if (inside(x, y, f.points)) cells[gy][gx] = f.color;
  }
}
// One-pixel outline round the silhouette
const outlined = cells.map((row) => row.slice());
for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    if (cells[gy][gx]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cells[gy + dy]?.[gx + dx]);
    if (near) outlined[gy][gx] = 'K';
  }
}

// ---------- SVG: rounded dark square, then the pixels as horizontal runs ----------
let rects = '';
for (let gy = 0; gy < GRID; gy++) {
  let gx = 0;
  while (gx < GRID) {
    const color = outlined[gy][gx];
    let run = 1;
    while (color && outlined[gy][gx + run] === color) run++;
    if (color) rects += `<rect x="${gx}" y="${gy}" width="${run}" height="1" fill="${C[color]}"/>`;
    gx += run;
  }
}
const svg = (rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">
<defs><radialGradient id="glow" cx="50%" cy="42%" r="65%"><stop offset="0" stop-color="#1B3A78"/><stop offset="1" stop-color="#0A1428"/></radialGradient></defs>
<rect width="${GRID}" height="${GRID}" rx="${rounded ? 6 : 0}" fill="url(#glow)"/>${rounded ? `<rect x="0.5" y="0.5" width="${GRID - 1}" height="${GRID - 1}" rx="5.5" fill="none" stroke="#2B3F66" stroke-width="1"/>` : ''}
${rects}
</svg>
`;

writeFileSync(pub('favicon.svg'), svg(true));
// Home-screen icons are full-bleed squares: the system rounds them
const square = Buffer.from(svg(false));
const png = (size, source = square) => sharp(source, { density: (72 * size) / GRID }).resize(size, size, { kernel: 'nearest' }).png().toBuffer();
writeFileSync(pub('apple-touch-icon.png'), await png(180));
writeFileSync(pub('icon-192.png'), await png(192));
writeFileSync(pub('icon-512.png'), await png(512));

// favicon.ico: PNG-compressed entries at 16, 32 and 48
const rounded = Buffer.from(svg(true));
const entries = await Promise.all([16, 32, 48].map((size) => png(size, rounded)));
const header = Buffer.alloc(6 + entries.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((data, i) => {
  const size = [16, 32, 48][i];
  const o = 6 + i * 16;
  header.writeUInt8(size, o);
  header.writeUInt8(size, o + 1);
  header.writeUInt8(0, o + 2);
  header.writeUInt8(0, o + 3);
  header.writeUInt16LE(1, o + 4);
  header.writeUInt16LE(32, o + 6);
  header.writeUInt32LE(data.length, o + 8);
  header.writeUInt32LE(offset, o + 12);
  offset += data.length;
});
writeFileSync(pub('favicon.ico'), Buffer.concat([header, ...entries]));

console.log(outlined.map((row) => row.map((c) => c ?? '.').join('')).join('\n'));
