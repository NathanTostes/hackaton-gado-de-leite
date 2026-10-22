import { createContext, useContext, useRef, useState, type ComponentRef } from 'react';
import type { ScrollView, View } from 'react-native';

export type ErrosCampos = Record<string, string>;
export const ContextoFormulario = createContext<ReturnType<typeof useFormulario> | null>(null);

/** Mantém erros e referências na UI; não participa das regras do motor. */
export function useFormulario() {
  const [erros, setErros] = useState<ErrosCampos>({});
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const conteudo = useRef<ComponentRef<typeof View>>(null);
  const campos = useRef(new Map<string, ComponentRef<typeof View>>());
  const mostrarErros = (novos: ErrosCampos) => {
    setErros(novos);
    if (Object.keys(novos).length === 0) return false;
    // Espera o layout das mensagens antes de medir. A ordem do Map é a da tela.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const primeiro = [...campos.current].find(([id]) => novos[id]);
      if (!primeiro || !conteudo.current) return;
      primeiro[1].measureLayout(conteudo.current, (_x, y) => {
        scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }, () => {});
    }));
    return Object.keys(novos).length > 0;
  };
  const limparErro = (id: string) => setErros((atuais) => {
    if (!atuais[id]) return atuais;
    const novos = { ...atuais };
    delete novos[id];
    return novos;
  });
  return { erros, scroll, conteudo, campos, mostrarErros, limparErro };
}

export function useCampoFormulario(id: string) {
  const formulario = useContext(ContextoFormulario);
  return {
    erro: formulario?.erros[id],
    ref: (view: ComponentRef<typeof View> | null) => {
      if (view) formulario?.campos.current.set(id, view);
      else formulario?.campos.current.delete(id);
    },
    limpar: () => formulario?.limparErro(id),
  };
}
