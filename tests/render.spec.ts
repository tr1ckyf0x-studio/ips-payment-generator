/**
 * The rendered PDF must contain what the layout spec says, at the right place on the
 * sheet.
 *
 * This closes the loop: the spec is checked against the reference in `layout.spec.ts`,
 * and here the output is checked against the spec by parsing the generated PDF back
 * with the same extractor. Between them, a coordinate that reaches paper wrong has to
 * be wrong in both directions to escape.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, PrintScaling } from 'pdf-lib';
import { extractGeometry } from '../tools/extractGeometry.ts';
import { pausalProfile } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { A4_HEIGHT, A4_WIDTH } from '../src/layout/paginate.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';
import type { Box, Rule } from '../src/layout/types.ts';

const TOLERANCE_MM = 0.25;

const fonts = {
  regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
  bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
  narrow: readFileSync('src/assets/fonts/RobotoCondensed-Regular.ttf'),
};

function slip(n: number): Slip {
  return {
    ...emptySlip(`s${n}`),
    platilac: `PAYER ${n}\nADDRESS ${n}`,
    svrhaUplate: `Uplata po računu ${n}`,
    primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
    oblikPlacanja: '1',
    osnovPlacanja: '21',
    iznos: '5.200,00',
    racunPrimaoca: '845000000040484987',
    model: '97',
    pozivNaBroj: '14123412',
  };
}

let dir: string;

async function render(slips: Slip[]): Promise<string> {
  const { bytes } = await renderDocument(slips, { profile: pausalProfile, fonts });
  const path = join(dir, `out-${slips.length}-${Math.random().toString(36).slice(2)}.pdf`);
  writeFileSync(path, bytes);
  return path;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'render-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const allBoxes = pausalProfile.primitives.filter((p): p is Box => p.kind === 'box');
const boxes = allBoxes.filter((b) => !b.beyondReference);
const rules = pausalProfile.primitives.filter((p): p is Rule => p.kind === 'rule');

describe('rendered PDF', () => {
  it('is A4', async () => {
    const geometry = extractGeometry(await render([slip(1)]));
    expect(geometry.pageWidth).toBeCloseTo(A4_WIDTH, 1);
    expect(geometry.pageHeight).toBeCloseTo(A4_HEIGHT, 1);
  });

  it.each([
    { cell: 0, offsetY: 0 },
    { cell: 1, offsetY: 99 },
    { cell: 2, offsetY: 198 },
  ])('places cell $cell at $offsetY mm with the spec geometry', async ({ offsetY }) => {
    const path = await render([slip(1), slip(2), slip(3)]);
    const geometry = extractGeometry(path, { origin: { x: 0, y: offsetY } });

    for (const box of boxes) {
      const nearest = Math.min(
        ...geometry.rects.map((r) =>
          Math.max(
            Math.abs(r.x - box.x),
            Math.abs(r.y - box.y),
            Math.abs(r.w - box.w),
            Math.abs(r.h - box.h),
          ),
        ),
      );
      expect(nearest, `box "${box.id}" in cell at ${offsetY}mm`).toBeLessThanOrEqual(TOLERANCE_MM);
    }

    for (const rule of rules) {
      const nearest = Math.min(
        ...geometry.lines.map((l) =>
          Math.max(
            Math.abs(l.x0 - rule.x0),
            Math.abs(l.y0 - rule.y0),
            Math.abs(l.x1 - rule.x1),
            Math.abs(l.y1 - rule.y1),
          ),
        ),
      );
      expect(nearest, `rule "${rule.id}" in cell at ${offsetY}mm`).toBeLessThanOrEqual(TOLERANCE_MM);
    }
  });

  it('draws a dashed cut guide after each slip on the sheet', async () => {
    // One slip, one guide: the empty cells below it are blank paper, and a line across
    // them would mark a cut that separates nothing.
    const one = extractGeometry(await render([slip(1)]));
    expect(one.lines.filter((l) => l.dashed).map((g) => Math.round(g.y0))).toEqual([99]);

    const geometry = extractGeometry(await render([slip(1), slip(2), slip(3)]));
    const guides = geometry.lines.filter((l) => l.dashed);

    expect(guides.map((g) => Math.round(g.y0))).toEqual([99, 198]);

    // A dashed rule is reported by its first and last *dash*, so the far end falls
    // short by up to one on/off period.
    const DASH_PERIOD = 4;
    for (const guide of guides) {
      expect(guide.x0).toBeCloseTo(0, 1);
      expect(guide.x1).toBeGreaterThan(A4_WIDTH - DASH_PERIOD);
      expect(guide.x1).toBeLessThanOrEqual(A4_WIDTH);
      expect(guide.y0).toBeCloseTo(guide.y1, 2);
    }
  });

  it.each([
    { count: 1, sheets: 1 },
    { count: 3, sheets: 1 },
    { count: 4, sheets: 2 },
    { count: 7, sheets: 3 },
  ])('puts $count slips on $sheets sheets', async ({ count, sheets }) => {
    const path = await render(Array.from({ length: count }, (_, i) => slip(i)));
    const perSheet = allBoxes.length;
    const firstPage = extractGeometry(path, { page: 1 });
    expect(firstPage.rects.length).toBe(perSheet * Math.min(count, 3));

    const lastPage = extractGeometry(path, { page: sheets });
    expect(lastPage.rects.length).toBe(perSheet * (count - (sheets - 1) * 3));
  });

  it('keeps every drawn element inside the printable area', async () => {
    const geometry = extractGeometry(await render([slip(1), slip(2), slip(3)]));
    const MARGIN = 3;
    const solid = geometry.lines.filter((l) => !l.dashed);

    for (const rect of geometry.rects) {
      expect(rect.x).toBeGreaterThanOrEqual(MARGIN);
      expect(rect.x + rect.w).toBeLessThanOrEqual(A4_WIDTH - MARGIN);
      expect(rect.y).toBeGreaterThanOrEqual(MARGIN);
      expect(rect.y + rect.h).toBeLessThanOrEqual(A4_HEIGHT - MARGIN);
    }
    for (const line of solid) {
      expect(Math.min(line.y0, line.y1)).toBeGreaterThanOrEqual(MARGIN);
      expect(Math.max(line.y0, line.y1)).toBeLessThanOrEqual(A4_HEIGHT - MARGIN);
    }
  });

  it('asks the reader not to rescale it when printing', async () => {
    // The whole point of this document is that it comes out 210 x 99 mm, and every
    // print dialog offers to fit it to the page instead. Acrobat and Preview honour
    // `/PrintScaling /None` and open at actual size; Chrome ignores it, which is why
    // the form says so in words as well. Asking costs one dictionary entry.
    const pdf = await PDFDocument.load(await renderDocument([slip(1)], {
      profile: pausalProfile,
      fonts,
    }).then((r) => r.bytes));

    expect(pdf.catalog.getViewerPreferences()?.getPrintScaling()).toBe(PrintScaling.None);
  });
});
