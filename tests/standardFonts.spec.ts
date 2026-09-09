/**
 * The stub that keeps `@pdf-lib/standard-fonts` out of the bundle.
 *
 * What this file can check is the stub's own shape: `pdf-lib` reads `FontNames` at module
 * scope and the encoding tables when it embeds, so getting either wrong breaks the
 * library rather than saving bytes. What it cannot check is that `pdf-lib` receives the
 * stub — vitest loads `pdf-lib` from its CommonJS build, outside vite's transform, so the
 * alias does not reach it here. `tests/bundle.spec.ts` checks the artifact instead.
 */
import { describe, expect, it } from 'vitest';
import { Encodings, Font, FontNames, STANDARD_FONT_MESSAGE } from '../src/pdf/standardFonts.ts';

type Stub = typeof import('../src/pdf/standardFonts.ts');

describe('the standard-font stub', () => {
  it('is what an import of the package name resolves to', async () => {
    // Only proves the alias resolves; that pdf-lib's own import is rewritten is a
    // property of the build, checked in bundle.spec.ts.
    const resolved = (await import('@pdf-lib/standard-fonts')) as unknown as Stub;
    expect(resolved.STANDARD_FONT_MESSAGE, 'the alias is not in force').toBe(
      STANDARD_FONT_MESSAGE,
    );
  });

  it('keeps the names pdf-lib reads at module scope', () => {
    // `pdf-lib/utils/objects` evaluates `values(FontNames)` on import, and
    // `isStandardFont` checks against the result, so these must be the real fourteen.
    const names = Object.values(FontNames);
    expect(names).toHaveLength(14);
    for (const expected of ['Helvetica', 'Times-Roman', 'Courier', 'Symbol', 'ZapfDingbats']) {
      expect(names).toContain(expected);
    }
  });

  it('keeps the encoding tables real, since they are small and not ours to reinvent', () => {
    expect(Object.keys(Encodings)).toEqual(
      expect.arrayContaining(['WinAnsi', 'Symbol', 'ZapfDingbats']),
    );
  });

  it('throws a message naming the cause when asked for metrics it dropped', () => {
    // A plausible-looking fallback would print a slip in metrics the layout was never
    // calibrated against; the stack trace is the cheaper failure.
    expect(() => Font.load('Helvetica')).toThrow(/does not carry the standard PDF font metrics/);
    expect(() => Font.load('Helvetica')).toThrow(/vite\.config\.ts/);
    expect(STANDARD_FONT_MESSAGE).toContain('embedFont(bytes)');
  });
});
