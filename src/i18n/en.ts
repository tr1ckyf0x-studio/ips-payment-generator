/**
 * English.
 *
 * Field hints keep the Serbian name of each element on the blank, so a field can be
 * matched to the printed form regardless of interface language.
 */
import type { Translation } from './ru.ts';

export const en: Translation = {
  counted: {
    slips_one: '{{count}} slip',
    slips_other: '{{count}} slips',
    sheets_one: '{{count}} A4 sheet',
    sheets_other: '{{count}} A4 sheets',
  },
  app: {
    title: 'Nalog za uplatu',
    blank: 'Blank',
    addSlip: 'Add slip',
    download: 'Download PDF',
    forgetPayer: 'forget payer',
    printHint:
      'Print at <b>100 % / Actual size</b>, not "fit to page" — otherwise the slip will not match the required 210 × 99 mm. Cut along the dashed line.',
    payerHint: 'The payer details are kept in this browser and filled into new slips.',
    buildFailed: 'Could not build the PDF: {{message}}',
    shrunkWarning:
      'Text had to be shrunk considerably to fit its field: {{fields}}. It will be small on paper — better to shorten it.',
    qrFailedTitle: 'No QR code was generated.',
    qrFailedBody: 'The slip prints without one — it can still be paid over the counter as usual.',
    slipNumber: 'slip {{number}}',
    language: 'Language',
    documentTitle: 'Nalog za uplatu — payment slip generator',
  },
  footer: {
    source: 'Source code on GitHub',
  },
  preview: {
    title: 'Preview',
    updating: 'updating…',
  },
  slip: {
    heading: 'Slip {{number}}',
    duplicate: 'Duplicate',
    remove: 'Remove',
    payer: 'Payer',
    payerHint: 'platilac — up to {{count}} lines',
    paymentForm: 'Payment form',
    paymentFormHint: 'first digit of the code',
    paymentGround: 'Payment ground',
    paymentGroundHint: 'second and third digits',
    currency: 'Currency',
    currencyHint: 'valuta',
    amount: 'Amount',
    amountHint: 'iznos — decimal comma',
    purpose: 'Purpose of payment',
    purposeHint: 'svrha uplate',
    account: "Recipient's account",
    accountHint: 'račun primaoca — as printed, e.g. 165-55-74',
    recipient: 'Recipient',
    recipientHint: 'primalac',
    model: 'Model',
    modelHint: 'model',
    reference: 'Reference number',
    referenceHint: 'poziv na broj (odobrenje)',
    urgent: 'Urgent',
    urgentHint:
      'način izvršenja - hitno: an H is printed in the box. Up to 300,000 dinars such a slip is executed as an instant transfer',
    none: '—',
  },
  fields: {
    platilac: 'Payer',
    svrhaUplate: 'Purpose of payment',
    primalac: 'Recipient',
    iznos: 'Amount',
    racunPrimaoca: "Recipient's account",
    pozivNaBroj: 'Reference number',
    sifraPlacanja: 'Payment code',
    valuta: 'Currency',
    model: 'Model',
  },
  ips: {
    accountDigits:
      "the recipient's account does not make 18 digits — write it as printed, like 165-55-74, or in full; currently {{count}}",
    recipientRequired: 'the recipient is required for the QR code',
    tooLong: 'no more than {{limit}} characters, currently {{count}}',
    amountRequired: 'the amount is required and must be a number, for example 5.200,00',
    amountLength: 'the amount field must be 5 to {{limit}} characters, currently {{count}}',
    codeRequired: 'both the payment form and ground are needed — three digits together',
    purposeTooLong: '{{limit}} characters fit in the QR code, currently {{count}}',
    referenceTooLong: 'no more than {{limit}} characters including the model, currently {{count}}',
    model97: 'under model 97 the first two digits are a check number, and it does not agree',
    model97Suggestion: ' (for {{base}} it is {{digits}})',
    unsupportedCharacters: 'the QR code does not accept: {{characters}} — Latin script is required',
  },
};
