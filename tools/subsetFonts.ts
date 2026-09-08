/**
 * Cuts the bundled typefaces down to the characters this app can actually print.
 *
 * Full Liberation Sans and Roboto Condensed are about 1.3 MB together, and every visitor
 * downloads them. The blank's own wording uses forty distinct characters; the two faces
 * that draw it need nothing more. Values are whatever the user types, so the face that
 * draws those keeps Latin, Serbian diacritics and Cyrillic.
 *
 * Run with `npm run fonts:subset`, which rewrites the files in `src/assets/fonts`. The
 * result is committed: this is a one-off preparation step, not part of the build.
 * `tests/fonts.spec.ts` fails if the blank ever asks for a character that was cut.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import subsetFont from 'subset-font';
import { PROFILES } from '../src/layout/formSpec.ts';

const FONTS = 'src/assets/fonts';
const CACHE = '.visual/fonts/originals';

/**
 * Sources for the unabridged faces.
 *
 * Subsetting must start from the original every time. Running it over the file already
 * in `src/assets/fonts` would cut a subset out of a subset, and a character dropped that
 * way cannot come back — so the originals are fetched rather than read from the repo.
 *
 * Liberation publishes built TTFs only inside a release tarball; the repository itself
 * carries FontForge sources.
 */
const LIBERATION_TARBALL =
  'https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz';
const ROBOTO_CONDENSED =
  'https://github.com/googlefonts/roboto-2/raw/main/src/hinted/RobotoCondensed-Regular.ttf';

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function original(file: string): Promise<Buffer> {
  const cached = `${CACHE}/${file}`;
  if (existsSync(cached)) return readFileSync(cached);
  mkdirSync(CACHE, { recursive: true });

  if (file.startsWith('Liberation')) {
    const tarball = `${CACHE}/liberation.tar.gz`;
    if (!existsSync(tarball)) writeFileSync(tarball, await download(LIBERATION_TARBALL));
    execFileSync('tar', ['-xzf', tarball, '-C', CACHE, '--strip-components=1',
      `liberation-fonts-ttf-2.1.5/${file}`]);
  } else {
    writeFileSync(cached, await download(ROBOTO_CONDENSED));
  }

  console.log(`fetched the original ${file}`);
  return readFileSync(cached);
}

/** Every character the pre-printed wording of any blank uses. */
function blankCharacters(): string {
  const chars = new Set<string>();
  for (const profile of Object.values(PROFILES)) {
    for (const item of profile.primitives) {
      if (item.kind === 'label') for (const ch of item.text) chars.add(ch);
    }
  }
  // Digits and the punctuation a caption could reasonably gain later.
  for (const ch of '0123456789.,-–—:;()/ ') chars.add(ch);
  return [...chars].join('');
}

function range(from: number, to: number): string {
  let out = '';
  for (let code = from; code <= to; code += 1) out += String.fromCodePoint(code);
  return out;
}

/**
 * What a value can contain: printable ASCII, the Serbian Latin diacritics, and Cyrillic
 * — a payer may type the recipient in either script, and the blank prints it verbatim
 * even though the QR payload transliterates it.
 */
const VALUE_CHARACTERS =
  range(0x20, 0x7e) +
  'ČčĆćĐđŠšŽž' +
  range(0x0400, 0x045f) +
  '№€„""‘’–—…';

const TARGETS = [
  { file: 'LiberationSans-Regular.ttf', characters: blankCharacters() },
  { file: 'LiberationSans-Bold.ttf', characters: blankCharacters() },
  { file: 'RobotoCondensed-Regular.ttf', characters: VALUE_CHARACTERS },
];

console.log(`${'font'.padEnd(30)} ${'before'.padStart(8)} ${'after'.padStart(8)}  chars`);
for (const { file, characters } of TARGETS) {
  const source = await original(file);
  const subset = await subsetFont(source, characters, { targetFormat: 'truetype' });
  writeFileSync(`${FONTS}/${file}`, subset);
  console.log(
    `${file.padEnd(30)} ${`${Math.round(source.length / 1024)} KB`.padStart(8)} ` +
      `${`${Math.round(subset.length / 1024)} KB`.padStart(8)}  ${[...new Set(characters)].length}`,
  );
}
