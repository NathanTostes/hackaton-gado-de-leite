// Metro configurado para monorepo npm workspaces.
// Os pacotes @drmoo/* são consumidos como código-fonte TypeScript, sem build step.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const raizDoProjeto = __dirname;
const raizDoMonorepo = path.resolve(raizDoProjeto, '../..');

const config = getDefaultConfig(raizDoProjeto);

// 1. Observar também os pacotes do monorepo.
config.watchFolders = [raizDoMonorepo];

// 2. Resolver módulos no node_modules do app e no da raiz.
config.resolver.nodeModulesPaths = [
  path.resolve(raizDoProjeto, 'node_modules'),
  path.resolve(raizDoMonorepo, 'node_modules'),
];

// 3. Evitar instâncias duplicadas de React quando o pacote existe nos dois níveis.
config.resolver.disableHierarchicalLookup = true;

// 4. O SQLite da web é o próprio SQLite compilado em WebAssembly (wa-sqlite).
//    Sem registrar .wasm como asset, o bundle de produção não resolve o módulo
//    e o app abre sem banco — justamente na demonstração em localhost.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

module.exports = config;
