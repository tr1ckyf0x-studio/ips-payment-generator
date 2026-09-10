import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        // 127 kB of metrics for fonts this app never embeds. See src/pdf/standardFonts.ts.
        // Anchored, because a bare string alias also matches deep paths — and the stub
        // itself imports one of those to keep the encoding tables real.
        find: /^@pdf-lib\/standard-fonts$/,
        replacement: resolve('./src/pdf/standardFonts.ts'),
      },
    ],
  },
  build: {
    // One page per language, because a search engine can only offer one per URL. All
    // three load the same app; only the head and the pre-render copy differ.
    rollupOptions: {
      input: {
        ru: resolve('./index.html'),
        sr: resolve('./sr/index.html'),
        en: resolve('./en/index.html'),
      },
    },
    /**
     * The default 500 kB warns about the lazy `renderer` chunk — pdf-lib, fontkit and the
     * QR builder, 1058 kB, which no longer blocks the first paint. Its size is a decision
     * rather than an accident, so the threshold is raised past it, but only just: the
     * entry chunk is held to its own ceiling by `tests/bundle.spec.ts`, and this still
     * trips if the deferred half starts growing.
     */
    chunkSizeWarningLimit: 1100,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
