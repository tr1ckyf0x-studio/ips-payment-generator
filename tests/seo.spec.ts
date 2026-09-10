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
