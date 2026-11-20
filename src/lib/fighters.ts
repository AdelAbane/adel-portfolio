/**
 * The hero's judo fighters: palettes and hairstyles laid over the shared frames of judo.ts. Small
 * on purpose: the page's script imports it to pick a new pair each loop (judo.ts runs at build time).
 */

export const HAIR_STYLES = ['short', 'buzz', 'ponytail', 'bun', 'braids', 'afro', 'tied'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export type Gi = 'white' | 'blue';

export const giColours: Record<Gi, { W: string; w: string; g: string }> = {
  white: { W: '#F2F6FF', w: '#D3DEF0', g: '#9FB1CF' },
  blue: { W: '#4A8BF0', w: '#2B6CDB', g: '#1A4699' },
};

const skins = {
  fair: { S: '#F3CDB0', s: '#D5A386', m: '#CF8F78' },
  light: { S: '#E8B896', s: '#C48D6A', m: '#C27D66' },
  lightMedium: { S: '#E0AC86', s: '#B07A55', m: '#BE8466' },
  medium: { S: '#D29A74', s: '#A86F4E', m: '#B0745A' },
  tan: { S: '#B97E56', s: '#8E5A37', m: '#94603F' },
  brown: { S: '#8D5A3B', s: '#6A3F26', m: '#6E4129' },
  deep: { S: '#6B4129', s: '#4C2C1A', m: '#522F1D' },
};

const hairColours = {
  brown: { H: '#3A2216', h: '#6E4630' },
  black: { H: '#15161C', h: '#454B60' },
  blonde: { H: '#B98A3E', h: '#E2C072' },
  auburn: { H: '#7A3420', h: '#A8553A' },
  darkBrown: { H: '#24160F', h: '#4E3426' },
};

const belts = { black: '#111111', brown: '#5A3A22', green: '#2E9E4F', orange: '#F08A24' };

export interface Fighter {
  style: HairStyle;
  /** Women wear a white T-shirt under the gi (inside the lapels) */
  tshirt: boolean;
  colours: { S: string; s: string; m: string; H: string; h: string; B: string };
}

const fighter = (style: HairStyle, tshirt: boolean, skin: keyof typeof skins, hair: keyof typeof hairColours, belt: keyof typeof belts): Fighter => ({
  style,
  tshirt,
  colours: { ...skins[skin], ...hairColours[hair], B: belts[belt] },
});

/** The roster: a random pair each loop (see Hero.astro). The first two are the no-JS defaults */
export const fighters: Fighter[] = [
  fighter('short', false, 'medium', 'brown', 'black'),
  fighter('buzz', false, 'lightMedium', 'black', 'brown'),
  fighter('ponytail', true, 'light', 'blonde', 'brown'),
  fighter('braids', true, 'deep', 'black', 'black'),
  fighter('afro', true, 'brown', 'darkBrown', 'orange'),
  fighter('bun', true, 'fair', 'auburn', 'green'),
  fighter('tied', false, 'tan', 'black', 'green'),
  fighter('buzz', false, 'deep', 'black', 'orange'),
];

/** CSS custom properties for one fighter in one gi (the sprites fill with var(--j-<letter>)) */
export function fighterVars(f: Fighter, gi: Gi): Record<string, string> {
  const c = { ...f.colours, ...giColours[gi], n: f.tshirt ? '#FFFFFF' : f.colours.s };
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [`--j-${k}`, v]));
}
