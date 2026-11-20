/**
 * Judo pixel art for the hero strip, built at compile time.
 *
 * Every pose is drawn without its outline on a 22 × 26 grid (one character per pixel, "." is
 * empty), from shared parts: a head, the neck and gi top, arms and legs. `outline()` then adds a 1px
 * dark border, so each frame ends up about 24 × 28 with the feet on its bottom row.
 *
 * One set of body frames serves every fighter. The colours are letters that the page maps to CSS
 * variables (a palette per fighter: skin, gi, belt, hair), and the hair is a separate layer per
 * style, worked out by building each frame with that hairstyle and keeping only what changed.
 *
 *   W / w / g  gi light, base, shadow    B  belt        S / s  skin, skin shadow
 *   H / h      hair, hair highlight      E  eyes        m      mouth
 *   n          inside the lapels (skin, or a white T-shirt)
 *   O          outline (added)
 */

import { HAIR_STYLES, type HairStyle } from './fighters';

export { HAIR_STYLES, type HairStyle };

export type PixelMap = string[];

const W = 22;
const H = 26;

export const OUTLINE = '#0A0F1E';

// ---------- Grid helpers ----------

const blank = (w = W, h = H): string[][] => Array.from({ length: h }, () => Array(w).fill('.'));

/** Draws the parts onto an empty grid, in order: [part, x, y] (empty pixels let the layer below show) */
function compose(parts: [PixelMap, number, number][], w = W, h = H): PixelMap {
  const grid = blank(w, h);
  for (const [part, px, py] of parts) {
    part.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const gx = px + x;
        const gy = py + y;
        if (char !== '.' && gx >= 0 && gx < w && gy >= 0 && gy < h) grid[gy][gx] = char;
      });
    });
  }
  return grid.map((row) => row.join(''));
}

export const mirror = (map: PixelMap): PixelMap => map.map((row) => [...row].reverse().join(''));

/** Drops the empty rows and columns around a map; also says how much it cut from the top and left */
function trim(map: PixelMap): { map: PixelMap; left: number; top: number } {
  const top = map.findIndex((row) => /[^.]/.test(row));
  const rows = map.filter((row) => /[^.]/.test(row));
  const cols = Math.max(...rows.map((row) => row.length));
  let left = cols;
  let right = 0;
  for (const row of rows) {
    const first = row.search(/[^.]/);
    if (first >= 0) left = Math.min(left, first);
    for (let x = row.length - 1; x >= 0; x--) {
      if (row[x] !== '.') {
        right = Math.max(right, x);
        break;
      }
    }
  }
  return { map: rows.map((row) => row.padEnd(cols, '.').slice(left, right + 1)), left, top };
}

/**
 * Rotates a map clockwise by `deg` with nearest-neighbour sampling, so the result is still made of
 * whole pixels (no smoothing). The canvas grows to fit and is trimmed afterwards. `transform` maps
 * a point of the original to where it ends up.
 */
function rotateWith(map: PixelMap, deg: number) {
  const h = map.length;
  const w = Math.max(...map.map((row) => row.length));
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const size = Math.ceil(Math.hypot(w, h)) + 2;
  const cx = w / 2;
  const cy = h / 2;
  const grid = blank(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Back from the output pixel's center to the source pixel it lands on
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      const sx = Math.floor(cos * dx + sin * dy + cx);
      const sy = Math.floor(-sin * dx + cos * dy + cy);
      if (sy >= 0 && sy < h && sx >= 0 && sx < w) grid[y][x] = map[sy][sx] ?? '.';
    }
  }
  const trimmed = trim(grid.map((row) => row.join('')));
  const transform = (px: number, py: number) => ({
    cx: cos * (px - cx) - sin * (py - cy) + size / 2 - trimmed.left,
    cy: sin * (px - cx) + cos * (py - cy) + size / 2 - trimmed.top,
  });
  return { map: trimmed.map, transform };
}

/** A 1px dark border around the figure, corners included so angles stay sharp; one pixel added on every side */
export function outline(map: PixelMap): PixelMap {
  const h = map.length;
  const w = Math.max(...map.map((row) => row.length));
  const filled = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && (map[y][x] ?? '.') !== '.';
  const out = blank(w + 2, h + 2);
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (filled(x, y)) out[y + 1][x + 1] = map[y][x];
      else if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => filled(x + dx, y + dy)))) out[y + 1][x + 1] = 'O';
    }
  }
  return out.map((row) => row.join(''));
}

// ---------- Parts (all facing right, lit from the top left) ----------

