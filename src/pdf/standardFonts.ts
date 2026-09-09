/**
 * Stands in for `@pdf-lib/standard-fonts`, which we pay 127 kB for and never use.
 *
 * The package carries the AFM metrics of the fourteen fonts every PDF reader already
 * has — Helvetica, Times, Courier, Symbol, ZapfDingbats. This app embeds its own three
 * faces instead, because the blank has to print identically everywhere, so none of that
 * data is ever read. It arrives anyway: `pdf-lib/utils/objects` evaluates
 * `values(FontNames)` at module scope, which drags in `Font.js`, which imports all
 * fourteen compressed JSON files.
 *
 * `vite.config.ts` aliases the package to this module. Only `Font.load` is replaced —
 * the two small exports stay real, so `pdf-lib` sees the shape it expects:
 *
 * - `FontNames` is a bare string enum, needed at module scope. Copied verbatim.
 * - `Encodings` is 1.5 kB of encoding tables, re-exported from the package itself.
 * - `Font.load` is the only door to the font data, and it is reached solely from
 *   `StandardFontEmbedder`'s constructor — that is, from `embedStandardFont`. Calling it
 *   throws rather than returning something plausible: a silently wrong font would print
 *   a slip with the wrong metrics, which is worse than a stack trace.
 *
 * `tests/standardFonts.spec.ts` checks that the alias is in force and that the door is
 * still shut.
 */

// The real tables — small, and correctness here is not ours to reinvent.
export { Encodings } from '@pdf-lib/standard-fonts/es/Encoding.js';

/** Copied from the package's `Font.js`; `pdf-lib` reads these values, not the metrics. */
export const FontNames = {
  Courier: 'Courier',
  CourierBold: 'Courier-Bold',
  CourierOblique: 'Courier-Oblique',
  CourierBoldOblique: 'Courier-BoldOblique',
  Helvetica: 'Helvetica',
  HelveticaBold: 'Helvetica-Bold',
  HelveticaOblique: 'Helvetica-Oblique',
  HelveticaBoldOblique: 'Helvetica-BoldOblique',
  TimesRoman: 'Times-Roman',
  TimesRomanBold: 'Times-Bold',
  TimesRomanItalic: 'Times-Italic',
  TimesRomanBoldItalic: 'Times-BoldItalic',
  Symbol: 'Symbol',
  ZapfDingbats: 'ZapfDingbats',
} as const;

export const STANDARD_FONT_MESSAGE =
  'This build does not carry the standard PDF font metrics: @pdf-lib/standard-fonts is ' +
  'stubbed out in vite.config.ts because the slip embeds its own faces. Use ' +
  'embedFont(bytes) rather than embedStandardFont, or drop the alias.';

export class Font {
  static load(fontName: string): never {
    throw new Error(`${STANDARD_FONT_MESSAGE} (asked for "${fontName}")`);
  }
}
