/**
 * Invariants that must hold for every blank, and the measurements the OPTIMUM one is
 * built from.
 *
 * `layout.spec.ts` checks the pausal profile against its vector reference. This checks
 * what cannot come from a reference: that a blank fits the sheet, that nothing collides,
 * and that the OPTIMUM figures are the ones measured off the scans rather than drifted
 * values.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jsQR from 'jsqr';
import { optimumProfile, PROFILES, type ProfileId } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';
import { buildIpsPayload } from '../src/ips/payload.ts';
import { rasterise } from '../tools/inkMetrics.ts';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Box, Label, Rule } from '../src/layout/types.ts';

const fonts = {
  regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
  bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
  narrow: readFileSync('src/assets/fonts/RobotoCondensed-Regular.ttf'),
};

const slip: Slip = {
  ...emptySlip('t'),
  platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
  svrhaUplate: 'Uplata po računu za el. energiju',
  primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
  oblikPlacanja: '1',
  osnovPlacanja: '21',
  valuta: 'RSD',
  iznos: '5.200,00',
  racunPrimaoca: '845-0000000404849-87',
  model: '97',
  pozivNaBroj: '18163220000111111',
};

const ids = Object.keys(PROFILES) as ProfileId[];

describe.each(ids)('the %s blank', (id) => {
  const profile = PROFILES[id];
  const boxes = profile.primitives.filter((p): p is Box => p.kind === 'box');
  const rules = profile.primitives.filter((p): p is Rule => p.kind === 'rule');

  it('is a 210 x 99 mm cell', () => {
    expect(profile.width).toBe(210);
    expect(profile.height).toBe(99);
  });

  it('keeps every element inside the printable area', () => {
    const MARGIN = 3; // Epson EcoTank L3280 minimum
    for (const box of boxes) {
      expect(box.x, `${box.id} left`).toBeGreaterThanOrEqual(MARGIN);
      expect(box.x + box.w, `${box.id} right`).toBeLessThanOrEqual(210 - MARGIN);
      expect(box.y + box.h, `${box.id} bottom`).toBeLessThanOrEqual(profile.height);
    }
    for (const rule of rules) {
      expect(Math.min(rule.x0, rule.x1), `${rule.id} left`).toBeGreaterThanOrEqual(MARGIN);
      expect(Math.max(rule.x0, rule.x1), `${rule.id} right`).toBeLessThanOrEqual(210 - MARGIN);
      expect(Math.max(rule.y0, rule.y1), `${rule.id} bottom`).toBeLessThanOrEqual(profile.height);
    }
  });

  it('leaves the QR clear of every drawn element', () => {
    const { x, y, size } = profile.qr;
    for (const item of [...boxes, ...rules]) {
      const b =
        'w' in item
          ? { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h }
          : {
              x0: Math.min(item.x0, item.x1),
              y0: Math.min(item.y0, item.y1),
              x1: Math.max(item.x0, item.x1),
              y1: Math.max(item.y0, item.y1),
            };
      const overlaps = b.x0 < x + size && b.x1 > x && b.y0 < y + size && b.y1 > y;
      expect(overlaps, `the QR overlaps "${item.id}"`).toBe(false);
    }
  });

  it('carries every element the form requires', () => {
    const ids = boxes.map((b) => b.id);
    for (const field of ['sifraPlacanja', 'valuta', 'iznos', 'racunPrimaoca', 'model', 'pozivNaBroj', 'hitno']) {
      expect(ids, `${field} box`).toContain(field);
    }
    const labels = profile.primitives.filter((p) => p.kind === 'label').map((p) => p.text);
    for (const text of ['НАЛОГ ЗА УПЛАТУ', 'платилац', 'сврха уплате', 'прималац', 'ХИТНО', 'Образац бр. 1']) {
      expect(labels, `label ${text}`).toContain(text);
    }
  });

  it('fills every field with a slot', () => {
    const slotted = profile.slots.map((s) => s.field);
    for (const box of boxes) expect(slotted, `slot for ${box.id}`).toContain(box.id);
  });

  it('never lets two pieces of pre-printed wording collide', async () => {
    // Found by eye on the OPTIMUM blank: the title had been placed by estimate rather
    // than measurement and ran into the "износ" caption beneath it.
    //
    // The boxes are computed from the font rather than read back with pdftotext, which
    // groups neighbouring text into one line — that grouping is exactly what let the
    // original collision through an earlier version of this test.
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const regular = await pdf.embedFont(fonts.regular);
    const bold = await pdf.embedFont(fonts.bold);
    const MM = 72 / 25.4;
    /** Ascender and descender as fractions of the point size, measured on output. */
    const ASCENT = 0.72;
    const DESCENT = 0.21;

    const boxesOf = profile.primitives
      .filter((p): p is Label => p.kind === 'label')
      .map((label) => {
        const font = label.bold ? bold : regular;
        const w = font.widthOfTextAtSize(label.text, label.size) / MM;
        const x =
          label.anchorRight !== undefined
            ? label.anchorRight - w
            : label.anchorCentre !== undefined
              ? label.anchorCentre - w / 2
              : label.x;
        const size = label.size * (25.4 / 72);
        return { text: label.text, x, w, y: label.baseline - ASCENT * size, h: (ASCENT + DESCENT) * size };
      });

    for (let a = 0; a < boxesOf.length; a += 1) {
      for (let b = a + 1; b < boxesOf.length; b += 1) {
        const one = boxesOf[a];
        const two = boxesOf[b];
        const overlaps =
          one.x < two.x + two.w && one.x + one.w > two.x &&
          one.y < two.y + two.h && one.y + one.h > two.y;
        expect(overlaps, `"${one.text}" overlaps "${two.text}"`).toBe(false);
      }
    }
  });

  it('renders a readable QR carrying the slip', async () => {
    const dir = mkdtempSync(join(tmpdir(), `profile-${id}-`));
    const path = join(dir, 'out.pdf');
    const { bytes, qr } = await renderDocument([slip], { profile, fonts });
    writeFileSync(path, bytes);
    const raster = rasterise(path, { dpi: 300 });
    const rgba = new Uint8ClampedArray(raster.width * raster.height * 4);
    for (let i = 0; i < raster.pixels.length; i += 1) {
      const v = raster.pixels[i];
      rgba.set([v, v, v, 255], i * 4);
    }
    const decoded = jsQR(rgba, raster.width, raster.height);
    rmSync(dir, { recursive: true, force: true });

    expect(qr[0].tooDense).toBe(false);
    expect(decoded, 'the QR could not be read off the page').not.toBeNull();
    expect(decoded!.data).toBe(buildIpsPayload(slip).text);
  });
});

