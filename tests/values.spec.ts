/**
 * Slip data must reach the paper, in the right field.
 *
 * `render.spec.ts` proves the blank is drawn where the reference has it; this proves
 * the values land in it. Positions are checked against the slot geometry, so a value
 * printed into the wrong box fails here even though the box itself is correct.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractText } from '../tools/extractGeometry.ts';
import { pausalProfile } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';
import { inkBox, rasterise } from '../tools/inkMetrics.ts';
import type { Box } from '../src/layout/types.ts';

const fonts = {
  regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
  bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
  narrow: readFileSync('src/assets/fonts/RobotoCondensed-Regular.ttf'),
};

const filled: Slip = {
  ...emptySlip('a'),
  platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
  svrhaUplate: 'Uplata po računu za el. energiju',
  primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
  oblikPlacanja: '1',
  osnovPlacanja: '21',
  valuta: 'RSD',
  iznos: '5.200,00',
  racunPrimaoca: '845000000040484987',
  model: '97',
  pozivNaBroj: '14123412',
};

const dir = mkdtempSync(join(tmpdir(), 'values-'));

async function textOf(slips: Slip[], page = 1) {
  const { bytes } = await renderDocument(slips, { profile: pausalProfile, fonts });
  const path = join(dir, `v-${Math.random().toString(36).slice(2)}.pdf`);
  writeFileSync(path, bytes);
  const text = extractText(path, { page });
  rmSync(path, { force: true });
  return text;
}

function slotOf(field: string) {
  const slot = pausalProfile.slots.find((s) => s.field === field);
  if (!slot) throw new Error(`no slot for ${field}`);
  return slot;
}

describe('slip values on the page', () => {
  it.each([
    { field: 'sifraPlacanja', text: '121' },
    { field: 'valuta', text: 'RSD' },
    { field: 'iznos', text: '5.200,00' },
    { field: 'racunPrimaoca', text: '845-0000000404849-87' },
    { field: 'model', text: '97' },
    { field: 'pozivNaBroj', text: '14123412' },
  ])('prints $text inside the $field slot', async ({ field, text }) => {
    const items = await textOf([filled]);
    const found = items.find((t) => t.text === text);
    expect(found, `"${text}" is missing from the page`).toBeDefined();

    const slot = slotOf(field);
    // Horizontally within the slot, vertically on its baseline.
    expect(found!.x).toBeGreaterThanOrEqual(slot.x - 0.5);
    expect(found!.x + found!.w).toBeLessThanOrEqual(slot.x + slot.w + 0.5);
    expect(found!.y + found!.h).toBeGreaterThan(slot.baseline - 1.5);
    expect(found!.y).toBeLessThan(slot.baseline);
  });

  it('composes the payment code from its two halves', async () => {
    const items = await textOf([filled]);
    expect(items.some((t) => t.text === '121')).toBe(true);
  });

  it.each([
    { half: 'oblikPlacanja', slip: { ...filled, oblikPlacanja: '' } },
    { half: 'osnovPlacanja', slip: { ...filled, osnovPlacanja: '' } },
  ])('prints no payment code while $half is unset', async ({ slip }) => {
    const items = await textOf([slip]);
    expect(items.some((t) => t.text === '121' || t.text === '1' || t.text === '21')).toBe(false);
  });

  it('prints every line of a multi-line block', async () => {
    const items = await textOf([filled]);
    for (const line of ['PETAR PETROVIĆ', 'KNEZ MIHAILOVA 1, BEOGRAD', 'JP EPS BEOGRAD']) {
      expect(items.some((t) => t.text === line), line).toBe(true);
    }
  });

  it('drops block lines beyond the three the blank prints', async () => {
    const items = await textOf([{ ...filled, platilac: 'ONE\nTWO\nTHREE\nFOUR' }]);
    expect(items.some((t) => t.text === 'THREE')).toBe(true);
    expect(items.some((t) => t.text === 'FOUR')).toBe(false);
  });

  it('leaves the blank empty rather than printing placeholders', async () => {
    const items = await textOf([emptySlip('empty')]);
    const labels = pausalProfile.primitives
      .filter((p) => p.kind === 'label')
      .map((p) => p.text);
    // Only pre-printed wording, plus the currency the empty slip defaults to.
    for (const item of items) {
      expect(labels.includes(item.text) || item.text === 'RSD', `unexpected "${item.text}"`).toBe(true);
    }
  });

  it('leaves the reception and execution dates for the bank to fill in', async () => {
    // These two are written by the bank or menjačnica when it takes the payment, so the
    // form does not collect them and nothing is printed into them...
    expect(pausalProfile.slots.map((s) => s.field)).not.toContain('mestoIDatumPrijema');
    expect(pausalProfile.slots.map((s) => s.field)).not.toContain('datumIzvrsenja');

    // ...but the blank must still carry their wording and the rules to write above.
    const primitives = pausalProfile.primitives;
    const labels = primitives.filter((p) => p.kind === 'label').map((p) => p.text);
    expect(labels).toContain('место и датум пријема');
    expect(labels).toContain('датум извршења');
    expect(primitives.some((p) => p.kind === 'rule' && p.id === 'mestoIDatumRule')).toBe(true);
    expect(primitives.some((p) => p.kind === 'rule' && p.id === 'datumIzvrsenjaRule')).toBe(true);

    const items = await textOf([filled]);
    expect(items.some((t) => t.text === 'место и датум пријема')).toBe(true);
    expect(items.some((t) => t.text === 'датум извршења')).toBe(true);
  });

  it('centres each framed value in its box, horizontally and vertically', async () => {
    const bytes = (await renderDocument([filled], { profile: pausalProfile, fonts })).bytes;
    const path = join(dir, 'centred.pdf');
    writeFileSync(path, bytes);
    const raster = rasterise(path, { dpi: 600 });

    const boxes = pausalProfile.primitives.filter(
      (p): p is Box => p.kind === 'box' && p.id !== 'hitno',
    );
    for (const box of boxes) {
      // Measured strictly inside the outline so the box's own rule is not counted.
      const inset = box.stroke + 0.25;
      const ink = inkBox(raster, {
        x: box.x + inset,
        y: box.y + inset,
        w: box.w - 2 * inset,
        h: box.h - 2 * inset,
      });
      expect(ink, `${box.id} has no value drawn`).toBeDefined();

      const boxCentreX = box.x + box.w / 2;
      const boxCentreY = box.y + box.h / 2;
      const inkCentreX = ink!.x + ink!.w / 2;
      const inkCentreY = ink!.y + ink!.h / 2;

      expect(
        Math.abs(inkCentreX - boxCentreX),
        `${box.id} is off-centre horizontally by ${(inkCentreX - boxCentreX).toFixed(2)}mm`,
      ).toBeLessThan(0.3);
      // Digits have no descenders, so their ink is the cap band; centring that band is
      // what reads as centred.
      expect(
        Math.abs(inkCentreY - boxCentreY),
        `${box.id} is off-centre vertically by ${(inkCentreY - boxCentreY).toFixed(2)}mm`,
      ).toBeLessThan(0.3);
    }
    rmSync(path, { force: true });
  });

  describe('način izvršenja - hitno', () => {
    // Prilog 2 of the decision: "u element način izvršenja - hitno upisuje se opisno
    // slovna oznaka H". A slip carrying it for up to 300,000 dinars must be executed as
    // an instant transfer.
    const box = pausalProfile.primitives.find((p) => p.kind === 'box' && p.id === 'hitno');

    it('draws the box and its caption, which the pausal reference lacks', async () => {
      expect(box).toBeDefined();
      expect(box!.kind === 'box' && box!.beyondReference).toBe(true);
      const items = await textOf([filled]);
      expect(items.some((t) => t.text === 'ХИТНО')).toBe(true);
    });

    it('prints H when the slip is marked urgent', async () => {
      const items = await textOf([{ ...filled, hitno: true }]);
      const mark = items.find((t) => t.text === 'H');
      expect(mark, 'the H mark is missing').toBeDefined();

      // Checked by the mark's centre: a text bounding box carries the font's ascender
      // and descender room, so its edges sit outside the letter's own ink.
      if (box!.kind !== 'box') throw new Error('hitno is not a box');
      const centreX = mark!.x + mark!.w / 2;
      const centreY = mark!.y + mark!.h / 2;
      expect(centreX, 'H is not horizontally inside its box').toBeGreaterThan(box!.x);
      expect(centreX).toBeLessThan(box!.x + box!.w);
      expect(centreY, 'H is not vertically inside its box').toBeGreaterThan(box!.y);
      expect(centreY).toBeLessThan(box!.y + box!.h);
    });

    it('leaves the box empty when the slip is not urgent', async () => {
      const items = await textOf([{ ...filled, hitno: false }]);
      expect(items.some((t) => t.text === 'H')).toBe(false);
    });
  });

  it('keeps each slip on its own cell of the sheet', async () => {
    const second: Slip = { ...filled, id: 'b', iznos: '1.111,11' };
    const items = await textOf([filled, second]);
    const first = items.find((t) => t.text === '5.200,00');
    const other = items.find((t) => t.text === '1.111,11');
    expect(first).toBeDefined();
    expect(other).toBeDefined();
    expect(other!.y - first!.y).toBeCloseTo(pausalProfile.height, 1);
  });
});