/*
 * Heads are 8 × 9: a 6 × 7 face block (flat top, straight sides, the jaw angling in over the last
 * 2 rows to a 2px chin) with an ear on each side at eye level. Brows are in the hair colour, the nose
 * is a skin-shadow pixel and the mouth a darker line. The face is bald here; the hair is its own
 * layer, on a 12 × 13 grid around it (2 pixels of room on every side, for buns, braids and afros).
 */
const face: PixelMap = [
  '........',
  '........',
  '.SSSSSS.',
  '.SSSSSS.',
  '.sHSSHS.',
  'sSESSESs',
  '.SSSsSS.',
  '..SmmS..',
  '...SS...',
];


/** Hair around the face, front view (the face sits at 2, 2 on this 12 × 13 grid) */
const frontHair: Record<HairStyle, PixelMap> = {
  short: ['', '', '..H.H.H.....', '...HHhHhH...', '...HHHhHH...', '...H....H...'],
  buzz: ['', '', '', '', '...HhHhHH...', '...H....H...'],
  ponytail: ['', '', '', '....HHHH....', '...HHhHHH...', '.HHH....H...', 'HH..........', 'Hh..........', 'H...........'],
  bun: ['.....HH.....', '....HhHH....', '....HHHH....', '...HHHHHH...', '...HhHHhH...', '...H....H...'],
  braids: [
    '',
    '',
    '',
    '...HHHHHH...',
    '...HHhhHH...',
    '..HH....HH..',
    '.Hh......hH.',
    '.hH......Hh.',
    '.Hh......hH.',
    '.hH......Hh.',
    '.Hh......hH.',
    '.H........H.',
  ],
  afro: [
    '...HHHHHH...',
    '..HHhHHhHH..',
    '.HHhHHHHhHH.',
    '.HHHHhhHHHH.',
    '.HHHHhHHHHH.',
    '.HH......HH.',
    '.HH......HH.',
    '..H......H..',
  ],
  tied: ['', '', '', '...HHHHHH...', '..HHhHHHHH..', '..HH....H...', '..H.........', '.HH.........', '.Hh.........', '.HH.........', '..H.........'],
};

/*
 * Lying on the back (the landing), seen from the side: the head in profile, crown to the left,
 * face up. 8 × 6, on a 12 × 9 grid with room to the left and above for the hair.
 */
const profile: PixelMap = [
  '....s...',
  '.SHSSSmS',
  'SSESSSSs',
  'SSSSSSs.',
  'sSSsSS..',
  '.sSSS...',
];

const profileHair: Record<HairStyle, PixelMap> = {
  short: ['', '', '', '....HH......', '...HHH......', '...HH.......', '...Hh.......', '...HH.......', '....HH......'],
  buzz: ['', '', '', '', '....HH......', '....H.......', '....h.......', '....H.......', '.....H......'],
  ponytail: ['', '', '', '....HH......', '...HHH......', '...HH.......', '...Hh.......', '.HHHH.......', 'HhHHHH......'],
  bun: ['', '', '', '....HH......', '.HHHHH......', 'HHhHH.......', 'HHHHh.......', '..HHH.......', '....HH......'],
  braids: ['', '', '', '....HH......', '...HHH......', '...HH.......', '...Hh.......', '.hHhHH......', 'HhHhHHH.....'],
  afro: ['', '..HHH.......', '.HHhHH......', 'HHHHHH......', 'HHhHHH......', 'HHHHh.......', 'HhHHH.......', 'HHHHH.......', '.HHHHHH.....'],
  tied: ['', '', '', '....HH......', '...HHH......', '...HH.......', '...HH.......', '...Hh.......', 'hHHHHHH.....'],
};

/** A head grid: the face at (dx, dy) on a w × h grid, with a hairstyle on top (or none: bald) */
function headGrid(base: PixelMap, hair: PixelMap | null, w: number, h: number, dx: number, dy: number): PixelMap {
  return compose([[base, dx, dy], ...(hair ? [[hair, 0, 0] as [PixelMap, number, number]] : [])], w, h);
}

/** Every cell any hairstyle covers, plus the face: the part of a head grid that can ever be drawn */
function unionGrid(base: PixelMap, hairs: Record<HairStyle, PixelMap>, w: number, h: number, dx: number, dy: number): PixelMap {
  return compose([[base, dx, dy], ...HAIR_STYLES.map((style) => [hairs[style].map((row) => row.replace(/[^.]/g, 'X')), 0, 0] as [PixelMap, number, number])], w, h);
}

interface HeadKind {
  grid: (style: HairStyle | null) => PixelMap;
  union: PixelMap;
}

const front: HeadKind = {
  grid: (style) => headGrid(face, style ? frontHair[style] : null, 12, 13, 2, 2),
  union: unionGrid(face, frontHair, 12, 13, 2, 2),
};

