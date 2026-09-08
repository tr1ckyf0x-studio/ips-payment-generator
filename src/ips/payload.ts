/**
 * Builds the NBS IPS QR payload.
 *
 * Written here rather than taken from a package: the format is a hundred lines of
 * string assembly plus rules that have to be enforced exactly, and the failure mode of
 * getting one wrong is a slip nobody can pay. The rules below are from
 * `references/ips/nbs-preporuke-validacija.pdf`, numbered as in that document.
 *
 * Shape: `TAG:value` pairs joined by `|`, no leading or trailing delimiter, and an
 * optional tag with no value is omitted entirely — `|S:|` is explicitly forbidden (2).
 */
import { accountDigits, sifraPlacanja, type Slip } from '../model/slip.ts';
import { toSerbianLatin, unsupportedCharacters } from './serbianLatin.ts';

/** Maximum lengths, in characters, from the recommendations. */
const LIMITS = {
  /** Recipient name and address (11). */
  N: 70,
  /** Payer name and address (13). */
  P: 70,
  /** Currency and amount (12). */
  I: 18,
  /** Purpose of payment (15). */
  S: 35,
  /** Model and reference number (16). */
  RO: 25,
} as const;

const MAX_BLOCK_ROWS = 3;

/**
 * A reason a slip cannot produce a payload.
 *
 * Carries a code and its parameters rather than a sentence: this module is pure format
 * logic and must not depend on the interface language. The form renders it.
 */
export interface IpsProblem {
  field: string;
  code:
    | 'accountDigits'
    | 'recipientRequired'
    | 'tooLong'
    | 'amountRequired'
    | 'amountLength'
    | 'codeRequired'
    | 'purposeTooLong'
    | 'referenceTooLong'
    | 'model97'
    | 'unsupportedCharacters';
  params?: Record<string, string | number>;
}

export interface IpsOptions {
  /**
   * Include the payer tag (P). It is optional (13), and the recommendations note the
   * bank may replace it with the holder of the account the money actually comes from —
   * which for a cash payment over the counter is not the person named on the slip. It
   * costs about 70 bytes, which matters at the stronger correction levels.
   */
  includePayer?: boolean;
}

export interface IpsPayload {
  /** The string to encode, or undefined when the slip cannot produce a valid one. */
  text?: string;
  problems: IpsProblem[];
}

/**
 * Amount as the I tag wants it: `RSD` then the figure with a decimal comma and no
 * thousands separators (12). "5.200,00" becomes "RSD5200,00".
 */
export function formatAmount(raw: string): string | undefined {
  const cleaned = raw.replace(/\s/g, '').replace(/\./g, '');
  if (!cleaned) return undefined;

  const match = /^(\d+)(?:,(\d{0,2}))?$/.exec(cleaned);
  if (!match) return undefined;

  const [, whole, fraction] = match;
  // The comma is mandatory; trailing decimal zeroes are not.
  return `RSD${whole},${fraction ?? ''}`;
}

/**
 * Model and reference number for the RO tag (16). A reference not derived from any
 * model is prefixed with `00`; anything else keeps the model's two digits.
 */
export function formatReference(model: string, reference: string): string | undefined {
  const trimmed = reference.trim();
  if (!trimmed) return undefined;
  return `${model || '00'}${trimmed}`;
}

/**
 * Collapses a block field to at most three lines joined by CRLF, as the spec shows, and
 * transliterates it: the validator rejects Cyrillic in these fields.
 */
function blockValue(raw: string): string {
  return toSerbianLatin(
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_BLOCK_ROWS)
      .join('\r\n'),
  );
}

/**
 * Check digits for a reference number under model 97 (ISO 7064 MOD 97-10).
 *
 * The validator enforces these: `RO:97163220000111111` comes back 608, and the same
 * reference with its correct check digits passes. The algorithm is confirmed against
 * the specification's own example, where reference 123412 yields check digits 14 and
 * the tag reads `RO:9714123412`.
 */
export function model97CheckDigits(base: string): string | undefined {
  if (!/^\d+$/.test(base)) return undefined;
  let remainder = 0;
  for (const digit of `${base}00`) remainder = (remainder * 10 + Number(digit)) % 97;
  return String(98 - remainder).padStart(2, '0');
}

