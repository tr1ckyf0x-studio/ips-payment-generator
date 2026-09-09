import { describe, expect, it } from 'vitest';
import {
  accountDigits,
  blockLines,
  emptySlip,
  formatAccount,
  MAX_BLOCK_LINES,
  sifraPlacanja,
} from '../src/model/slip.ts';

describe('šifra plaćanja', () => {
  it('joins the two halves once both are set', () => {
    const slip = { ...emptySlip('a'), oblikPlacanja: '1', osnovPlacanja: '21' };
    expect(sifraPlacanja(slip)).toBe('121');
  });

  it.each([
    { oblikPlacanja: '1', osnovPlacanja: '' },
    { oblikPlacanja: '', osnovPlacanja: '21' },
    { oblikPlacanja: '', osnovPlacanja: '' },
  ])('prints nothing while a half is missing ($oblikPlacanja/$osnovPlacanja)', (parts) => {
    expect(sifraPlacanja({ ...emptySlip('a'), ...parts })).toBe('');
  });

  it('keeps each half independently selectable', () => {
    // Regression: storing the joined code meant picking one half cleared it, so
    // neither half could ever be chosen first.
    let slip = emptySlip('a');
    slip = { ...slip, oblikPlacanja: '1' };
    expect(slip.oblikPlacanja).toBe('1');
    slip = { ...slip, osnovPlacanja: '21' };
    expect(slip.oblikPlacanja).toBe('1');
    expect(slip.osnovPlacanja).toBe('21');
  });
});

describe('account formatting', () => {
  it('groups an 18-digit account the way the blank shows it', () => {
    expect(formatAccount('845000000040484987')).toBe('845-0000000404849-87');
  });

  it('reformats an already-grouped account consistently', () => {
    expect(formatAccount('845-0000000404849-87')).toBe('845-0000000404849-87');
  });

  it.each(['', '123', '84500000004048498712345'])('passes through %s unchanged', (input) => {
    expect(formatAccount(input)).toBe(input);
  });

  it('strips everything but digits for the QR payload', () => {
    expect(accountDigits('845-0000000404849-87')).toBe('845000000040484987');
  });

  // The three worked examples the recommendations use to state the rule for tag R,
  // `references/ips/nbs-preporuke-validacija.pdf`, item 10. An invoice prints the middle
  // part without its leading zeros, and the QR wants all eighteen digits.
  it.each([
    ['840-955845-10', '840000000095584510'],
    ['165-55-74', '165000000000005574'],
    ['310-1234567891211-86', '310123456789121186'],
  ])('pads %s to the eighteen digits the QR needs', (written, expected) => {
    expect(accountDigits(written)).toBe(expected);
  });

  it('prints a short account expanded, so paper and QR cannot disagree', () => {
    expect(formatAccount('165-55-74')).toBe('165-0000000000055-74');
    expect(accountDigits(formatAccount('165-55-74'))).toBe(accountDigits('165-55-74'));
  });

  it('pads only the middle part, since the bank and control lengths are fixed', () => {
    // Padding a two-digit control number would turn a typo into a plausible account.
    expect(accountDigits('16-55-74')).toBe('165574');
    expect(accountDigits('165-55-7')).toBe('165557');
  });
});

describe('block fields', () => {
  it(`keeps at most ${MAX_BLOCK_LINES} lines, which is all the blank prints`, () => {
    expect(blockLines('a\nb\nc\nd\ne')).toEqual(['a', 'b', 'c']);
  });

  it('keeps a single line as one line', () => {
    expect(blockLines('only')).toEqual(['only']);
  });
});