const side: HeadKind = {
  grid: (style) => headGrid(profile, style ? profileHair[style] : null, 12, 9, 4, 3),
  union: unionGrid(profile, profileHair, 12, 9, 4, 3),
};

// Gi top (12 × 9): broad shoulders, crossed lapels round the neck, a narrow waist, the belt with
// its knot and two hanging ends, and the hips
const torso: PixelMap = [
  'WWWWgnngwwwg',
  'WWWWWgWgwwwg',
  'WWWWWWgwwwgg',
  '..WWWgWwwg..',
  '..BBBBBBBB..',
  '..wwBBBwwg..',
  '..WwBwBwwg..',
  '.WWwBwBwwgg.',
  '.WWwwwwwwgg.',
];

// Arms hanging: sleeve, darker cuff, hand
const armDownBack: PixelMap = ['WWg', 'WWg', 'WWg', 'WWg', 'WWg', 'gWg', 'ggg', 'SSs'];
const armDownFront: PixelMap = ['wwg', 'wwg', 'wwg', 'wwg', 'wwg', 'wgg', 'ggg', 'Ss.'];

// Arms reaching forward at chest height
const armForward: PixelMap = ['wwwwwgSS', 'wwwwggSs', 'ggggg.s.'];
const armForwardBack: PixelMap = ['gggggSs', 'ggggss.'];

// Arms raised (hand on top), holding something on the shoulders or a fist in the air
const armUp: PixelMap = ['SS', 'Ss', 'gg', 'wg', 'wg', 'wg', 'wg', 'wg'];
const armUpBack: PixelMap = ['SS', 'sS', 'gg', 'Wg', 'Wg', 'Wg', 'Wg', 'Wg'];

// Legs (8 rows): trousers, then the feet pointing forward
const legsStand: PixelMap = [
  'WWwwwwwwgg',
  'WWwwwwwwgg',
  'WWwg..Wwgg',
  'WWwg..Wwgg',
  'WWwg..Wwgg',
  'Wwgg..Wwgg',
  'SSs...SSs.',
  'SSSS..SSSS',
];

// Passing step: the back leg straight, the front foot lifted
const legsPass: PixelMap = [
  'WWwwwwwwgg',
  '.WWwwwwwg.',
  '.WWwwwwgg.',
  '.WWwgwwgg.',
  '.WWwgWwwgg',
  '.Wwg..Wwgs',
  '.SSs...SSS',
  '.SSSS.....',
];

// Knees bent (5 rows): the stance a crouch or a lift stands on
const legsBent: PixelMap = [
  '.WWwwwwwwgg.',
  'WWwwg..Wwwgg',
  'WWwg....Wwgg',
  'SSs.....SSs.',
  'SSSS....SSSS',
];

// Deep squat (4 rows): knees out, ready to go under
const legsSquat: PixelMap = [
  '..WWwwwwwwgg..',
  'WWWwwg..Wwwwgg',
  'SSs.wg..Wg.SSs',
  'SSSS......SSSS',
];

// Lunge: the front leg bent forward, the back leg stretched behind
const legsLunge: PixelMap = [
  '....WWwwwwwwgg....',
  '...WWwwg..Wwwwgg..',
  '..WWwg.....Wwwgg..',
  '.WWwg........Wwg..',
  'Wwgg.........Wwg..',
  'SSs..........SSs..',
  'SSSS.........SSSSs',
];

// Kneeling: the back knee down, the front foot flat
const legsKneel: PixelMap = [
  '...WWwwwwwwgg....',
  '..WWwwg..Wwwwggg.',
  '.WWwg.......Wwgg.',
  'WWwgg.......Wwg..',
  'gggSS.......SSSS.',
];

/**
 * A pose before its head is drawn on: the body map, plus where each head goes (its center, in map
 * pixels) and how far it has turned. The body can rotate freely; the head is stamped on afterwards,
 * turned only in 90° steps, so its shape stays exact in every frame.
 */
interface Figure {
  map: PixelMap;
  heads: { head: PixelMap; union: PixelMap; cx: number; cy: number; deg: number }[];
}

