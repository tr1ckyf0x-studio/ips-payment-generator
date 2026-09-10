/**
 * Russian, the reference locale.
 *
 * Its shape is the contract: `Translation` is derived from it, so every other locale
 * has to provide the same keys or the build fails. Interface language never changes
 * what is printed — the blank itself is Serbian by law.
 */
export const ru = {
  /**
   * Counted phrases, kept apart from the rest: the set of plural forms differs by
   * language — Russian needs one/few/many, Serbian one/few/other, English one/other —
   * so these cannot share a single key list. `tests/i18n.spec.ts` checks each locale
   * carries the forms its own language actually uses.
   */
  counted: {
    slips_one: '{{count}} платёжка',
    slips_few: '{{count}} платёжки',
    slips_many: '{{count}} платёжек',
    sheets_one: '{{count}} лист A4',
    sheets_few: '{{count}} листа A4',
    sheets_many: '{{count}} листов A4',
  },
  app: {
    title: 'Налог за уплату',
    blank: 'Бланк',
    addSlip: 'Добавить платёжку',
    download: 'Скачать PDF',
    print: 'Печать',
    printHint:
      'При печати выберите <b>масштаб 100 % / Actual size</b>, а не «по размеру страницы» — иначе бланк не совпадёт с обязательными 210 × 99 мм. Режьте по пунктиру.',
    buildFailed: 'Не удалось собрать PDF: {{message}}',
    shrunkWarning:
      'Текст пришлось сильно уменьшить, чтобы влез в поле: {{fields}}. На бумаге это будет мелко — лучше сократить запись.',
    qrFailedTitle: 'QR-код не сформирован.',
    qrFailedBody: 'Платёжка напечатается без него — оплатить можно как обычно, по реквизитам.',
    slipNumber: 'платёжка {{number}}',
    language: 'Язык',
    documentTitle: 'Генератор платёжек «налог за уплату» для Сербии с IPS QR-кодом',
  },
  footer: {
    source: 'Исходный код на GitHub',
  },
  preview: {
    title: 'Предпросмотр',
    updating: 'обновляется…',
  },
  slip: {
    heading: 'Платёжка {{number}}',
    duplicate: 'Дублировать',
    remove: 'Удалить',
    payer: 'Плательщик',
    payerHint: 'платилац — до {{count}} строк',
    paymentForm: 'Форма оплаты',
    paymentFormHint: '1-я цифра шифры',
    paymentGround: 'Основание',
    paymentGroundHint: '2-я и 3-я цифры',
    currency: 'Валюта',
    currencyHint: 'валута',
    amount: 'Сумма',
    amountHint: 'износ — запятая как разделитель',
    purpose: 'Назначение платежа',
    purposeHint: 'сврха уплате',
    account: 'Счёт получателя',
    accountHint: 'рачун примаоца — как на счёте, например 165-55-74',
    recipient: 'Получатель',
    recipientHint: 'прималац',
    model: 'Модель',
    modelHint: 'модел',
    reference: 'Ссылка на номер',
    referenceHint: 'позив на број (одобрење)',
    urgent: 'Срочно',
    urgentHint:
      'начин извршења - хитно: в поле впечатывается H. До 300 000 динаров такая платёжка исполняется мгновенным переводом',
    none: '—',
  },
  fields: {
    platilac: 'Плательщик',
    svrhaUplate: 'Назначение платежа',
    primalac: 'Получатель',
    iznos: 'Сумма',
    racunPrimaoca: 'Счёт получателя',
    pozivNaBroj: 'Ссылка на номер',
    sifraPlacanja: 'Шифра платежа',
    valuta: 'Валюта',
    model: 'Модель',
  },
  ips: {
    accountDigits:
      'счёт получателя не складывается в 18 цифр — укажите как на счёте, например 165-55-74, или полностью; сейчас {{count}}',
    recipientRequired: 'получатель обязателен для QR-кода',
    tooLong: 'не больше {{limit}} символов, сейчас {{count}}',
    amountRequired: 'сумма обязательна и должна быть числом, например 5.200,00',
    amountLength: 'поле суммы должно быть от 5 до {{limit}} символов, сейчас {{count}}',
    codeRequired: 'нужны форма оплаты и основание — вместе три цифры',
    purposeTooLong: 'в QR-код помещается {{limit}} символов, сейчас {{count}}',
    referenceTooLong: 'не больше {{limit}} символов вместе с моделью, сейчас {{count}}',
    model97: 'по модели 97 первые две цифры — контрольное число, и оно не сходится',
    model97Suggestion: ' (для {{base}} это {{digits}})',
    unsupportedCharacters: 'QR-код не принимает символы: {{characters}} — нужна латиница',
  },
};

/** Everything except the counted phrases, which every locale must provide verbatim. */
export type Translation = Omit<typeof ru, 'counted'> & { counted: Record<string, string> };
