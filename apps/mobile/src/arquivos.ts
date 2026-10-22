/**
 * Levar um arquivo para fora do app — download no computador, compartilhamento
 * no celular.
 *
 * São dois mundos diferentes e um só chamador: no navegador, o arquivo vira um
 * download; no aparelho, vai para a folha de compartilhamento do sistema, que é
 * de onde sai o WhatsApp, o e-mail e o "salvar em Arquivos". Nenhum dos dois
 * caminhos passa por servidor: o arquivo é gerado dentro do app.
 */
import { Platform } from 'react-native';

const EXTENSAO_MIME: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  csv: 'text/csv',
  html: 'text/html',
};

export interface ArquivoParaEntregar {
  /** Nome com extensão, como o usuário vai vê-lo. */
  nome: string;
  bytes: Uint8Array;
  /** Texto do diálogo de compartilhamento no celular. */
  titulo?: string;
}

function mimeDe(nome: string): string {
  const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSAO_MIME[extensao] ?? 'application/octet-stream';
}

function baixarNoNavegador(nome: string, bytes: Uint8Array, mime: string): void {
  // `new Blob([bytes])` precisa de um ArrayBuffer próprio: o buffer do
  // Uint8Array pode ser maior do que a visão, e aí o arquivo sai corrompido.
  const copia = bytes.slice();
  const url = URL.createObjectURL(new Blob([copia.buffer as ArrayBuffer], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revogar na hora cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Entrega o arquivo ao usuário.
 *
 * Devolve como foi entregue, porque a tela precisa dizer a coisa certa:
 * "baixado" no computador e "compartilhado" no celular.
 */
export async function entregarArquivo({
  nome,
  bytes,
  titulo,
}: ArquivoParaEntregar): Promise<'download' | 'compartilhado' | 'salvo'> {
  const mime = mimeDe(nome);

  if (Platform.OS === 'web') {
    baixarNoNavegador(nome, bytes, mime);
    return 'download';
  }

  const { Directory, File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');

  // Pasta própria no cache: o nome do arquivo é o que aparece no WhatsApp, e
  // escrever na raiz do cache arriscaria colidir com arquivo de outro módulo.
  const pasta = new Directory(Paths.cache, 'drmoo');
  pasta.create({ idempotent: true, intermediates: true });
  const arquivo = new File(pasta, nome);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  await arquivo.write(bytes);

  if (!(await Sharing.isAvailableAsync())) return 'salvo';
  await Sharing.shareAsync(arquivo.uri, {
    mimeType: mime,
    dialogTitle: titulo ?? nome,
    UTI: mime === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
  return 'compartilhado';
}

/**
 * Gera um PDF a partir de HTML e o entrega.
 *
 * No aparelho, `expo-print` imprime o HTML num PDF de verdade e ele segue para
 * o compartilhamento (WhatsApp inclusive). No navegador não existe essa API:
 * abrimos a janela de impressão com o mesmo HTML e o usuário escolhe "Salvar
 * como PDF" — que é o caminho nativo do navegador para a mesma coisa.
 */
export async function entregarPdf({
  html,
  nome,
  titulo,
}: {
  html: string;
  nome: string;
  titulo?: string;
}): Promise<'impressao' | 'compartilhado' | 'salvo'> {
  if (Platform.OS === 'web') {
    const janela = window.open('', '_blank', 'width=900,height=1200');
    if (!janela) throw new Error('O navegador bloqueou a janela. Libere os pop-ups para este site e tente de novo.');
    janela.document.write(html);
    janela.document.close();
    janela.document.title = nome.replace(/\.pdf$/i, '');
    // Esperar o layout: imprimir antes de a fonte e as imagens assentarem sai torto.
    janela.onload = () => janela.setTimeout(() => janela.print(), 350);
    return 'impressao';
  }

  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (!(await Sharing.isAvailableAsync())) return 'salvo';
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: titulo ?? nome,
    UTI: 'com.adobe.pdf',
  });
  return 'compartilhado';
}

/** Abre o seletor de arquivos e devolve os bytes do que o usuário escolheu. */
export async function escolherArquivo(extensoes: string[] = ['xlsx']): Promise<{ nome: string; bytes: Uint8Array } | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolver) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = extensoes.map((e) => `.${e}`).join(',');
      input.onchange = async () => {
        const arquivo = input.files?.[0];
        if (!arquivo) {
          resolver(null);
          return;
        }
        resolver({ nome: arquivo.name, bytes: new Uint8Array(await arquivo.arrayBuffer()) });
      };
      // Safari e Firefox ignoram o clique em input fora do documento.
      input.style.display = 'none';
      document.body.appendChild(input);
      input.click();
      setTimeout(() => input.remove(), 60_000);
      // Cancelar o diálogo não dispara evento algum em nenhum navegador: a
      // promessa fica pendente, e a tela trata isso como "nada escolhido".
    });
  }

  const DocumentPicker = await import('expo-document-picker');
  const escolha = await DocumentPicker.getDocumentAsync({
    type: extensoes.map((e) => EXTENSAO_MIME[e] ?? '*/*'),
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (escolha.canceled || !escolha.assets?.[0]) return null;

  const { File } = await import('expo-file-system');
  const arquivo = new File(escolha.assets[0].uri);
  return { nome: escolha.assets[0].name, bytes: arquivo.bytesSync() };
}
