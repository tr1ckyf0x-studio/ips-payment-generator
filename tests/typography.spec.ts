/**
 * Type must sit where it belongs on the paper.
 *
 * Both cases here are regressions found by eye, not by the other tests:
 *
 *  - labels rendered half a millimetre low, dropping the descender of "платилац" onto
 *    the rule beneath it. The geometry tests passed throughout, because the rule was in
 *    the right place — it was the text that was not.
 *  - values were set in the blank's own Arial, while a real filled slip uses a
 *    condensed face and is markedly narrower.
 *
 * These are checked on the raster, because that is where the collision actually
 * happens; font-metric boxes are not comparable against a reference that does not embed
 * its font.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { inkBox, rasterise, type Raster } from '../tools/inkMetrics.ts';
import { extractText } from '../tools/extractGeometry.ts';
import { pausalProfile } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';
import type { Label, Rule } from '../src/layout/types.ts';

const DPI = 300;

const fonts = {
  regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
  bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
  narrow: readFileSync('src/assets/fonts/RobotoCondensed-Regular.ttf'),
};

const slip: Slip = {
  ...emptySlip('a'),
  platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
  svrhaUplate: 'Uplata po računu za el. energiju',
  primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
  oblikPlacanja: '1',
  osnovPlacanja: '21',
  valuta: 'RSD',
  iznos: '5.200,00',
  racunPrimaoca: '845000000040484987',
  model: '97',
  pozivNaBroj: '14123412',
};

const labels = pausalProfile.primitives.filter((p): p is Label => p.kind === 'label');
const rules = pausalProfile.primitives.filter((p): p is Rule => p.kind === 'rule');

let raster: Raster;
let pdfPath: string;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'typo-'));
  pdfPath = join(dir, 'out.pdf');
  writeFileSync(pdfPath, (await renderDocument([slip], { profile: pausalProfile, fonts })).bytes);
  raster = rasterise(pdfPath, { dpi: DPI });
  return () => rmSync(dir, { recursive: true, force: true });
});

/** Width of a label as actually rendered. */
function widthOf(label: Label): number {
  return extractText(pdfPath).find((t) => t.text === label.text)?.w ?? 20;
}

/** Left edge of a label, resolving right-aligned ones like the title. */
function leftOf(label: Label, width: number): number {
  return label.anchorRight === undefined ? label.x : label.anchorRight - width;
}

/** The nearest horizontal rule below a label, within its horizontal span. */
function ruleBelow(label: Label, width: number): Rule | undefined {
  const left = leftOf(label, width);
  return rules
    .filter((r) => r.y0 === r.y1 && r.y0 > label.baseline)
    .filter((r) => Math.min(r.x0, r.x1) < left + width && Math.max(r.x0, r.x1) > left)
    .sort((a, b) => a.y0 - b.y0)[0];
}

/**
 * Bottom edge of a label's ink, measured in a window that stops above the rule so only
 * the label itself is inside it.
 */
function inkBottom(source: Raster, label: Label, ruleY: number): number | undefined {
  const top = label.baseline - label.size * (25.4 / 72) * 0.8;
  // The window must span the whole label: the deepest ink in "модел и позив на број
  // (одобрење)" is its closing bracket, at the far right.
  const width = widthOf(label) + 0.6;
  // Stop clear of the rule itself: a framed field's border is 0.47 mm thick, so its ink
  // begins 0.235 mm above the nominal y, and a pixel of slack keeps it out at 300 dpi.
  // A bracket's stroke is about a pixel wide at this resolution, so antialiasing lifts
  // it well above the default threshold; at 128 the deepest ink is simply not seen.
  const box = inkBox(
    source,
    { x: leftOf(label, width - 0.6) - 0.3, y: top, w: width, h: ruleY - 0.45 - top },
    200,
  );
  return box && box.y + box.h;
}

