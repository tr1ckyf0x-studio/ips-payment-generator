/**
 * The bundled faces are subset down to what the app can print, so what they still carry
 * has to be checked.
 *
 * A missing glyph does not throw — it prints as nothing, or as a blank box — so this is
 * the only thing standing between a trimmed font and a slip with a hole in it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { PROFILES } from '../src/layout/formSpec.ts';
import { toSerbianLatin } from '../src/ips/serbianLatin.ts';

interface Face {
  hasGlyphForCodePoint(codePoint: number): boolean;
}

const load = (file: string): Face =>
  (fontkit as unknown as { create(b: Buffer): Face }).create(
    readFileSync(`src/assets/fonts/${file}`),
  );

const blankRegular = load('LiberationSans-Regular.ttf');
const blankBold = load('LiberationSans-Bold.ttf');
const valueFace = load('RobotoCondensed-Regular.ttf');

function missing(face: Face, text: string): string[] {
  return [...new Set(text)].filter((ch) => !face.hasGlyphForCodePoint(ch.codePointAt(0)!));
}

describe('the faces that draw the blank', () => {
  const wording = Object.values(PROFILES)
    .flatMap((profile) => profile.primitives)
    .filter((item) => item.kind === 'label')
    .map((item) => item.text)
    .join('');

  it('carries every character the pre-printed wording uses', () => {
    expect(missing(blankRegular, wording), 'regular').toEqual([]);
  });

  it('carries the title in bold', () => {
    const bold = Object.values(PROFILES)
      .flatMap((p) => p.primitives)
      .filter((item) => item.kind === 'label' && item.bold)
      .map((item) => (item.kind === 'label' ? item.text : ''))
      .join('');
    expect(bold, 'no bold wording found').not.toBe('');
    expect(missing(blankBold, bold), 'bold').toEqual([]);
  });
});

describe('the face that draws the values', () => {
  it('carries printable ASCII', () => {
    let ascii = '';
    for (let c = 0x20; c <= 0x7e; c += 1) ascii += String.fromCodePoint(c);
    expect(missing(valueFace, ascii)).toEqual([]);
  });

  it('carries the Serbian Latin diacritics', () => {
    expect(missing(valueFace, 'ČčĆćĐđŠšŽž')).toEqual([]);
  });

  it('carries Cyrillic, since the blank prints what was typed', () => {
    // The QR payload transliterates, but the slip itself shows the text verbatim.
    let cyrillic = '';
    for (let c = 0x0410; c <= 0x044f; c += 1) cyrillic += String.fromCodePoint(c);
    expect(missing(valueFace, cyrillic + 'ЂЈЉЊЋЏђјљњћџ')).toEqual([]);
  });

  it('carries everything transliteration can produce', () => {
    let cyrillic = '';
    for (let c = 0x0400; c <= 0x045f; c += 1) cyrillic += String.fromCodePoint(c);
    expect(missing(valueFace, toSerbianLatin(cyrillic))).toEqual([]);
  });
});

describe('bundle weight', () => {
  it('keeps the subset fonts far smaller than the originals', () => {
    // The full faces are about 400-500 KB each; every visitor downloads these.
    const total = ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf', 'RobotoCondensed-Regular.ttf']
      .reduce((sum, file) => sum + statSync(`src/assets/fonts/${file}`).size, 0);
    expect(total, `fonts total ${Math.round(total / 1024)} KB`).toBeLessThan(200 * 1024);
  });
});
