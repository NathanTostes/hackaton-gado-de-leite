#!/usr/bin/env node
/**
 * Tira o `extends: "expo/tsconfig.base"` do tsconfig do app.
 *
 * O Expo reescreve `apps/mobile/tsconfig.json` a cada `expo export` /
 * `expo prebuild` e recoloca esse `extends`. Acontece que o pacote `expo` não
 * declara `tsconfig.base.json` em "exports": o `tsc` ainda acha (resolução
 * legada), mas o esbuild/vite da suíte de testes não — e aí os testes de
 * interface param de rodar antes do primeiro `it`.
 *
 * As opções que o arquivo base traz já estão copiadas no tsconfig do app, com
 * comentário explicando. Este script só desfaz a reintrodução, para que rodar
 * um build nunca quebre `npm test`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARQUIVO = resolve(RAIZ, 'apps/mobile/tsconfig.json');

const original = readFileSync(ARQUIVO, 'utf8');
// Remove a linha do extends (com ou sem vírgula, no meio ou no fim do objeto).
const limpo = original
  .replace(/^\s*"extends"\s*:\s*"expo\/tsconfig\.base"\s*,?\s*$\n?/m, '')
  .replace(/,(\s*)\n(\s*)\}\s*$/, '$1\n$2}\n');

if (limpo !== original) {
  writeFileSync(ARQUIVO, limpo, 'utf8');
  console.log('tsconfig do app normalizado (extends do Expo removido).');
}
