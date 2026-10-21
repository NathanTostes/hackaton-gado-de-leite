/**
 * Motor de inferência do Dr. Moo.
 *
 * Referência: specsDrMoo.md §4.4 (ciclo), §4.7 (resolução de conflito),
 * §4.8 (traço) e §4.9 (reprodutibilidade).
 *
 * Decisão de projeto: a sessão **recomputa tudo do zero** a cada avanço, a partir
 * de (fatos iniciais + lista ordenada de respostas). Isso dá três propriedades de
 * graça: retração ("voltar") é só remover a última resposta; reabrir um prontuário
 * antigo reproduz o parecer bit a bit; e não há estado oculto para dessincronizar.
 * O custo é irrelevante — a base tem dezenas de regras e roda em poucos milissegundos.
 */
import {
  LIMIAR_PREMISSA,
  combinar,
  premissaSatisfeita,
  propagar,
  rotuloDeConfianca,
} from './cf';
import { avaliarCondicao, especificidade } from './match';
import { chaveObjetivo, compilarBase, type BaseCompilada, type RegraCompilada } from './compilar';
import type {
  BaseDeConhecimento,
  CF,
  Fato,
  Hipotese,
  JustificativaPergunta,
  MemoriaDeTrabalho,
  MotivoParada,
  OpcoesSessao,
  Parecer,
  PassoDoTraco,
  Pergunta,
  ProximoPasso,
  RespostaUsuario,
} from './types';

export const ENGINE_VERSAO = '1.0.0';

const PADRAO = {
  maxPerguntas: 20,
  limiarConclusao: 0.85,
  distanciaMinima: 0.25,
  /** CF a partir do qual uma bandeira vermelha interrompe o questionário (§4.4). */
  limiarBandeiraVermelha: 0.5,
} as const;

interface EstadoDerivado {
  memoria: MemoriaDeTrabalho;
  traco: PassoDoTraco[];
}

export class Sessao {
  readonly kb: BaseCompilada;
  private readonly fatosIniciais: Fato[];
  private readonly respostas: RespostaUsuario[] = [];
  private readonly opcoes: Required<Omit<OpcoesSessao, 'agora'>> & { agora: () => string };
  private estado: EstadoDerivado;

  constructor(kb: BaseDeConhecimento | BaseCompilada, fatosIniciais: Fato[] = [], opcoes: OpcoesSessao = {}) {
    this.kb = 'regrasCompiladas' in kb ? (kb as BaseCompilada) : compilarBase(kb);
    this.fatosIniciais = fatosIniciais;
    this.opcoes = {
      maxPerguntas: opcoes.maxPerguntas ?? PADRAO.maxPerguntas,
      limiarConclusao: opcoes.limiarConclusao ?? PADRAO.limiarConclusao,
      distanciaMinima: opcoes.distanciaMinima ?? PADRAO.distanciaMinima,
      agora: opcoes.agora ?? (() => new Date().toISOString()),
    };
    this.estado = this.recomputar();
  }

  // -------------------------------------------------------------------------
  // API pública
  // -------------------------------------------------------------------------

  responder(resposta: RespostaUsuario): void {
    // Responder de novo a mesma variável substitui a resposta anterior.
    const i = this.respostas.findIndex((r) => r.variavel === resposta.variavel);
    if (i >= 0) this.respostas.splice(i, 1, resposta);
    else this.respostas.push(resposta);
    this.estado = this.recomputar();
  }

  /** Retração: desfaz a última resposta e recalcula toda a cadeia. */
  voltar(): boolean {
    if (this.respostas.length === 0) return false;
    this.respostas.pop();
    this.estado = this.recomputar();
    return true;
  }

  get perguntasRespondidas(): readonly RespostaUsuario[] {
    return this.respostas;
  }

  get memoria(): MemoriaDeTrabalho {
    return this.estado.memoria;
  }

  get traco(): readonly PassoDoTraco[] {
    return this.estado.traco;
  }

