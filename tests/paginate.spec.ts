import { describe, expect, it } from 'vitest';
import { A4_HEIGHT, paginate, SLIPS_PER_SHEET } from '../src/layout/paginate.ts';

const CELL = 99;

describe('paginate', () => {
  it.each([
    { count: 0, sheets: 0 },
    { count: 1, sheets: 1 },
    { count: 3, sheets: 1 },
    { count: 4, sheets: 2 },
    { count: 6, sheets: 2 },
    { count: 7, sheets: 3 },
  ])('lays $count slips onto $sheets sheets', ({ count, sheets }) => {
    const input = Array.from({ length: count }, (_, i) => i);
    expect(paginate(input, CELL)).toHaveLength(sheets);
  });

  it('stacks cells top to bottom, three to a sheet', () => {
    const [first, second] = paginate([1, 2, 3, 4], CELL);
    expect(first.placements.map((p) => p.offsetY)).toEqual([0, 99, 198]);
    expect(first.placements.map((p) => p.slip)).toEqual([1, 2, 3]);
    expect(second.placements.map((p) => p.offsetY)).toEqual([0]);
    expect(second.placements.map((p) => p.slip)).toEqual([4]);
  });

  it('fills the sheet exactly, leaving no room for a fourth cell', () => {
    expect(SLIPS_PER_SHEET * CELL).toBe(A4_HEIGHT);
  });

  it('marks the cell boundaries for cutting but never the sheet edge', () => {
    const [sheet] = paginate([1, 2, 3], CELL);
    expect(sheet.cutGuides).toEqual([99, 198]);
    expect(sheet.cutGuides).not.toContain(A4_HEIGHT);
  });

  it.each([
    { count: 1, guides: [99] },
    { count: 2, guides: [99, 198] },
    { count: 3, guides: [99, 198] },
  ])('guides a sheet of $count slips at $guides', ({ count, guides }) => {
    const [sheet] = paginate(Array.from({ length: count }, (_, i) => i), CELL);
    expect(sheet.cutGuides).toEqual(guides);
  });

  it('guides a single-slip sheet, so the remainder can be trimmed off', () => {
    // The one guide it gets is the slip's own bottom edge; the empty cells below it are
    // blank paper and get none.
    const [sheet] = paginate([1], CELL);
    expect(sheet.placements).toHaveLength(1);
    expect(sheet.cutGuides).toEqual([99]);
  });

  it('guides the last sheet by its own contents, not by the first', () => {
    const [full, partial] = paginate([1, 2, 3, 4], CELL);
    expect(full.cutGuides).toEqual([99, 198]);
    expect(partial.cutGuides).toEqual([99]);
  });

  it('rejects a non-positive cell height', () => {
    expect(() => paginate([1], 0)).toThrow(RangeError);
    expect(() => paginate([1], -1)).toThrow(RangeError);
  });
});
