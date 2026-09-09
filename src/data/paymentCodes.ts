/**
 * Payment codes (šifra plaćanja) from Prilog 3 of the NBS decision.
 *
 * A code is three digits: the first says how the payment is made, the other two say
 * what it is for. Composing them in the UI beats listing two hundred combinations.
 *
 * Source: `references/odluka-nbs-platni-nalozi.pdf`, Prilog 3.
 */

export interface Code {
  value: string;
  /** Official Serbian wording. */
  sr: string;
  /** Russian gloss. */
  ru: string;
  /** English gloss. The Serbian wording stays authoritative; these only explain it. */
  en: string;
}

/**
 * The description to show for a code in a given interface language.
 *
 * Serbian doubles as the fallback rather than being one branch of three: a language we
 * do not gloss gets the wording the decision itself uses, which is the one the bank
 * works from. The tag is cut at the first subtag so a browser reporting `en-US` is
 * still English.
 */
export function describeCode(code: Code, language: string): string {
  const tag = language.split('-')[0];
  return tag === 'ru' || tag === 'en' ? code[tag] : code.sr;
}

/** First digit: klasifikacija prema obliku plaćanja. */
export const PAYMENT_FORMS: Code[] = [
  { value: '1', sr: 'Gotovinski', ru: 'Наличными', en: 'Cash' },
  { value: '2', sr: 'Bezgotovinski', ru: 'Безналичный перевод', en: 'Cashless transfer' },
  { value: '3', sr: 'Obračunski', ru: 'Расчётный', en: 'Clearing' },
  { value: '9', sr: 'Preknjižavanje', ru: 'Переучёт (возврат ошибочно уплаченного)', en: 'Reposting (refund of a wrong payment)' },
];

