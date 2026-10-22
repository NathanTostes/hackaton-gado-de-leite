/**
 * Gera `docs/02-base-de-conhecimento.md` e `docs/05-casos-de-teste.md` a partir
 * da própria base. Documentação escrita à mão sobre uma base que muda vira
 * documentação errada; esta é derivada da fonte.
 *
 * Uso: npm run docs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { regraEmLinguagemNatural } from '@drmoo/engine';
import {
  ROTULO_GRUPO,
  baseCompilada,
  baseDeConhecimento,
  casos,
  executarCasos,
  rotulos,
} from '@drmoo/knowledge';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(RAIZ, 'docs');
mkdirSync(DOCS, { recursive: true });

// ---------------------------------------------------------------------------
// 02 — Base de conhecimento
// ---------------------------------------------------------------------------

const validadas = baseDeConhecimento.regras.filter((r) => r.status === 'validada');
const aRevisar = baseDeConhecimento.regras.filter((r) => r.status === 'revisar');

const porGrupo = new Map<string, typeof baseDeConhecimento.regras>();
for (const r of baseDeConhecimento.regras) {
  porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r]);
}

const linhas: string[] = [
  '# 2. Base de conhecimento',
  '',
  '> **Documento gerado automaticamente a partir de `packages/knowledge/kb/`.**',
  '> Não edite este arquivo à mão: edite a base e rode `npm run docs`.',
  '',
  `**Versão da base:** ${baseDeConhecimento.versao}`,
  '',
  `**${baseDeConhecimento.regras.length} regras de produção** · ` +
    `${validadas.length} validadas contra fonte primária · ` +
    `${aRevisar.length} a revisar · ` +
    `${baseDeConhecimento.perguntas.length} perguntas · ` +
    `${baseDeConhecimento.hipoteses.length} hipóteses`,
  '',
  '## 2.1 Como a base é escrita',
  '',
  'A base vive em JSON, e não em código, por uma razão prática: ela é **dado**, não programa.',
  'Um médico-veterinário consegue abrir `packages/knowledge/kb/grupos/02-mastite.json`, ler a',
  'regra, conferir a página da cartilha citada e dizer se está certa — sem saber TypeScript.',
  '',
  'Cada regra carrega:',
  '',
  '| Campo | Para que serve |',
  '|---|---|',
  '| `se` | premissa, em `todas` (E), `alguma` (OU) e `nao`, com 10 operadores de comparação |',
  '| `entao` | conclusões, cada uma com seu fator de certeza |',
  '| `prioridade` | resolução de conflito quando várias regras podem disparar |',
  '| `porque` | o texto que o app mostra em "por que essa pergunta?" e no traço |',
  '| `conduta` | o que fazer, como checklist acionável na tela |',
  '| `fonte` | referência bibliográfica, com página |',
  '| `status` | `validada` (conferida com fonte primária) ou `revisar` |',
  '',
  '## 2.2 Procedência e honestidade sobre o que não foi validado',
  '',
  'O grupo de **mastite** foi extraído integralmente da cartilha da Embrapa Gado de Leite',
  '*"Como identificar a vaca com mastite em sua propriedade"* (2015), com a página citada regra a',
  'regra. São as regras marcadas como `validada`.',
  '',
  'Os demais grupos clínicos foram formalizados a partir de consenso veterinário geral e **ainda',
  'não foram conferidos com fonte primária**. Estão marcados como `revisar` e, no aplicativo,',
  'qualquer conclusão que dependa deles aparece com o selo *"requer validação técnica"*.',
  '',
  'Declarar isso é mais útil do que escondê-lo: o sistema é uma prova de conceito, e a fronteira',
  'entre o que está verificado e o que está suposto é informação clínica relevante para quem usa.',
  '',
  '## 2.3 Metas e fórmulas de rebanho',
  '',
  '| Indicador | Meta | Fonte |',
  '|---|---|---|',
  '| % de mastite clínica no mês | ≤ 2% | Mastite, p. 38 (adaptado do National Mastitis Council) |',
  '| % de mastite subclínica | ≤ 20% | Mastite, p. 39 |',
  '| Intervalo entre testes de CMT | 30 dias | Mastite, p. 23 |',
  '| CCS individual indicando subclínica | > 200.000 células/mL | Mastite, p. 34 |',
  '| CMT positivo caracterizando mastite crônica | ≥ 3 meses na mesma lactação | Mastite, p. 35 |',
  '| % de vacas em lactação | ~83% | Administrando, p. 46 |',
  '| % de vacas no rebanho | ~50% | Administrando, p. 46 |',
  '',
  '## 2.4 Regras de produção',
  '',
];

for (const [grupo, regras] of porGrupo) {
  linhas.push(`### ${ROTULO_GRUPO[grupo] ?? grupo}`, '');
  for (const r of regras) {
    linhas.push(
      `#### \`${r.id}\` — ${r.titulo}`,
      '',
      '```',
      regraEmLinguagemNatural(r.se, r.entao, rotulos),
      '```',
      '',
      `**Por quê:** ${r.porque}`,
      '',
    );
    if (r.conduta?.length) {
      linhas.push('**Conduta:**', '');
      for (const c of r.conduta) linhas.push(`- ${c}`);
      linhas.push('');
    }
    linhas.push(
      `**Fonte:** ${r.fonte}`,
      '',
      `**Status:** ${r.status === 'validada' ? '✅ validada' : '⚠️ a revisar'} · ` +
        `**Prioridade:** ${r.prioridade}`,
      '',
      '---',
      '',
    );
  }
}

linhas.push(
  '## 2.5 Perguntas',
  '',
  'O custo indica o esforço para obter a resposta: 1 = observação direta, 3 = exige manejo ou',
  'contenção, 5 = exame laboratorial. O motor divide o ganho esperado pelo custo, e por isso',
  'pergunta "o leite tem grumos?" antes de pedir uma CCS de laboratório.',
  '',
  '| Variável | Pergunta | Tipo | Custo |',
  '|---|---|---|---|',
);
for (const p of baseDeConhecimento.perguntas) {
  linhas.push(`| \`${p.var}\` | ${p.pergunta} | ${p.tipo} | ${p.custo} |`);
}

linhas.push(
  '',
  '## 2.6 Changelog',
  '',
);
for (const c of baseDeConhecimento.changelog) {
  linhas.push(`### v${c.versao} — ${c.data}`, '', c.notas, '');
}

writeFileSync(join(DOCS, '02-base-de-conhecimento.md'), linhas.join('\n'));

// ---------------------------------------------------------------------------
// 05 — Casos de teste
// ---------------------------------------------------------------------------

const resultados = executarCasos(baseCompilada);
const passaram = resultados.filter((r) => r.passou).length;

const l2: string[] = [
  '# 5. Casos de teste',
  '',
  '> **Documento gerado automaticamente.** Rode `npm run docs` para atualizar.',
  '',
  '*"Defina casos de teste com resultado esperado junto com o conhecimento do domínio e valide',
  'cada versão da base"* — diretriz explícita do regulamento do Hackathon.',
  '',
  `**${passaram} de ${resultados.length} casos passam** contra a base v${baseDeConhecimento.versao}.`,
  '',
  'Os mesmos casos rodam em três lugares: na suíte automatizada (`npm test`), no CI local antes',
  'de qualquer alteração na base, e **dentro do próprio aplicativo**, na tela "Base de',
  'conhecimento" — onde qualquer pessoa pode apertar um botão e ver o resultado.',
  '',
  '## 5.1 Resumo',
  '',
  '| Caso | Descrição | Esperado | Obtido | Resultado |',
  '|---|---|---|---|---|',
];

for (const r of resultados) {
  const esperado = r.caso.esperado.diagnosticoPrincipal ?? '_nenhuma conclusão_';
  const obtido = r.obtido.diagnosticoPrincipal
    ? `${r.obtido.diagnosticoPrincipal} (CF ${r.obtido.cf?.toFixed(2)})`
    : '_nenhuma conclusão_';
  l2.push(
    `| \`${r.caso.id}\` | ${r.caso.descricao} | ${esperado} | ${obtido} | ${
      r.passou ? '✅' : `❌ ${r.falhas.join('; ')}`
    } |`,
  );
}

l2.push('', '## 5.2 Detalhe de cada caso', '');

for (const r of resultados) {
  const c = r.caso;
  l2.push(
    `### \`${c.id}\` — ${c.descricao}`,
    '',
    '**Fatos de entrada:**',
    '',
    '```json',
    JSON.stringify(c.fatos, null, 2),
    '```',
    '',
    `**Regras disparadas:** ${r.obtido.regrasDisparadas.map((x) => `\`${x}\``).join(', ') || '—'}`,
    '',
    `**Hipóteses resultantes:** ${
      r.obtido.hipoteses.map((h) => `${h.id} (${h.cf.toFixed(2)})`).join(', ') || '—'
    }`,
    '',
    `**Resultado:** ${r.passou ? '✅ passou' : `❌ ${r.falhas.join('; ')}`}`,
    '',
    '---',
    '',
  );
}

l2.push(
  '## 5.3 Cobertura',
  '',
  'Os casos cobrem, no mínimo: os três graus de mastite clínica; mastite subclínica por CMT em',
  'cada nível da escala (T, +, ++, +++); subclínica por CCS acima e abaixo de 200.000; mastite',
  'crônica; peito perdido; o exemplo impresso de 4,8% de mastite clínica da cartilha; mastite',
  'subclínica acima e abaixo da meta de 20%; um caso de cada grupo clínico; dois casos de',
  'notificação obrigatória; dois casos de bezerra; **dois casos negativos** — o sistema precisa',
  'saber dizer "não encontrei alteração" — e um caso deliberadamente ambíguo, em que duas',
  'hipóteses ficam próximas e o parecer traz as duas.',
  '',
);

writeFileSync(join(DOCS, '05-casos-de-teste.md'), l2.join('\n'));

console.log(
  `docs/02-base-de-conhecimento.md (${baseDeConhecimento.regras.length} regras)\n` +
    `docs/05-casos-de-teste.md (${passaram}/${resultados.length} casos passando)`,
);
