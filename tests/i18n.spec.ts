/**
 * Every locale must be complete, and every string the code asks for must exist.
 *
 * The non-counted keys are enforced by the type system already; what it cannot check is
 * the counted phrases, whose plural forms differ by language, and whether a key used in
 * a component actually exists in the dictionaries.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES, type Language } from '../src/i18n/index.ts';
import {
  describeCode,
  PAYMENT_FORMS,
  PAYMENT_GROUNDS,
  REFERENCE_MODELS,
} from '../src/data/paymentCodes.ts';

const codes = Object.keys(LANGUAGES) as Language[];

/** Plural categories a language actually uses, per the Unicode rules. */
function categoriesOf(language: Language): string[] {
  const rules = new Intl.PluralRules(language);
  const seen = new Set<string>();
  for (const n of [0, 1, 2, 3, 4, 5, 11, 21, 22, 100, 101]) seen.add(rules.select(n));
  return [...seen];
}

describe.each(codes)('the %s locale', (code) => {
  const dictionary = LANGUAGES[code];

  it('carries a form for every plural category the language uses', () => {
    const counted: Record<string, string> = dictionary.counted;
    for (const base of ['slips', 'sheets']) {
      for (const category of categoriesOf(code)) {
        expect(counted[`${base}_${category}`], `${code}: missing ${base}_${category}`).toBeTruthy();
      }
    }
  });

  it('leaves no string empty', () => {
    const walk = (value: unknown, path: string) => {
      if (typeof value === 'string') {
        expect(value.trim(), `${code}: ${path} is empty`).not.toBe('');
        return;
      }
      for (const [key, inner] of Object.entries(value as object)) walk(inner, `${path}.${key}`);
    };
    walk(dictionary, code);
  });

  it('glosses every payment code', () => {
    for (const list of [PAYMENT_FORMS, PAYMENT_GROUNDS, REFERENCE_MODELS]) {
      for (const entry of list) {
        expect(entry.sr, `sr gloss for ${entry.value}`).toBeTruthy();
        expect(entry.ru, `ru gloss for ${entry.value}`).toBeTruthy();
        expect(entry.en, `en gloss for ${entry.value}`).toBeTruthy();
      }
    }
  });
});

describe('describeCode', () => {
  const cash = PAYMENT_FORMS.find((c) => c.value === '1')!;

  it.each([
    ['ru', 'Наличными'],
    ['en', 'Cash'],
    ['sr', 'Gotovinski'],
  ])('describes a code in %s', (language, expected) => {
    expect(describeCode(cash, language)).toBe(expected);
  });

  it('ignores the region subtag a browser may report', () => {
    // The detector is set to languageOnly, but resolvedLanguage is not guaranteed to be
    // bare, and a regional tag falling through to Serbian would be silent.
    expect(describeCode(cash, 'en-US')).toBe('Cash');
    expect(describeCode(cash, 'ru-RS')).toBe('Наличными');
  });

  it('falls back to the official Serbian for a language it does not gloss', () => {
    expect(describeCode(cash, 'de')).toBe(cash.sr);
  });

  it('describes every code in every language, never emptily', () => {
    for (const list of [PAYMENT_FORMS, PAYMENT_GROUNDS, REFERENCE_MODELS]) {
      for (const entry of list) {
        for (const language of ['ru', 'sr', 'en']) {
          expect(describeCode(entry, language).trim(), `${language} ${entry.value}`).not.toBe('');
        }
      }
    }
  });
});

describe('keys used by the interface', () => {
  /** Every t('...') literal found in the source. */
  function usedKeys(): string[] {
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = readFileSync(path, 'utf8');
          for (const m of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) found.add(m[1]);
          for (const m of source.matchAll(/i18nKey="([a-zA-Z0-9_.]+)"/g)) found.add(m[1]);
        }
      }
    };
    walk('src');
    return [...found];
  }

  it.each(codes)('%s defines every key the interface asks for', (code) => {
    const { counted, ...rest } = LANGUAGES[code];
    const flat = new Set<string>();
    const walk = (value: unknown, path: string[]) => {
      if (typeof value === 'string') {
        flat.add(path.join('.'));
        return;
      }
      for (const [key, inner] of Object.entries(value as object)) walk(inner, [...path, key]);
    };
    walk(rest, []);
    // Counted phrases are looked up by their base name; i18next appends the suffix.
    for (const key of Object.keys(counted)) flat.add(key.replace(/_(one|few|many|other)$/, ''));

    for (const key of usedKeys()) {
      // Keys built from a field name at runtime, e.g. `fields.${name}`, are covered by
      // the payment-code and field tests instead.
      if (key.startsWith('ips.') || key.startsWith('fields.')) continue;
      expect(flat.has(key), `${code}: missing "${key}"`).toBe(true);
    }
  });
});
