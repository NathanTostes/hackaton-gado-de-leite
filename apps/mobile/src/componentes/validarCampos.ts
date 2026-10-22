import { hoje, somarDias } from '@drmoo/domain';

export type DefinicaoCampo = {
  rotulo: string;
  valor: string;
  tipo?: 'numero' | 'data';
  obrigatorio?: boolean;
  positivo?: boolean;
  inteiro?: boolean;
};

export function dataCadastro(valor: string): string {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  return br ? `${br[3]}-${br[2]}-${br[1]}` : valor.trim();
}

/** Valida todos os campos antes de persistir, sem converter entradas inválidas em zero. */
export function validarCampos(campos: DefinicaoCampo[]): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const campo of campos) {
    const valor = campo.valor.trim();
    if (!valor) {
      if (campo.obrigatorio) erros[campo.rotulo] = 'Preencha este campo.';
      continue;
    }
    if (campo.tipo === 'numero') {
      const texto = valor.replace(',', '.');
      const n = Number(texto);
      if (!/^\d+(\.\d+)?$/.test(texto) || !Number.isFinite(n) ||
          (campo.positivo && n <= 0) || (campo.inteiro && !Number.isInteger(n))) {
        erros[campo.rotulo] = `Informe um número${campo.inteiro ? ' inteiro' : ''} ${campo.positivo ? 'maior que zero' : 'não negativo'}, sem separador de milhar.`;
      }
    }
    if (campo.tipo === 'data') {
      const data = dataCadastro(valor);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || somarDias(data, 0) !== data || data > hoje()) {
        erros[campo.rotulo] = 'Informe uma data válida, até hoje.';
      }
    }
  }
  return erros;
}
