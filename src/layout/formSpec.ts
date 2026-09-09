/**
 * The two blanks this app can print.
 *
 * The National Bank fixes the 99 x 210 mm size and which elements appear, but not where
 * they go, so print shops draw genuinely different blanks. These are two of them, and
 * `blankGeometry.ts` holds everything they have in common.
 */
import { createProfile, type BlankGeometry } from './blankGeometry.ts';
import type { FormProfile } from './types.ts';

/**
 * The pausal reference: `references/reference-uplatnica-pausal.pdf`, vector and exact.
 * Coordinates extracted with `tools/extractGeometry.ts`; `tests/layout.spec.ts` holds
 * them to it within 0.25 mm.
 */
const PAUSAL: BlankGeometry = {
  id: 'pausal',
  boxStroke: 0.47,
  ruleStroke: 0.35,
  blocks: { x0: 8.98, x1: 98.72, tops: [12.99, 32.44, 51.88], height: 13.96 },
  separatorX: 104.7,
  fields: {
    sifraPlacanja: { x: 113.18, y: 17.98, w: 11.97, h: 5.98 },
    valuta: { x: 129.63, y: 17.98, w: 11.97, h: 5.98 },
    iznos: { x: 149.58, y: 17.98, w: 49.86, h: 5.98 },
    racunPrimaoca: { x: 113.18, y: 29.94, w: 86.26, h: 5.98 },
    model: { x: 113.18, y: 41.91, w: 11.97, h: 5.98 },
    pozivNaBroj: { x: 129.63, y: 41.91, w: 69.8, h: 5.98 },
  },
  rules: {
    potpis: { x0: 8.98, x1: 63.82, y: 72.82 },
    mesto: { x0: 48.86, x1: 98.72, y: 80.8 },
    datum: { x0: 113.18, x1: 148.08, y: 80.8 },
  },
  // Absent from this blank, which predates the 65/2018 amendment, but drawn anyway:
  // the element is current, and its geometry comes from the OPTIMUM scans.
  hitno: { x: 178.04, y: 76.7, w: 5.15, h: 4.1 },
  title: { yTop: 9.16, right: 199.44 },
  footer: { centre: 106.4, yTop: 87.84 },
  // Vertically centred in the band below the framed fields; see `qrArea`.
  qr: { x: 173.44, size: 26 },
};

/**
 * The OPTIMUM d.o.o. blank, measured from nine scans with `tools/measure_blank.py`.
 *
 * It differs from the reference by more than rounding: blocks 90.7 x 15.1 mm against
 * 89.75 x 13.96, a pitch of 21.2 mm against 19.45, and the column separator 7.0 mm past
 * the blocks rather than 6.0. Scale is absolute — taken from the scans' own page sizes
 * rather than from another blank — and the key figures agree across all nine.
 *
 * What the scans cannot give is the origin: every one is cropped, so where this
 * arrangement sits on the 210 x 99 mm sheet is inferred. The left margin is set to
 * 5.5 mm, which is what the least-cropped scans imply and which leaves 6.7 mm on the
 * right; the reference's own margins are 8.98 and 10.56.
 */
const OPTIMUM: BlankGeometry = {
  id: 'optimum',
  boxStroke: 0.47,
  ruleStroke: 0.35,
  blocks: { x0: 6.27, x1: 97.19, tops: [12.0, 33.25, 54.23], height: 15.12 },
  separatorX: 104.21,
  fields: {
    // Rows sit 0.13 mm higher and the model box is 10 mm, both from printing this blank
    // and scanning it on top of a real one — see "Checked against paper".
    sifraPlacanja: { x: 113.08, y: 15.11, w: 13.0, h: 6.1 },
    valuta: { x: 131.08, y: 15.11, w: 13.0, h: 6.1 },
    iznos: { x: 151.08, y: 15.11, w: 53.0, h: 6.1 },
    racunPrimaoca: { x: 113.08, y: 28.25, w: 91.0, h: 6.19 },
    model: { x: 113.08, y: 41.43, w: 10.0, h: 6.1 },
    pozivNaBroj: { x: 131.08, y: 41.43, w: 73.0, h: 6.1 },
  },
  rules: {
    potpis: { x0: 6.27, x1: 62.27, y: 76.5 },
    mesto: { x0: 49.27, x1: 97.27, y: 85.53 },
    datum: { x0: 113.27, x1: 148.27, y: 85.53 },
  },
  hitno: { x: 177.07, y: 81.43, w: 5.2, h: 4.1 },
  // Measured on two clean scans: the title's ink starts 8.6 mm above the first block
  // rule and ends 197.4 mm right of the blocks' left edge.
  title: { yTop: 3.6, right: 203.69 },
  footer: { centre: 105.17, yTop: 92.3 },
  // Vertically centred in the band below the framed fields; see `qrArea`.
  qr: { x: 178.08, size: 26 },
};

export const pausalProfile: FormProfile = createProfile(PAUSAL);
export const optimumProfile: FormProfile = createProfile(OPTIMUM);

export const PROFILES = { pausal: pausalProfile, optimum: optimumProfile } as const;
export type ProfileId = keyof typeof PROFILES;

/** The blank the user actually pays with. */
export const DEFAULT_PROFILE: ProfileId = 'optimum';