  /** Próximo passo: uma pergunta ou o parecer final. */
  proximo(): ProximoPasso {
    const hipoteses = this.hipoteses();
    const parada = this.verificarParada(hipoteses);

    if (parada) {
      return {
        tipo: 'parecer',
        parecer: this.parecer(parada, hipoteses),
        hipoteses,
        perguntasFeitas: this.respostas.length,
      };
    }

    const escolha = this.escolherPergunta(hipoteses);
    if (!escolha) {
      return {
        tipo: 'parecer',
        parecer: this.parecer('sem_perguntas_uteis', hipoteses),
        hipoteses,
        perguntasFeitas: this.respostas.length,
      };
    }

    return {
      tipo: 'pergunta',
      pergunta: escolha.pergunta,
      justificativa: escolha.justificativa,
      hipoteses,
      perguntasFeitas: this.respostas.length,
    };
  }

  /** Encerra à força (botão "concluir agora"). */
  encerrar(): Parecer {
    return this.parecer('encerrado_pelo_usuario', this.hipoteses());
  }

  // -------------------------------------------------------------------------
  // Ciclo de inferência
  // -------------------------------------------------------------------------

  private recomputar(): EstadoDerivado {
    const memoria: MemoriaDeTrabalho = new Map();
    const agora = this.opcoes.agora();

    for (const f of this.fatosIniciais) memoria.set(f.variavel, { ...f });
    for (const r of this.respostas) {
      // "Não sei" não entra na memória: desconhecido ≠ falso (§4.5).
      if (r.cf === 0) continue;
      memoria.set(r.variavel, {
        variavel: r.variavel,
        valor: r.valor,
        cf: r.cf,
        origem: 'pergunta',
        timestamp: agora,
      });
    }

    const traco = this.encadearProgressivo(memoria, agora);
    return { memoria, traco };
  }

  /**
   * Encadeamento progressivo com refração: dispara uma regra por ciclo, sempre a
   * vencedora da resolução de conflito, e repete até o ponto fixo.
   */
  private encadearProgressivo(memoria: MemoriaDeTrabalho, agora: string): PassoDoTraco[] {
    const traco: PassoDoTraco[] = [];
    const jaDisparadas = new Set<string>();
    // Contador de recência: ordem em que cada chave entrou/mudou na memória.
    const recencia = new Map<string, number>();
    let relogio = 0;
    for (const chave of memoria.keys()) recencia.set(chave, relogio++);

    const MAX_CICLOS = 500; // trava de segurança contra regras mutuamente recursivas
    for (let ciclo = 0; ciclo < MAX_CICLOS; ciclo++) {
      const candidatas: {
        regra: RegraCompilada;
        cfPremissa: CF;
        premissas: PassoDoTraco['premissasAvaliadas'];
        assinatura: string;
      }[] = [];

      for (const regra of this.kb.regrasCompiladas) {
        const av = avaliarCondicao(regra.seCompilada, memoria);
        if (av.cf === null || !premissaSatisfeita(av.cf)) continue;

        // Refração: a mesma regra não dispara duas vezes com os mesmos fatos.
        const assinatura =
          regra.id +
          '|' +
          av.premissas.map((p) => `${p.var}:${String(p.valorObtido)}:${p.cf.toFixed(4)}`).join(',');
        if (jaDisparadas.has(assinatura)) continue;

        candidatas.push({ regra, cfPremissa: av.cf, premissas: av.premissas, assinatura });
      }

      if (candidatas.length === 0) break;

      candidatas.sort((a, b) => this.resolverConflito(a, b, recencia));
      const vencedora = candidatas[0]!;
      jaDisparadas.add(vencedora.assinatura);

      const conclusoes: PassoDoTraco['conclusoes'] = [];
      const derivadoDe = vencedora.premissas.map((p) => p.var);

      for (const c of vencedora.regra.entao) {
        const chave =
          c.var === this.kb.variavelObjetivo ? chaveObjetivo(this.kb.variavelObjetivo, c.val) : c.var;
        const valorArmazenado = c.var === this.kb.variavelObjetivo ? true : c.val;
        const cfNovo = propagar(c.cf, vencedora.cfPremissa);
        const anterior = memoria.get(chave);
        const cfDepois = anterior ? combinar(anterior.cf, cfNovo) : cfNovo;

        memoria.set(chave, {
          variavel: chave,
          valor: valorArmazenado,
          cf: cfDepois,
          origem: 'regra',
          regraId: vencedora.regra.id,
          derivadoDe,
          timestamp: agora,
        });
        recencia.set(chave, relogio++);

        conclusoes.push({
          var: chave,
          val: c.val,
          cfAntes: anterior ? anterior.cf : null,
          cfDepois,
        });
      }

      traco.push({
        ordem: traco.length + 1,
        regraId: vencedora.regra.id,
        regraTitulo: vencedora.regra.titulo,
        premissasAvaliadas: vencedora.premissas,
        cfPremissa: vencedora.cfPremissa,
        conclusoes,
        fonte: vencedora.regra.fonte,
        explicacao: vencedora.regra.porque,
        status: vencedora.regra.status,
      });
    }

    return traco;
  }

