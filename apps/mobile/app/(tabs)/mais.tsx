import { router } from 'expo-router';
import { Image, View } from 'react-native';
import { baseDeConhecimento } from '@drmoo/knowledge';
import { ENGINE_VERSAO } from '@drmoo/engine';
import {
  CabecalhoPagina,
  Cartao,
  Espaco,
  Linha,
  MaterialIcons,
  Tela,
  TituloSecao,
  Txt,
  type NomeIcone,
} from '../../src/componentes/base';
import { useTema } from '../../src/tema';

const ITENS: { rota: string; icone: NomeIcone; titulo: string; texto: string }[] = [
  {
    rota: '/financeiro',
    icone: 'payments',
    titulo: 'Financeiro',
    texto: 'Lucro por vaca: tratamentos médicos × produção de leite (e o contexto da propriedade).',
  },
  {
    rota: '/conhecimento',
    icone: 'account-tree',
    titulo: 'Base de conhecimento',
    texto: 'Todas as regras de produção, suas fontes e os casos de teste — rodáveis aqui.',
  },
  {
    rota: '/triagem',
    icone: 'fact-check',
    titulo: 'Triagem de entrada',
    texto: 'Animal novo no rebanho (quarentena) e bezerra recém-nascida (colostro).',
  },
  {
    rota: '/estatisticas',
    icone: 'insights',
    titulo: 'Estatísticas',
    texto: 'Todos os gráficos da propriedade, com exportação do relatório em PDF.',
  },
  {
    rota: '/rede-local',
    icone: 'wifi-tethering',
    titulo: 'Rede local',
    texto: 'Sincronizar com outros aparelhos da propriedade, pelo Wi-Fi local.',
  },
  {
    rota: '/configuracoes',
    icone: 'settings',
    titulo: 'Configurações',
    texto: 'Dados da propriedade, metas e período de gestação.',
  },
];

export default function Mais() {
  const { c, espaco } = useTema();

  return (
    <Tela>
      <CabecalhoPagina titulo="Mais" subtitulo="Gestão, base de conhecimento e informações do projeto" />
      <Linha gap={espaco.md}>
        <Image
          source={require('../../assets/logo-dr-moo.jpg')}
          style={{ width: 64, height: 64, borderRadius: 12 }}
        />
        <View style={{ flex: 1 }}>
          <Txt v="h2">Dr. Moo</Txt>
          <Txt v="caption" cor={c.textoSecundario}>
            Sistema especialista de anamnese e triagem de bovinos leiteiros em lactação.
          </Txt>
        </View>
      </Linha>

      <TituloSecao>Seções</TituloSecao>
      <View style={{ gap: espaco.sm }}>
        {ITENS.map((i) => (
          <Cartao key={i.rota} aoTocar={() => router.push(i.rota)}>
            <Linha gap={espaco.md} centro={false}>
              <MaterialIcons name={i.icone} size={26} color={c.primaria} />
              <View style={{ flex: 1 }}>
                <Txt v="corpoForte">{i.titulo}</Txt>
                <Txt v="caption" cor={c.textoSecundario}>
                  {i.texto}
                </Txt>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={c.textoSecundario} />
            </Linha>
          </Cartao>
        ))}
      </View>

      <TituloSecao icone="info">Sobre</TituloSecao>
      <Cartao>
        <Txt v="label">
          Hackathon UFJF 2026 — XXVIII Semana da Computação do DCC/UFJF · RERUM Engenharia
          de Sistemas. Tema T1: Anamnese.
        </Txt>
        <Espaco h={espaco.sm} />
        <Txt v="caption" cor={c.textoSecundario}>
          Base de conhecimento v{baseDeConhecimento.versao} ·{' '}
          {baseDeConhecimento.regras.length} regras · motor de inferência v{ENGINE_VERSAO}
        </Txt>
        <Espaco h={espaco.sm} />
        <Txt v="caption" cor={c.textoSecundario}>
          O conhecimento de domínio vem das cartilhas da Embrapa Gado de Leite "Como
          identificar a vaca com mastite em sua propriedade" (2015) e "Administrando a
          propriedade leiteira" (2016).
        </Txt>
        <Espaco h={espaco.sm} />
        <Txt v="caption" cor={c.textoSecundario}>
          As decisões deste app saem de uma base de conhecimento explícita e de um motor
          de inferência determinístico. Nenhum modelo de linguagem participa do
          diagnóstico. O app roda inteiramente offline.
        </Txt>
      </Cartao>
    </Tela>
  );
}
