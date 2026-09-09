/**
 * Fields of one payment slip.
 *
 * Labels are in Russian with the Serbian wording of the blank underneath, so a field
 * can be matched to the printed form at a glance.
 */
import { useTranslation } from 'react-i18next';
import {
  describeCode,
  PAYMENT_FORMS,
  PAYMENT_GROUNDS,
  REFERENCE_MODELS,
  type Code,
} from '../data/paymentCodes.ts';
import { MAX_BLOCK_LINES, type Slip } from '../model/slip.ts';
import styles from './SlipForm.module.css';

interface Props {
  slip: Slip;
  index: number;
  removable: boolean;
  onChange: (slip: Slip) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

export function SlipForm({ slip, index, removable, onChange, onRemove, onDuplicate }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  /**
   * A code reads as its number and its description in the interface language, with the
   * official Serbian wording on hover — that is the one printed on a Serbian invoice,
   * so it has to stay reachable even when the interface is not Serbian.
   */
  const codeOptions = (codes: Code[]) =>
    codes.map((c) => (
      <option key={c.value} value={c.value} title={c.sr}>
        {c.value} — {describeCode(c, language)}
      </option>
    ));

  function set<K extends keyof Slip>(key: K, value: Slip[K]) {
    onChange({ ...slip, [key]: value });
  }

  /** Blocks print at most three lines, so stop extra ones from being typed in. */
  function setBlock(key: 'platilac' | 'svrhaUplate' | 'primalac', value: string) {
    set(key, value.split('\n').slice(0, MAX_BLOCK_LINES).join('\n'));
  }

  return (
    <section className={styles.slip}>
      <header className={styles.head}>
        <h2>{t('slip.heading', { number: index + 1 })}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onDuplicate}>
            {t('slip.duplicate')}
          </button>
          <button type="button" onClick={onRemove} disabled={!removable}>
            {t('slip.remove')}
          </button>
        </div>
      </header>

      <div className={styles.grid}>
        <label className={styles.block}>
          <span>{t('slip.payer')}</span>
          <small>{t('slip.payerHint', { count: MAX_BLOCK_LINES })}</small>
          <textarea
            rows={3}
            value={slip.platilac}
            onChange={(e) => setBlock('platilac', e.target.value)}
            placeholder={'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD'}
          />
        </label>

        <div className={styles.column}>
          <div className={styles.row}>
            <label className={styles.narrow}>
              <span>{t('slip.paymentForm')}</span>
              <small>{t('slip.paymentFormHint')}</small>
              <select value={slip.oblikPlacanja} onChange={(e) => set('oblikPlacanja', e.target.value)}>
                <option value="">{t('slip.none')}</option>
                {codeOptions(PAYMENT_FORMS)}
              </select>
            </label>

            <label>
              <span>{t('slip.paymentGround')}</span>
              <small>{t('slip.paymentGroundHint')}</small>
              <select value={slip.osnovPlacanja} onChange={(e) => set('osnovPlacanja', e.target.value)}>
                <option value="">{t('slip.none')}</option>
                {codeOptions(PAYMENT_GROUNDS)}
              </select>
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.narrow}>
              <span>{t('slip.currency')}</span>
              <small>{t('slip.currencyHint')}</small>
              <input value={slip.valuta} onChange={(e) => set('valuta', e.target.value)} />
            </label>
            <label>
              <span>{t('slip.amount')}</span>
              <small>{t('slip.amountHint')}</small>
              <input
                value={slip.iznos}
                onChange={(e) => set('iznos', e.target.value)}
                placeholder="5.200,00"
                inputMode="decimal"
              />
            </label>
          </div>
        </div>

        <label className={styles.block}>
          <span>{t('slip.purpose')}</span>
          <small>{t('slip.purposeHint')}</small>
          <textarea
            rows={3}
            value={slip.svrhaUplate}
            onChange={(e) => setBlock('svrhaUplate', e.target.value)}
            placeholder="Uplata po računu za el. energiju"
          />
        </label>

        <label>
          <span>{t('slip.account')}</span>
          <small>{t('slip.accountHint')}</small>
          <input
            value={slip.racunPrimaoca}
            onChange={(e) => set('racunPrimaoca', e.target.value)}
            placeholder="845-0000000404849-87"
            inputMode="numeric"
          />
        </label>

        <label className={styles.block}>
          <span>{t('slip.recipient')}</span>
          <small>{t('slip.recipientHint')}</small>
          <textarea
            rows={3}
            value={slip.primalac}
            onChange={(e) => setBlock('primalac', e.target.value)}
            placeholder={'JP EPS BEOGRAD\nBALKANSKA 13'}
          />
        </label>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={slip.hitno}
            onChange={(e) => set('hitno', e.target.checked)}
          />
          <span>
            {t('slip.urgent')}
            <small>{t('slip.urgentHint')}</small>
          </span>
        </label>

        <div className={styles.row}>
          <label className={styles.narrow}>
            <span>{t('slip.model')}</span>
            <small>{t('slip.modelHint')}</small>
            <select value={slip.model} onChange={(e) => set('model', e.target.value)}>
              {/* Only the number fits this narrow select, so the description stays a tooltip. */}
              {REFERENCE_MODELS.map((c) => (
                <option key={c.value || 'none'} value={c.value} title={describeCode(c, language)}>
                  {c.value || t('slip.none')}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('slip.reference')}</span>
            <small>{t('slip.referenceHint')}</small>
            <input
              value={slip.pozivNaBroj}
              onChange={(e) => set('pozivNaBroj', e.target.value)}
              placeholder="14123412"
            />
          </label>
        </div>

      </div>
    </section>
  );
}