  /** §4.7 — bandeira vermelha → especificidade → prioridade → recência → declaração. */
  private resolverConflito(
    a: { regra: RegraCompilada; premissas: PassoDoTraco['premissasAvaliadas'] },
    b: { regra: RegraCompilada; premissas: PassoDoTraco['premissasAvaliadas'] },
    recencia: Map<string, number>,
  ): number {
    const urgente = (r: RegraCompilada) =>
      r.grupo === 'emergencia' || r.grupo === 'notificacao_obrigatoria' ? 1 : 0;
    const dUrgencia = urgente(b.regra) - urgente(a.regra);
    if (dUrgencia !== 0) return dUrgencia;

    const dEspec = especificidade(b.regra.se) - especificidade(a.regra.se);
    if (dEspec !== 0) return dEspec;

    const dPrio = b.regra.prioridade - a.regra.prioridade;
    if (dPrio !== 0) return dPrio;

    const maisRecente = (ps: PassoDoTraco['premissasAvaliadas']) =>
      ps.reduce((max, p) => Math.max(max, recencia.get(p.var) ?? -1), -1);
    const dRec = maisRecente(b.premissas) - maisRecente(a.premissas);
    if (dRec !== 0) return dRec;

    return a.regra.ordemDeclaracao - b.regra.ordemDeclaracao;
  }

  // -------------------------------------------------------------------------
  // Encadeamento regressivo: escolha da próxima pergunta (§4.4 passo 4)
  // -------------------------------------------------------------------------

