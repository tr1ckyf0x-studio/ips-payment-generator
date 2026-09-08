/**
 * Places slips onto A4 sheets.
 *
 * A slip cell is the normative 99 mm, so three stack into exactly 297 mm — a full A4
 * with nothing clipped, since the drawn content of a slip ends around 90 mm.
 */
import type { Mm } from './types.ts';

export const A4_WIDTH: Mm = 210;
export const A4_HEIGHT: Mm = 297;
export const SLIPS_PER_SHEET = 3;

export interface Placement<T> {
  slip: T;
  /** Offset of the slip's top-left corner from the sheet's top-left corner. */
  offsetY: Mm;
}

export interface Sheet<T> {
  placements: Array<Placement<T>>;
  /** Y positions of the dashed cut guides on this sheet. */
  cutGuides: Mm[];
}

/**
 * Groups slips into sheets of three.
 *
 * A cut guide follows each slip that was actually printed, along its bottom edge: a
 * sheet holding one slip gets one guide, at 99 mm, which is the line the unused
 * remainder is trimmed off along to leave a slip of exactly 210 x 99 mm. Guiding the
 * empty cells below it as well would draw lines across blank paper with nothing to
 * separate.
 *
 * The guide after the last slip of a full sheet falls on the sheet edge, where there is
 * likewise nothing to cut, and is left out.
 */
export function paginate<T>(slips: T[], cellHeight: Mm): Array<Sheet<T>> {
  if (cellHeight <= 0) throw new RangeError('cellHeight must be positive');

  const sheets: Array<Sheet<T>> = [];
  for (let i = 0; i < slips.length; i += SLIPS_PER_SHEET) {
    const placements = slips.slice(i, i + SLIPS_PER_SHEET).map((slip, cell) => ({
      slip,
      offsetY: cell * cellHeight,
    }));
    sheets.push({
      placements,
      cutGuides: placements.map((p) => p.offsetY + cellHeight).filter((y) => y < A4_HEIGHT),
    });
  }
  return sheets;
}
