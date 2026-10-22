/**
 * Exportação e importação da propriedade inteira em planilha.
 *
 * A exportação e o template são o mesmo arquivo: baixar o modelo com os dados
 * atuais dentro é o que permite ao produtor corrigir, completar e devolver —
 * e é o que vai alimentar o sistema na apresentação.
 *
 * A importação é **não destrutiva por padrão**: ela grava e atualiza, sem
 * apagar o que não está na planilha. Quem quiser trocar a base inteira pede
 * explicitamente (`substituir: true`).
 */
import {
  ABAS,
  abaParaBanco,
  bancoParaAba,
  gerarArquivo,
  gerarArquivoBase64,
  lerArquivo,
  type ConteudoPlanilha,
  type ErroImportacao,
  type LinhaBanco,
} from '@drmoo/planilha';
import { abrirBanco, agoraISO, apagarTudo, consultar, emTransacao, executar, novoId, type Parametro } from './driver';

/** Chave natural de cada tabela: o que faz a linha ser "a mesma" entre importações. */
const CHAVE_NATURAL: Record<string, string[]> = {
  propriedade: [],
  lote: ['nome'],
  animal: ['brinco'],
  lactacao: ['animal_id', 'numero'],
  controle_leiteiro: ['animal_id', 'data'],
  producao_propriedade: ['data'],
  exame_cmt: ['animal_id', 'data'],
  exame_ccs: ['animal_id', 'data'],
  medicamento: ['nome'],
  tratamento: ['animal_id', 'data_inicio'],
  vacina: ['nome'],
  vacinacao: ['animal_id', 'vacina_id', 'data'],
  cobertura: ['animal_id', 'data'],
  morte: ['animal_id', 'data'],
  despesa: ['data', 'categoria', 'valor'],
  receita: ['data', 'categoria', 'valor', 'animal_id'],
  evento_calendario: ['tipo', 'data', 'titulo'],
};

interface Nomes {
  animais: Map<string, string>;
  lotes: Map<string, string>;
  medicamentos: Map<string, string>;
  vacinas: Map<string, string>;
}

async function nomesPorId(): Promise<Nomes> {
  const [animais, lotes, medicamentos, vacinas] = await Promise.all([
    consultar<{ id: string; brinco: string }>('SELECT id, brinco FROM animal WHERE deleted_at IS NULL'),
    consultar<{ id: string; nome: string }>('SELECT id, nome FROM lote'),
    consultar<{ id: string; nome: string }>('SELECT id, nome FROM medicamento'),
    consultar<{ id: string; nome: string }>('SELECT id, nome FROM vacina'),
  ]);
  return {
    animais: new Map(animais.map((a) => [a.id, a.brinco])),
    lotes: new Map(lotes.map((l) => [l.id, l.nome])),
    medicamentos: new Map(medicamentos.map((m) => [m.id, m.nome])),
    vacinas: new Map(vacinas.map((v) => [v.id, v.nome])),
  };
}

function inverter(mapa: Map<string, string>): Map<string, string> {
  return new Map([...mapa.entries()].map(([id, nome]) => [nome, id]));
}

/** Conteúdo da planilha a partir do banco atual. */
export async function conteudoDaPlanilha(): Promise<ConteudoPlanilha> {
  await abrirBanco();
  const nomes = await nomesPorId();
  const conteudo: ConteudoPlanilha = {};

  for (const aba of ABAS) {
    const filtro = aba.tabela === 'animal' ? ' WHERE deleted_at IS NULL' : '';
    const linhas = await consultar<LinhaBanco>(`SELECT * FROM ${aba.tabela}${filtro}`);
    conteudo[aba.nome] = bancoParaAba(aba, linhas, nomes);
  }
  return conteudo;
}

/** Arquivo `.xlsx` com os dados atuais — serve de exportação e de template. */
export async function exportarPlanilha(): Promise<Uint8Array> {
  return gerarArquivo(await conteudoDaPlanilha());
}

/** O mesmo arquivo em base64, para gravar no sistema de arquivos do aparelho. */
export async function exportarPlanilhaBase64(): Promise<string> {
  return gerarArquivoBase64(await conteudoDaPlanilha());
}

/**
 * Planilha de exemplo — não olha para o banco.
 *
 * Fica aqui, junto da exportação, porque é daqui que a tela de configurações
 * busca tudo que tem a ver com planilha; o conteúdo em si vive em
 * `@drmoo/planilha`, sem depender de banco nenhum.
 */
export { gerarArquivoExemplo, gerarArquivoExemploBase64, NOME_ARQUIVO_EXEMPLO } from '@drmoo/planilha';

export interface RelatorioImportacao {
  /** Linhas gravadas por aba. */
  gravadas: Record<string, number>;
  total: number;
  erros: ErroImportacao[];
  abasDesconhecidas: string[];
  substituiu: boolean;
}

