/**
 * Turns an IPS payload into a matrix of modules, and that matrix into rectangles.
 *
 * The QR is drawn as vector rectangles straight into the PDF rather than as a raster
 * image, so it stays sharp at whatever resolution the printer works at — a scanned
 * bitmap would be the one blurry thing on an otherwise vector page.
 */
import QRCode from 'qrcode';
import type { Mm } from '../layout/types.ts';

/**
 * Error correction level.
 *
 * L, matching the NBS generator's own: probing their API showed a 90-byte payload coming
 * back as a version 5 symbol, which at level M would hold only 84 bytes.
 *
 * The level is a genuine trade-off rather than "more is better". A stronger level does
 * not cost compatibility — it is part of the QR standard and every reader detects it —
 * but it packs more modules into the same square, and a module too small to resolve is
 * a code that fails outright rather than degrades. At L a fully filled slip stays at
 * 0.57 mm per module, well clear of the 0.4 mm floor, and leaves room for the payer tag.
 */
export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export const ERROR_CORRECTION: ErrorCorrection = 'L';

/**
 * Smallest module that still scans reliably from print. Below this a phone camera
 * starts to struggle, so the caller warns rather than shipping an unscannable code.
 */
export const MIN_MODULE_MM = 0.4;

export interface QrRect {
  x: Mm;
  y: Mm;
  w: Mm;
  h: Mm;
}

export interface QrSymbol {
  /** QR version, 1 to 40. */
  version: number;
  /** Modules per side, excluding the quiet zone. */
  size: number;
  /** Side of one module once drawn at `sizeMm`. */
  moduleMm: Mm;
  /** Dark areas to fill, in millimetres relative to the symbol's top-left corner. */
  rects: QrRect[];
}

/**
 * Builds the symbol and reduces it to rectangles.
 *
 * Adjacent dark modules in a row are merged into one rectangle: a version 11 symbol has
 * some 1800 dark modules, and emitting each as its own rectangle would bloat the page
 * for no visual difference.
 */
export function buildQrSymbol(
  text: string,
  sizeMm: Mm,
  level: ErrorCorrection = ERROR_CORRECTION,
): QrSymbol {
  const qr = QRCode.create(text, { errorCorrectionLevel: level });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const moduleMm = sizeMm / size;

  const rects: QrRect[] = [];
  for (let row = 0; row < size; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= size; col += 1) {
      const dark = col < size && data[row * size + col] === 1;
      if (dark && runStart < 0) runStart = col;
      if (!dark && runStart >= 0) {
        rects.push({
          x: runStart * moduleMm,
          y: row * moduleMm,
          w: (col - runStart) * moduleMm,
          h: moduleMm,
        });
        runStart = -1;
      }
    }
  }

  return { version: qr.version, size, moduleMm, rects };
}
