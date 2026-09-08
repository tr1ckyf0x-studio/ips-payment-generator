/**
 * Renders the generated PDF with pdf.js.
 *
 * The preview is the actual document, not a parallel HTML reproduction of it — so what
 * is on screen and what comes out of the printer cannot drift apart.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import styles from './PdfPreview.module.css';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Renders at this many device pixels per PDF point, for a crisp preview. */
const SCALE = 1.5;

interface Props {
  bytes: Uint8Array | undefined;
  pending: boolean;
}

export function PdfPreview({ bytes, pending }: Props) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);

  useEffect(() => {
    if (!bytes || !container.current) return;
    let cancelled = false;
    const host = container.current;

    // pdf.js takes ownership of the buffer it is given, so hand it a copy.
    const task = pdfjs.getDocument({ data: bytes.slice() });

    task.promise
      .then(async (doc) => {
        if (cancelled) return;
        setPages(doc.numPages);
        const canvases: HTMLCanvasElement[] = [];

        for (let n = 1; n <= doc.numPages; n += 1) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: SCALE });
          const canvas = document.createElement('canvas');
          canvas.className = styles.page;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          if (!context) continue;
          await page.render({ canvasContext: context, viewport }).promise;
          canvases.push(canvas);
        }

        if (cancelled) return;
        host.replaceChildren(...canvases);
      })
      .catch(() => {
        if (!cancelled) host.replaceChildren();
      });

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [bytes]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span>{t('preview.title')}</span>
        <span className={styles.meta}>
          {pending ? t('preview.updating') : t('sheets', { count: pages })}
        </span>
      </div>
      <div ref={container} className={styles.pages} />
    </div>
  );
}
