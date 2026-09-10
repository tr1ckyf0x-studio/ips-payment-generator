/**
 * Browser tests run against the built site, served with the headers that ship.
 *
 * Not against the dev server and not against `vite preview`: the first bundles
 * differently and the second ignores `public/_headers`, so neither could tell whether
 * the content security policy lets the app work. Everything here has to hold for the
 * artifact a visitor actually receives.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

export default defineConfig({
  testDir: 'e2e',
  // The suite is small and every case renders a PDF; serial keeps the output readable
  // and the machine unloaded, and costs a few seconds.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    // A phone is where the layout has to give something up, so it is tested where it
    // has to: a narrow viewport with touch, not a desktop window made thin.
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npm run serve:dist -- ${PORT}`,
    url: `http://localhost:${PORT}/`,
    // Never reuse whatever happens to hold the port. A stray server left from an earlier
    // session served its own copy of `_headers`, read once at its start, and the suite
    // passed against a policy that had been deliberately broken — the one thing these
    // tests exist to notice. Paying a rebuild each run is the cheaper mistake.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
