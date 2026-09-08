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
 * Cut guides are drawn at every cell boundary except the sheet edge itself, and on
 * every sheet regardless of how full it is: on a sheet holding a single slip the guide
 * at 99 mm is the line along which the unused remainder is trimmed away, which is what
 * yields a slip of exactly 210 x 99 mm.
 */
export function paginate<T>(slips: T[], cellHeight: Mm): Array<Sheet<T>> {
  if (cellHeight <= 0) throw new RangeError('cellHeight must be positive');

  const cutGuides: Mm[] = [];
  for (let cell = 1; cell < SLIPS_PER_SHEET; cell += 1) {
    const y = cell * cellHeight;
    if (y < A4_HEIGHT) cutGuides.push(y);
  }

  const sheets: Array<Sheet<T>> = [];
  for (let i = 0; i < slips.length; i += SLIPS_PER_SHEET) {
    sheets.push({
      placements: slips.slice(i, i + SLIPS_PER_SHEET).map((slip, cell) => ({
        slip,
        offsetY: cell * cellHeight,
      })),
      cutGuides,
    });
  }
  return sheets;
}
