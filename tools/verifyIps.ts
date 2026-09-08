/**
 * Checks our IPS payloads against the National Bank's own validator.
 *
 * This is what established the two rules the written recommendations omit: text fields
 * reject Cyrillic, and model 97 references are checked for their check digits. Kept as
 * a script rather than a test because it needs the network and the service rate-limits;
 * run it after changing anything in `src/ips/`.
 *
 * Run with `npm run ips:verify`. Uses only the sample account from the NBS documentation,
 * never anyone's real details.
 */
import { buildIpsPayload } from '../src/ips/payload.ts';
import { emptySlip, type Slip } from '../src/model/slip.ts';

const VALIDATOR = 'https://nbs.rs/QRcode/api/qr/v1/validate?lang=en';
const PAUSE_MS = 2500;

/** From the specification's own example, so no real recipient is sent anywhere. */
const SAMPLE_ACCOUNT = '845-0000000404849-87';

const slip = (over: Partial<Slip>): Slip => ({
  ...emptySlip('verify'),
  primalac: 'JP EPS BEOGRAD\nBALKANSKA 13',
  racunPrimaoca: SAMPLE_ACCOUNT,
  oblikPlacanja: '1',
  osnovPlacanja: '89',
  valuta: 'RSD',
  iznos: '3.596,13',
  ...over,
});

interface Case {
  name: string;
  slip: Slip;
  /** Set when we expect our own builder to refuse before reaching the validator. */
  expectLocalReject?: boolean;
}

const CASES: Case[] = [
  { name: 'minimal', slip: slip({}) },
  { name: 'with purpose', slip: slip({ svrhaUplate: 'UPLATA PO RACUNU ZA EL. ENERGIJU' }) },
  { name: 'model 97, valid', slip: slip({ model: '97', pozivNaBroj: '18163220000111111' }) },
  { name: 'model 97, wrong check digits', slip: slip({ model: '97', pozivNaBroj: '163220000111111' }), expectLocalReject: true },
  { name: 'no model, plain reference', slip: slip({ model: '', pozivNaBroj: '1234' }) },
  { name: 'model 11', slip: slip({ model: '11', pozivNaBroj: '1234567' }) },
  { name: 'cyrillic recipient (transliterated)', slip: slip({ primalac: 'ЈП ЕПС БЕОГРАД\nБАЛКАНСКА 13' }) },
  { name: 'cyrillic purpose (transliterated)', slip: slip({ svrhaUplate: 'Уплата по рачуну за струју' }) },
  { name: 'serbian diacritics', slip: slip({ primalac: 'ČIGRA DOO LESKOVAC', svrhaUplate: 'Uplata za usluge održavanja' }) },
  { name: 'amount without decimals', slip: slip({ iznos: '1025' }) },
  { name: 'amount with thousands separator', slip: slip({ iznos: '1.234.567,89' }) },
  { name: 'single-line recipient', slip: slip({ primalac: 'Čigra' }) },
  { name: 'russian-only characters', slip: slip({ primalac: 'ООО Ы Э Ъ' }), expectLocalReject: true },
];

let failures = 0;

for (const testCase of CASES) {
  const { text, problems } = buildIpsPayload(testCase.slip);

  if (!text) {
    const ok = testCase.expectLocalReject === true;
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${testCase.name.padEnd(38)} rejected locally: ` +
        problems.map((p) => `${p.field}/${p.code}`).join('; ').slice(0, 80),
    );
    continue;
  }

  if (testCase.expectLocalReject) {
    failures += 1;
    console.log(`FAIL ${testCase.name.padEnd(38)} expected a local rejection, got a payload`);
    continue;
  }

  const response = await fetch(VALIDATOR, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: text,
  });
  const json = (await response.json()) as { s?: { code?: number; desc?: string } };
  const ok = json.s?.code === 0;
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${testCase.name.padEnd(38)} ` +
      `${json.s?.code} ${json.s?.desc ?? ''} (${Buffer.byteLength(text, 'utf8')} bytes)`,
  );

  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

console.log(failures === 0 ? '\nall accepted by the NBS validator' : `\n${failures} case(s) failed`);
process.exit(failures === 0 ? 0 : 1);
