import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ['packages/**/tests/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@drmoo/engine': r('./packages/engine/src/index.ts'),
      '@drmoo/knowledge': r('./packages/knowledge/src/index.ts'),
      '@drmoo/domain': r('./packages/domain/src/index.ts'),
      '@drmoo/db': r('./packages/db/src/index.ts'),
    },
  },
});
