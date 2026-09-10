import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { SlipForm } from './ui/SlipForm.tsx';
import { PdfPreview } from './ui/PdfPreview.tsx';
import { usePdfDocument } from './ui/usePdfDocument.ts';
import { emptySlip, type Slip } from './model/slip.ts';
import { SLIPS_PER_SHEET } from './layout/paginate.ts';
import { DEFAULT_PROFILE, type ProfileId } from './layout/formSpec.ts';
import { LEGIBLE_SIZE_PT } from './layout/fitText.ts';
import { LANGUAGE_NAMES, type Language } from './i18n/index.ts';
import { downloadPdf, printPdf } from './ui/pdfFile.ts';
import styles from './App.module.css';

let nextId = 0;
const newId = () => `slip-${(nextId += 1)}`;

function newSlip(): Slip {
  return emptySlip(newId());
}

export function App() {
  const { t, i18n } = useTranslation();
  const [profileId, setProfileId] = useState<ProfileId>(DEFAULT_PROFILE);
  const [slips, setSlips] = useState<Slip[]>(() => [newSlip()]);
  const { bytes, shrunk, qr, error, pending } = usePdfDocument(slips, profileId);

  const update = useCallback((index: number, slip: Slip) => {
    setSlips((prev) => prev.map((item, i) => (i === index ? slip : item)));
  }, []);

  const remove = useCallback((index: number) => {
    setSlips((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const duplicate = useCallback((index: number) => {
    setSlips((prev) => [
      ...prev.slice(0, index + 1),
      { ...prev[index], id: newId() },
      ...prev.slice(index + 1),
    ]);
  }, []);

  const add = useCallback(() => {
    setSlips((prev) => [...prev, newSlip()]);
  }, []);

  // The tab title lives outside React's tree, so it is set here rather than in HTML.
  useEffect(() => {
    document.title = t('app.documentTitle');
    document.documentElement.lang = i18n.resolvedLanguage ?? 'en';
  }, [t, i18n.resolvedLanguage]);

  const sheets = Math.max(1, Math.ceil(slips.length / SLIPS_PER_SHEET));

  const download = useCallback(() => {
    if (bytes) downloadPdf(bytes);
  }, [bytes]);

  const print = useCallback(() => {
    if (bytes) printPdf(bytes);
  }, [bytes]);

  /**
   * Fields shrunk past the point of comfortable reading. Shrinking itself is fine and
   * silent — this only calls out the cases a person would want to shorten by hand.
   */
  const tooSmall = useMemo(
    () =>
      shrunk
        .filter((f) => f.size < LEGIBLE_SIZE_PT)
        .map((f) => {
          const index = slips.findIndex((s) => s.id === f.slipId);
          return `${t('app.slipNumber', { number: index + 1 })}, «${t(`fields.${f.field}`)}»`;
        }),
    [shrunk, slips, t],
  );

  /**
   * Slips whose data cannot make a valid IPS payload. Those slips still print — they
   * just carry no QR — so this explains what is missing rather than blocking anything.
   */
  const qrProblems = useMemo(
    () =>
      qr
        .filter((report) => report.problems.length > 0)
        .map((report) => {
          const index = slips.findIndex((s) => s.id === report.slipId);
          const detail = report.problems
            .map((p) => `${t(`fields.${p.field}`)}: ${t(`ips.${p.code}`, p.params ?? {})}` +
              (p.code === 'model97' && p.params ? t('ips.model97Suggestion', p.params) : ''))
            .join('; ');
          return `${t('app.slipNumber', { number: index + 1 })} — ${detail}`;
        }),
    [qr, slips, t],
  );

  const summary = useMemo(
    () => `${t('slips', { count: slips.length })} · ${t('sheets', { count: sheets })}`,
    [slips.length, sheets, t],
  );

  return (
    <div className={styles.app}>
      <aside className={styles.editor}>
        <header className={styles.top}>
          <div>
            <h1>{t('app.title')}</h1>
            <p className={styles.summary}>
              {summary}
            </p>
          </div>
          <div className={styles.topActions}>
            <button type="button" onClick={add}>
              {t('app.addSlip')}
            </button>
            <button type="button" onClick={download} disabled={!bytes}>
              {t('app.download')}
            </button>
            <button type="button" className={styles.primary} onClick={print} disabled={!bytes}>
              {t('app.print')}
            </button>
          </div>
        </header>

        <div className={styles.pickers}>
        <label className={styles.blankPicker}>
          <span>{t('app.blank')}</span>
          <select value={profileId} onChange={(e) => setProfileId(e.target.value as ProfileId)}>
            <option value="optimum">OPTIMUM d.o.o.</option>
            <option value="pausal">HSFormular</option>
          </select>
        </label>

        <label className={styles.blankPicker}>
          <span>{t('app.language')}</span>
          <select
            value={i18n.resolvedLanguage}
            onChange={(e) => void i18n.changeLanguage(e.target.value as Language)}
          >
            {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        </div>

        <p className={styles.hint}>
          <Trans i18nKey="app.printHint" components={{ b: <b /> }} />
        </p>

        {error && <p className={styles.error}>{t('app.buildFailed', { message: error })}</p>}

        {qrProblems.length > 0 && (
          <div className={styles.warning}>
            <b>{t('app.qrFailedTitle')}</b> {t('app.qrFailedBody')}
            <ul className={styles.list}>
              {qrProblems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {tooSmall.length > 0 && (
          <p className={styles.warning}>
            {t('app.shrunkWarning', { fields: tooSmall.join('; ') })}
          </p>
        )}

        {slips.map((slip, index) => (
          <SlipForm
            key={slip.id}
            slip={slip}
            index={index}
            removable={slips.length > 1}
            onChange={(next) => update(index, next)}
            onRemove={() => remove(index)}
            onDuplicate={() => duplicate(index)}
          />
        ))}

        <footer className={styles.footer}>
          <a
            href="https://github.com/tr1ckyf0x-studio/ips-payment-generator"
            target="_blank"
            rel="noreferrer"
          >
            {t('footer.source')}
          </a>
          <span>© {new Date().getFullYear()} Vladislav Lisianskii</span>
        </footer>
      </aside>

      <main className={styles.preview}>
        <PdfPreview bytes={bytes} pending={pending} />
      </main>
    </div>
  );
}
