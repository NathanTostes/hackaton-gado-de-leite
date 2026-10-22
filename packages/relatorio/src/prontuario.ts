/**
 * Prontuário em PDF — o documento que vai para o veterinário pelo WhatsApp.
 *
 * Leva o parecer, as respostas coletadas e o traço da inferência: quem recebe
 * precisa poder conferir COMO o sistema chegou ali, não só o que ele concluiu.
 * Sem o traço, o PDF seria um palpite assinado por um app.
 */
import { formatarBR } from '@drmoo/domain';
import { cartao, cartoes, destaque, documento, escapar, tabela } from './html';

export interface HipoteseRelatorio {
  id: string;
  rotulo: string;
  descricao: string;
  confianca: string;
  cf: number;
  bandeiraVermelha: boolean;
  conduta: string[];
  fontes: string[];
  status: string;
}

export interface RespostaRelatorio {
  variavel: string;
  rotulo?: string;
  valor: string;
  cf?: number;
}

export interface DadosProntuario {
  propriedade?: string | null;
  animal: {
    brinco: string;
    nome?: string | null;
    categoria: string;
    raca?: string | null;
    idadeMeses?: number | null;
    del?: number | null;
    producaoMediaDia?: number | null;
    lote?: string | null;
  };
  atendimento: {
    id: string;
    dataHora: string;
    queixaPrincipal?: string | null;
    kbVersao: string;
    engineVersao: string;
    motivoParada?: string | null;
  };
  hipoteses: HipoteseRelatorio[];
  bandeiraVermelha?: HipoteseRelatorio | null;
  respostas: RespostaRelatorio[];
  /** Traço da inferência já em texto, como a tela mostra. */
  traco: string;
  /** Se re-executar o motor hoje devolve o mesmo resultado gravado. */
  reproduz: boolean;
  geradoEm: string;
}

function identificacao(a: DadosProntuario['animal']): string {
  return a.nome ? `${a.nome} (brinco ${a.brinco})` : `Brinco ${a.brinco}`;
}

export function htmlProntuario(d: DadosProntuario): string {
  const cabecalhoAnimal = cartoes(
    [
      cartao('Animal', identificacao(d.animal), d.animal.categoria),
      d.animal.raca ? cartao('Raça', d.animal.raca, d.animal.lote ?? undefined) : '',
      d.animal.idadeMeses != null ? cartao('Idade', `${d.animal.idadeMeses} meses`) : '',
      d.animal.del != null ? cartao('Dias em lactação', String(d.animal.del)) : '',
      d.animal.producaoMediaDia
        ? cartao('Produção média', `${d.animal.producaoMediaDia.toFixed(1)} L/dia`, 'últimos 90 dias')
        : '',
    ].filter(Boolean),
  );

  const alerta = d.bandeiraVermelha
    ? destaque(
        `BANDEIRA VERMELHA — ${d.bandeiraVermelha.rotulo}`,
        `${d.bandeiraVermelha.descricao} Conduta imediata: ${d.bandeiraVermelha.conduta.join(' ')}`,
        'alerta',
      )
    : '';

  const pareceres = d.hipoteses.length
    ? d.hipoteses
        .map(
          (h, i) => `<div class="secao">
            <h3>${i + 1}. ${escapar(h.rotulo)} — ${escapar(h.confianca)} (CF ${h.cf.toFixed(2)})</h3>
            <p>${escapar(h.descricao)}</p>
            ${
              h.conduta.length
                ? `<p><strong>Conduta sugerida:</strong></p><ul>${h.conduta
                    .map((c) => `<li>${escapar(c)}</li>`)
                    .join('')}</ul>`
                : ''
            }
            ${h.fontes.length ? `<p class="nota">Fonte: ${escapar(h.fontes.join('; '))}</p>` : ''}
            ${
              h.status !== 'validada'
                ? `<p class="nota">Regra marcada como "${escapar(h.status)}" — requer validação técnica.</p>`
                : ''
            }
          </div>`,
        )
        .join('')
    : '<p class="nota">Nenhuma hipótese acima do limiar. A anamnese não encontrou alteração.</p>';

  const corpo = `
    ${cabecalhoAnimal}
    ${d.atendimento.queixaPrincipal ? `<p><strong>Queixa principal:</strong> ${escapar(d.atendimento.queixaPrincipal)}</p>` : ''}
    ${alerta}

    <h2>Parecer</h2>
    ${pareceres}

    <h2>Respostas coletadas</h2>
    ${tabela(
      [
        { titulo: 'Pergunta', valor: (r: RespostaRelatorio) => r.rotulo ?? r.variavel },
        { titulo: 'Resposta', valor: (r: RespostaRelatorio) => r.valor },
        {
          titulo: 'Certeza',
          numero: true,
          valor: (r: RespostaRelatorio) => (r.cf != null && r.cf !== 1 ? Math.abs(r.cf).toFixed(1) : '—'),
        },
      ],
      d.respostas,
      'Nenhuma pergunta foi respondida neste atendimento.',
    )}

    <h2>Como o sistema chegou a este parecer</h2>
    <pre style="white-space:pre-wrap;font-size:9pt;font-family:ui-monospace,Menlo,Consolas,monospace;background:#F7F9FA;border:1px solid #E6EAEC;border-radius:6px;padding:8px">${escapar(
      d.traco || 'Nenhuma regra disparou.',
    )}</pre>

    <p class="nota">
      Atendimento ${escapar(d.atendimento.id)} · base de conhecimento v${escapar(d.atendimento.kbVersao)} ·
      motor v${escapar(d.atendimento.engineVersao)} ·
      ${d.reproduz ? 'parecer reproduzido com a base atual' : 'o recálculo com a base atual difere do gravado'}.
    </p>`;

  return documento(
    {
      titulo: 'Prontuário de anamnese',
      subtitulo: `${identificacao(d.animal)} · ${formatarBR(d.atendimento.dataHora.slice(0, 10))}`,
      propriedade: d.propriedade,
      geradoEm: d.geradoEm,
    },
    corpo,
  );
}
