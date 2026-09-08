/**
 * Long values must shrink rather than overrun their field.
 *
 * The unit tests below use a fake measurer so the arithmetic is checked exactly; the
 * rendering test at the end proves the real font goes through the same path and that
 * nothing lands outside its slot on the page.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fitSize, LEGIBLE_SIZE_PT, type Measure } from '../src/layout/fitText.ts';
import { extractText } from '../tools/extractGeometry.ts';
import { pausalProfile } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';

/** One millimetre per character per point of size — linear, like real text. */
const measure: Measure = (text, size) => text.length * size;

describe('fitSize', () => {
  it('leaves a value that already fits at its full size', () => {
    expect(fitSize(['abc'], 100, 10, measure)).toEqual({ size: 10, scale: 1 });
  });

  it('shrinks just enough for the widest line to fit exactly', () => {
    // 'abcde' is 5 * 10 = 50 mm at size 10; a 25 mm field halves it.
    expect(fitSize(['abcde'], 25, 10, measure)).toEqual({ size: 5, scale: 0.5 });
  });

  it('sizes all lines by the widest of them', () => {
    const { size } = fitSize(['ab', 'abcdefgh'], 40, 10, measure);
    // The long line drives it: 8 chars * 10 = 80 mm into 40 mm.
    expect(size).toBe(5);
  });

  it('treats an empty value as fitting', () => {
    expect(fitSize([], 20, 10, measure)).toEqual({ size: 10, scale: 1 });
    expect(fitSize([''], 20, 10, measure)).toEqual({ size: 10, scale: 1 });
  });

  it('never grows a short value beyond the slot size', () => {
    expect(fitSize(['a'], 1000, 10, measure).size).toBe(10);
  });

  it('reports the scale so a caller can warn about unreadable results', () => {
    const { size, scale } = fitSize(['a'.repeat(40)], 100, 10, measure);
    expect(scale).toBeCloseTo(0.25, 5);
    expect(size).toBeLessThan(LEGIBLE_SIZE_PT);
  });
});

describe('long values on the page', () => {
  const fonts = {
    regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
    bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
    narrow: readFileSync('src/assets/fonts/RobotoCondensed-Regular.ttf'),
  };

  const longSlip: Slip = {
    ...emptySlip('long'),
    platilac: 'PETAR PETROVIĆ PREDUZETNIK ZA RAZVOJ SOFTVERA I SAVETOVANJE',
    svrhaUplate: 'Uplata po računu za el. energiju za januar',
    primalac: 'JP ELEKTROPRIVREDA SRBIJE, BALKANSKA 13, 11000 BEOGRAD, SRBIJA',
    oblikPlacanja: '1',
    osnovPlacanja: '21',
    valuta: 'RSD',
    iznos: '1.234.567.890,00',
    racunPrimaoca: '845000000040484987',
    model: '97',
    pozivNaBroj: '14123412',
  };

  async function render(slip: Slip) {
    const dir = mkdtempSync(join(tmpdir(), 'fit-'));
    const path = join(dir, 'out.pdf');
    const { bytes, shrunk } = await renderDocument([slip], { profile: pausalProfile, fonts });
    writeFileSync(path, bytes);
    const text = extractText(path);
    rmSync(dir, { recursive: true, force: true });
    return { text, shrunk };
  }

  it('keeps every long value inside its slot', async () => {
    const { text } = await render(longSlip);

    // Check the slip's own values, found by their content — matching by position would
    // also pick up the blank's pre-printed wording, which shares these coordinates.
    const expected: Array<[string, string]> = [
      ['platilac', longSlip.platilac],
      ['svrhaUplate', longSlip.svrhaUplate],
      ['primalac', longSlip.primalac],
      ['iznos', longSlip.iznos],
      ['racunPrimaoca', '845-0000000404849-87'],
      ['pozivNaBroj', longSlip.pozivNaBroj],
    ];

    for (const [field, value] of expected) {
      const slot = pausalProfile.slots.find((s) => s.field === field)!;
      for (const line of value.split('\n')) {
        const item = text.find((t) => t.text === line);
        expect(item, `"${line}" is missing from the page`).toBeDefined();
        expect(item!.x, `${field} starts left of its field`).toBeGreaterThanOrEqual(slot.x - 0.5);
        expect(
          item!.x + item!.w,
          `${field} runs past its field: "${line}"`,
        ).toBeLessThanOrEqual(slot.x + slot.w + 0.5);
      }
    }
  });

  it('reports which fields it had to shrink', async () => {
    const { shrunk } = await render(longSlip);
    const fields = shrunk.map((s) => s.field);
    expect(fields).toContain('platilac');
    expect(fields).toContain('primalac');
    for (const entry of shrunk) {
      expect(entry.size).toBeLessThan(entry.baseSize);
      expect(entry.slipId).toBe('long');
    }
  });

  it('leaves ordinary values untouched', async () => {
    const { shrunk } = await render({
      ...emptySlip('short'),
      platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
      primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
      svrhaUplate: 'Uplata po računu za el. energiju',
      oblikPlacanja: '1',
      osnovPlacanja: '21',
      valuta: 'RSD',
      iznos: '5.200,00',
      racunPrimaoca: '845000000040484987',
      model: '97',
      pozivNaBroj: '14123412',
    });
    expect(shrunk).toEqual([]);
  });

  it('sets values at the size calibrated against a real filled slip', async () => {
    const { text } = await render({ ...emptySlip('typical'), platilac: 'PETAR PETROVIĆ' });
    const line = text.find((t) => t.text === 'PETAR PETROVIĆ');
    // 10 pt is the size at which the payer line on references/scans/optimum-2026-09-04
    // came out at its measured 31.90 mm. That scan's text cannot be used here, so this
    // pins the same size through a neutral string: a change of face or size moves it.
    expect(line!.w).toBeGreaterThan(24.0);
    expect(line!.w).toBeLessThan(25.3);
  });
});
