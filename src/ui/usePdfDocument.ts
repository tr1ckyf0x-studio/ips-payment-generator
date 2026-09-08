/**
 * Keeps a rendered PDF in step with the slips being edited.
 *
 * Rendering is debounced so typing does not queue a document per keystroke, and each
 * run is tagged so a slow render that finishes late cannot overwrite a newer one.
 */
import { useEffect, useRef, useState } from 'react';
import { PROFILES, type ProfileId } from '../layout/formSpec.ts';
import { renderDocument, type QrReport, type ShrunkField } from '../pdf/renderer.ts';
import { loadFonts } from '../pdf/fonts.ts';
import type { Slip } from '../model/slip.ts';

const DEBOUNCE_MS = 250;

export interface PdfState {
  bytes: Uint8Array | undefined;
  /** Fields that had to be shrunk to fit their field on the blank. */
  shrunk: ShrunkField[];
  /** Per slip: the QR that was drawn, or why it could not be. */
  qr: QrReport[];
  error: string | undefined;
  pending: boolean;
}

export function usePdfDocument(slips: Slip[], profileId: ProfileId): PdfState {
  const [state, setState] = useState<PdfState>({
    bytes: undefined,
    shrunk: [],
    qr: [],
    error: undefined,
    pending: true,
  });
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    setState((prev) => ({ ...prev, pending: true }));

    const timer = setTimeout(async () => {
      try {
        const fonts = await loadFonts();
        const { bytes, shrunk, qr } = await renderDocument(slips, {
          profile: PROFILES[profileId],
          fonts,
        });
        if (generation.current === current) {
          setState({ bytes, shrunk, qr, error: undefined, pending: false });
        }
      } catch (cause) {
        if (generation.current === current) {
          setState({
            bytes: undefined,
            shrunk: [],
            qr: [],
            error: cause instanceof Error ? cause.message : String(cause),
            pending: false,
          });
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [slips, profileId]);

  return state;
}
