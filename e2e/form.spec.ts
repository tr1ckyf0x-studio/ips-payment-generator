/**
 * What 234 unit tests cannot see: whether the form actually works in a browser.
 *
 * Every user-visible breakage this project has had was found by opening the page and
 * looking — a stale dependency pre-bundle, pdf.js changing its render call, a preview
 * that silently drew nothing. None of them would have failed the unit suite, because
 * none of the unit suite opens the app.
 *
 * These run against the built site under its shipping headers, so a content security
 * policy that blocks the worker or the fonts fails here rather than in production.
 */
import { expect, test, type Page } from '@playwright/test';

/** The NBS documentation's sample payee — nothing personal reaches the repository. */
const SAMPLE = {
  payer: 'PETAR PETROVIĆ\nKNEZ MIHAILOVA 1, BEOGRAD',
  purpose: 'Uplata po računu za el. energiju',
  account: '165-55-74',
  recipient: 'JP EPS BEOGRAD\nBALKANSKA 13',
  amount: '5.200,00',
};

/** Fills the fields the QR needs, by their placeholder, which is language-independent. */
async function fillSlip(page: Page): Promise<void> {
  await page.getByPlaceholder(/PETAR/).fill(SAMPLE.payer);
  await page.getByPlaceholder(/Uplata po/).fill(SAMPLE.purpose);
  await page.getByPlaceholder(/845-/).fill(SAMPLE.account);
  await page.getByPlaceholder(/JP EPS/).fill(SAMPLE.recipient);
  await page.getByPlaceholder('5.200,00').fill(SAMPLE.amount);
  await page.locator('select').filter({ hasText: /Gotovinski|Наличными|Cash/ }).selectOption('1');
  await page.locator('select').filter({ hasText: /21 —/ }).selectOption('21');
}

/** The preview renders the PDF onto a canvas; ink on it means the document arrived. */
async function previewHasInk(page: Page): Promise<boolean> {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d');
    if (!context) return false;
    const { data } = context.getImageData(0, 0, element.width, Math.min(400, element.height));
    for (let i = 0; i < data.length; i += 4) if (data[i] < 200) return true;
    return false;
  });
}

/**
 * Anything the page logs as an error fails the test it happened in. A violation of the
 * shipping content security policy surfaces here and nowhere else — it is not an
 * exception, just a line in the console — so collecting them is the only way to notice.
 */
let consoleErrors: string[] = [];

test.beforeEach(({ page }) => {
  consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
});

test.afterEach(() => {
  expect(consoleErrors, 'the page logged errors').toEqual([]);
});

test('fills a slip and draws its QR code', async ({ page }) => {
  await page.goto('/');
  await fillSlip(page);

  // The form says so itself when the payload cannot be built.
  await expect(page.getByText(/QR-код не сформирован|No QR code|QR kôd nije/)).toHaveCount(0);
  expect(await previewHasInk(page), 'the preview drew nothing').toBe(true);
});

test('keeps what was typed when the language changes, and leaves the address alone', async ({
  page,
}) => {
  await page.goto('/');
  await fillSlip(page);
  const before = page.url();

  await page.locator('select').filter({ hasText: 'Srpski' }).selectOption('sr');

  await expect(page.getByPlaceholder(/PETAR/)).toHaveValue(SAMPLE.payer);
  await expect(page.getByPlaceholder(/845-/)).toHaveValue(SAMPLE.account);
  expect(page.url(), 'switching language rewrote the address').toBe(before);
  await expect(page.locator('html')).toHaveAttribute('lang', 'sr');
});

test('serves each language from its own address', async ({ page }) => {
  for (const [path, lang] of [
    ['/', 'ru'],
    ['/sr/', 'sr'],
    ['/en/', 'en'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      new RegExp(`${path === '/' ? '/' : path}$`),
    );
  }
});

test('hands over a PDF when asked', async ({ page }) => {
  await page.goto('/');
  await fillSlip(page);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Скачать PDF|Download PDF|Preuzmi PDF/ }).click();
  const file = await download;

  const stream = await file.createReadStream();
  const head: Buffer[] = [];
  for await (const chunk of stream) {
    head.push(chunk as Buffer);
    if (Buffer.concat(head).length > 5) break;
  }
  expect(Buffer.concat(head).subarray(0, 5).toString()).toBe('%PDF-');
});

test('answers a path that does not exist with a real 404', async ({ page }) => {
  // It used to answer 200 with the whole application, which reads as an unlimited
  // supply of duplicate pages to anything crawling the site.
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);

  // The browser logs the 404 as a failed resource load. Here that is the assertion
  // passing, not a fault, so it is dropped by hand rather than by loosening the guard —
  // a chunk that really went missing must still fail every other test.
  consoleErrors = consoleErrors.filter((text) => !text.includes('404'));
});
