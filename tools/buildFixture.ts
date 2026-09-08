/**
 * Snapshots the reference blank's geometry into a committed fixture.
 *
 * Run with `npm run fixture`. The fixture is what `tests/layout.spec.ts` compares the
 * layout spec against, so regenerating it is a deliberate act: it means adopting a new
 * reference, not fixing a failing test.
 */
import { writeFileSync } from 'node:fs';
import { extractGeometry, extractText } from './extractGeometry.ts';

const REFERENCE = 'references/reference-uplatnica-pausal.pdf';
const OUT = 'tests/fixtures/reference-geometry.json';

const geometry = extractGeometry(REFERENCE);
const text = extractText(REFERENCE);

writeFileSync(
  OUT,
  JSON.stringify({ source: REFERENCE, ...geometry, text }, null, 2) + '\n',
);

console.log(
  `${OUT}: ${geometry.pageWidth} x ${geometry.pageHeight} mm, ` +
    `${geometry.rects.length} rects, ${geometry.lines.length} lines, ${text.length} text runs`,
);
