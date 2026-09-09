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
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