  private escolherPergunta(
    hipoteses: Hipotese[],
  ): { pergunta: Pergunta; justificativa: JustificativaPergunta } | null {
    const respondidas = new Set(this.respostas.map((r) => r.variavel));
    const cfPorHipotese = new Map(hipoteses.map((h) => [h.id, Math.abs(h.cf)] as const));

    const scores = new Map<string, number>();
    const regrasPorVar = new Map<string, RegraCompilada[]>();

    /**
     * Desconto aplicado a cada nível de submeta. Perguntar algo que só serve
     * depois de outra coisa ser provada vale menos do que perguntar a coisa em si.
     */
    const DESCONTO_SUBMETA = 0.8;
    const PROFUNDIDADE_MAX = 4;

    /**
     * Encadeamento regressivo propriamente dito: distribui o peso de uma regra
     * pelas variáveis que faltam. Se a variável faltante não é perguntável mas é
     * produzida por outras regras (uma submeta, como `diagnostico=mastite_g1`),
     * recorre para essas regras — é assim que o motor descobre que, para chegar
     * ao grau 2, antes precisa perguntar o que estabelece o grau 1.
     */
    const distribuir = (
      regra: RegraCompilada,
      peso: number,
      regraRaiz: RegraCompilada,
      profundidade: number,
      caminho: Set<string>,
    ): void => {
      if (profundidade > PROFUNDIDADE_MAX || caminho.has(regra.id)) return;
      const av = avaliarCondicao(regra.seCompilada, this.estado.memoria);
      // Regra já decidida (disparou ou foi descartada) não motiva pergunta.
      if (av.cf !== null || av.faltantes.length === 0) return;

      const proximoCaminho = new Set(caminho).add(regra.id);

      for (const v of av.faltantes) {
        const pergunta = this.kb.perguntaPorVar.get(v);

        if (!pergunta) {
          // Submeta: recorre nas regras que podem prová-la.
          for (const produtora of this.kb.produzidaPor.get(v) ?? []) {
            distribuir(produtora, peso * DESCONTO_SUBMETA, regraRaiz, profundidade + 1, proximoCaminho);
          }
          continue;
        }

        if (respondidas.has(v) || this.estado.memoria.has(v)) continue;
        if (!this.preRequisitoOk(pergunta)) continue;

        const custo = Math.max(1, pergunta.custo);
        scores.set(v, (scores.get(v) ?? 0) + peso / custo);
        const lista = regrasPorVar.get(v) ?? [];
        if (!lista.includes(regraRaiz)) lista.push(regraRaiz);
        regrasPorVar.set(v, lista);
      }
    };

    for (const regra of this.kb.regrasCompiladas) {
      const av = avaliarCondicao(regra.seCompilada, this.estado.memoria);
      if (av.cf !== null || av.faltantes.length === 0) continue;

      // Peso da regra: quanto ela ainda pode mudar o quadro.
      let peso = 0;
      for (const c of regra.entao) {
        const alvo = c.var === this.kb.variavelObjetivo ? String(c.val) : c.var;
        const cfAtual = cfPorHipotese.get(alvo) ?? 0;
        peso += Math.abs(c.cf) * (1 - cfAtual);
      }
      peso *= regra.prioridade / 100;
      if (regra.grupo === 'emergencia' || regra.grupo === 'notificacao_obrigatoria') peso *= 2.5;

      distribuir(regra, peso, regra, 0, new Set());
    }

    if (scores.size === 0) return null;

    let melhorVar: string | null = null;
    let melhorScore = -Infinity;
    for (const [v, s] of scores) {
      const p = this.kb.perguntaPorVar.get(v)!;
      const atual = melhorVar ? this.kb.perguntaPorVar.get(melhorVar)! : null;
      const melhor =
        s > melhorScore ||
        // desempate determinístico: menor custo, depois ordem de declaração
        (s === melhorScore &&
          atual !== null &&
          (p.custo < atual.custo ||
            (p.custo === atual.custo &&
              this.kb.perguntas.indexOf(p) < this.kb.perguntas.indexOf(atual))));
      if (melhor) {
        melhorScore = s;
        melhorVar = v;
      }
    }

    if (!melhorVar) return null;
    const pergunta = this.kb.perguntaPorVar.get(melhorVar)!;
    return {
      pergunta,
      justificativa: this.justificar(melhorVar, regrasPorVar.get(melhorVar) ?? []),
    };
  }

  private preRequisitoOk(p: Pergunta): boolean {
    if (!p.preRequisito) return true;
    const av = avaliarCondicao(p.preRequisito, this.estado.memoria);
    return av.cf !== null && av.cf >= LIMIAR_PREMISSA;
  }

  /** Módulo de explicação — "por que essa pergunta?" (§4.8). */
  private justificar(variavel: string, regras: RegraCompilada[]): JustificativaPergunta {
    const rotuloHip = new Map(this.kb.hipoteses.map((h) => [h.id, h.rotulo] as const));
    const regrasPendentes = regras.slice(0, 4).map((r) => ({
      id: r.id,
      titulo: r.titulo,
      porque: r.porque,
      hipoteses: r.entao
        .filter((c) => c.var === this.kb.variavelObjetivo)
        .map((c) => rotuloHip.get(String(c.val)) ?? String(c.val)),
    }));

    const alvos = [...new Set(regrasPendentes.flatMap((r) => r.hipoteses))];
    const texto =
      alvos.length > 0
        ? `Esta resposta ajuda a separar: ${alvos.join(', ')}.`
        : 'Esta resposta é necessária para avaliar as regras que ainda estão em aberto.';

    return { var: variavel, texto, regrasPendentes };
  }

  // -------------------------------------------------------------------------
  // Hipóteses, parada e parecer
  // -------------------------------------------------------------------------

