/**
 * The page-size parser, tested without poppler.
 *
 * CI caught this: `pdftocairo` on Ubuntu wrote an `<svg>` header the original regular
 * expression did not match, and the parser answered 0 mm instead of failing — which read
 * as "the page is not A4" and sent the search in the wrong direction. Header shapes vary
 * with the poppler version, so they are covered here rather than only through whatever
 * the local install happens to emit.
 */
import { describe, expect, it } from 'vitest';
import { parsePageSize } from '../tools/extractGeometry.ts';

const A4 = { width: 210, height: 297 };

describe('parsePageSize', () => {
  it.each([
    [
      'points, as poppler 26 writes them',
      '<svg xmlns="http://www.w3.org/2000/svg" width="595.275591pt" height="841.889764pt" viewBox="0 0 595.275591 841.889764">',
    ],
    [
      'points rounded to integers',
      '<svg xmlns="http://www.w3.org/2000/svg" width="595pt" height="842pt">',
    ],
    [
      'height before width',
      '<svg xmlns="http://www.w3.org/2000/svg" height="841.89pt" width="595.28pt">',
    ],
    [
      'no unit suffix',
      '<svg xmlns="http://www.w3.org/2000/svg" width="595.28" height="841.89">',
    ],
    [
      'viewBox only',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595.28 841.89">',
    ],
    [
      'attributes split across lines',
      '<svg xmlns="http://www.w3.org/2000/svg"\n  width="595.28pt"\n  height="841.89pt">',
    ],
  ])('reads A4 from a header with %s', (_name, header) => {
    const { width, height } = parsePageSize(`${header}\n<g></g>\n</svg>`);
    expect(width).toBeCloseTo(A4.width, 0);
    expect(height).toBeCloseTo(A4.height, 0);
  });

  it('understands millimetres and inches', () => {
    expect(parsePageSize('<svg width="210mm" height="297mm">').width).toBeCloseTo(210, 1);
    expect(parsePageSize('<svg width="8.27in" height="11.69in">').width).toBeCloseTo(210, 0);
  });

  it('prefers the declared size over the viewBox', () => {
    const size = parsePageSize('<svg width="595.28pt" height="841.89pt" viewBox="0 0 100 100">');
    expect(size.width).toBeCloseTo(210, 0);
  });

  it('throws rather than reporting a zero-sized page', () => {
    // A silent 0 is worse than a failure: it looks like a wrong page size.
    expect(() => parsePageSize('<svg xmlns="http://www.w3.org/2000/svg">')).toThrow(
      /could not read the page size/,
    );
    expect(() => parsePageSize('not svg at all')).toThrow(/no <svg> element/);
  });
});
