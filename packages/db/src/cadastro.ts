import { ROTULO_CATEGORIA, hoje, somarDias } from '@drmoo/domain';
import type { Animal } from './tipos';

export const ROTULO_ORIGEM = {
  nascimento: 'Nascimento', compra: 'Compra', transferencia: 'Transferência',
} as const;

export const ROTULO_REPRODUCAO = {
  nao_informada: 'Não informada', vazia: 'Vazia', prenhe: 'Prenhe',
  nao_avaliada: 'Ainda não avaliada',
} as const;

export function validarCadastroAnimal(a: Animal): void {
  if (!a.brinco.trim()) throw new Error('Informe o número ou brinco.');
  if (!(a.categoria in ROTULO_CATEGORIA)) throw new Error('Selecione a categoria do animal.');
  if (!['M', 'F'].includes(a.sexo)) throw new Error('Selecione o sexo do animal.');
  if (!(a.origem in ROTULO_ORIGEM)) throw new Error('Selecione a origem do animal.');
  const categoriasFemeas = ['vaca_lactacao', 'vaca_seca', 'novilha', 'bezerra_1_2_anos'];
  if ((a.sexo === 'M' && categoriasFemeas.includes(a.categoria)) ||
      (a.sexo === 'F' && ['touro', 'novilho', 'boi_carro'].includes(a.categoria))) {
    throw new Error('A categoria deve ser compatível com o sexo do animal.');
  }
  for (const [rotulo, valor] of [
    ['Peso ao nascer', a.peso_nascimento], ['Peso na entrada', a.peso_entrada],
    ['Valor de aquisição', a.valor_aquisicao], ['Idade estimada', a.idade_estimada_meses],
    ['Número de lactações', a.numero_lactacoes_entrada],
  ] as const) {
    if (valor != null && (!Number.isFinite(valor) || valor < 0 ||
        (rotulo.startsWith('Peso') && valor === 0))) {
      throw new Error(`${rotulo}: informe um número válido${rotulo.startsWith('Peso') ? ' maior que zero' : ' não negativo'}.`);
    }
    if (valor != null && ['Idade estimada', 'Número de lactações'].includes(rotulo) && !Number.isInteger(valor)) {
      throw new Error(`${rotulo}: informe um número inteiro.`);
    }
  }
  for (const [rotulo, data] of [
    ['Nascimento', a.data_nascimento], ['Entrada', a.data_entrada],
    ['Último parto', a.ultimo_parto_entrada], ['Referência da idade', a.idade_estimada_em],
  ] as const) {
    if (data && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || somarDias(data, 0) !== data || data > hoje())) {
      throw new Error(`${rotulo}: informe uma data válida, até hoje, no formato DD/MM/AAAA.`);
    }
  }
  if (a.data_nascimento && a.idade_estimada_meses != null) throw new Error('Informe a data de nascimento ou a idade estimada.');
  if (a.idade_estimada_meses != null && !a.idade_estimada_em) throw new Error('Informe a data de referência da idade estimada.');
  if (a.data_nascimento && a.data_entrada && a.data_nascimento > a.data_entrada) throw new Error('A entrada não pode ser anterior ao nascimento.');
  if (a.ultimo_parto_entrada && a.data_nascimento && a.ultimo_parto_entrada <= a.data_nascimento) throw new Error('O último parto deve ser posterior ao nascimento.');
  if (a.sexo === 'M' && (a.situacao_reprodutiva || a.ultimo_parto_entrada || a.numero_lactacoes_entrada != null)) throw new Error('Os dados de gestação e lactação são exclusivos de fêmeas.');
  if (a.situacao_reprodutiva && !(a.situacao_reprodutiva in ROTULO_REPRODUCAO)) throw new Error('Selecione a situação reprodutiva.');
}
