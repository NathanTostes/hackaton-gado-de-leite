import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export interface EstadoDados<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Carrega dados do banco local, recarregando sempre que a tela volta ao foco —
 * lançamentos feitos em outra tela aparecem sem o usuário precisar puxar nada.
 */
export function useDados<T>(carregar: () => Promise<T>, deps: unknown[] = []): EstadoDados<T> {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gatilho, setGatilho] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(carregar, deps);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    fn()
      .then((r) => {
        if (ativo) {
          setDados(r);
          setErro(null);
        }
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [fn, gatilho]);

  const recarregar = useCallback(() => setGatilho((g) => g + 1), []);

  useFocusEffect(
    useCallback(() => {
      setGatilho((g) => g + 1);
    }, []),
  );

  return { dados, carregando, erro, recarregar };
}
