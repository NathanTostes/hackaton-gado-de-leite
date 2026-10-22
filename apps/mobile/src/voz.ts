/**
 * Fala do app — usada pelo modo leitura em voz alta.
 *
 * `expo-speech` cobre os três alvos do projeto com a mesma chamada: TTS nativo
 * no Android, e a Web Speech API do navegador na versão web, sem precisar de
 * nenhum código condicional por plataforma aqui.
 */
import * as Speech from 'expo-speech';

const IDIOMA = 'pt-BR';

/** Interrompe qualquer fala em andamento e começa a falar o texto novo. */
export function falar(texto: string): void {
  Speech.stop();
  Speech.speak(texto, { language: IDIOMA, pitch: 1, rate: 0.95 });
}

export function pararDeFalar(): void {
  Speech.stop();
}
