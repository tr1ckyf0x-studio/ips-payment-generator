/**
 * Where each language lives.
 *
 * A search engine can only offer one page per URL, so three languages need three URLs.
 * Russian keeps the root — it is what the site already answered on — and the other two
 * take a prefix. `hreflang` in each page's head ties the three together, and the root
 * carries `x-default` as the one that negotiates.
 *
 * An explicit prefix is an explicit choice and wins over the browser's own preference;
 * the root still detects, so a first-time visitor is not forced into Russian.
 */
import type { Language } from './index.ts';

export const SITE_ORIGIN = 'https://ips.tr1ckyf0x.dev';

const PATHS = { ru: '/', sr: '/sr/', en: '/en/' } as const satisfies Record<Language, string>;

/** The path this language is served from, always with its trailing slash. */
export function pathFor(language: Language): string {
  return PATHS[language];
}

/** The absolute URL, for canonical and hreflang tags. */
export function urlFor(language: Language): string {
  return SITE_ORIGIN + pathFor(language);
}

/**
 * The language a path asks for, or `undefined` for the root, which asks for none.
 *
 * Tolerates a missing trailing slash, since `/sr` and `/sr/` are the same page to
 * Cloudflare's asset server and to anyone typing by hand.
 */
export function languageFromPath(pathname: string): Language | undefined {
  const segment = pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  if (!segment) return undefined;
  const found = (Object.keys(PATHS) as Language[]).find(
    (language) => PATHS[language] === `/${segment}/`,
  );
  return found;
}
