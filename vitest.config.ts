import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ['packages/**/tests/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      // Só o código que roda no app e nos pacotes: teste, configuração e
      // script de geração de documento não entram na conta.
      include: ['packages/*/src/**', 'apps/mobile/src/**'],
      exclude: ['**/*.d.ts', '**/index.ts'],
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
    },
  },
  // Os componentes do app vivem em apps/mobile, cujo tsconfig estende
  // "expo/tsconfig.base". Dependendo de onde o npm hospeda o pacote `expo`, o
  // esbuild não acha esse arquivo e a transformação falha antes do primeiro
  // teste. A string evita a busca automática de tsconfigs pelo Vite; um objeto
  // ainda dispara essa busca antes de aplicar as opções abaixo.
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        target: 'es2022',
        useDefineForClassFields: false,
      },
    }),
  },
  resolve: {
    alias: {
      // Os testes de componentes usam um único mock, mesmo com dependências nos dois workspaces.
      'react': r('./node_modules/react'),
      'react-native': r('./node_modules/react-native'),
      'expo-router': r('./node_modules/expo-router'),
      '@drmoo/engine': r('./packages/engine/src/index.ts'),
      '@drmoo/knowledge': r('./packages/knowledge/src/index.ts'),
      '@drmoo/domain': r('./packages/domain/src/index.ts'),
      '@drmoo/db': r('./packages/db/src/index.ts'),
      '@drmoo/sync': r('./packages/sync/src/index.ts'),
      '@drmoo/planilha': r('./packages/planilha/src/index.ts'),
      '@drmoo/relatorio': r('./packages/relatorio/src/index.ts'),
      '@drmoo/ui': r('./packages/ui/src/index.ts'),
    },
  },
});