  hipoteses(): Hipotese[] {
    const porHipotese = new Map<string, PassoDoTraco[]>();
    for (const passo of this.estado.traco) {
      for (const c of passo.conclusoes) {
        const lista = porHipotese.get(c.var) ?? [];
        lista.push(passo);
        porHipotese.set(c.var, lista);
      }
    }

    const resultado: Hipotese[] = [];
    for (const def of this.kb.hipoteses) {
      const chave = chaveObjetivo(this.kb.variavelObjetivo, def.id);
      const fato = this.estado.memoria.get(chave);
      const cf = fato?.cf ?? 0;
      if (cf <= 0) continue;

      const passos = porHipotese.get(chave) ?? [];
      const regras = passos.map((p) => this.kb.regrasCompiladas.find((r) => r.id === p.regraId)!);
      const conduta = [...new Set(regras.flatMap((r) => r?.conduta ?? []))];
      const fontes = [...new Set(regras.map((r) => r?.fonte).filter(Boolean) as string[])];
      const status = regras.some((r) => r?.status === 'revisar') ? 'revisar' : 'validada';

      resultado.push({
        id: def.id,
        rotulo: def.rotulo,
        descricao: def.descricao,
        grupo: def.grupo,
        cf,
        confianca: rotuloDeConfianca(cf),
        bandeiraVermelha: def.bandeiraVermelha === true,
        conduta,
        fontes,
        status,
        regrasQueSustentam: [...new Set(passos.map((p) => p.regraId))],
      });
    }

    // Subsunção: uma hipótese confirmada apaga do ranking as que ela substitui
    // (o grau 2 da mastite não deve concorrer com o grau 1 que o originou).
    const LIMIAR_SUBSUNCAO = 0.5;
    const confirmadas = new Map(resultado.filter((h) => h.cf >= LIMIAR_SUBSUNCAO).map((h) => [h.id, h]));
    for (const def of this.kb.hipoteses) {
      if (!confirmadas.has(def.id)) continue;
      for (const substituida of def.substitui ?? []) {
        const alvo = resultado.find((h) => h.id === substituida);
        if (alvo) alvo.substituidaPor = def.id;
      }
    }

    return resultado
      .filter((h) => h.substituidaPor === undefined)
      .sort((a, b) => b.cf - a.cf);
  }

  private verificarParada(hipoteses: Hipotese[]): MotivoParada | null {
    const bandeira = hipoteses.find(
      (h) => h.bandeiraVermelha && h.cf >= PADRAO.limiarBandeiraVermelha,
    );
    if (bandeira) return 'bandeira_vermelha';

    const [primeira, segunda] = hipoteses;
    if (
      primeira &&
      primeira.cf >= this.opcoes.limiarConclusao &&
      primeira.cf - (segunda?.cf ?? 0) >= this.opcoes.distanciaMinima
    ) {
      return 'confianca_suficiente';
    }

    if (this.respostas.length >= this.opcoes.maxPerguntas) return 'limite_de_perguntas';
    return null;
  }

  parecer(motivoParada: MotivoParada, hipoteses: Hipotese[] = this.hipoteses()): Parecer {
    return {
      motivoParada,
      hipoteses: hipoteses.filter((h) => h.cf >= LIMIAR_PREMISSA),
      bandeiraVermelha:
        hipoteses.find((h) => h.bandeiraVermelha && h.cf >= PADRAO.limiarBandeiraVermelha) ?? null,
      traco: [...this.estado.traco],
      fatos: [...this.estado.memoria.values()],
      kbVersao: this.kb.versao,
      engineVersao: ENGINE_VERSAO,
      geradoEm: this.opcoes.agora(),
    };
  }

  /** Serialização para gravar no prontuário (§4.9 — reprodutibilidade). */
  serializar(): { respostas: RespostaUsuario[]; fatosIniciais: Fato[]; kbVersao: string } {
    return {
      respostas: [...this.respostas],
      fatosIniciais: [...this.fatosIniciais],
      kbVersao: this.kb.versao,
    };
  }

  static restaurar(
    kb: BaseDeConhecimento | BaseCompilada,
    dados: { respostas: RespostaUsuario[]; fatosIniciais: Fato[] },
    opcoes: OpcoesSessao = {},
  ): Sessao {
    const s = new Sessao(kb, dados.fatosIniciais, opcoes);
    for (const r of dados.respostas) s.responder(r);
    return s;
  }
}

/** Atalho para execução não interativa (casos de teste, §9). */
export function inferir(
  kb: BaseDeConhecimento | BaseCompilada,
  fatos: Fato[],
  opcoes: OpcoesSessao = {},
): Parecer {
  const sessao = new Sessao(kb, fatos, opcoes);
  const passo = sessao.proximo();
  return passo.parecer ?? sessao.encerrar();
}
