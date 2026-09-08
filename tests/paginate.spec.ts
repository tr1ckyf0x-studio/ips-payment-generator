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
    const [sheet] = paginate([1], CELL);
    expect(sheet.cutGuides).toEqual([99, 198]);
    expect(sheet.cutGuides).not.toContain(A4_HEIGHT);
  });

  it('guides a single-slip sheet too, so the remainder can be trimmed off', () => {
    const [sheet] = paginate([1], CELL);
    expect(sheet.placements).toHaveLength(1);
    expect(sheet.cutGuides).toContain(99);
  });

  it('rejects a non-positive cell height', () => {
    expect(() => paginate([1], 0)).toThrow(RangeError);
    expect(() => paginate([1], -1)).toThrow(RangeError);
  });
});
