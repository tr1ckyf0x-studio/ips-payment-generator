/**
 * One payment slip's data, plus the formatting rules the blank expects.
 *
 * "место и датум пријема" and "датум извршења" are deliberately not here: the bank or
 * menjačnica writes them in when it takes the payment, as the OPTIMUM scans show. Their
 * rules and wording are still drawn on the blank — the space to write into is needed.
 */

export interface Slip {
  id: string;
  /** Payer: name and address, up to three lines. */
  platilac: string;
  /** Purpose of payment, up to three lines. */
  svrhaUplate: string;
  /** Recipient: name and address, up to three lines. */
  primalac: string;
  /**
   * The šifra plaćanja is kept as the two things the user actually picks rather than
   * as the concatenated code: a single string could not distinguish "form 1, no ground
   * yet" from "ground 21, no form yet", which would make either half unselectable
   * until the other was set.
   */
  oblikPlacanja: string;
  osnovPlacanja: string;
  valuta: string;
  /** Amount as typed, e.g. "5.200,00". */
  iznos: string;
  /** Recipient account, 18 digits with or without dashes. */
  racunPrimaoca: string;
  model: string;
  pozivNaBroj: string;
  /** "način izvršenja - hitno", introduced by 65/2018. Not yet drawn. */
  hitno: boolean;
}

export const MAX_BLOCK_LINES = 3;

export function emptySlip(id: string): Slip {
  return {
    id,
    platilac: '',
    svrhaUplate: '',
    primalac: '',
    oblikPlacanja: '',
    osnovPlacanja: '',
    valuta: 'RSD',
    iznos: '',
    racunPrimaoca: '',
    model: '',
    pozivNaBroj: '',
    hitno: false,
  };
}

/**
 * The three-digit payment code as printed on the blank, or an empty string while
 * either half is still unset.
 */
export function sifraPlacanja(slip: Slip): string {
  return slip.oblikPlacanja && slip.osnovPlacanja
    ? `${slip.oblikPlacanja}${slip.osnovPlacanja}`
    : '';
}

/** Splits a block field into the at most three lines the blank has room for. */
export function blockLines(text: string): string[] {
  return text.split('\n').slice(0, MAX_BLOCK_LINES);
}

/** Formats an 18-digit account as XXX-XXXXXXXXXXXXX-XX; passes anything else through. */
export function formatAccount(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 18) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 16)}-${digits.slice(16)}`;
}

/** The account as the IPS QR wants it: bare digits. */
export function accountDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}
