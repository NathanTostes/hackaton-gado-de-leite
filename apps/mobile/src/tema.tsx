import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { espaco, raio, temaClaro, temaEscuro, tipografia, toque, type TemaCores } from '@drmoo/ui';

interface Tema {
  c: TemaCores;
  escuro: boolean;
  espaco: typeof espaco;
  raio: typeof raio;
  t: typeof tipografia;
  toque: typeof toque;
}

const TemaContexto = createContext<Tema | null>(null);

export function ProvedorDeTema({ children }: { children: ReactNode }) {
  const esquema = useColorScheme();
  const escuro = esquema === 'dark';

  const valor = useMemo<Tema>(
    () => ({ c: escuro ? temaEscuro : temaClaro, escuro, espaco, raio, t: tipografia, toque }),
    [escuro],
  );

  return <TemaContexto.Provider value={valor}>{children}</TemaContexto.Provider>;
}

export function useTema(): Tema {
  const t = useContext(TemaContexto);
  if (!t) throw new Error('useTema precisa estar dentro de <ProvedorDeTema>');
  return t;
}
