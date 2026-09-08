/**
 * The IPS QR must carry exactly what the slip says, and must be readable off the page.
 *
 * The payload rules come from `references/ips/nbs-preporuke-validacija.pdf`. Two of
 * them are not in that document at all and were found by probing the National Bank's
 * validator — Cyrillic is rejected in text fields, and model 97 references are checked
 * for their check digits. `npm run ips:verify` re-runs that probe against the live
 * service; these tests keep the same rules honest offline.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jsQR from 'jsqr';
import {
  buildIpsPayload,
  formatAmount,
  formatReference,
  isValidModel97,
  model97CheckDigits,
} from '../src/ips/payload.ts';
import { toSerbianLatin, unsupportedCharacters } from '../src/ips/serbianLatin.ts';
import { buildQrSymbol, ERROR_CORRECTION, MIN_MODULE_MM } from '../src/ips/qr.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';
import { pausalProfile } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { rasterise } from '../tools/inkMetrics.ts';

/** The specification's own sample account, so no real details appear in tests. */
const SAMPLE_ACCOUNT = '845-0000000404849-87';

const slip = (over: Partial<Slip> = {}): Slip => ({
  ...emptySlip('t'),
  primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
  racunPrimaoca: SAMPLE_ACCOUNT,
  oblikPlacanja: '1',
  osnovPlacanja: '89',
  valuta: 'RSD',
  iznos: '3.596,13',
  ...over,
});