/** Last two digits: klasifikacija prema osnovu plaćanja. */
export const PAYMENT_GROUNDS: Code[] = [
  { value: '20', sr: 'Promet robe i usluga - međufazna potrošnja', ru: 'Товары и услуги — промежуточное потребление', en: 'Goods and services — intermediate consumption' },
  { value: '21', sr: 'Promet robe i usluga - finalna potrošnja', ru: 'Товары и услуги — конечное потребление', en: 'Goods and services — final consumption' },
  { value: '22', sr: 'Usluge javnih preduzeća', ru: 'Услуги государственных предприятий', en: 'Public utility services' },
  { value: '23', sr: 'Investicije u objekte i opremu', ru: 'Инвестиции в объекты и оборудование', en: 'Investment in buildings and equipment' },
  { value: '24', sr: 'Investicije - ostalo', ru: 'Прочие инвестиции', en: 'Other investment' },
  { value: '25', sr: 'Zakupnine stvari u javnoj svojini', ru: 'Аренда имущества в публичной собственности', en: 'Rent of publicly owned property' },
  { value: '26', sr: 'Zakupnine', ru: 'Аренда', en: 'Rent' },
  { value: '27', sr: 'Subvencije, regresi i premije s posebnih računa', ru: 'Субсидии и премии со спецсчетов', en: 'Subsidies and premiums from special accounts' },
  { value: '28', sr: 'Subvencije, regresi i premije sa ostalih računa', ru: 'Субсидии и премии с прочих счетов', en: 'Subsidies and premiums from other accounts' },
  { value: '29', sr: 'Digitalna imovina', ru: 'Цифровые активы', en: 'Digital assets' },
  { value: '30', sr: 'Promet nepokretnosti', ru: 'Оборот недвижимости', en: 'Real estate transactions' },
  { value: '31', sr: 'Carine i druge uvozne dažbine', ru: 'Таможенные и импортные сборы', en: 'Customs and other import duties' },
  { value: '40', sr: 'Zarade i druga primanja zaposlenih', ru: 'Зарплата и выплаты работникам', en: 'Salaries and other employee income' },
  { value: '41', sr: 'Neoporeziva primanja zaposlenih, socijalna i druga davanja izuzeta od oporezivanja', ru: 'Необлагаемые выплаты работникам', en: 'Non-taxable employee income and exempt benefits' },
  { value: '42', sr: 'Naknade zarada na teret poslodavca', ru: 'Компенсации зарплаты за счёт работодателя', en: 'Salary compensation paid by the employer' },
  { value: '44', sr: 'Isplate preko omladinskih i studentskih zadruga', ru: 'Выплаты через молодёжные кооперативы', en: 'Payments through youth and student cooperatives' },
  { value: '45', sr: 'Penzije', ru: 'Пенсии', en: 'Pensions' },
  { value: '46', sr: 'Obustave od penzija i zarada', ru: 'Удержания из пенсий и зарплат', en: 'Deductions from pensions and salaries' },
  { value: '47', sr: 'Naknade zarada na teret drugih isplatilaca', ru: 'Компенсации зарплаты за счёт других плательщиков', en: 'Salary compensation paid by others' },
  { value: '48', sr: 'Prihodi fizičkih lica od kapitala i drugih imovinskih prava', ru: 'Доходы физлиц от капитала и имущественных прав', en: 'Individuals\u2019 income from capital and property rights' },
  { value: '49', sr: 'Ostali prihodi fizičkih lica', ru: 'Прочие доходы физлиц', en: 'Other income of individuals' },
  { value: '53', sr: 'Uplata javnih prihoda izuzev poreza i doprinosa po odbitku', ru: 'Публичные доходы, кроме удерживаемых налогов', en: 'Public revenue other than withheld tax' },
  { value: '54', sr: 'Uplata poreza i doprinosa po odbitku', ru: 'Налоги и взносы, удерживаемые у источника', en: 'Withheld tax and contributions' },
  { value: '57', sr: 'Povraćaj više naplaćenih ili pogrešno naplaćenih tekućih prihoda', ru: 'Возврат излишне взысканных доходов', en: 'Refund of over- or wrongly collected revenue' },
  { value: '58', sr: 'Preknjižavanje više uplaćenih ili pogrešno uplaćenih tekućih prihoda', ru: 'Переучёт излишне уплаченных доходов', en: 'Reposting of over- or wrongly paid revenue' },
  { value: '60', sr: 'Premije osiguranja i nadoknada štete', ru: 'Страховые премии и возмещение ущерба', en: 'Insurance premiums and damage compensation' },
  { value: '61', sr: 'Raspored tekućih prihoda', ru: 'Распределение текущих доходов', en: 'Allocation of current revenue' },
  { value: '62', sr: 'Transferi u okviru državnih organa', ru: 'Трансферы внутри госорганов', en: 'Transfers between state bodies' },
  { value: '63', sr: 'Ostali transferi', ru: 'Прочие трансферы', en: 'Other transfers' },
  { value: '64', sr: 'Prenos sredstava iz budžeta za obezbeđenje povraćaja više naplaćenih tekućih prihoda', ru: 'Бюджетные средства на возврат излишне взысканного', en: 'Budget funds for refunding over-collected revenue' },
  { value: '65', sr: 'Uplata pazara', ru: 'Внесение дневной выручки', en: 'Daily takings deposit' },
  { value: '66', sr: 'Isplata gotovine', ru: 'Выдача наличных', en: 'Cash withdrawal' },
  { value: '70', sr: 'Kratkoročni krediti', ru: 'Краткосрочные кредиты', en: 'Short-term loans' },
  { value: '71', sr: 'Dugoročni krediti', ru: 'Долгосрочные кредиты', en: 'Long-term loans' },
  { value: '72', sr: 'Aktivna kamata', ru: 'Проценты по кредитам', en: 'Interest received' },
  { value: '73', sr: 'Polaganje oročenih depozita', ru: 'Размещение срочных депозитов', en: 'Term deposit placement' },
  { value: '75', sr: 'Ostali plasmani', ru: 'Прочие размещения', en: 'Other placements' },
  { value: '76', sr: 'Otplata kratkoročnih kredita', ru: 'Погашение краткосрочных кредитов', en: 'Short-term loan repayment' },
  { value: '77', sr: 'Otplata dugoročnih kredita', ru: 'Погашение долгосрочных кредитов', en: 'Long-term loan repayment' },
  { value: '78', sr: 'Povraćaj oročenih depozita', ru: 'Возврат срочных депозитов', en: 'Term deposit withdrawal' },
  { value: '79', sr: 'Pasivna kamata', ru: 'Проценты по депозитам', en: 'Interest paid' },
  { value: '80', sr: 'Eskont hartija od vrednosti', ru: 'Учёт ценных бумаг', en: 'Discounting of securities' },
  { value: '81', sr: 'Pozajmice osnivača za likvidnost', ru: 'Заём учредителя на ликвидность', en: 'Founder\u2019s liquidity loan' },
  { value: '82', sr: 'Povraćaj pozajmice za likvidnost osnivaču', ru: 'Возврат займа учредителю', en: 'Repayment of a liquidity loan to the founder' },
  { value: '83', sr: 'Naplata čekova građana', ru: 'Оплата чеков граждан', en: 'Cashing citizens\u2019 cheques' },
  { value: '84', sr: 'Platne kartice', ru: 'Платёжные карты', en: 'Payment cards' },
  { value: '85', sr: 'Menjački poslovi', ru: 'Обменные операции', en: 'Currency exchange' },
  { value: '86', sr: 'Kupoprodaja deviza', ru: 'Купля-продажа валюты', en: 'Foreign currency trade' },
  { value: '87', sr: 'Donacije i sponzorstva', ru: 'Пожертвования и спонсорство', en: 'Donations and sponsorships' },
  { value: '88', sr: 'Donacije', ru: 'Пожертвования по международным договорам', en: 'Donations under international agreements' },
  { value: '89', sr: 'Transakcije po nalogu građana', ru: 'Операции по поручению граждан', en: 'Transactions on behalf of citizens' },
  { value: '90', sr: 'Druge transakcije', ru: 'Прочие операции', en: 'Other transactions' },
];

/**
 * Reference number models. 97 carries a check digit computed per ISO 7064 MOD 97-10 and
 * is what most invoices use; 11 and 00 are the unchecked alternatives.
 */
export const REFERENCE_MODELS: Code[] = [
  { value: '97', sr: 'Model 97 (kontrolni broj)', ru: 'Модель 97 — с контрольным числом', en: 'Model 97 (with check digits)' },
  { value: '11', sr: 'Model 11', ru: 'Модель 11', en: 'Model 11' },
  { value: '00', sr: 'Model 00 (bez kontrole)', ru: 'Модель 00 — без контроля', en: 'Model 00 (unchecked)' },
  { value: '', sr: 'Bez modela', ru: 'Без модели', en: 'No model' },
];
