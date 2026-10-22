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
import { grupoUrgente } from './types';
import type {
  BaseDeConhecimento,
  CF,
  Condicao,
  Fato,
  GrupoRegra,
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

export const ENGINE_VERSAO = '1.1.0';

const PADRAO = {
  /**
   * Teto de perguntas. Subiu de 20 para 24 quando a base passou de um sistema
   * (úbere) para quinze: a triagem gasta as primeiras perguntas descobrindo
   * QUAL sistema investigar, e 20 deixava pouco para o diagnóstico em si.
   */
  maxPerguntas: 24,
  limiarConclusao: 0.85,
  distanciaMinima: 0.25,
  /** CF a partir do qual uma bandeira vermelha interrompe o questionário (§4.4). */
  limiarBandeiraVermelha: 0.5,
  /** CF a partir do qual uma hipótese conta como diagnóstico, não como dúvida. */
  limiarDiagnostico: 0.5,
} as const;

/** Pesos do encadeamento regressivo. Agrupados aqui para ficarem auditáveis. */
const SELECAO = {
  /** Desconto por nível de submeta: provar algo indireto vale menos. */
  descontoSubmeta: 0.8,
  profundidadeMax: 4,
  /** Amplificação do peso de regras de emergência, notificação e intoxicação. */
  pesoUrgente: 2.5,
  /**
   * Bônus de foco: perguntar sobre o sistema que já deu sinal vale mais do que
   * começar um sistema novo. É o que evita o vaivém clínico ("o leite tem
   * grumos?" → "a bezerra mamou colostro?" → "a vaca está mancando?") que uma
   * base de quinze grupos produz quando o motor só olha ganho dividido por custo.
   */
  bonusFoco: 1.8,
  /**
   * Bônus de discriminação por hipótese concorrente além da primeira. Uma
   * pergunta que separa laminite de pododermatite vale mais do que uma que só
   * reforça o que já está na frente.
   */
  bonusDiscriminacao: 0.35,
  discriminacaoMax: 2.0,
  /**
   * Multiplicador quando o pré-requisito da pergunta é desconhecido (e não
   * falso). Perguntar sobre retenção de placenta a uma vaca sem data de parto
   * registrada é razoável — só não é prioritário.
   */
  preRequisitoIncerto: 0.35,
} as const;

interface EstadoDerivado {
  memoria: MemoriaDeTrabalho;
  traco: PassoDoTraco[];
}

type EstadoPreRequisito = 'ok' | 'incerto' | 'bloqueado';

/** Uma variável ainda perguntável, com tudo que o motor sabe sobre o valor dela. */
interface CandidataPergunta {
  /** Soma de ganho ÷ custo sobre todas as regras em aberto que a pedem. */
  pesoBruto: number;
  preRequisito: EstadoPreRequisito;
  /** Hipóteses que esta resposta ainda pode mover — mede o poder de discriminação. */
  hipotesesAlvo: Set<string>;
  /** Sistemas (grupos) das regras que a pedem — alimenta o bônus de foco. */
  grupos: Set<GrupoRegra>;
  /** Regras em aberto que a pedem, para "por que essa pergunta?". */
  regras: RegraCompilada[];
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
    const urgente = (r: RegraCompilada) => (grupoUrgente(r.grupo) ? 1 : 0);
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

  /**
   * Quanto cada variável ainda perguntável pode mudar o quadro.
   *
   * Além do peso bruto (ganho ÷ custo), registra com QUE hipóteses e de que
   * sistemas a variável se relaciona — é o que permite depois premiar a pergunta
   * que mantém o foco clínico e a que separa hipóteses concorrentes.
   */
  private candidatasAPergunta(hipoteses: Hipotese[]): Map<string, CandidataPergunta> {
    const respondidas = new Set(this.respostas.map((r) => r.variavel));
    const cfPorHipotese = new Map(hipoteses.map((h) => [h.id, Math.abs(h.cf)] as const));
    const candidatas = new Map<string, CandidataPergunta>();

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
      if (profundidade > SELECAO.profundidadeMax || caminho.has(regra.id)) return;
      const av = avaliarCondicao(regra.seCompilada, this.estado.memoria);
      // Regra já decidida (disparou ou foi descartada) não motiva pergunta.
      if (av.cf !== null || av.faltantes.length === 0) return;

      const proximoCaminho = new Set(caminho).add(regra.id);

      for (const v of av.faltantes) {
        const pergunta = this.kb.perguntaPorVar.get(v);

        if (!pergunta) {
          // Submeta: recorre nas regras que podem prová-la.
          for (const produtora of this.kb.produzidaPor.get(v) ?? []) {
            distribuir(
              produtora,
              peso * SELECAO.descontoSubmeta,
              regraRaiz,
              profundidade + 1,
              proximoCaminho,
            );
          }
          continue;
        }

        if (respondidas.has(v) || this.estado.memoria.has(v)) continue;
        const preReq = this.avaliarPreRequisito(v);
        if (preReq === 'bloqueado') continue;

        const atual =
          candidatas.get(v) ??
          ({
            pesoBruto: 0,
            preRequisito: preReq,
            hipotesesAlvo: new Set<string>(),
            grupos: new Set<GrupoRegra>(),
            regras: [],
          } satisfies CandidataPergunta);

        atual.pesoBruto += peso / Math.max(1, pergunta.custo);
        atual.grupos.add(regraRaiz.grupo);
        for (const c of regraRaiz.entao) {
          if (c.var === this.kb.variavelObjetivo) atual.hipotesesAlvo.add(String(c.val));
        }
        if (!atual.regras.includes(regraRaiz)) atual.regras.push(regraRaiz);
        candidatas.set(v, atual);
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
      if (grupoUrgente(regra.grupo)) peso *= SELECAO.pesoUrgente;

      distribuir(regra, peso, regra, 0, new Set());
    }

    return candidatas;
  }

  /**
   * Força do foco de cada sistema: o maior CF entre as hipóteses vivas do grupo.
   *
   * Hipótese de exclusão ("sem alteração detectada") não cria foco — ela não é
   * um sinal de que aquele sistema merece investigação, é o contrário disso.
   */
  private focoPorGrupo(hipoteses: Hipotese[]): Map<GrupoRegra, number> {
    const foco = new Map<GrupoRegra, number>();
    for (const h of hipoteses) {
      if (this.kb.hipotesePorId.get(h.id)?.apenasSeNadaMais) continue;
      const cf = Math.abs(h.cf);
      if (cf <= 0) continue;
      foco.set(h.grupo, Math.max(foco.get(h.grupo) ?? 0, Math.min(1, cf)));
    }
    return foco;
  }

  private escolherPergunta(
    hipoteses: Hipotese[],
  ): { pergunta: Pergunta; justificativa: JustificativaPergunta } | null {
    const candidatas = this.candidatasAPergunta(hipoteses);
    if (candidatas.size === 0) return null;

    const foco = this.focoPorGrupo(hipoteses);

    let melhorVar: string | null = null;
    let melhorScore = -Infinity;
    let melhorPergunta: Pergunta | null = null;

    for (const [v, cand] of candidatas) {
      const p = this.kb.perguntaPorVar.get(v)!;

      // Foco: perguntar sobre o sistema que já deu sinal, proporcional à força
      // do sinal — um indício fraco puxa pouco, um diagnóstico quase fechado puxa muito.
      let forcaFoco = 0;
      for (const g of cand.grupos) forcaFoco = Math.max(forcaFoco, foco.get(g) ?? 0);
      const fatorFoco = 1 + (SELECAO.bonusFoco - 1) * forcaFoco;

      // Discriminação: quantas hipóteses diferentes esta resposta ainda separa.
      const fatorDiscriminacao = Math.min(
        SELECAO.discriminacaoMax,
        1 + SELECAO.bonusDiscriminacao * Math.max(0, cand.hipotesesAlvo.size - 1),
      );

      const fatorPreRequisito =
        cand.preRequisito === 'incerto' ? SELECAO.preRequisitoIncerto : 1;

      const score = cand.pesoBruto * fatorFoco * fatorDiscriminacao * fatorPreRequisito;

      const melhor =
        score > melhorScore ||
        // desempate determinístico: menor custo, depois ordem de declaração
        (score === melhorScore &&
          melhorPergunta !== null &&
          (p.custo < melhorPergunta.custo ||
            (p.custo === melhorPergunta.custo &&
              (this.kb.ordemPergunta.get(v) ?? Infinity) <
                (this.kb.ordemPergunta.get(melhorVar!) ?? Infinity))));

      if (melhor) {
        melhorScore = score;
        melhorVar = v;
        melhorPergunta = p;
      }
    }

    if (!melhorVar || !melhorPergunta) return null;
    const escolhida = candidatas.get(melhorVar)!;
    return {
      pergunta: melhorPergunta,
      justificativa: this.justificar(melhorVar, escolhida, foco),
    };
  }

  /**
   * Pré-requisito da pergunta: liberado, bloqueado ou incerto.
   *
   * A distinção importa. "A bezerra recebeu colostro?" é *bloqueada* para uma
   * vaca de seis anos, porque `idade_dias <= 90` é conhecidamente falso. Mas
   * "a placenta ficou retida?" diante de uma vaca sem data de parto registrada
   * não é bloqueada e sim *incerta*: o caderno está incompleto, não a vaca é
   * inelegível. Tratar os dois casos igual — como a versão anterior fazia —
   * tornava metrite e retenção de placenta indiagnosticáveis em qualquer animal
   * com cadastro incompleto, que é justamente o animal sobre o qual se pergunta.
   */
  private avaliarPreRequisito(variavel: string): EstadoPreRequisito {
    const cond: Condicao | undefined = this.kb.preRequisitoCompilado.get(variavel);
    if (!cond) return 'ok';
    const av = avaliarCondicao(cond, this.estado.memoria);
    if (av.cf === null) return 'incerto';
    return av.cf >= LIMIAR_PREMISSA ? 'ok' : 'bloqueado';
  }

  /** Módulo de explicação — "por que essa pergunta?" (§4.8). */
  private justificar(
    variavel: string,
    candidata: CandidataPergunta,
    foco: Map<GrupoRegra, number>,
  ): JustificativaPergunta {
    const rotuloHip = new Map(this.kb.hipoteses.map((h) => [h.id, h.rotulo] as const));
    const regrasPendentes = candidata.regras.slice(0, 4).map((r) => ({
      id: r.id,
      titulo: r.titulo,
      porque: r.porque,
      hipoteses: r.entao
        .filter((c) => c.var === this.kb.variavelObjetivo)
        .map((c) => rotuloHip.get(String(c.val)) ?? String(c.val)),
    }));

    const alvos = [...new Set(regrasPendentes.flatMap((r) => r.hipoteses))];
    const discrimina = candidata.hipotesesAlvo.size > 1;
    const texto =
      alvos.length === 0
        ? 'Esta resposta é necessária para avaliar as regras que ainda estão em aberto.'
        : discrimina
          ? `Esta resposta ajuda a separar: ${alvos.join(', ')}.`
          : `Esta resposta confirma ou descarta: ${alvos.join(', ')}.`;

    // Grupo em foco: o sistema já sinalizado com o indício mais forte entre os
    // que esta pergunta investiga. Sem sinal em nenhum, não há foco a declarar.
    let grupoFoco: GrupoRegra | undefined;
    let maior = 0;
    for (const g of candidata.grupos) {
      const f = foco.get(g) ?? 0;
      if (f > maior) {
        maior = f;
        grupoFoco = g;
      }
    }

    return { var: variavel, texto, regrasPendentes, grupoFoco, discrimina };
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
        // Preenchida abaixo, depois da subsunção e da ordenação por CF.
        relacao: 'concomitante',
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

    const vivas = resultado
      .filter((h) => h.substituidaPor === undefined)
      .sort((a, b) => b.cf - a.cf);

    // Hipótese de exclusão: "sem alteração detectada" cai fora assim que
    // qualquer outra coisa chega ao limiar de diagnóstico. A regra de triagem
    // só olha os sinais que ela pesquisa, e um CMT positivo não passa por lá —
    // sem este corte, o parecer afirmava as duas coisas ao mesmo tempo.
    const houveDiagnostico = vivas.some(
      (h) => !this.kb.hipotesePorId.get(h.id)?.apenasSeNadaMais && h.cf >= PADRAO.limiarDiagnostico,
    );
    const finais = houveDiagnostico
      ? vivas.filter((h) => !this.kb.hipotesePorId.get(h.id)?.apenasSeNadaMais)
      : vivas;

    // Relação com a líder: mesmo sistema é alternativa (diagnóstico
    // diferencial); sistema diferente é outro problema na mesma vaca.
    const lider = finais[0];
    for (const h of finais) {
      h.relacao =
        h === lider ? 'principal' : h.grupo === lider?.grupo ? 'diferencial' : 'concomitante';
    }

    return finais;
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
