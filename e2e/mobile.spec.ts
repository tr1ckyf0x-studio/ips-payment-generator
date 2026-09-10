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