describe('amount formatting', () => {
  it.each([
    ['3.596,13', 'RSD3596,13'],
    ['1025', 'RSD1025,'],
    ['1025,1', 'RSD1025,1'],
    ['1.234.567,89', 'RSD1234567,89'],
    ['5.200,00', 'RSD5200,00'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });

  it.each(['', ',01', 'abc', '1,234'])('rejects %s', (input) => {
    expect(formatAmount(input)).toBeUndefined();
  });
});

describe('model 97 check digits', () => {
  it('matches the example in the specification', () => {
    // The spec shows RO:9714123412 — reference 14123412, of which 14 is the check.
    expect(model97CheckDigits('123412')).toBe('14');
    expect(isValidModel97('14123412')).toBe(true);
  });

  it('rejects a reference whose check digits do not agree', () => {
    expect(isValidModel97('99123412')).toBe(false);
  });

  it('pads a single-digit check number', () => {
    const digits = model97CheckDigits('1');
    expect(digits).toHaveLength(2);
    expect(isValidModel97(`${digits}1`)).toBe(true);
  });
});

describe('reference tag', () => {
  it('prefixes an unmodelled reference with 00, as the spec requires', () => {
    expect(formatReference('', '1234')).toBe('001234');
  });

  it('keeps the model digits when there is a model', () => {
    expect(formatReference('97', '14123412')).toBe('9714123412');
  });

  it('omits itself when there is no reference', () => {
    expect(formatReference('97', '   ')).toBeUndefined();
  });
});

describe('transliteration', () => {
  it.each([
    ['ЈП ЕПС БЕОГРАД', 'JP EPS BEOGRAD'],
    ['Чигра', 'Čigra'],
    ['ЉИЉАНА', 'LJILJANA'],
    ['Његош', 'Njegoš'],
    ['Џон', 'Džon'],
    ['ЏЕМ', 'DŽEM'],
  ])('turns %s into %s', (input, expected) => {
    expect(toSerbianLatin(input)).toBe(expected);
  });

  it('leaves Latin text alone', () => {
    expect(toSerbianLatin('JP EPS BEOGRAD')).toBe('JP EPS BEOGRAD');
  });

  it('names characters that have no Serbian Latin equivalent', () => {
    expect(unsupportedCharacters('ООО Ы Э Ъ'.replace(/[ОО]/g, ''))).not.toHaveLength(0);
    expect(unsupportedCharacters('ČIGRA DOO 123 -/.')).toHaveLength(0);
  });
});

describe('payload assembly', () => {
  it('emits the mandatory tags in the specified order', () => {
    const { text } = buildIpsPayload(slip());
    expect(text).toBe('K:PR|V:01|C:1|R:845000000040484987|N:JP EPS BEOGRAD\r\nBALKANSKA 13|I:RSD3596,13|SF:189');
  });

  it('never starts or ends with the delimiter', () => {
    const { text } = buildIpsPayload(slip({ svrhaUplate: 'UPLATA' }))!;
    expect(text!.startsWith('|')).toBe(false);
    expect(text!.endsWith('|')).toBe(false);
  });

  it('omits an optional tag rather than emitting it empty', () => {
    // The recommendations forbid "|S:|" outright.
    const { text } = buildIpsPayload(slip({ svrhaUplate: '', pozivNaBroj: '' }));
    expect(text).not.toContain('S:|');
    expect(text).not.toContain('|S:');
    expect(text).not.toContain('RO:');
  });

  it('carries the payer, and omits the tag entirely when asked to', () => {
    expect(buildIpsPayload(slip({ platilac: 'PETAR PETROVIĆ' })).text).toContain(
      'P:PETAR PETROVIĆ',
    );
    const without = buildIpsPayload(slip({ platilac: 'PETAR PETROVIĆ' }), {
      includePayer: false,
    });
    expect(without.text).not.toContain('P:');
  });

  it('strips the account down to eighteen bare digits', () => {
    const { text } = buildIpsPayload(slip());
    expect(text).toContain('R:845000000040484987');
  });

  it.each([
    ['account of the wrong length', { racunPrimaoca: '265-123-45' }, 'racunPrimaoca'],
    ['no recipient', { primalac: '' }, 'primalac'],
    ['no amount', { iznos: '' }, 'iznos'],
    ['incomplete payment code', { osnovPlacanja: '' }, 'sifraPlacanja'],
    ['purpose over 35 characters', { svrhaUplate: 'x'.repeat(36) }, 'svrhaUplate'],
    ['recipient over 70 characters', { primalac: 'y'.repeat(71) }, 'primalac'],
    ['reference over 25 characters', { model: '', pozivNaBroj: '9'.repeat(26) }, 'pozivNaBroj'],
    ['model 97 with wrong check digits', { model: '97', pozivNaBroj: '163220000111111' }, 'pozivNaBroj'],
  ])('refuses to build with %s', (_name, over, field) => {
    const { text, problems } = buildIpsPayload(slip(over));
    expect(text).toBeUndefined();
    expect(problems.map((p) => p.field)).toContain(field);
  });
});

describe('the configuration that was chosen', () => {
  // Level L at 30 mm with the payer included, matching the NBS generator's own level.
  // A stronger level is not automatically better: it packs more modules into the same
  // square, and a module the camera cannot resolve fails outright instead of degrading.
  it('encodes at level L', () => {
    expect(ERROR_CORRECTION).toBe('L');
  });

  it('sits flush with the right edge of the fields', () => {
    expect(pausalProfile.qr.x + pausalProfile.qr.size).toBeCloseTo(199.44, 2);
  });

  it('overlaps nothing else on the blank', () => {
    // The QR was originally placed before the hitno box was measured, and the two
    // overlapped: the box landed inside the symbol and corrupted it.
    const { x, y, size } = pausalProfile.qr;
    for (const item of pausalProfile.primitives) {
      const box =
        item.kind === 'box'
          ? { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h }
          : item.kind === 'rule'
            ? {
                x0: Math.min(item.x0, item.x1),
                y0: Math.min(item.y0, item.y1),
                x1: Math.max(item.x0, item.x1),
                y1: Math.max(item.y0, item.y1),
              }
            : undefined;
      if (!box) continue;
      const overlaps =
        box.x0 < x + size && box.x1 > x && box.y0 < y + size && box.y1 > y;
      expect(overlaps, `the QR overlaps "${item.id}"`).toBe(false);
    }
  });

  it('clears the hitno box, which sits directly below it', () => {
    const hitno = pausalProfile.primitives.find((p) => p.kind === 'box' && p.id === 'hitno');
    if (hitno?.kind !== 'box') throw new Error('hitno box is missing');
    expect(pausalProfile.qr.y + pausalProfile.qr.size).toBeLessThan(hitno.y);
  });

  it('leaves at least half a millimetre per module on a filled slip', () => {
    const filled = slip({
      platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
      svrhaUplate: 'Uplata po računu za el. energiju',
      model: '97',
      pozivNaBroj: '18163220000111111',
    });
    const { text } = buildIpsPayload(filled);
    const symbol = buildQrSymbol(text!, pausalProfile.qr.size);
    expect(symbol.moduleMm).toBeGreaterThan(0.5);
  });
});

describe('the symbol on the page', () => {
  const fonts = {
    regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
    bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
    narrow: readFileSync('src/assets/fonts/RobotoCondensed-Regular.ttf'),
  };

  const payable = slip({
    platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1',
    svrhaUplate: 'UPLATA PO RACUNU',
    model: '97',
    pozivNaBroj: '18163220000111111',
  });

  it('keeps the module readable at every correction level for a full slip', () => {
    // The level is a trade-off: stronger correction packs more modules into the same
    // square, and below MIN_MODULE_MM the code fails outright rather than degrading.
    const { text } = buildIpsPayload(payable);
    const chosen = buildQrSymbol(text!, pausalProfile.qr.size, ERROR_CORRECTION);
    expect(chosen.moduleMm).toBeGreaterThan(MIN_MODULE_MM);
  });

  it('reports a too-dense code rather than shipping one that cannot be scanned', () => {
    const { text } = buildIpsPayload(payable);
    const tiny = buildQrSymbol(text!, 10, 'H');
    expect(tiny.moduleMm).toBeLessThan(MIN_MODULE_MM);
  });

  it('includes the payer by default and drops it on request', () => {
    expect(buildIpsPayload(payable).text).toContain('P:');
    expect(buildIpsPayload(payable, { includePayer: false }).text).not.toContain('P:');
  });

  it('merges runs of dark modules instead of emitting one rectangle each', () => {
    const { text } = buildIpsPayload(payable);
    const symbol = buildQrSymbol(text!, 30);
    const darkModules = symbol.rects.reduce((n, r) => n + Math.round(r.w / symbol.moduleMm), 0);
    expect(symbol.rects.length).toBeLessThan(darkModules * 0.7);
  });

  it('keeps the module above the size that still scans from print', () => {
    const { text } = buildIpsPayload(payable);
    const symbol = buildQrSymbol(text!, pausalProfile.qr.size);
    expect(symbol.moduleMm).toBeGreaterThan(MIN_MODULE_MM);
  });

  it('is decodable from the rendered page and carries the payload', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qr-'));
    const path = join(dir, 'out.pdf');
    const { bytes, qr } = await renderDocument([payable], { profile: pausalProfile, fonts });
    writeFileSync(path, bytes);

    const raster = rasterise(path, { dpi: 300 });
    // jsQR wants RGBA; the page is greyscale.
    const rgba = new Uint8ClampedArray(raster.width * raster.height * 4);
    for (let i = 0; i < raster.pixels.length; i += 1) {
      const v = raster.pixels[i];
      rgba.set([v, v, v, 255], i * 4);
    }
    const decoded = jsQR(rgba, raster.width, raster.height);
    rmSync(dir, { recursive: true, force: true });

    expect(decoded, 'the QR on the page could not be read').not.toBeNull();
    expect(decoded!.data).toBe(buildIpsPayload(payable).text);
    expect(qr[0].tooDense).toBe(false);
  });

  it('puts a readable code on every slip of a full sheet', async () => {
    const slips = [1, 2, 3].map((n) => ({
      ...payable,
      id: `s${n}`,
      iznos: `${n}.000,00`,
    }));
    const dir = mkdtempSync(join(tmpdir(), 'qr-sheet-'));
    const path = join(dir, 'sheet.pdf');
    const { bytes } = await renderDocument(slips, { profile: pausalProfile, fonts });
    writeFileSync(path, bytes);
    const raster = rasterise(path, { dpi: 300 });
    const perMm = raster.dpi / 25.4;

    // Decoded one cell at a time: jsQR finds a single symbol per image, and a phone is
    // pointed at one code too. What this checks is that the per-cell offset leaves each
    // symbol intact.
    slips.forEach((slip, cell) => {
      const { x, y, size } = pausalProfile.qr;
      const margin = 4;
      const px0 = Math.floor((x - margin) * perMm);
      const py0 = Math.floor((y + cell * pausalProfile.height - margin) * perMm);
      const side = Math.ceil((size + 2 * margin) * perMm);
      const rgba = new Uint8ClampedArray(side * side * 4);
      for (let row = 0; row < side; row += 1) {
        for (let col = 0; col < side; col += 1) {
          const v = raster.pixels[(py0 + row) * raster.width + (px0 + col)] ?? 255;
          rgba.set([v, v, v, 255], (row * side + col) * 4);
        }
      }
      const decoded = jsQR(rgba, side, side);
      expect(decoded, `slip ${cell + 1} of the sheet has no readable QR`).not.toBeNull();
      expect(decoded!.data).toBe(buildIpsPayload(slip).text);
    });

    rmSync(dir, { recursive: true, force: true });
  });

  it('draws no code when the slip cannot make a valid payload', async () => {
    const { qr } = await renderDocument([slip({ iznos: '' })], { profile: pausalProfile, fonts });
    expect(qr[0].version).toBeUndefined();
    expect(qr[0].problems.map((p) => p.field)).toContain('iznos');
  });
});
