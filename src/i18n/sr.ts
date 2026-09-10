/**
 * Serbian, in Latin script.
 *
 * Latin rather than Cyrillic because that is what goes into the fields — the QR payload
 * rejects Cyrillic outright — while the blank's own pre-printed wording stays Cyrillic
 * regardless of interface language, since that is how the form is printed.
 */
import type { Translation } from './ru.ts';

export const sr: Translation = {
  counted: {
    slips_one: '{{count}} nalog',
    slips_few: '{{count}} naloga',
    slips_other: '{{count}} naloga',
    sheets_one: '{{count}} list A4',
    sheets_few: '{{count}} lista A4',
    sheets_other: '{{count}} listova A4',
  },
  app: {
    title: 'Nalog za uplatu',
    blank: 'Obrazac',
    addSlip: 'Dodaj nalog',
    download: 'Preuzmi PDF',
    print: 'Štampaj',
    printHint:
      'Pri štampi izaberite <b>razmeru 100 % / Actual size</b>, a ne „prilagodi stranici“ — inače obrazac neće odgovarati propisanim 210 × 99 mm. Secite po isprekidanoj liniji.',
    buildFailed: 'Nije moguće napraviti PDF: {{message}}',
    shrunkWarning:
      'Tekst je morao znatno da se smanji da bi stao u polje: {{fields}}. Na papiru će biti sitno — bolje ga skratite.',
    qrFailedTitle: 'QR kôd nije napravljen.',
    qrFailedBody: 'Nalog se štampa bez njega — plaćanje je moguće kao i obično, po podacima.',
    slipNumber: 'nalog {{number}}',
    language: 'Jezik',
    documentTitle: 'Generator naloga za uplatu sa NBS IPS QR kodom — besplatno',
  },
  footer: {
    source: 'Izvorni kôd na GitHub-u',
  },
  preview: {
    title: 'Pregled',
    updating: 'osvežava se…',
  },
  slip: {
    heading: 'Nalog {{number}}',
    duplicate: 'Dupliraj',
    remove: 'Obriši',
    payer: 'Platilac',
    payerHint: 'platilac — do {{count}} reda',
    paymentForm: 'Oblik plaćanja',
    paymentFormHint: 'prva cifra šifre',
    paymentGround: 'Osnov plaćanja',
    paymentGroundHint: 'druga i treća cifra',
    currency: 'Valuta',
    currencyHint: 'valuta',
    amount: 'Iznos',
    amountHint: 'iznos — decimalni zarez',
    purpose: 'Svrha uplate',
    purposeHint: 'svrha uplate',
    account: 'Račun primaoca',
    accountHint: 'račun primaoca — kao na računu, npr. 165-55-74',
    recipient: 'Primalac',
    recipientHint: 'primalac',
    model: 'Model',
    modelHint: 'model',
    reference: 'Poziv na broj',
    referenceHint: 'poziv na broj (odobrenje)',
    urgent: 'Hitno',
    urgentHint:
      'način izvršenja - hitno: u polje se upisuje H. Do 300.000 dinara takav nalog se izvršava kao instant transfer',
    none: '—',
  },
  fields: {
    platilac: 'Platilac',
    svrhaUplate: 'Svrha uplate',
    primalac: 'Primalac',
    iznos: 'Iznos',
    racunPrimaoca: 'Račun primaoca',
    pozivNaBroj: 'Poziv na broj',
    sifraPlacanja: 'Šifra plaćanja',
    valuta: 'Valuta',
    model: 'Model',
  },
  ips: {
    accountDigits:
      'račun primaoca nema 18 cifara — unesite ga kao na računu, npr. 165-55-74, ili u celosti; trenutno {{count}}',
    recipientRequired: 'primalac je obavezan za QR kôd',
    tooLong: 'najviše {{limit}} znakova, trenutno {{count}}',
    amountRequired: 'iznos je obavezan i mora biti broj, na primer 5.200,00',
    amountLength: 'polje iznosa mora imati od 5 do {{limit}} znakova, trenutno {{count}}',
    codeRequired: 'potrebni su oblik i osnov plaćanja — zajedno tri cifre',
    purposeTooLong: 'u QR kôd staje {{limit}} znakova, trenutno {{count}}',
    referenceTooLong: 'najviše {{limit}} znakova zajedno s modelom, trenutno {{count}}',
    model97: 'po modelu 97 prve dve cifre su kontrolni broj, a on se ne slaže',
    model97Suggestion: ' (za {{base}} to je {{digits}})',
    unsupportedCharacters: 'QR kôd ne prima znakove: {{characters}} — potrebna je latinica',
  },
};
