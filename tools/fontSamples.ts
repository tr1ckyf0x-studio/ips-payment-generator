/**
 * Renders the same slip in several candidate faces, for choosing one by eye.
 *
 * Every candidate is sized so its capitals are the same height as on the OPTIMUM scans
 * (2.76 mm), so the sheets differ in the shape and width of the type, not in how big it
 * looks. The face's name goes in the "svrha uplate" field of its own slip.
 *
 * Run with `npm run fonts`. Writes `.visual/font-samples.pdf`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import fontkit from '@pdf-lib/fontkit';
import { pausalProfile } from '../src/layout/formSpec.ts';
import { renderDocument } from '../src/pdf/renderer.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';
import type { FormProfile } from '../src/layout/types.ts';

const OUT_DIR = '.visual';
const PT_TO_MM = 25.4 / 72;

/** Cap height of the machine-printed data on references/scans/optimum-2026-09-04.pdf. */
const TARGET_CAP_MM = 2.76;

/**
 * The faces compared when the value type was chosen.
 *
 * Only the two the app actually ships are kept in the repository; the rest are fetched
 * on demand into `.visual/fonts/`. Keeping a megabyte of rejected typefaces in version
 * control to support a tool that runs once in a blue moon is not a trade worth making,
 * and these are public files a URL away.
 */
const CANDIDATES: Array<{ name: string; path: string; url?: string }> = [
  {
    name: 'PT Sans Narrow',
    path: '.visual/fonts/PTSansNarrow-Regular.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/ptsansnarrow/PT_Sans-Narrow-Web-Regular.ttf',
  },
  { name: 'Roboto Condensed', path: 'src/assets/fonts/RobotoCondensed-Regular.ttf' },
  {
    name: 'Roboto',
    path: '.visual/fonts/Roboto-Regular.ttf',
    url: 'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Regular.ttf',
  },
  {
    name: 'Roboto Medium',
    path: '.visual/fonts/Roboto-Medium.ttf',
    url: 'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Medium.ttf',
  },
  { name: 'Liberation Sans (Arial)', path: 'src/assets/fonts/LiberationSans-Regular.ttf' },
];

/** Downloads a candidate the repository does not carry, once. */
async function ensure(candidate: { name: string; path: string; url?: string }): Promise<string> {
  if (existsSync(candidate.path)) return candidate.path;
  if (!candidate.url) throw new Error(`${candidate.name} is missing and has no source`);
  mkdirSync(dirname(candidate.path), { recursive: true });
  const response = await fetch(candidate.url);
  if (!response.ok) throw new Error(`${candidate.name}: ${response.status} from ${candidate.url}`);
  writeFileSync(candidate.path, Buffer.from(await response.arrayBuffer()));
  console.log(`fetched ${candidate.name}`);
  return candidate.path;
}

const blank = {
  regular: readFileSync('src/assets/fonts/LiberationSans-Regular.ttf'),
  bold: readFileSync('src/assets/fonts/LiberationSans-Bold.ttf'),
};

function sample(face: string): Slip {
  return {
    ...emptySlip(face),
    platilac: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
    svrhaUplate: `ŠRIFT: ${face}`,
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

/** Point size at which this face's capitals stand TARGET_CAP_MM tall. */
function sizeForCapHeight(path: string): number {
  const font = (fontkit as unknown as { create(b: Buffer): { capHeight: number; unitsPerEm: number } })
    .create(readFileSync(path));
  const capEm = font.capHeight / font.unitsPerEm;
  return TARGET_CAP_MM / capEm / PT_TO_MM;
}

/** The layout with every value slot resized to `size`. */
function withValueSize(size: number): FormProfile {
  return { ...pausalProfile, slots: pausalProfile.slots.map((s) => ({ ...s, size })) };
}

mkdirSync(OUT_DIR, { recursive: true });

const pages: Uint8Array[] = [];
console.log('face                       size    sample width');
for (const candidate of CANDIDATES) {
  const { name } = candidate;
  const path = await ensure(candidate);
  const size = sizeForCapHeight(path);
  const { bytes } = await renderDocument([sample(name)], {
    profile: withValueSize(size),
    fonts: { ...blank, narrow: readFileSync(path) },
  });
  pages.push(bytes);
  console.log(`${name.padEnd(26)} ${size.toFixed(2).padStart(5)} pt`);
}

// One slip per page keeps each face on its own sheet; merge them into a single file.
const files = pages.map((bytes, i) => {
  const p = `${OUT_DIR}/font-${i}.pdf`;
  writeFileSync(p, bytes);
  return p;
});
execFileSync('pdfunite', [...files, `${OUT_DIR}/font-samples.pdf`]);
execFileSync('pdftoppm', ['-png', '-r', '150', `${OUT_DIR}/font-samples.pdf`, `${OUT_DIR}/font-sample`]);

console.log(`\n${OUT_DIR}/font-samples.pdf: ${CANDIDATES.length} faces, one per page`);
console.log(
  `each face is sized to ${TARGET_CAP_MM} mm capitals, the height measured on the ` +
    'OPTIMUM scans, so the sheets differ only in the shape and width of the type',
);
