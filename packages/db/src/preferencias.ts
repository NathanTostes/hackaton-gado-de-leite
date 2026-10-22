/**
 * Preferências de interface que não pertencem a nenhuma tabela de domínio.
 *
 * Vivem em `meta_app` (chave/valor) pela mesma razão que a configuração de
 * sincronização vive lá: é um único par solitário, não uma entidade com
 * histórico ou relacionamento — criar tabela própria seria extrapolar o dado.
 */
import { gravarMeta, lerMeta } from './driver';

const CHAVE_MODO_LEITURA_VOZ = 'modo_leitura_voz';

/**
 * Modo leitura em voz alta: substitui a navegação inteira por uma única tela
 * de prontuário com botões grandes e o app falando cada pergunta e o parecer
 * final — pensado para quem não lê com segurança ou prefere ouvir.
 */
export async function modoLeituraVozAtivo(): Promise<boolean> {
  return (await lerMeta(CHAVE_MODO_LEITURA_VOZ)) === '1';
}

export async function definirModoLeituraVoz(ativo: boolean): Promise<void> {
  await gravarMeta(CHAVE_MODO_LEITURA_VOZ, ativo ? '1' : '0');
}
