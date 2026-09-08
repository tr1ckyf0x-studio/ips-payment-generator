/**
 * Measures where the ink actually lands on a rendered page.
 *
 * `pdftotext -bbox` reports a box derived from the font's metrics, which is only
 * comparable between two PDFs when both use the same font. The reference blank does not
 * embed its Arial, so poppler substitutes one and reports that substitute's metrics —
 * matching those boxes made our labels sit visibly lower than the reference's, with the
 * descender of "платилац" crossing the rule below it.
 *
 * Rasterising and looking at the pixels avoids the whole problem: ink is ink.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Raster {
  width: number;
  height: number;
  dpi: number;
  pixels: Uint8Array;
}

export interface InkBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Renders one page to an 8-bit greyscale raster. */
export function rasterise(pdfPath: string, { dpi = 600, page = 1 } = {}): Raster {
  const dir = mkdtempSync(join(tmpdir(), 'ink-'));
  try {
    execFileSync('pdftoppm', [
      '-gray', '-r', String(dpi), '-f', String(page), '-l', String(page),
      pdfPath, join(dir, 'p'),
    ]);
    const file = readdirSync(dir).find((f) => f.endsWith('.pgm'));
    if (!file) throw new Error('pdftoppm produced no PGM');
    const data = readFileSync(join(dir, file));

    // PGM header: P5 <width> <height> <maxval>, with # comments allowed between.
    const tokens: string[] = [];
    let i = 0;
    while (tokens.length < 4) {
      while (/\s/.test(String.fromCharCode(data[i]))) i += 1;
      if (data[i] === 0x23) {
        while (data[i] !== 0x0a) i += 1;
        continue;
      }
      let j = i;
      while (!/\s/.test(String.fromCharCode(data[j]))) j += 1;
      tokens.push(data.subarray(i, j).toString());
      i = j;
    }
    i += 1;
    const width = Number(tokens[1]);
    const height = Number(tokens[2]);
    return { width, height, dpi, pixels: new Uint8Array(data.subarray(i, i + width * height)) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Bounding box of the ink inside a millimetre-space window, in millimetres.
 * Returns undefined when the window is blank.
 */
export function inkBox(
  raster: Raster,
  window: { x: number; y: number; w: number; h: number },
  threshold = 128,
): InkBox | undefined {
  const perMm = raster.dpi / 25.4;
  const x0 = Math.max(0, Math.floor(window.x * perMm));
  const x1 = Math.min(raster.width, Math.ceil((window.x + window.w) * perMm));
  const y0 = Math.max(0, Math.floor(window.y * perMm));
  const y1 = Math.min(raster.height, Math.ceil((window.y + window.h) * perMm));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let y = y0; y < y1; y += 1) {
    const row = y * raster.width;
    for (let x = x0; x < x1; x += 1) {
      if (raster.pixels[row + x] < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return undefined;

  return {
    x: minX / perMm,
    y: minY / perMm,
    w: (maxX - minX + 1) / perMm,
    h: (maxY - minY + 1) / perMm,
  };
}
