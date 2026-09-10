/**
 * Getting a generated document out of the browser: to a file, or to the printer.
 *
 * Both start from the same blob and differ only in what they hand it to, so the two live
 * together — a slip saved and a slip printed must never be different bytes.
 *
 * Printing has no one way to do it. A browser that draws PDFs itself has a print dialog
 * that can be opened on one; a phone hands PDFs to the operating system, and the way to
 * its printer is the share sheet. Both are asked for by capability rather than guessed
 * at, with one exception named below.
 */

function fileName(): string {
  return `nalog-za-uplatu-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function pdfFile(bytes: Uint8Array): File {
  return new File([bytes as BlobPart], fileName(), { type: 'application/pdf' });
}

/** The document as a URL the browser can load. Whoever is finished with it releases it. */
function blobUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function downloadPdf(bytes: Uint8Array): void {
  const url = blobUrl(pdfFile(bytes));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName();
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Safari draws PDFs and still cannot print one out of a frame.
 *
 * Measured rather than assumed, on Safari 26 (macOS): reaching the frame's
 * `contentWindow` throws `SecurityError: Sandbox access violation` — Safari sandboxes a
 * framed PDF away from the page's own origin, and declaring the `sandbox` attribute
 * ourselves with `allow-same-origin` does not lift it. A window of its own is not
 * sandboxed that way and prints fine, which is the route Safari gets.
 *
 * There is no capability to test for this, so it is the one thing here known by name.
 */
function isSafari(): boolean {
  const agent = navigator.userAgent;
  return /Safari/.test(agent) && !/Chrome|Chromium|Android/.test(agent);
}

/** Marks the frame in the document, so a test can see the document was handed over. */
export const PRINT_FRAME_ID = 'print-document';

/** The frame the last print used: the dialog reads from it for as long as it is open. */
let printFrame: { element: HTMLIFrameElement; url: string } | undefined;

function printInFrame(file: File): void {
  // Releasing the previous document here rather than on a timer: the print dialog is not
  // observable, so the only moment we know for certain it is closed is the next print.
  if (printFrame) {
    printFrame.element.remove();
    URL.revokeObjectURL(printFrame.url);
  }

  const url = blobUrl(file);
  const element = document.createElement('iframe');
  element.id = PRINT_FRAME_ID;
  // Not `display: none` — a frame that is not laid out has nothing to print.
  element.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  element.src = url;
  element.addEventListener('load', () => {
    element.contentWindow?.focus();
    element.contentWindow?.print();
  });
  document.body.append(element);
  printFrame = { element, url };
}

/** How often the opened window is asked whether its document has arrived. */
const READY_POLL_MS = 100;
/** How long to wait for it before printing anyway. */
const READY_TIMEOUT_MS = 3000;

/** Shows the document in a window of its own, and opens the print dialog over it. */
function openInTab(file: File): boolean {
  const url = blobUrl(file);
  const tab = window.open(url, '_blank');
  if (!tab) {
    URL.revokeObjectURL(url);
    return false;
  }

  // Printing before the document arrives prints the wrong thing, so this waits for it
  // rather than for a chosen number of milliseconds — a number would be a guess about
  // someone else's machine.
  //
  // `readyState` alone is not the signal. A freshly opened window is `about:blank`,
  // which reports `complete` immediately — measured at 52 ms on Safari, before the PDF
  // could possibly have loaded — so the address has to have become the document's too.
  // If the window stops being reachable, the PDF is on screen and ⌘P still works, so
  // there is nothing to report.
  const started = Date.now();
  const timer = setInterval(() => {
    let ready: boolean;
    try {
      if (tab.closed) return clearInterval(timer);
      ready = tab.location.href === url && tab.document.readyState === 'complete';
    } catch {
      return clearInterval(timer);
    }
    if (!ready && Date.now() - started < READY_TIMEOUT_MS) return;
    clearInterval(timer);
    try {
      tab.print();
    } catch {
      // The document is in front of the visitor either way.
    }
  }, READY_POLL_MS);

  return true;
}

/**
 * A device held in the hand, where the share sheet beats anything the page can do.
 *
 * Touch points rather than the user agent: iPadOS Safari calls itself a Mac, and a Mac
 * has none. This is what a phone has and a desktop does not.
 */
function isHandheld(): boolean {
  return navigator.maxTouchPoints > 0;
}

/**
 * The system share sheet, which on a phone is where Print lives. Returns whether the
 * document was handed over; a sheet the visitor then dismisses still counts.
 */
function share(file: File): boolean {
  if (!navigator.canShare?.({ files: [file] })) return false;
  // Cancelling is the ordinary outcome and not a failure, so nothing is reported.
  void navigator.share({ files: [file], title: fileName() }).catch(() => undefined);
  return true;
}

/** Puts the document wherever this browser can be printed from. */
function handOver(file: File): boolean {
  // On a phone the share sheet wins even when the browser draws PDFs itself. iOS Safari
  // does draw them, and the tab it opens costs four taps to reach Print and leaves the
  // form behind; the sheet rises over the form and Print is one tap down it.
  if (isHandheld() && share(file)) return true;

  // `navigator.pdfViewerEnabled` asks whether the browser draws PDFs itself instead of
  // handing them to the system.
  if (!navigator.pdfViewerEnabled) return share(file);
  if (isSafari()) return openInTab(file);
  printInFrame(file);
  return true;
}

export function printPdf(bytes: Uint8Array): void {
  if (handOver(pdfFile(bytes))) return;
  // Nothing would put the document in front of the visitor — a phone with no share
  // sheet, or a blocked popup. The file itself is the honest remainder.
  downloadPdf(bytes);
}
