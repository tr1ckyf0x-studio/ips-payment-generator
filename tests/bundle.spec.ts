/**
 * The shipped bundle must not carry the standard PDF font metrics.
 *
 * This checks the artifact rather than the module graph, because the two differ: vitest
 * loads `pdf-lib` from its CommonJS build, outside vite's transform, so the alias in
 * `vite.config.ts` does not apply here — a test importing `pdf-lib` gets the real
 * `@pdf-lib/standard-fonts` and would pass whether or not the browser build does. What
 * ships is what the build emits, so that is what is measured.
 *
 * The marker is the compressed AFM payload itself: each of the fourteen fonts is a
 * zlib stream in base64, so a long run beginning `eJy` is font data and nothing else.
 * Before the alias the chunk held twelve of them; after it, none.
 *
 * See `src/pdf/standardFonts.ts` for why they are not wanted.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';

/** A zlib stream in base64: 0x78 0x9c encodes as "eJy". */
const COMPRESSED_PAYLOAD = /eJy[A-Za-z0-9+/]{200,}/g;

let chunk: string;
let outDir: string;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'bundle-'));
  await build({ logLevel: 'error', build: { outDir, sourcemap: false, emptyOutDir: true } });
  const assets = join(outDir, 'assets');
  const entry = readdirSync(assets).find((f) => /^index-.*\.js$/.test(f));
  expect(entry, 'the build emitted no entry chunk').toBeDefined();
  chunk = readFileSync(join(assets, entry!), 'utf8');
}, 120_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('the built bundle', () => {
  it('is the real application, not an empty build', () => {
    // Guards the assertion below from passing vacuously.
    expect(chunk.length).toBeGreaterThan(500_000);
    expect(chunk).toContain('НАЛОГ ЗА УПЛАТУ');
  });

  it('carries no standard PDF font metrics', () => {
    const blobs = chunk.match(COMPRESSED_PAYLOAD) ?? [];
    expect(
      blobs.length,
      `${blobs.length} compressed font payload(s) in the bundle: the ` +
        '@pdf-lib/standard-fonts alias in vite.config.ts is not taking effect',
    ).toBe(0);
  });
});
