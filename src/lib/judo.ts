/**
 * Judo pixel art for the hero strip, built at compile time.
 *
 * Every pose is drawn without its outline on a 22 × 26 grid (one character per pixel, "." is
 * empty), from shared parts: a head, the neck and gi top, arms and legs. `outline()` then adds a 1px dark
 * border, so each frame ends up 24 × 28 with the feet on its bottom row. Tori and Uke share the
 * same letters; only the palette (and Uke's buzz cut) differs, and Uke is mirrored to face left.
 *
 *   W / w / g  gi light, base, shadow    B  belt        S / s  skin, skin shadow
 *   H / h      hair, hair highlight      E  eyes        m      mouth
 *   O          outline (added)
 */

export type PixelMap = string[];

const W = 22;
const H = 26;

const OUTLINE = '#0A0F1E';

export const toriPalette = {
  W: '#F2F6FF',
  w: '#D3DEF0',
  g: '#9FB1CF',
  B: '#111111',
  S: '#D29A74',
  s: '#A86F4E',
  E: '#06101F',
  m: '#B0745A',
  H: '#3A2216',
  h: '#6E4630',
  O: OUTLINE,
};

export const ukePalette = {
  W: '#4A8BF0',
  w: '#2B6CDB',
  g: '#1A4699',
  B: '#5A3A22',
  S: '#E0AC86',
  s: '#B07A55',
  E: '#06101F',
  m: '#BE8466',
  H: '#15161C',
  h: '#454B60',
  O: OUTLINE,
};

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
 * 2 rows to a 2px chin) with an ear on each side at eye level, under 2 rows kept for hair spikes.
 * Brows are in the hair colour, the nose is a skin-shadow pixel and the mouth a darker line.
 */
const toriHead: PixelMap = [
  'H.H.H...',
  '.HHhHhH.',
  '.HHHhHH.',
  '.HSSSSH.',
  '.sHSSHS.',
  'sSESSESs',
  '.SSSsSS.',
  '..SmmS..',
  '...SS...',
];

// Uke: a buzz cut, close to the head, with a sharp hairline
const ukeHead: PixelMap = ['........', '........', '.HhHhHH.', ...toriHead.slice(3)];

// Gi top (12 × 9): broad shoulders, crossed lapels round the neck, a narrow waist, the belt with
// its knot and two hanging ends, and the hips
const torso: PixelMap = [
  'WWWWgssgwwwg',
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
  heads: { head: PixelMap; cx: number; cy: number; deg: number }[];
}

/** Gi top, neck and arms (21 × 19), hips on the last row; the head centers above the neck */
function upper(head: PixelMap, arms: 'down' | 'forward' | 'up' | 'fist'): Figure {
  const parts: [PixelMap, number, number][] = [];
  if (arms === 'down' || arms === 'fist') parts.push([armDownBack, 0, 10]);
  if (arms === 'forward') parts.push([armForwardBack, 11, 12]);
  if (arms === 'up') parts.push([armUpBack, 1, 3]);
  parts.push([torso, 3, 10], [['ss'], 8, 9]);
  if (arms === 'down') parts.push([armDownFront, 15, 10]);
  if (arms === 'forward') parts.push([armForward, 12, 11]);
  if (arms === 'up') parts.push([armUp, 15, 3]);
  if (arms === 'fist') parts.push([armUp, 15, 1]);
  return { map: compose(parts, 21, 19), heads: [{ head, cx: 9, cy: 4.5, deg: 0 }] };
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

/** Stamps the heads on (growing the map if one sticks out) and adds the outline */
function finish(figure: Figure): PixelMap {
  let map = figure.map;
  for (const { head, cx, cy, deg } of figure.heads) {
    let turned = head;
    for (let i = 0; i < (((Math.round(deg / 90) % 4) + 4) % 4); i++) turned = quarter(turned);
    const w = Math.max(...map.map((row) => row.length));
    const x = Math.round(cx - turned[0].length / 2);
    const y = Math.round(cy - turned.length / 2);
    const left = Math.max(0, -x);
    const top = Math.max(0, -y);
    const width = Math.max(w + left, x + left + turned[0].length);
    const height = Math.max(map.length + top, y + top + turned.length);
    map = compose([
      [map, left, top],
      [turned, x + left, y + top],
    ], width, height);
  }
  return outline(map);
}

// ---------- Tori ----------

export const toriWalkA = finish(pose(upper(toriHead, 'down'), legsStand));
export const toriWalkB = finish(pose(upper(toriHead, 'down'), legsPass));

// Crouched with the hands down (F2), the body the roll turns over
const rollCrouch = pose(upper(toriHead, 'forward'), legsSquat, { x: 6, legsX: 5, lean: 70 });

// Forward roll (mae mawari ukemi): F1 step in, F2 hands down, F3 over the right shoulder,
// F4 curled on the back, F5 coming up; F6 is the standing pose (toriWalkA)
export const toriRoll = [
  finish(pose(upper(toriHead, 'forward'), legsLunge, { x: 4, legsX: 3, lean: 25 })),
  finish(rollCrouch),
  finish(turn(rollCrouch, 75)),
  finish(turn(rollCrouch, 230)),
  finish(pose(upper(toriHead, 'forward'), legsKneel, { x: 4, legsX: 4, lean: 10 })),
].map(bottomAlign);

// Kata-guruma: drop under Uke (2 frames), lift with the knees bent then straight, throw, and win
export const toriEntry = [
  finish(pose(upper(toriHead, 'forward'), legsBent, { legsX: 6, lean: 15 })),
  finish(pose(upper(toriHead, 'forward'), legsSquat, { x: 5, legsX: 5, lean: 35 })),
].map(bottomAlign);

export const toriLift = [
  finish(pose(upper(toriHead, 'up'), legsBent, { legsX: 6 })),
  finish(pose(upper(toriHead, 'up'), legsStand)),
].map(bottomAlign);

// The pull down after the throw: arms forward, knees bent
export const toriThrow = bottomAlign(finish(pose(upper(toriHead, 'forward'), legsBent, { legsX: 6, lean: 20 })));
export const toriIppon = finish(pose(upper(toriHead, 'fist'), legsStand));

// ---------- Uke (mirrored: faces left) ----------

export const ukeStand = mirror(finish(pose(upper(ukeHead, 'down'), legsStand)));

// Pulled off balance, bent forward with an arm reaching over Tori's shoulder
export const ukeBent = bottomAlign(mirror(finish(pose(upper(ukeHead, 'forward'), legsStand, { x: 5, legsX: 7, lean: 40 }))));

// Lying on his back after the throw: head on the left (towards Tori), face up
const ukeFlat = turn(pose(upper(ukeHead, 'down'), legsStand), -90);
export const ukeGround = finish(ukeFlat);

// On Tori's shoulders: the landing pose upside down, so the 180° throw ends exactly on it. The
// throw is 4 rotation steps of that pose: 0°, 60°, 120°, 180°.
export const ukeThrow = [0, 60, 120, 180].map((deg) => finish(turn(turn(ukeFlat, 180), deg)));

/** Pads the top so the map is 28 rows tall: every frame shares one bottom (the feet) */
function bottomAlign(map: PixelMap): PixelMap {
  const width = Math.max(...map.map((row) => row.length));
  const pad = Array.from({ length: Math.max(0, H + 2 - map.length) }, () => '.'.repeat(width));
  return [...pad, ...map];
}
