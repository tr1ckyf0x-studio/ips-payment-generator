/**
 * Loads the embedded typeface in the browser.
 *
 * The renderer takes font bytes rather than fetching them itself, which is what lets
 * the Node tests hand it files off disk while the app hands it fetched assets.
 */
import regularUrl from '../assets/fonts/LiberationSans-Regular.ttf?url';
import boldUrl from '../assets/fonts/LiberationSans-Bold.ttf?url';
import narrowUrl from '../assets/fonts/RobotoCondensed-Regular.ttf?url';
import type { FontBytes } from './renderer.ts';

let cached: Promise<FontBytes> | undefined;

export function loadFonts(): Promise<FontBytes> {
  cached ??= Promise.all([
    fetch(regularUrl).then((r) => r.arrayBuffer()),
    fetch(boldUrl).then((r) => r.arrayBuffer()),
    fetch(narrowUrl).then((r) => r.arrayBuffer()),
  ]).then(([regular, bold, narrow]) => ({ regular, bold, narrow }));
  return cached;
}
