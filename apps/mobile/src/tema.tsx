import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { espaco, raio, temaClaro, tipografia, toque, type TemaCores } from '@drmoo/ui';

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
  // O app usa apenas o tema claro, independente da preferência do sistema.
  const valor = useMemo<Tema>(
    () => ({ c: temaClaro, escuro: false, espaco, raio, t: tipografia, toque }),
    [],
  );

  return <TemaContexto.Provider value={valor}>{children}</TemaContexto.Provider>;
}

export function useTema(): Tema {
  const t = useContext(TemaContexto);
  if (!t) throw new Error('useTema precisa estar dentro de <ProvedorDeTema>');
  return t;
}
