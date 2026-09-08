/**
 * Serbian Cyrillic to Serbian Latin.
 *
 * The NBS validator rejects Cyrillic in the QR's text fields — probing it with
 * `N:ЈП ЕПС БЕОГРАД` returns 608 "Invalid field format", while the same name in Latin
 * with diacritics (`ČIGRA DOO LESKOVAC`) passes. The recommendations do not say this;
 * it was found by testing against the validator (`npm run ips:verify`).
 *
 * Transliterating rather than rejecting is right for Serbian: the two scripts are
 * officially equivalent and the mapping is one-to-one, so a name typed in Cyrillic on
 * the slip carries over unchanged in meaning.
 */

/** Digraphs first: Љ, Њ and Џ each map to two Latin letters. */
const MAP: Record<string, string> = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Ђ: 'Đ', Е: 'E', Ж: 'Ž', З: 'Z', И: 'I',
  Ј: 'J', К: 'K', Л: 'L', Љ: 'Lj', М: 'M', Н: 'N', Њ: 'Nj', О: 'O', П: 'P', Р: 'R',
  С: 'S', Т: 'T', Ћ: 'Ć', У: 'U', Ф: 'F', Х: 'H', Ц: 'C', Ч: 'Č', Џ: 'Dž', Ш: 'Š',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i',
  ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
};

/**
 * Uppercase digraphs inside an all-caps word: "ЉИЉАНА" should become "LJILJANA", not
 * "LjILJANA".
 */
function isUpper(ch: string | undefined): boolean {
  return ch !== undefined && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

export function toSerbianLatin(text: string): string {
  const chars = [...text];
  return chars
    .map((ch, i) => {
      const mapped = MAP[ch];
      if (mapped === undefined) return ch;
      if (mapped.length === 2 && isUpper(ch)) {
        // Follow the case of the next letter, so ЉИЉАНА -> LJILJANA and Љиљана -> Ljiljana.
        const next = chars[i + 1];
        if (next !== undefined && MAP[next] !== undefined && isUpper(next)) {
          return mapped.toUpperCase();
        }
      }
      return mapped;
    })
    .join('');
}

/**
 * Characters the QR's text fields accept: Latin letters including Serbian diacritics,
 * digits, spaces and the special characters listed in the recommendations.
 */
const ALLOWED = /^[A-Za-zČĆĐŠŽčćđšž0-9 \r\n!"#$%&'()*+,\-./:;<=>?@[\]^_`{}~‘’„”"]*$/;

/** Reports characters that would make the validator reject the field. */
export function unsupportedCharacters(text: string): string[] {
  if (ALLOWED.test(text)) return [];
  return [...new Set([...text].filter((ch) => !ALLOWED.test(ch)))];
}
