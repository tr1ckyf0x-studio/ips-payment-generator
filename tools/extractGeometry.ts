/**
 * Extracts stroked geometry from a PDF, in millimetres from the top-left of the page.
 *
 * Works by converting the PDF to SVG with `pdftocairo` and reading back the stroked
 * paths. The same extractor runs against both the reference blank and our own output,
 * so a layout comparison has a single code path on both sides.
 *
 * Requires poppler (`pdftocairo`, `pdftotext`) on PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PT_TO_MM = 25.4 / 72;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: number;
}

export interface Line {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stroke: number;
  dashed: boolean;
}

export interface TextItem {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

/**
 * Page size from a `pdftocairo -svg` header, in millimetres.
 *
 * Written defensively because the header is not stable across poppler versions: the
 * attribute order, the unit suffix and whether the size is given at all vary, and a
 * silent zero here reads as "the page is not A4" rather than as a parsing failure.
 * Falls back to the viewBox, whose numbers are in points either way.
 */
export function parsePageSize(svg: string): { width: number; height: number } {
  const tag = /<svg\b[^>]*>/.exec(svg)?.[0];
  if (!tag) throw new Error('no <svg> element in the pdftocairo output');

  const attribute = (name: string): number | undefined => {
    const m = new RegExp(`\\b${name}="([\\d.]+)(pt|px|mm|in)?"`).exec(tag);
    if (!m) return undefined;
    const value = Number(m[1]);
    switch (m[2]) {
      case 'mm':
        return value;
      case 'in':
        return value * 25.4;
      // px and an absent unit are user units, which cairo emits as points.
      default:
        return value * PT_TO_MM;
    }
  };

  const width = attribute('width');
  const height = attribute('height');
  if (width !== undefined && height !== undefined) return { width, height };

  const viewBox = /\bviewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"/.exec(tag);
  if (viewBox) {
    return { width: Number(viewBox[1]) * PT_TO_MM, height: Number(viewBox[2]) * PT_TO_MM };
  }

  throw new Error(`could not read the page size from: ${tag.slice(0, 200)}`);
}

export interface Geometry {
  pageWidth: number;
  pageHeight: number;
  rects: Rect[];
  lines: Line[];
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function apply(m: Matrix, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = m;
  return [a * x + c * y + e, b * x + d * y + f];
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function toSvg(pdfPath: string, page: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'geom-'));
  try {
    const out = join(dir, 'page.svg');
    execFileSync('pdftocairo', ['-svg', '-f', String(page), '-l', String(page), pdfPath, out]);
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Reads every stroked path on one page and classifies it as a rectangle or a line.
 * Coordinates are shifted by `origin`, which lets a slip inside a multi-slip sheet be
 * compared against a reference measured from the slip's own corner.
 */
export function extractGeometry(
  pdfPath: string,
  { page = 1, origin = { x: 0, y: 0 } }: { page?: number; origin?: { x: number; y: number } } = {},
): Geometry {
  const svg = toSvg(pdfPath, page);

  const size = parsePageSize(svg);
  const pageWidth = round(size.width);
  const pageHeight = round(size.height);

  const rects: Rect[] = [];
  const lines: Line[] = [];

  for (const tag of svg.match(/<path[^>]*stroke-width[^>]*\/>/g) ?? []) {
    const strokeMatch = /stroke-width="([\d.]+)"/.exec(tag);
    const dataMatch = /\sd="([^"]+)"/.exec(tag);
    if (!strokeMatch || !dataMatch) continue;

    const transform = /transform="matrix\(([^)]+)\)"/.exec(tag);
    const m: Matrix = transform
      ? (transform[1].split(',').map(Number) as Matrix)
      : IDENTITY;

    // A uniform scale in the transform also scales the pen width.
    const scale = Math.hypot(m[0], m[1]) || 1;
    const stroke = round(Number(strokeMatch[1]) * scale * PT_TO_MM);
    const dashed = /stroke-dasharray="[^"]*[\d]/.test(tag);

    const pts: Array<[number, number]> = [];
    for (const seg of dataMatch[1].matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)) {
      const [x, y] = apply(m, Number(seg[1]), Number(seg[2]));
      pts.push([x * PT_TO_MM - origin.x, y * PT_TO_MM - origin.y]);
    }
    if (pts.length < 2) continue;

    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);

    if (pts.length >= 4 && w > 0.1 && h > 0.1) {
      rects.push({ x: round(Math.min(...xs)), y: round(Math.min(...ys)), w: round(w), h: round(h), stroke });
    } else {
      lines.push({
        x0: round(pts[0][0]),
        y0: round(pts[0][1]),
        x1: round(pts[pts.length - 1][0]),
        y1: round(pts[pts.length - 1][1]),
        stroke,
        dashed,
      });
    }
  }

  const byPosition = (a: { x?: number; y?: number; x0?: number; y0?: number }, b: typeof a) =>
    (a.y ?? a.y0!) - (b.y ?? b.y0!) || (a.x ?? a.x0!) - (b.x ?? b.x0!);

  return {
    pageWidth,
    pageHeight,
    rects: rects.sort(byPosition),
    lines: lines.sort(byPosition),
  };
}

/** Reads text runs with their bounding boxes, in millimetres from the top-left. */
export function extractText(
  pdfPath: string,
  { page = 1, origin = { x: 0, y: 0 } }: { page?: number; origin?: { x: number; y: number } } = {},
): TextItem[] {
  const xml = execFileSync(
    'pdftotext',
    ['-bbox-layout', '-f', String(page), '-l', String(page), pdfPath, '-'],
    { encoding: 'utf8' },
  );

  const items: TextItem[] = [];
  for (const line of xml.matchAll(
    /<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g,
  )) {
    const [xMin, yMin, xMax, yMax] = line.slice(1, 5).map((v) => Number(v) * PT_TO_MM);
    const text = [...line[5].matchAll(/>([^<]*)<\/word>/g)].map((w) => w[1]).join(' ');
    items.push({
      x: round(xMin - origin.x),
      y: round(yMin - origin.y),
      w: round(xMax - xMin),
      h: round(yMax - yMin),
      text,
    });
  }
  return items.sort((a, b) => a.y - b.y || a.x - b.x);
}
