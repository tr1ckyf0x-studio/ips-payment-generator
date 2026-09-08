/**
 * Shrinking text to fit a fixed-width field.
 *
 * The blank's fields cannot grow, so a long recipient name or purpose has to be set
 * smaller rather than overflow into the neighbouring field. Text width is linear in
 * point size, so the size that just fits is one division away — no iterative search.
 */
import type { Mm } from './types.ts';

/** Measures a string's width in millimetres at a given point size. */
export type Measure = (text: string, size: number) => Mm;

export interface Fit {
  /** Point size to draw at: the slot's own size, or less when it would not fit. */
  size: number;
  /** How much the size had to be reduced, 1 meaning not at all. */
  scale: number;
}

/**
 * The largest size no greater than `baseSize` at which every line fits `maxWidth`.
 *
 * All lines of a field share one size — sizing them independently would leave a block
 * with lines of visibly different heights.
 */
export function fitSize(
  lines: string[],
  maxWidth: Mm,
  baseSize: number,
  measure: Measure,
): Fit {
  const widest = Math.max(0, ...lines.map((line) => measure(line, baseSize)));
  if (widest <= maxWidth || widest === 0) return { size: baseSize, scale: 1 };

  const scale = maxWidth / widest;
  return { size: baseSize * scale, scale };
}

/**
 * Below this, a value is still drawn but has become hard to read on paper; the form
 * warns rather than silently shipping something illegible.
 */
export const LEGIBLE_SIZE_PT = 7.5;