/** Gi top, neck and arms (21 × 19), hips on the last row; the head centers above the neck */
function upper(head: HeadGrid, arms: 'down' | 'forward' | 'up' | 'fist'): Figure {
  const parts: [PixelMap, number, number][] = [];
  if (arms === 'down' || arms === 'fist') parts.push([armDownBack, 0, 10]);
  if (arms === 'forward') parts.push([armForwardBack, 11, 12]);
  if (arms === 'up') parts.push([armUpBack, 1, 3]);
  parts.push([torso, 3, 10], [['ss'], 8, 9]);
  if (arms === 'down') parts.push([armDownFront, 15, 10]);
  if (arms === 'forward') parts.push([armForward, 12, 11]);
  if (arms === 'up') parts.push([armUp, 15, 3]);
  if (arms === 'fist') parts.push([armUp, 15, 1]);
  return { map: compose(parts, 21, 19), heads: [{ ...head, cx: 9, cy: 4.5, deg: 0 }] };
}

const shift = (figure: Figure, dx: number, dy: number) => figure.heads.map((h) => ({ ...h, cx: h.cx + dx, cy: h.cy + dy }));

/** A full pose on the 22 × 26 grid: the upper body at (x, y), legs at the bottom */
function pose(top: Figure, legs: PixelMap, { x = 3, legsX = 7, lean = 0 } = {}): Figure {
  const leaned = lean ? turn(top, lean) : top;
  const legsY = H - legs.length;
  const y = legsY - leaned.map.length + 1;
  // The hips sit on top of the legs (one row of overlap so the gi reads as one piece)
  return {
    map: compose([
      [legs, legsX, legsY],
      [leaned.map, x, y],
    ]),
    heads: shift(leaned, x, y),
  };
}

/** Rotates the body clockwise by `deg`, carrying the head positions along */
function turn(figure: Figure, deg: number): Figure {
  const { map, transform } = rotateWith(figure.map, deg);
  return {
    map,
    heads: figure.heads.map((h) => ({ ...h, ...transform(h.cx, h.cy), deg: h.deg + deg })),
  };
}

/** A quarter turn clockwise, exact */
const quarter = (map: PixelMap): PixelMap =>
  [...map[0]].map((_, x) => map.map((row) => row[x]).reverse().join(''));

const quarters = (deg: number) => ((Math.round(deg / 90) % 4) + 4) % 4;

/** Drops the rows and columns of `map` outside the bounding box of `mask` */
function cropTo(map: PixelMap, mask: PixelMap) {
  const rows = mask.map((row, y) => (/[^.]/.test(row) ? y : -1)).filter((y) => y >= 0);
  let left = Infinity;
  let right = -1;
  for (const row of mask) {
    const first = row.search(/[^.]/);
    if (first < 0) continue;
    left = Math.min(left, first);
    right = Math.max(right, row.length - 1 - [...row].reverse().join('').search(/[^.]/));
  }
  const top = rows[0];
  return { map: map.slice(top, rows.at(-1)! + 1).map((row) => row.slice(left, right + 1)), left, top };
}

/**
 * Stamps the heads on (growing the map where the head can reach) and adds the outline. The head is
 * cropped to what any hairstyle could cover, so every style gives a map of the same size.
 */
function finish(figure: Figure): PixelMap {
  let map = figure.map;
  for (const { head, union, cx, cy, deg } of figure.heads) {
    let turned = head;
    let mask = union;
    for (let i = 0; i < quarters(deg); i++) {
      turned = quarter(turned);
      mask = quarter(mask);
    }
    const crop = cropTo(turned, mask);
    const w = Math.max(...map.map((row) => row.length));
    const x = Math.round(cx - turned[0].length / 2) + crop.left;
    const y = Math.round(cy - turned.length / 2) + crop.top;
    const cw = crop.map[0].length;
    const left = Math.max(0, -x);
    const top = Math.max(0, -y);
    const width = Math.max(w + left, x + left + cw);
    const height = Math.max(map.length + top, y + top + crop.map.length);
    map = compose([
      [map, left, top],
      [crop.map, x + left, y + top],
    ], width, height);
  }
  return outline(map);
}

type HeadGrid = { head: PixelMap; union: PixelMap };

/*
 * Lying flat on the back after the throw, seen from the side: head on the left (towards Tori),
 * face up, the near arm out on the mat, legs straight, toes up. Drawn without the head (stamped on).
 */
const lyingBody: PixelMap = [
  '..............................',
  '..............................',
  '...............BB..........S..',
  '........nWWWWWWBBWWW.......SS.',
  '.......sWWwwwwwBBwwg.......SSs',
  '.......sWWgwwwwBBwwgWWWWWWWSSs',
  '........WwWgwwwBBwwgwwwwwwwgSs',
  '........wwwWggwwwwwgwwwwwwwgss',
  '.........ggggSSsgggggggggggg..',
];