/** True when a reference already carries valid model 97 check digits. */
export function isValidModel97(reference: string): boolean {
  if (!/^\d{3,}$/.test(reference)) return false;
  const expected = model97CheckDigits(reference.slice(2));
  return expected !== undefined && expected === reference.slice(0, 2);
}

/** Length in characters as the recommendations count them, newlines included. */
function length(value: string): number {
  return [...value].length;
}

export function buildIpsPayload(slip: Slip, options: IpsOptions = {}): IpsPayload {
  const { includePayer = true } = options;
  const problems: IpsProblem[] = [];
  const add = (field: string, code: IpsProblem['code'], params?: IpsProblem['params']) =>
    problems.push({ field, code, params });

  // R — recipient account: exactly 18 digits, no dashes (10).
  const account = accountDigits(slip.racunPrimaoca);
  if (account.length !== 18) {
    add('racunPrimaoca', 'accountDigits', { count: account.length });
  }

  // N — recipient, up to three lines and 70 characters (11).
  const recipient = blockValue(slip.primalac);
  if (!recipient) add('primalac', 'recipientRequired');
  else if (length(recipient) > LIMITS.N) {
    add('primalac', 'tooLong', { limit: LIMITS.N, count: length(recipient) });
  }

  // I — currency and amount (12).
  const amount = formatAmount(slip.iznos);
  if (!amount) add('iznos', 'amountRequired');
  else if (length(amount) < 5 || length(amount) > LIMITS.I) {
    add('iznos', 'amountLength', { limit: LIMITS.I, count: length(amount) });
  }

  // SF — payment code, three digits (14).
  const code = sifraPlacanja(slip);
  if (!/^\d{3}$/.test(code)) add('sifraPlacanja', 'codeRequired');

  // P — payer, optional (13).
  const payer = includePayer ? blockValue(slip.platilac) : '';
  if (payer && length(payer) > LIMITS.P) {
    add('platilac', 'tooLong', { limit: LIMITS.P, count: length(payer) });
  }

  // S — purpose, optional, a single line (15), transliterated like the other text.
  const purpose = toSerbianLatin(
    slip.svrhaUplate.split('\n').map((l) => l.trim()).filter(Boolean).join(' '),
  );
  if (purpose && length(purpose) > LIMITS.S) {
    add('svrhaUplate', 'purposeTooLong', { limit: LIMITS.S, count: length(purpose) });
  }

  // RO — model and reference, optional (16).
  const reference = formatReference(slip.model, slip.pozivNaBroj);
  if (reference) {
    if (length(reference) > LIMITS.RO) {
      add('pozivNaBroj', 'referenceTooLong', { limit: LIMITS.RO, count: length(reference) });
    }
    // The validator checks model 97's check digits, so a wrong reference would produce
    // a QR the bank refuses.
    if (slip.model === '97' && !isValidModel97(slip.pozivNaBroj.replace(/[\s-]/g, ''))) {
      const digits = slip.pozivNaBroj.replace(/[\s-]/g, '');
      const suggestion = model97CheckDigits(digits.slice(2));
      add('pozivNaBroj', 'model97', suggestion ? { base: digits.slice(2), digits: suggestion } : undefined);
    }
  }

  // Anything still outside the permitted character set would be rejected as a bad
  // field format, so name it rather than shipping a QR the bank refuses.
  for (const [field, value] of [
    ['primalac', recipient],
    ['svrhaUplate', purpose],
    ['platilac', payer],
  ] as const) {
    const bad = unsupportedCharacters(value);
    if (bad.length > 0) {
      add(field, 'unsupportedCharacters', { characters: bad.join(' ') });
    }
  }

  if (problems.length > 0) return { problems };

  // Tag order follows the examples in the specification.
  const tags: Array<[string, string | undefined]> = [
    ['K', 'PR'],
    ['V', '01'],
    ['C', '1'],
    ['R', account],
    ['N', recipient],
    ['I', amount],
    ['P', payer || undefined],
    ['SF', code],
    ['S', purpose || undefined],
    ['RO', reference],
  ];

  const text = tags
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .map(([tag, value]) => `${tag}:${value}`)
    .join('|');

  return { text, problems };
}
