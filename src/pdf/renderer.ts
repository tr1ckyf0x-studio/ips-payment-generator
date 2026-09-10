/**
 * Draws payment slips onto A4 pages with pdf-lib.
 *
 * The single place in the codebase where millimetres become PostScript points and
 * where our top-left origin becomes pdf-lib's bottom-left one. Everything upstream
 * works in millimetres from the top-left of a slip; `place()` is the only conversion.
 */
import { PDFDocument, PrintScaling, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { FieldSlot, FormProfile, Mm, Primitive, QrArea } from '../layout/types.ts';
import { A4_HEIGHT, A4_WIDTH, paginate } from '../layout/paginate.ts';
import { blockLines, formatAccount, sifraPlacanja, type Slip } from '../model/slip.ts';
import { fitSize } from '../layout/fitText.ts';
import { buildIpsPayload, type IpsOptions, type IpsProblem } from '../ips/payload.ts';
import { buildQrSymbol, ERROR_CORRECTION, MIN_MODULE_MM, type ErrorCorrection } from '../ips/qr.ts';

const MM_TO_PT = 72 / 25.4;

/**
 * Cap height of the value face (Roboto Condensed) as a fraction of the point size.
 * Vertical centring puts the middle of the capitals on the middle of the field, which
 * is what reads as centred; centring the baseline or the full ascender-to-descender box
 * would both sit visibly low. `tests/values.spec.ts` checks the result on the ink.
 */
const VALUE_CAP_RATIO = 0.711;
const BLACK = rgb(0, 0, 0);

/** Cut guide styling: thin dashed rule across the full sheet width. */
const CUT_GUIDE_STROKE: Mm = 0.25;
const CUT_GUIDE_DASH: [Mm, Mm] = [2, 2];

export interface FontBytes {
  /** The blank's own wording: Arial-metric. */
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
  /** Slip data: condensed, matching how a real blank is machine-filled. */
  narrow: Uint8Array | ArrayBuffer;
}

export interface RenderOptions {
  profile: FormProfile;
  fonts: FontBytes;
  /** Draw the blank's rules and wording. Off would print onto pre-printed stock. */
  drawBlank?: boolean;
  /** Draw the slip data. */
  drawValues?: boolean;
  /** Draw the IPS QR code. */
  drawQr?: boolean;
  /** How the IPS payload is built and encoded. */
  ips?: IpsOptions & { level?: ErrorCorrection };
}

function mm(value: Mm): number {
  return value * MM_TO_PT;
}

/**
 * Converts a point given in millimetres from the top-left of a slip into pdf-lib's
 * points-from-the-bottom-left-of-the-page.
 */
function place(x: Mm, y: Mm, offsetY: Mm): { x: number; y: number } {
  return { x: mm(x), y: mm(A4_HEIGHT - (y + offsetY)) };
}

function drawPrimitive(page: PDFPage, item: Primitive, offsetY: Mm, fonts: { regular: PDFFont; bold: PDFFont }): void {
  switch (item.kind) {
    case 'box': {
      // pdf-lib anchors a rectangle at its bottom-left corner.
      const corner = place(item.x, item.y + item.h, offsetY);
      page.drawRectangle({
        ...corner,
        width: mm(item.w),
        height: mm(item.h),
        borderColor: BLACK,
        borderWidth: mm(item.stroke),
      });
      break;
    }
    case 'rule': {
      page.drawLine({
        start: place(item.x0, item.y0, offsetY),
        end: place(item.x1, item.y1, offsetY),
        thickness: mm(item.stroke),
        color: BLACK,
        dashArray: item.dash?.map(mm),
      });
      break;
    }
    case 'label': {
      const font = item.bold ? fonts.bold : fonts.regular;
      const width = font.widthOfTextAtSize(item.text, item.size) / MM_TO_PT;
      const x =
        item.anchorRight !== undefined
          ? item.anchorRight - width
          : item.anchorCentre !== undefined
            ? item.anchorCentre - width / 2
            : item.x;
      page.drawText(item.text, {
        ...place(x, item.baseline, offsetY),
        size: item.size,
        font,
        color: BLACK,
      });
      break;
    }
  }
}

/** Value of a slot's field, formatted the way the blank expects it. */
function slotText(slip: Slip, field: string): string {
  if (field === 'sifraPlacanja') return sifraPlacanja(slip);
  // Prilog 2: "u element način izvršenja - hitno upisuje se opisno slovna oznaka H".
  if (field === 'hitno') return slip.hitno ? 'H' : '';
  const raw = (slip as unknown as Record<string, unknown>)[field];
  if (typeof raw !== 'string') return '';
  return field === 'racunPrimaoca' ? formatAccount(raw) : raw;
}

/**
 * Draws one field, shrinking it if the value is too long for the slot.
 *
 * Returns the size used, so the caller can tell the form which fields had to give way.
 */
function drawSlot(
  page: PDFPage,
  slot: FieldSlot,
  slip: Slip,
  offsetY: Mm,
  font: PDFFont,
): number | undefined {
  const text = slotText(slip, slot.field);
  if (!text) return undefined;

  const lines = slot.lineHeight ? blockLines(text).slice(0, slot.maxLines ?? 3) : [text];
  const measure = (line: string, size: number) => font.widthOfTextAtSize(line, size) / MM_TO_PT;
  const { size } = fitSize(lines, slot.w, slot.size, measure);

  // Centring is resolved here rather than in the layout because it depends on the cap
  // height of the face actually used, and on the size after any shrinking.
  const firstBaseline =
    slot.verticalCentre === undefined
      ? slot.baseline
      : slot.verticalCentre + (VALUE_CAP_RATIO * size) / MM_TO_PT / 2;

  lines.forEach((line, index) => {
    if (!line) return;
    const width = measure(line, size);
    const x = slot.align === 'center' ? slot.x + (slot.w - width) / 2 : slot.x;
    const baseline = firstBaseline + index * (slot.lineHeight ?? 0);
    page.drawText(line, { ...place(x, baseline, offsetY), size, font, color: BLACK });
  });

  return size;
}

/** Why a slip has no QR code, or a warning about the one it has. */
export interface QrReport {
  slipId: string;
  /** Present when the payload could not be built. */
  problems: IpsProblem[];
  /** Present when a code was drawn. */
  version?: number;
  moduleMm?: number;
  /** True when the module fell below what scans reliably from print. */
  tooDense?: boolean;
}

/** A field that had to be set smaller than its slot's size to fit. */
export interface ShrunkField {
  slipId: string;
  field: string;
  size: number;
  baseSize: number;
}

export interface RenderResult {
  bytes: Uint8Array;
  /** Fields the renderer had to shrink, so the form can say which ones and by how much. */
  shrunk: ShrunkField[];
  /** One entry per slip: the QR drawn, or why it could not be. */
  qr: QrReport[];
}

/**
 * Draws the IPS QR for one slip, and reports what happened.
 *
 * A slip with incomplete data simply gets no code — an unpayable QR would be worse
 * than none, and the form surfaces the reason.
 */
function drawQrCode(
  page: PDFPage,
  area: QrArea,
  slip: Slip,
  offsetY: Mm,
  ips: IpsOptions & { level?: ErrorCorrection },
): QrReport {
  const { text, problems } = buildIpsPayload(slip, ips);
  if (!text) return { slipId: slip.id, problems };

  const symbol = buildQrSymbol(text, area.size, ips.level ?? ERROR_CORRECTION);
  for (const rect of symbol.rects) {
    // Rectangles are anchored bottom-left, so shift down by the module height.
    page.drawRectangle({
      ...place(area.x + rect.x, area.y + rect.y + rect.h, offsetY),
      width: mm(rect.w),
      height: mm(rect.h),
      color: BLACK,
      borderWidth: 0,
    });
  }

  return {
    slipId: slip.id,
    problems: [],
    version: symbol.version,
    moduleMm: symbol.moduleMm,
    tooDense: symbol.moduleMm < MIN_MODULE_MM,
  };
}

/**
 * Renders one A4 PDF holding every slip, three to a sheet, with dashed cut guides at
 * the cell boundaries.
 */
export async function renderDocument(slips: Slip[], options: RenderOptions): Promise<RenderResult> {
  const { profile, fonts, drawBlank = true, drawValues = true, drawQr = true, ips = {} } = options;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  // The document asks not to be rescaled when printed. A slip fitted to the page stops
  // being 210 x 99 mm, and a print dialog is where that is easiest to leave switched on.
  // Acrobat and Preview honour this; Chrome ignores it, which is why the form still says
  // so in words. Asking costs one dictionary entry.
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const narrow = await pdf.embedFont(fonts.narrow, { subset: true });

  const shrunk: ShrunkField[] = [];
  const qr: QrReport[] = [];
  const sheets = paginate(slips.length ? slips : [null], profile.height);

  for (const sheet of sheets) {
    const page = pdf.addPage([mm(A4_WIDTH), mm(A4_HEIGHT)]);

    for (const { slip, offsetY } of sheet.placements) {
      if (drawBlank) {
        for (const item of profile.primitives) {
          drawPrimitive(page, item, offsetY, { regular, bold });
        }
      }
      if (drawValues && slip) {
        for (const slot of profile.slots) {
          const size = drawSlot(page, slot, slip, offsetY, narrow);
          if (size !== undefined && size < slot.size - 0.01) {
            shrunk.push({ slipId: slip.id, field: slot.field, size, baseSize: slot.size });
          }
        }
      }
      if (drawQr && slip) {
        qr.push(drawQrCode(page, profile.qr, slip, offsetY, ips));
      }
    }

    for (const y of sheet.cutGuides) {
      page.drawLine({
        start: place(0, y, 0),
        end: place(A4_WIDTH, y, 0),
        thickness: mm(CUT_GUIDE_STROKE),
        color: BLACK,
        dashArray: CUT_GUIDE_DASH.map(mm),
      });
    }
  }

  return { bytes: await pdf.save(), shrunk, qr };
}
