/**
 * Estado compartilhado do modo leitura em voz alta.
 *
 * Precisa ser contexto, não um estado local da tela de Configurações: quando
 * a pessoa ativa o modo, o app inteiro troca de tela imediatamente (ver
 * `app/_layout.tsx`), e `anamnese-voz` também precisa poder desligá-lo pelo
 * botão de canto sem passar por Configurações. Um único lugar evita que as
 * duas pontas fiquem fora de sincronia com o que está gravado no banco.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { definirModoLeituraVoz, modoLeituraVozAtivo } from '@drmoo/db';

interface ModoVoz {
  ativo: boolean;
  /** `true` só depois da leitura inicial do banco — evita um flash da navegação normal. */
  carregado: boolean;
  definir: (ativo: boolean) => Promise<void>;
}

const ModoVozContexto = createContext<ModoVoz | null>(null);

export function ProvedorDeModoVoz({ children }: { children: ReactNode }) {
  const [ativo, setAtivo] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let vivo = true;
    modoLeituraVozAtivo()
      .then((v) => {
        if (vivo) {
          setAtivo(v);
          setCarregado(true);
        }
      })
      .catch(() => vivo && setCarregado(true));
    return () => {
      vivo = false;
    };
  }, []);

  const definir = async (novo: boolean) => {
    await definirModoLeituraVoz(novo);
    setAtivo(novo);
  };

  return (
    <ModoVozContexto.Provider value={{ ativo, carregado, definir }}>
      {children}
    </ModoVozContexto.Provider>
  );
}

export function useModoVoz(): ModoVoz {
  const v = useContext(ModoVozContexto);
  if (!v) throw new Error('useModoVoz precisa estar dentro de <ProvedorDeModoVoz>');
  return v;
}