describe('the OPTIMUM blank reproduces the scans', () => {
  // Measured with tools/measure_blank.py across nine scans. Scale is absolute, taken
  // from each scan's own page size, so these are millimetres and not ratios.
  const boxes = optimumProfile.primitives.filter((p): p is Box => p.kind === 'box');
  const rules = optimumProfile.primitives.filter((p): p is Rule => p.kind === 'rule');
  const blockTop = rules.filter((r) => r.id.endsWith('-top')).sort((a, b) => a.y0 - b.y0);

  it('has blocks 90.7 mm wide, against the reference 89.75', () => {
    const top = blockTop[0];
    expect(Math.abs(top.x1 - top.x0)).toBeCloseTo(90.71, 1);
  });

  it('has blocks 15.1 mm tall, against the reference 13.96', () => {
    const left = rules.find((r) => r.id === 'platilac-left')!;
    expect(Math.abs(left.y1 - left.y0)).toBeCloseTo(15.12, 1);
  });

  it('spaces the blocks 21.2 mm apart, against the reference 19.45', () => {
    expect(blockTop[1].y0 - blockTop[0].y0).toBeCloseTo(21.25, 1);
  });

  it('puts the separator 7.0 mm past the blocks, against the reference 6.0', () => {
    const separator = rules.find((r) => r.id === 'columnSeparator')!;
    expect(separator.x0 - blockTop[0].x1).toBeCloseTo(7.02, 1);
  });

  it('makes the framed fields 6.1 mm tall, against the reference 5.98', () => {
    for (const id of ['sifraPlacanja', 'valuta', 'iznos', 'model', 'pozivNaBroj']) {
      expect(boxes.find((b) => b.id === id)!.h, id).toBeCloseTo(6.1, 1);
    }
  });
});
