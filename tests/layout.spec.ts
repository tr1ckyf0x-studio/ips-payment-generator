/**
 * The layout spec must reproduce the reference blank's geometry.
 *
 * This compares two arrays of numbers — no rasterising, no visual judgement. A failure
 * here means the spec drifted from the reference (or the reference was replaced).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pausalProfile } from '../src/layout/formSpec.ts';
import type { Box, Rule } from '../src/layout/types.ts';

const TOLERANCE_MM = 0.25;

interface Fixture {
  pageWidth: number;
  pageHeight: number;
  rects: Array<{ x: number; y: number; w: number; h: number; stroke: number }>;
  lines: Array<{ x0: number; y0: number; x1: number; y1: number; stroke: number }>;
  text: Array<{ x: number; y: number; w: number; h: number; text: string }>;
}

const fixture: Fixture = JSON.parse(
  readFileSync('tests/fixtures/reference-geometry.json', 'utf8'),
);

// The hitno box is a deliberate addition from the OPTIMUM blanks; the pausal
// reference predates that element, so it is excluded from the comparison.
const boxes = pausalProfile.primitives.filter(
  (p): p is Box => p.kind === 'box' && !p.beyondReference,
);
const rules = pausalProfile.primitives.filter((p): p is Rule => p.kind === 'rule');

/** Distance between two rectangles as the largest disagreement in any dimension. */
function boxDistance(a: Box, b: Fixture['rects'][number]): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.w - b.w),
    Math.abs(a.h - b.h),
  );
}

function ruleDistance(a: Rule, b: Fixture['lines'][number]): number {
  return Math.max(
    Math.abs(a.x0 - b.x0),
    Math.abs(a.y0 - b.y0),
    Math.abs(a.x1 - b.x1),
    Math.abs(a.y1 - b.y1),
  );
}

describe('slip layout against the reference blank', () => {
  it('is as wide as the reference and as tall as the normative cell', () => {
    expect(pausalProfile.width).toBeCloseTo(210, 1);
    expect(pausalProfile.height).toBe(99);
    // The reference sheet is a hair narrower than A4; content must still fit.
    expect(fixture.pageWidth).toBeGreaterThan(209);
  });

  it('draws exactly the reference boxes', () => {
    expect(boxes).toHaveLength(fixture.rects.length);

    for (const reference of fixture.rects) {
      const nearest = boxes
        .map((box) => ({ box, d: boxDistance(box, reference) }))
        .sort((a, b) => a.d - b.d)[0];

      expect(
        nearest.d,
        `no box within ${TOLERANCE_MM}mm of reference ` +
          `(${reference.x}, ${reference.y}, ${reference.w}x${reference.h}); ` +
          `nearest is "${nearest.box.id}" at ${nearest.d.toFixed(2)}mm`,
      ).toBeLessThanOrEqual(TOLERANCE_MM);

      expect(nearest.box.stroke, `stroke of "${nearest.box.id}"`).toBeCloseTo(
        reference.stroke,
        1,
      );
    }
  });

  it('draws exactly the reference rules', () => {
    expect(rules).toHaveLength(fixture.lines.length);

    for (const reference of fixture.lines) {
      const nearest = rules
        .map((rule) => ({ rule, d: ruleDistance(rule, reference) }))
        .sort((a, b) => a.d - b.d)[0];

      expect(
        nearest.d,
        `no rule within ${TOLERANCE_MM}mm of reference ` +
          `(${reference.x0}, ${reference.y0}) -> (${reference.x1}, ${reference.y1}); ` +
          `nearest is "${nearest.rule.id}" at ${nearest.d.toFixed(2)}mm`,
      ).toBeLessThanOrEqual(TOLERANCE_MM);
    }
  });

  it('keeps all content inside the printable area of an A4 sheet', () => {
    const MARGIN = 3; // Epson EcoTank L3280 minimum
    for (const box of boxes) {
      expect(box.x, box.id).toBeGreaterThanOrEqual(MARGIN);
      expect(box.x + box.w, box.id).toBeLessThanOrEqual(210 - MARGIN);
      expect(box.y + box.h, box.id).toBeLessThanOrEqual(pausalProfile.height);
    }
  });

  it('carries every label the reference prints, except its vendor credit', () => {
    const labels = pausalProfile.primitives.filter((p) => p.kind === 'label');
    const wanted = ['НАЛОГ ЗА УПЛАТУ', 'платилац', 'сврха уплате', 'прималац', 'валута', 'износ'];
    for (const text of wanted) {
      expect(labels.some((l) => l.text === text), `label "${text}"`).toBe(true);
    }
    expect(labels.some((l) => l.text.includes('HSFormular'))).toBe(false);
  });
});
