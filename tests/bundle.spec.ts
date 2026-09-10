/**
 * Two properties of the shipped bundle that nothing else can check.
 *
 * These are asserted on the artifact rather than the module graph, because the two
 * differ: vitest loads `pdf-lib` from its CommonJS build, outside vite's transform, so
 * the alias in `vite.config.ts` does not apply here — a test importing `pdf-lib` gets the
 * real `@pdf-lib/standard-fonts` and would pass whether or not the browser build does.
 * What ships is what the build emits, so that is what is measured.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';

/**
 * A zlib stream in base64: 0x78 0x9c encodes as "eJy". Each of the fourteen standard
 * fonts is one, so a long run like this is font metrics and nothing else. Twelve of them
 * were in the bundle before the alias.
 */
const COMPRESSED_PAYLOAD = /eJy[A-Za-z0-9+\/]{200,}/g;

/**
 * The entry chunk measured 300.8 kB once the PDF pipeline was made lazy, against 1687 kB
 * when it was not. The ceiling is loose enough for ordinary growth and tight enough to
 * catch a static import that drags pdf-lib, fontkit or pdf.js back into the first load.
 */
const ENTRY_CEILING = 450 * 1024;

let chunks: Array<{ name: string; code: string }>;
let entry: { name: string; code: string };
let outDir: string;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'bundle-'));
  // Explicitly production. vitest runs with NODE_ENV=test, which vite carries into the
  // bundle, and React would ship its development build — 200 kB that never reaches a
  // user, making the size ceiling below meaningless. `mode` alone does not undo it.
  await build({
    mode: 'production',
    logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { outDir, sourcemap: false, emptyOutDir: true },
  });

  const assets = join(outDir, 'assets');
  chunks = readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((name) => ({ name, code: readFileSync(join(assets, name), 'utf8') }));

  // Ask the page which chunk it loads rather than guessing from the file name: adding
  // the per-language entry points renamed it from index-*.js to main-*.js, and this
  // test failed for that alone.
  const html = readFileSync(join(outDir, 'index.html'), 'utf8');
  const src = /<script[^>]+type="module"[^>]+src="\/assets\/([^"]+)"/.exec(html)?.[1];
  expect(src, 'the page loads no module script').toBeDefined();
  const found = chunks.find((c) => c.name === src);
  expect(found, `the build emitted no chunk named ${src}`).toBeDefined();
  entry = found!;
}, 120_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('the built bundle', () => {
  it('is the real application, not an empty build', () => {
    // Guards the assertions below from passing vacuously.
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.reduce((n, c) => n + c.code.length, 0)).toBeGreaterThan(1_000_000);
    expect(chunks.some((c) => c.code.includes('НАЛОГ ЗА УПЛАТУ'))).toBe(true);
  });

  it('emits a page for every language', () => {
    // The head tags themselves are checked in seo.spec.ts, off the sources; what can
    // only be seen here is whether the build was told about all three entry points.
    for (const page of ['index.html', 'sr/index.html', 'en/index.html']) {
      expect(existsSync(join(outDir, page)), `${page} was not built`).toBe(true);
    }
    for (const asset of ['robots.txt', 'sitemap.xml', '404.html', 'icon.svg', 'og.png']) {
      expect(existsSync(join(outDir, asset)), `${asset} did not reach the output`).toBe(true);
    }
  });

  it('carries no standard PDF font metrics, in any chunk', () => {
    const guilty = chunks
      .map((c) => ({ name: c.name, blobs: (c.code.match(COMPRESSED_PAYLOAD) ?? []).length }))
      .filter((c) => c.blobs > 0);
    expect(
      guilty,
      'the @pdf-lib/standard-fonts alias in vite.config.ts is not taking effect',
    ).toEqual([]);
  });

  it('keeps the PDF pipeline out of the first load', () => {
    const size = Buffer.byteLength(entry.code);
    expect(
      size,
      `the entry chunk is ${(size / 1024).toFixed(0)} kB: something the form does not ` +
        'need to paint is being imported statically — see src/ui/usePdfDocument.ts',
    ).toBeLessThan(ENTRY_CEILING);

    // The pipeline still has to be in the output, just not in the entry chunk.
    const worker = readdirSync(join(outDir, 'assets')).find((f) => f.includes('pdf.worker'));
    expect(worker, 'the pdf.js worker was not emitted').toBeDefined();
    expect(statSync(join(outDir, 'assets', worker!)).size).toBeGreaterThan(100_000);
  });
});
