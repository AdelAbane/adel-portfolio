export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

/**
 * Turns a pixel map (one string per row, one character per pixel) into SVG rects.
 * Runs of the same color on a row are merged into a single rect.
 * Characters missing from the palette (e.g. ".") are left empty.
 */
export function pixelRects(map: string[], palette: Record<string, string>, size: number): PixelRect[] {
  const rects: PixelRect[] = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === char) end++;
      if (palette[char]) {
        rects.push({ x: x * size, y: y * size, width: (end - x) * size, height: size, fill: palette[char] });
      }
      x = end;
    }
  });
  return rects;
}