export interface OpcoesImportacao {
  /** Apaga os dados atuais antes de importar. Padrão: false (só acrescenta e atualiza). */
  substituir?: boolean;
}

/**
 * Importa o arquivo lido do disco.
 *
 * Tudo numa transação só: se a planilha quebrar no meio, o banco não fica meio
 * importado — ou entra inteira ou não entra nada.
 */
export async function importarPlanilha(
  dados: Uint8Array | ArrayBuffer | string,
  opcoes: OpcoesImportacao = {},
): Promise<RelatorioImportacao> {
  await abrirBanco();
  const { conteudo, abasDesconhecidas } = lerArquivo(dados);

  const relatorio: RelatorioImportacao = {
    gravadas: {},
    total: 0,
    erros: [],
    abasDesconhecidas,
    substituiu: Boolean(opcoes.substituir),
  };

  const importar = async () => {
    // Chaves já existentes, para a importação atualizar em vez de duplicar.
    const existentes = new Map<string, Map<string, string>>();
    for (const tabela of Object.keys(CHAVE_NATURAL)) {
      const chaves = CHAVE_NATURAL[tabela] ?? [];
      const mapa = new Map<string, string>();
      if (chaves.length) {
        const linhas = await consultar<LinhaBanco>(`SELECT id, ${chaves.join(', ')} FROM ${tabela}`);
        for (const l of linhas) mapa.set(chaves.map((c) => String(l[c] ?? '')).join('|'), String(l.id));
      }
      existentes.set(tabela, mapa);
    }

    const nomes = await nomesPorId();
    const contexto = {
      animais: inverter(nomes.animais),
      lotes: inverter(nomes.lotes),
      medicamentos: inverter(nomes.medicamentos),
      vacinas: inverter(nomes.vacinas),
      novoId,
      agora: agoraISO,
      idExistente: (tabela: string, linha: LinhaBanco) => {
        const chaves = CHAVE_NATURAL[tabela] ?? [];
        if (!chaves.length) return undefined;
        return existentes.get(tabela)?.get(chaves.map((c) => String(linha[c] ?? '')).join('|'));
      },
    };

    // A propriedade é linha única: atualizar a existente, não criar outra.
    const propriedadeAtual = await consultar<{ id: string }>('SELECT id FROM propriedade LIMIT 1');

    const paraGravar: { tabela: string; aba: string; linhas: LinhaBanco[] }[] = [];

    // Na ordem das abas: lotes e medicamentos antes de quem os referencia; os
    // ids recém-criados entram no contexto para a aba seguinte enxergá-los.
    for (const aba of ABAS) {
      const linhasPlanilha = conteudo[aba.nome];
      if (!linhasPlanilha?.length) continue;

      const convertido = abaParaBanco(aba, aba.linhaUnica ? linhasPlanilha.slice(0, 1) : linhasPlanilha, contexto);
      relatorio.erros.push(...convertido.erros);

      if (aba.tabela === 'propriedade' && propriedadeAtual[0]) {
        for (const linha of convertido.linhas) linha.id = propriedadeAtual[0].id;
      }

      for (const linha of convertido.linhas) {
        const id = String(linha.id);
        if (aba.tabela === 'animal' && linha.brinco) contexto.animais.set(String(linha.brinco), id);
        if (aba.tabela === 'lote' && linha.nome) contexto.lotes.set(String(linha.nome), id);
        if (aba.tabela === 'medicamento' && linha.nome) contexto.medicamentos.set(String(linha.nome), id);
        if (aba.tabela === 'vacina' && linha.nome) contexto.vacinas.set(String(linha.nome), id);
      }

      paraGravar.push({ tabela: aba.tabela, aba: aba.nome, linhas: convertido.linhas });
    }

    if (opcoes.substituir && relatorio.erros.length) {
      throw new Error('A substituição foi cancelada. Corrija a planilha: ' +
        relatorio.erros.map((e) => `${e.aba}, linha ${e.linha}: ${e.motivo}`).join('; '));
    }

    await executar('PRAGMA defer_foreign_keys = ON', []);
    for (const { tabela, aba, linhas } of paraGravar) {
      for (const linha of linhas) {
        const colunas = Object.keys(linha).filter((c) => linha[c] !== undefined);
        const atribuicoes = colunas.filter((c) => c !== 'id' && c !== 'created_at').map((c) => `${c} = excluded.${c}`);
        await executar(
          `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})
           ON CONFLICT(id) DO UPDATE SET ${atribuicoes.join(', ')}`,
          colunas.map((c) => linha[c] as Parametro),
        );
        relatorio.gravadas[aba] = (relatorio.gravadas[aba] ?? 0) + 1;
        relatorio.total += 1;
      }
    }
  };

  // Na substituição, limpar, validar e gravar pertencem à mesma transação.
  if (opcoes.substituir) await apagarTudo(importar);
  else await emTransacao(importar);

  return relatorio;
}
