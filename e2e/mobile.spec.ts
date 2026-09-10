/**
 * What a phone gives up.
 *
 * The layout collapses to one column below 900 px, which measured well enough — nothing
 * overflowed sideways — while hiding the thing that matters: at 375 px the page is 2.1
 * screens tall with a single slip and grows by about another screen for each one added,
 * and the buttons that produce the document sat on the first of them. Filling the form
 * scrolled them away, so the last step of every visit was scrolling back up to find them.
 */
import { expect, test } from '@playwright/test';

test('never scrolls sideways', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'the page is wider than the screen').toBeLessThanOrEqual(0);
});

test('keeps the actions in reach however far down the form goes', async ({ page }) => {
  await page.goto('/');
  const print = page.getByRole('button', { name: /Печать|Print|Štampaj/ });
  await expect(print).toBeInViewport();

  // Far enough to be well past the header's own place on the page.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(print).toBeInViewport();
});

/**
 * The share sheet is a system surface no browser test can open, so what is checked here
 * is the decision and the payload: that a touch device is offered the document through
 * `navigator.share` rather than sent to a tab, and that the file carries the name and
 * type the sheet will show. Whether the sheet then lists Print is iOS's business.
 */
test('offers the document to the system share sheet', async ({ page }) => {
  await page.addInitScript(() => {
    // Stands in for iOS Safari, the case this branch exists for: a handheld whose
    // browser *does* draw PDFs, so without the branch the document would go to a frame
    // or a tab instead. Headless Chromium reports no viewer, which would let the
    // fallback reach the sheet by accident and prove nothing.
    Object.defineProperty(navigator, 'pdfViewerEnabled', { configurable: true, value: true });

    const shared: string[] = [];
    (window as unknown as { __shared: string[] }).__shared = shared;
    const value = {
      canShare: (data?: { files?: File[] }) => Array.isArray(data?.files) && data.files.length > 0,
      share: async (data: { files: File[] }) => {
        for (const file of data.files) shared.push(`${file.name} ${file.type} ${file.size}`);
      },
    };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: value.canShare });
    Object.defineProperty(navigator, 'share', { configurable: true, value: value.share });
  });

  await page.goto('/');
  expect(
    await page.evaluate(() => navigator.maxTouchPoints),
    'the device under test has no touch, so this is not the branch being exercised',
  ).toBeGreaterThan(0);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /Печать|Print|Štampaj/ }).click();

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared: string[] }).__shared))
    .toEqual([expect.stringMatching(/^nalog-za-uplatu-\d{4}-\d{2}-\d{2}\.pdf application\/pdf \d+$/)]);

  // And nothing else was done with it: no frame to print from, no tab to go back from.
  expect(await page.locator('iframe#print-document').count()).toBe(0);
});