/** All the frames for one hairstyle (null: bald, the shared body) */
function buildFrames(style: HairStyle | null) {
  const head: HeadGrid = { head: front.grid(style), union: front.union };
  const lyingHead: HeadGrid = { head: side.grid(style), union: side.union };

  // ---------- Tori ----------

  const walkA = finish(pose(upper(head, 'down'), legsStand));
  const walkB = finish(pose(upper(head, 'down'), legsPass));

  // Crouched with the hands down (F2), the body the roll turns over
  const rollCrouch = pose(upper(head, 'forward'), legsSquat, { x: 6, legsX: 5, lean: 70 });

  // Forward roll (mae mawari ukemi): F1 step in, F2 hands down, F3 over the right shoulder,
  // F4 curled on the back, F5 coming up; F6 is the standing pose (walkA)
  const roll = [
    finish(pose(upper(head, 'forward'), legsLunge, { x: 4, legsX: 3, lean: 25 })),
    finish(rollCrouch),
    finish(turn(rollCrouch, 75)),
    finish(turn(rollCrouch, 230)),
    finish(pose(upper(head, 'forward'), legsKneel, { x: 4, legsX: 4, lean: 10 })),
  ].map(bottomAlign);

  // Kata-guruma: drop under Uke (2 frames), lift with the knees bent then straight, throw, and win
  const entry = [
    finish(pose(upper(head, 'forward'), legsBent, { legsX: 6, lean: 15 })),
    finish(pose(upper(head, 'forward'), legsSquat, { x: 5, legsX: 5, lean: 35 })),
  ].map(bottomAlign);
  const lift = [finish(pose(upper(head, 'up'), legsBent, { legsX: 6 })), finish(pose(upper(head, 'up'), legsStand))].map(bottomAlign);
  // The pull down after the throw: arms forward, knees bent
  const pull = bottomAlign(finish(pose(upper(head, 'forward'), legsBent, { legsX: 6, lean: 20 })));
  const ippon = finish(pose(upper(head, 'fist'), legsStand));

  // ---------- Uke (mirrored: faces left) ----------

  const stand = mirror(finish(pose(upper(head, 'down'), legsStand)));
  // Pulled off balance, bent forward with an arm reaching over Tori's shoulder
  const bent = bottomAlign(mirror(finish(pose(upper(head, 'forward'), legsStand, { x: 5, legsX: 7, lean: 40 }))));
  // Flat on the back, the head (profile, face up) at the left end of the body
  const flat: Figure = { map: lyingBody, heads: [{ ...lyingHead, cx: 2, cy: 4.5, deg: 0 }] };
  const ground = finish(flat);
  // On Tori's shoulders: the landing pose upside down (face down across his shoulders), then 3
  // more steps of 60° along the arc, the last one exactly on the back (180°)
  const thrown = [0, 60, 120, 180].map((deg) => finish(turn(turn(flat, 180), deg)));

  return {
    toriWalkA: walkA,
    toriWalkB: walkB,
    ...Object.fromEntries(roll.map((map, i) => [`toriRoll${i + 1}`, map])),
    toriEntry1: entry[0],
    toriEntry2: entry[1],
    toriLift1: lift[0],
    toriLift2: lift[1],
    toriThrow: pull,
    toriIppon: ippon,
    ukeStand: stand,
    ukeBent: bent,
    ...Object.fromEntries(thrown.map((map, i) => [`ukeThrow${i}`, map])),
    ukeGround: ground,
  } as Record<string, PixelMap>;
}

/** One frame: the shared body, and per hairstyle only the pixels that hairstyle changes */
export interface JudoFrame {
  body: PixelMap;
  hair: Record<HairStyle, PixelMap>;
}

const bald = buildFrames(null);
const styled = Object.fromEntries(HAIR_STYLES.map((style) => [style, buildFrames(style)])) as Record<HairStyle, Record<string, PixelMap>>;

/** Cells where `map` differs from `base` (same size), everything else empty */
const diff = (map: PixelMap, base: PixelMap): PixelMap =>
  map.map((row, y) => [...row].map((char, x) => (char === (base[y]?.[x] ?? '.') ? '.' : char)).join(''));

export const judoFrames: Record<string, JudoFrame> = Object.fromEntries(
  Object.entries(bald).map(([name, body]) => [
    name,
    { body, hair: Object.fromEntries(HAIR_STYLES.map((style) => [style, diff(styled[style][name], body)])) as Record<HairStyle, PixelMap> },
  ]),
);

/** Pads the top so the map is 28 rows tall: every frame shares one bottom (the feet) */
function bottomAlign(map: PixelMap): PixelMap {
  const width = Math.max(...map.map((row) => row.length));
  const pad = Array.from({ length: Math.max(0, H + 2 - map.length) }, () => '.'.repeat(width));
  return [...pad, ...map];
}