describe('labels clear the rules beneath them', () => {
  // Measured on the OPTIMUM blanks the user actually pays with: the gap between the
  // bottom of "платилац" and the rule below it is 1.19 mm on one scan and 1.32 mm on the
  // other. The pausal reference crowds the same labels to 0.05-0.20 mm, which is what
  // put the tail of "ц" on the rule when its coordinates were copied verbatim.
  const MIN_GAP_MM = 0.8;
  const MAX_GAP_MM = 1.8;

  const anchored = labels.filter((l) => l.anchoredAbove !== undefined);

  it('anchors every label that sits above a rule', () => {
    // Any label with a rule close beneath it must be positioned by clearance, not by
    // the reference's coordinate.
    for (const label of labels) {
      const rule = ruleBelow(label, widthOf(label));
      if (!rule) continue;
      if (rule.y0 - label.baseline < 4) {
        expect(label.anchoredAbove, `${label.text} is not anchored to its rule`).toBeDefined();
      }
    }
  });

  it.each(anchored.map((l) => ({ id: l.id, text: l.text })))(
    '$text clears its rule by about as much as the real blank',
    ({ id }) => {
      const label = labels.find((l) => l.id === id)!;
      const ruleY = label.anchoredAbove!;
      const bottom = inkBottom(raster, label, ruleY);
      expect(bottom, `${label.text}: no ink found`).toBeDefined();

      const gap = ruleY - 0.175 - bottom!; // 0.175 = half the rule's stroke
      expect(gap, `${label.text} clears its rule by ${gap.toFixed(2)}mm`).toBeGreaterThan(MIN_GAP_MM);
      expect(gap, `${label.text} clears its rule by ${gap.toFixed(2)}mm`).toBeLessThan(MAX_GAP_MM);
    },
  );

  it('never lets any label touch the rule below it', () => {
    for (const label of labels) {
      const rule = ruleBelow(label, widthOf(label));
      if (!rule) continue;
      const bottom = inkBottom(raster, label, rule.y0);
      if (bottom === undefined) continue;
      expect(bottom, `${label.text} runs into its rule`).toBeLessThan(rule.y0 - 0.175);
    }
  });
});

describe('values are set in a condensed face', () => {
  it('renders values at the size calibrated against a real filled slip', async () => {
    const measured = extractText(pdfPath).find((t) => t.text === 'PETAR PETROVIĆ');
    expect(measured).toBeDefined();
    // 10 pt is the size at which the payer line on the OPTIMUM scans came out at its
    // measured 31.90 mm; this pins that size through a neutral string.
    expect(measured!.w).toBeGreaterThan(24.0);
    expect(measured!.w).toBeLessThan(25.3);
  });

  it('is narrower than the face used for the blank itself', async () => {
    // Compared on digits, which both faces carry: the blank face is subset down to the
    // wording it prints, so it has no letters to compare with any more.
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const blankFace = await pdf.embedFont(fonts.regular, { subset: false });
    const valueFace = await pdf.embedFont(fonts.narrow, { subset: false });
    const digits = '0123456789';
    const wide = blankFace.widthOfTextAtSize(digits, 10);
    const narrow = valueFace.widthOfTextAtSize(digits, 10);
    expect(narrow).toBeLessThan(wide * 0.92);
  });

  it('keeps every value inside its slot', () => {
    for (const s of pausalProfile.slots) {
      const box = inkBox(raster, {
        x: s.x - 0.3,
        y: s.baseline - 4.5,
        w: s.w + 0.6,
        h: 5.5 + (s.lineHeight ?? 0) * ((s.maxLines ?? 1) - 1),
      });
      if (!box) continue;
      expect(box.x, `${s.field} starts left of its slot`).toBeGreaterThanOrEqual(s.x - 0.4);
      expect(box.x + box.w, `${s.field} runs past its slot`).toBeLessThanOrEqual(s.x + s.w + 0.4);
    }
  });
});
