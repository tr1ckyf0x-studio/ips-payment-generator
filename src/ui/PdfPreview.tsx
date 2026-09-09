/**
 * Renders the generated PDF with pdf.js.
 *
 * The preview is the actual document, not a parallel HTML reproduction of it — so what
 * is on screen and what comes out of the printer cannot drift apart.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import styles from './PdfPreview.module.css';

/**
 * pdf.js is 356 kB and cannot draw anything until a document exists, so it is fetched
 * when the first one does rather than before the form appears. The component itself, its
 * heading and its styles stay in the entry chunk, so the pane is never blank-framed while
 * the library arrives — the heading already says "updating".
 *
 * The promise is cached at module scope: several previews, or a preview remounted by a
 * language change, share one request.
 */
let pdfjs: Promise<typeof import('pdfjs-dist')> | undefined;

function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  pdfjs ??= import('pdfjs-dist').then((module) => {
    module.GlobalWorkerOptions.workerSrc = workerUrl;
    return module;
  });
  return pdfjs;
}

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
    let task: PDFDocumentLoadingTask | undefined;
    const host = container.current;

    void (async () => {
      try {
        const module = await loadPdfjs();
        if (cancelled) return;

        // pdf.js takes ownership of the buffer it is given, so hand it a copy.
        task = module.getDocument({ data: bytes.slice() });
        const doc = await task.promise;
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
          // pdf.js 6 takes the canvas and finds its own context; passing a
          // `canvasContext` as well is the backwards-compatible path its own types
          // discourage, and it is only valid with a null canvas.
          await page.render({ canvas, viewport }).promise;
          canvases.push(canvas);
        }

        if (cancelled) return;
        host.replaceChildren(...canvases);
      } catch {
        if (!cancelled) host.replaceChildren();
      }
    })();

    return () => {
      cancelled = true;
      void task?.destroy();
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
