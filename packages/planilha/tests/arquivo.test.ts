/**
 * O arquivo .xlsx de verdade: escrito e lido de volta.
 *
 * A planilha exportada é também o template que vai ser preenchido e devolvido,
 * então "abre no Excel com as abas certas" é requisito, não detalhe.
 */
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { ABAS, ABA_INSTRUCOES, gerarArquivo, gerarArquivoBase64, lerArquivo } from '../src/index';

describe('arquivo da planilha', () => {
  it('sai com a aba de instruções e uma aba por cadastro, na ordem do mapa', () => {
    const livro = XLSX.read(gerarArquivo({}), { type: 'array' });

    expect(livro.SheetNames[0]).toBe(ABA_INSTRUCOES);
    expect(livro.SheetNames.slice(1)).toEqual(ABAS.map((a) => a.nome));
  });

  it('a aba vazia sai com o cabeçalho — é isso que a torna um template', () => {
    const livro = XLSX.read(gerarArquivo({}), { type: 'array' });
    const animais = livro.Sheets.Animais!;
    const linhas = XLSX.utils.sheet_to_json<string[]>(animais, { header: 1 });

    expect(linhas[0]).toContain('Brinco');
    expect(linhas[0]).toContain('Categoria');
    expect(linhas).toHaveLength(1);
  });

  it('a aba de instruções lista cada aba e seus campos obrigatórios', () => {
    const livro = XLSX.read(gerarArquivo({}), { type: 'array' });
    const texto = XLSX.utils.sheet_to_csv(livro.Sheets[ABA_INSTRUCOES]!);

    expect(texto).toContain('Animais');
    expect(texto).toContain('Brinco');
    expect(texto).toContain('BRINCO do animal');
  });

  it('o que foi escrito volta igual na leitura', () => {
    const bytes = gerarArquivo({
      Animais: [
        { Brinco: '101', Nome: 'Mimosa', Categoria: 'vaca_lactacao', 'Sexo (F/M)': 'F' },
        { Brinco: '102', Nome: 'Estrela', Categoria: 'vaca_seca', 'Sexo (F/M)': 'F' },
      ],
    });

    const { conteudo } = lerArquivo(bytes);

    expect(conteudo.Animais).toHaveLength(2);
    expect(conteudo.Animais?.[0]?.Brinco).toBe('101');
    expect(conteudo.Animais?.[1]?.Nome).toBe('Estrela');
    expect(conteudo.Lotes).toEqual([]);
  });

  it('a versão em base64 gera o mesmo conteúdo (é o caminho do celular)', () => {
    const dados = { Lotes: [{ Lote: 'Lactação', Descrição: 'alta produção' }] };

    const { conteudo } = lerArquivo(gerarArquivoBase64(dados));

    expect(conteudo.Lotes?.[0]?.Lote).toBe('Lactação');
  });

  it('avisa sobre aba que o sistema não conhece, em vez de tentar aplicá-la', () => {
    const livro = XLSX.read(gerarArquivo({}), { type: 'array' });
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['qualquer coisa']]), 'Anotações');
    const bytes = new Uint8Array(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);

    const { conteudo, abasDesconhecidas } = lerArquivo(bytes);

    expect(abasDesconhecidas).toEqual(['Anotações']);
    expect(conteudo).not.toHaveProperty('Anotações');
  });

  it('preserva acentos nos dados e nos cabeçalhos', () => {
    const bytes = gerarArquivo({ Animais: [{ Brinco: '1', Nome: 'Açucena', Raça: 'Holandês' }] });

    const { conteudo } = lerArquivo(bytes);

    expect(conteudo.Animais?.[0]?.Nome).toBe('Açucena');
    expect(conteudo.Animais?.[0]?.['Raça']).toBe('Holandês');
  });
});
