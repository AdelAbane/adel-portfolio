/**
 * The 404 page's lost explorer: same pixel style and size as the hero's judokas (22 × 26, then a
 * 1px outline from judo.ts, so 24 × 28). A safari hat, a big backpack peeking out on both sides,
 * and a map held the wrong way up (its north arrow points down). Two idle frames: looking left,
 * then right.
 */
import { outline, type PixelMap } from './judo';

export const npcPalette = {
  k: '#D9C08A', // hat, lit
  K: '#B89A5E', // hat
  b: '#6B4A2B', // hat band
  H: '#4A2E1C', // hair
  S: '#E2B48E', // skin
  s: '#B98563', // skin shadow
  E: '#06101F', // eyes
  m: '#A8644C', // mouth
  T: '#5E7F4A', // shirt
  t: '#45613A', // shirt shadow
  r: '#3A2A1C', // backpack straps
  p: '#B4652E', // backpack
  P: '#8A4A1F', // backpack shadow
  M: '#F3E7C9', // map paper
  x: '#8C6A43', // map lines
  X: '#E5484D', // the red X, and the north arrow's tip
  L: '#8C7650', // shorts
  l: '#6E5B3C', // shorts shadow
  c: '#F2F6FF', // socks
  U: '#4A3424', // boots
  O: '#0A0F1E', // outline
};

const head = (eyes: 'left' | 'right'): PixelMap => [
  '........kkkkkk........',
  '.......kKKKKKKk.......',
  '.......KbbbbbbK.......',
  '....kkkKKKKKKKKkkk....',
  '.......HSSSSSSH.......',
  eyes === 'left' ? '.......sESSSESS.......' : '.......SSESSSEs.......',
  '.......SSSSsSSS.......',
  '........SSmmSS........',
  '.........SSSS.........',
];

const body: PixelMap = [
  '....ppTTrTTTTrTTpp....',
  '...pppTTrTTTTrTTppp...',
  '...pPpSMMMMMMMMSpPp...',
  '...pPpSMxMMMMxMSpPp...',
  '...pppTMxMMXMxMTppp...',
  '...pPpTMxMMMxMMTpPp...',
  '...pPpTXXXMMMMMTpPp...',
  '...pppTMXMMMMMMTppp...',
  '....ppTTTTTTTTTTpp....',
  '......LLLLLLLLLL......',
  '......LLLLllLLLL......',
  '......LLLl..lLLL......',
  '.......SSs..sSS.......',
  '.......SSs..sSS.......',
  '.......ccc..ccc.......',
  '......UUUU..UUUU......',
  '......UUUU..UUUU......',
];

export const npcFrames = [outline([...head('left'), ...body]), outline([...head('right'), ...body])];
