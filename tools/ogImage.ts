/**
 * Builds `public/og.png`, the picture a messenger or a search result shows for a link.
 *
 * Drawn from a real rendered slip rather than by hand, so it cannot drift into showing
 * something the generator no longer produces. The A4 page is cropped to its top cell —
 * one slip, 210 x 99 mm — and laid on the dark ground the site uses.
 *
 * 1200 x 630 is what the platforms ask for. The page is made that many *points*, so
 * rasterising at 72 dpi lands on exactly that many pixels with no resampling.
 *
 *   npm run og
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import { optimumProfile } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';

const WIDTH = 1200;
const HEIGHT = 630;
const MM = 72 / 25.4;
const BACKGROUND = rgb(0.102, 0.102, 0.102); // the site's own ground, #1a1a1a

/** The NBS documentation's sample payee, so nothing personal is baked into the image. */
const SAMPLE: Slip = {
  ...emptySlip('og'),
  platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
  svrhaUplate: 'Uplata po računu za el. energiju',
  primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
  oblikPlacanja: '1',
  osnovPlacanja: '21',
  valuta: 'RSD',
  iznos: '5.200,00',
  racunPrimaoca: '845-0000000404849-87',
  model: '97',
  pozivNaBroj: '18163220000111111',
};

const fonts = {
  regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
  bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
  narrow: readFileSync('src/assets/fonts/RobotoCondensed-Regular.ttf'),
};

async function main(): Promise<void> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([WIDTH, HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: BACKGROUND });

  const { bytes } = await renderDocument([SAMPLE], { profile: optimumProfile, fonts });
  const sheet = await PDFDocument.load(bytes);
  const [sheetPage] = sheet.getPages();
  const { height } = sheetPage.getSize();
  const cell = optimumProfile.height * MM;
  // Take the top cell by bounding box rather than by moving the page's own frame:
  // cropping the frame leaves the content where it was, and it would be drawn off the
  // top of the picture. A bounding box brings its own translation.
  const slip = await doc.embedPage(sheetPage, {
    left: 0,
    bottom: height - cell,
    right: optimumProfile.width * MM,
    top: height,
  });
  const scale = (WIDTH - 160) / slip.width;
  const drawn = { width: slip.width * scale, height: slip.height * scale };
  const at = { x: (WIDTH - drawn.width) / 2, y: (HEIGHT - drawn.height) / 2 };

  // The slip draws ink and nothing else — it has no background of its own, and against a
  // dark ground its black rules all but vanish. Lay a sheet of paper under it.
  const bleed = 18;
  page.drawRectangle({
    x: at.x - bleed,
    y: at.y - bleed,
    width: drawn.width + bleed * 2,
    height: drawn.height + bleed * 2,
    color: rgb(1, 1, 1),
  });
  page.drawPage(slip, { ...drawn, ...at });

  const dir = mkdtempSync(join(tmpdir(), 'og-'));
  try {
    const pdf = join(dir, 'og.pdf');
    writeFileSync(pdf, await doc.save());
    // -r 72 because the page is sized in points: one point becomes one pixel.
    execFileSync('pdftoppm', ['-png', '-r', '72', '-singlefile', pdf, 'public/og']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('public/og.png: %d x %d, from a real rendered slip', WIDTH, HEIGHT);
}

await main();
