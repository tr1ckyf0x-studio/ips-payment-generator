/**
 * The three language pages, checked for the things a search engine reads.
 *
 * They are three hand-written files rather than one generated from a template, so the
 * risk is drift: a tag fixed on one page and forgotten on the others. These assertions
 * are what makes that cheap to catch — every page must carry the same set of alternates,
 * and each must point its canonical at itself.
 *
 * The source files are read rather than the build, because nothing here is transformed
 * on the way out and a build is slow. `tests/bundle.spec.ts` checks that all three are
 * actually emitted.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LANGUAGES, type Language } from '../src/i18n/index.ts';
import { pathFor, SITE_ORIGIN, urlFor } from '../src/i18n/routing.ts';

const SOURCES: Record<Language, string> = {
  ru: 'index.html',
  sr: 'sr/index.html',
  en: 'en/index.html',
};

const languages = Object.keys(LANGUAGES) as Language[];
const pages = Object.fromEntries(
  languages.map((language) => [language, readFileSync(SOURCES[language], 'utf8')]),
) as Record<Language, string>;

const attribute = (html: string, tag: RegExp): string | undefined => tag.exec(html)?.[1];

describe.each(languages)('the %s page', (language) => {
  const html = pages[language];

  it('declares the language it is written in', () => {
    expect(attribute(html, /<html lang="([^"]+)"/)).toBe(language);
  });

  it('has a title and a description worth showing in a result', () => {
    const title = attribute(html, /<title>([^<]+)<\/title>/);
    expect(title, 'no title').toBeTruthy();
    // Google truncates a result title around 60 characters and a description around 160.
    expect(title!.length).toBeLessThanOrEqual(70);

    const description = attribute(html, /<meta\s+name="description"\s+content="([^"]+)"/s);
    expect(description, 'no description').toBeTruthy();
    expect(description!.length).toBeGreaterThan(80);
  });

  it('points its canonical at itself', () => {
    expect(attribute(html, /<link rel="canonical" href="([^"]+)"/)).toBe(urlFor(language));
  });

  it('lists every language as an alternate, plus a default', () => {
    const alternates = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(
      (m) => [m[1], m[2]] as const,
    );
    const byLang = Object.fromEntries(alternates);
    for (const other of languages) {
      expect(byLang[other], `${other} is not linked from ${language}`).toBe(urlFor(other));
    }
    expect(byLang['x-default'], 'no x-default').toBe(urlFor('ru'));
  });

  it('offers a picture for a link card', () => {
    // Without one a messenger shows a bare link, which is what prompted this. The size
    // is stated so a scraper need not fetch the file to lay the card out.
    const meta = (property: string) =>
      attribute(html, new RegExp(`<meta property="${property}" content="([^"]+)"`));
    expect(meta('og:image')).toBe(`${SITE_ORIGIN}/og.png`);
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    expect(meta('og:image:alt'), 'no alt text').toBeTruthy();
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('says what the page is before any script runs', () => {
    // The crawler's first pass sees this and nothing else; React replaces it on mount.
    const intro = /<div class="intro">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
    const words = intro
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    expect(words.length, 'the pre-render copy is too thin to describe anything').toBeGreaterThan(40);
    expect(intro).toContain('<h1>');
  });

  it('reaches the other languages by a plain link, not only by script', () => {
    for (const other of languages.filter((l) => l !== language)) {
      expect(html, `${language} does not link to ${other}`).toContain(`href="${pathFor(other)}"`);
    }
  });
});

describe('the headers Cloudflare is told to send', () => {
  const headers = readFileSync('public/_headers', 'utf8');
  const policy = /Content-Security-Policy: (.+)/.exec(headers)?.[1] ?? '';
  const directive = (name: string) =>
    policy
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `));

  it('lets the page reach nothing but itself', () => {
    // This is the app's one promise made enforceable: it cannot post anywhere, and it
    // cannot open a connection to any other origin. Widening either would make the
    // README's claim untrue without anything else noticing.
    expect(directive('connect-src')).toBe("connect-src 'self' blob: data:");
    expect(directive('form-action')).toBe("form-action 'none'");
    expect(directive('default-src')).toBe("default-src 'self'");
  });

  it('refuses to be framed or to have its base rewritten', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive('base-uri')).toBe("base-uri 'none'");
    expect(directive('object-src')).toBe("object-src 'none'");
  });

  it('still allows what the app genuinely needs', () => {
    // Verified by serving the build under this exact policy and finding the console
    // clean: pdf.js needs a worker of its own and WebAssembly, and the pages carry an
    // inline style block.
    expect(directive('worker-src')).toContain('blob:');
    expect(directive('script-src')).toContain("'wasm-unsafe-eval'");
    expect(directive('style-src')).toContain("'unsafe-inline'");
  });

  it('sends the small headers that cost nothing', () => {
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('Referrer-Policy: no-referrer');
    expect(headers).toMatch(/Permissions-Policy: .*camera=\(\)/);
  });
});

describe('robots and sitemap', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');
  const sitemap = readFileSync('public/sitemap.xml', 'utf8');

  it('lets everything be crawled and names the sitemap', () => {
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  it('lists exactly the pages that exist', () => {
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(listed.sort()).toEqual(languages.map(urlFor).sort());
  });
});
