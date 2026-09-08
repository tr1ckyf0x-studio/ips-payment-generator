/**
 * Renders a sample document for eyeball inspection, and reports how our pre-printed
 * wording lines up with the reference blank's.
 *
 * Run with `npm run visual`. Writes into `.visual/` (git-ignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pausalProfile } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';
import { extractText } from './extractGeometry.ts';
import { inkBox, rasterise } from './inkMetrics.ts';
import type { Label } from '../src/layout/types.ts';

const OUT_DIR = '.visual';
const PT_TO_MM = 25.4 / 72;
const REFERENCE = 'references/reference-uplatnica-pausal.pdf';

const fonts = {
  regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
  bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
  narrow: readFileSync('src/assets/fonts/RobotoCondensed-Regular.ttf'),
};

function sample(n: number, purpose: string): Slip {
  return {
    ...emptySlip(`sample-${n}`),
    platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
    svrhaUplate: purpose,
    primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
    oblikPlacanja: '1',
    osnovPlacanja: '21',
    valuta: 'RSD',
    iznos: '5.200,00',
    racunPrimaoca: '845000000040484987',
    model: '97',
    pozivNaBroj: '14123412',
  };
}

mkdirSync(OUT_DIR, { recursive: true });

const slips = [
  sample(1, 'Uplata po računu za el. energiju'),
  sample(2, 'Uplata po računu za vodu'),
  sample(3, 'Uplata po računu za grejanje'),
];

const { bytes } = await renderDocument(slips, { profile: pausalProfile, fonts });
const pdfPath = `${OUT_DIR}/sample.pdf`;
writeFileSync(pdfPath, bytes);

execFileSync('pdftoppm', ['-png', '-r', '150', pdfPath, `${OUT_DIR}/sample`]);
execFileSync('pdftoppm', ['-png', '-r', '150', REFERENCE, `${OUT_DIR}/reference`]);

// Compare our pre-printed wording against the reference's, label by label, by where
// the ink lands. Font-metric boxes are not comparable here: the reference does not
// embed its Arial, so poppler reports a substitute's metrics.
const ours = extractText(pdfPath);
const theirs = extractText(REFERENCE);
const oursRaster = rasterise(pdfPath);
const theirsRaster = rasterise(REFERENCE);
const labels = pausalProfile.primitives.filter((p): p is Label => p.kind === 'label');

console.log(`${pdfPath}: ${slips.length} slips\n`);
console.log('label                             size     dx     dy     dw   width%  suggest');
for (const label of labels) {
  // Our signature label is deliberately shorter than the reference's ("печат и
  // потпис платиоца"), so compare only exact matches.
  const ref = theirs.find((t) => t.text === label.text);
  const mine = ours.find((t) => t.text === label.text);
  if (!ref || !mine) {
    console.log(`${label.text.padEnd(33)} ${mine ? 'ours only' : 'MISSING from our output'}`);
    continue;
  }

  // A window around the label, tight enough to exclude neighbouring rules and labels:
  // the block above ends as little as 1.2 mm over a label's ascender, and the framed
  // field below starts as little as 0.6 mm under its baseline. Sizing it from the point
  // size keeps both out while still holding the ascenders and descenders.
  const above = label.size * PT_TO_MM * 0.8;
  const window = {
    x: label.x - 0.6,
    y: label.baseline - above,
    w: ref.w + 1.2,
    h: above + 0.5,
  };
  const a = inkBox(oursRaster, window);
  const b = inkBox(theirsRaster, window);
  if (!a || !b) {
    console.log(`${label.text.padEnd(33)} no ink in window`);
    continue;
  }

  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dw = a.w - b.w;
  const ratio = b.w / a.w;
  // Labels anchored to a rule are deliberately lifted off the reference's crowded
  // position, so only their horizontal placement and width are held to it.
  const lifted = label.anchoredAbove !== undefined;
  const flag =
    Math.abs(dx) > 0.15 || Math.abs(1 - ratio) > 0.02 || (!lifted && Math.abs(dy) > 0.15)
      ? ' <--'
      : lifted
        ? ' lifted'
        : '';
  console.log(
    `${label.text.slice(0, 32).padEnd(33)} ` +
      `${label.size.toFixed(1).padStart(4)} ` +
      `${dx.toFixed(2).padStart(6)} ${dy.toFixed(2).padStart(6)} ${dw.toFixed(2).padStart(6)} ` +
      `${(ratio * 100).toFixed(1).padStart(6)}  ${(label.size * ratio).toFixed(2).padStart(6)}${flag}`,
  );
}
