import { router, useLocalSearchParams } from 'expo-router';
import { obterAnimal } from '@drmoo/db';
import { Alerta, Carregando, Tela, Vazio } from '../../src/componentes/base';
import { FormularioAnimal } from '../../src/componentes/formularioAnimal';
import { useDados } from '../../src/hooks';

export default function EditarAnimal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dados: animal, carregando, erro } = useDados(() => obterAnimal(id), [id]);
  if (carregando) return <Carregando />;
  if (erro) return <Tela><Alerta tipo="alerta" titulo="Não foi possível carregar o cadastro" texto={erro} /></Tela>;
  if (!animal) return <Vazio icone="error-outline" titulo="Animal não encontrado" />;
  return <FormularioAnimal key={animal.id} modo="novo" animal={animal} aoVoltar={() => router.back()} />;
}
