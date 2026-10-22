# 1. Arquitetura

## 1.1 Por que a LLM não participa do runtime

O regulamento do Hackathon é explícito: *"Não use a LLM como o sistema especialista. A IA ajuda a
construir; quem decide é a base de conhecimento com o motor de inferência — determinístico e
auditável."*

No Dr. Moo isso não é uma restrição aceita a contragosto; é a decisão de projeto que organiza
tudo o mais. Um diagnóstico veterinário que o produtor vai usar para decidir se descarta leite,
se chama o veterinário ou se descarta uma vaca precisa ser:

- **determinístico** — os mesmos sinais produzem sempre o mesmo parecer;
- **auditável** — dá para abrir e ver exatamente qual regra disparou e por quê;
- **revisável por quem entende do assunto** — um médico-veterinário consegue ler, criticar e
  corrigir a base sem saber programar;
- **versionado** — um prontuário de três meses atrás pode ser reexecutado com a base da época.

Nenhuma dessas quatro propriedades sobrevive se a decisão sair de um modelo de linguagem.

Não há, em todo o código do aplicativo, nenhuma chamada de rede em tempo de execução, nenhuma
chave de API e nenhuma referência a serviço de LLM. O app funciona com o aparelho em modo avião.

## 1.2 As quatro camadas

O modelo conceitual apresentado no slide 14 do Hackathon mapeia diretamente nos pacotes:

```
┌───────────────────────────────────────────────────────────────────────┐
│  apps/mobile  — Interface do usuário (Expo / React Native + Web)      │
│  exibe perguntas, coleta respostas, apresenta parecer e explicação    │
└───────────────┬───────────────────────────────────────────────────────┘
                │ perguntas / respostas            traço de regras
┌───────────────▼─────────────────┐   ┌───────────────────────────────┐
│  packages/engine                │   │  packages/engine/explain.ts   │
│  Motor de inferência            │◄──┤  Módulo de explicação         │
│  casa regras com fatos,         │   │  responde "por quê?" e "como?"│
│  resolve conflito, dispara,     │   └───────────────────────────────┘
│  combina CF, gera traço         │
│  + Memória de trabalho (sessão) │
└───────────────┬─────────────────┘
      regras    │    fatos
┌───────────────▼─────────────────┐   ┌───────────────────────────────┐
│  packages/knowledge             │   │  packages/db (SQLite local)   │
│  Base de conhecimento em JSON:  │   │  Fontes de dados externas:    │
│  regras, variáveis, pesos (CF), │   │  prontuário, histórico, CMT,  │
│  perguntas, condutas, fontes    │   │  produção, tratamentos        │
│  versionada e revisada          │   └───────────────────────────────┘
└─────────────────────────────────┘
```

**A regra estrutural do projeto:** `packages/engine` é TypeScript puro, sem nenhuma dependência —
nem React, nem SQLite, nem I/O. Sua interface é uma função:

```
(baseDeConhecimento, fatosIniciais) → (próximaPergunta | parecer, traço)
```

Essa disciplina tem três consequências práticas:

1. a suíte do motor roda em ~20 ms, o que permite rodar os casos de teste **dentro do próprio
   app**, na tela "Base de conhecimento", diante de quem estiver avaliando;
2. o motor pode ser invocado em dois contextos diferentes — a anamnese de um animal e os
   indicadores do rebanho — sem nenhuma adaptação;
3. é impossível que uma decisão diagnóstica dependa acidentalmente de estado da interface ou
   de uma consulta ao banco.

## 1.3 Monorepo

| Pacote | Responsabilidade | Dependências |
|---|---|---|
| `packages/engine` | motor de inferência, fatores de certeza, traço, explicação | **nenhuma** |
| `packages/knowledge` | base de conhecimento em JSON, validação de carga, casos de teste | `engine` |
| `packages/domain` | cálculos zootécnicos e financeiros (funções puras) | nenhuma |
| `packages/db` | esquema SQLite, repositórios, seed, pré-carga de fatos | `domain`, `expo-sqlite` |
| `packages/ui` | tokens do design system | nenhuma |
| `apps/mobile` | telas | todos acima |

Os pacotes são consumidos como **código-fonte TypeScript**, sem etapa de build: o Metro e o
Vitest compilam direto. Um passo a menos para quebrar na véspera da apresentação.

## 1.4 Escolhas tecnológicas

| Camada | Escolha | Por quê |
|---|---|---|
| Runtime | **Expo SDK 58 / React Native 0.88** com `react-native-web` | um único código roda no Android **e** em `localhost:8081` no navegador — atende "mobile/web" e o requisito de localhost com um só artefato |
| Linguagem | **TypeScript** `strict` + `noUncheckedIndexedAccess` | a base de conhecimento é dado estruturado; tipos pegam erro de forma antes do runtime |
| Navegação | **expo-router** | rotas por arquivo, com *code splitting* automático — cada tela virou um chunk de 2 a 17 KB |
| Banco | **expo-sqlite** | SQLite nativo no Android e SQLite compilado em WebAssembly no navegador, com a mesma API. Resolve o "no web, ver alternativa local" sem duas camadas de acesso |
| UI | componentes próprios + **Material Symbols** (`@expo/vector-icons`) e fonte **Inter** | o alvo é Android 8 com 2 GB de RAM; uma biblioteca de componentes inteira custaria mais do que entrega |
| Gráficos | **react-native-svg** com componentes próprios | bibliotecas de chart prontas pesam dezenas de vezes mais do que os três gráficos que o app usa |
| Testes | **Vitest** | roda os quatro pacotes em menos de 1 s |

Nada de: backend, Docker, autenticação em nuvem, Firebase, animações caras.
Todas as dependências têm licença permissiva (MIT / Apache-2.0 / BSD).

## 1.5 Modelo de dados

SQLite local, 20 tabelas. Convenções: `id TEXT PRIMARY KEY`, timestamps ISO, `deleted_at` para
exclusão lógica (preparando a sincronização em rede local, hoje apenas protótipo).

Núcleo do sistema especialista:

- `atendimento` — grava `kb_versao`, `engine_versao`, os fatos iniciais, as respostas, as
  conclusões e o traço completo. É o que permite reexecutar o parecer mais tarde.
- `fato_registrado` — os fatos da sessão, normalizados, para consulta e filtro.
- `exame_cmt` — resultado por quarto mamário (AD, AE, PD, PE), com os valores da escala da
  cartilha (`N`, `T`, `+`, `++`, `+++`, `PP`).
- `caso_mastite` — abre quando a anamnese conclui mastite clínica; é a origem do `% de mastite
  clínica` do mês.

Rebanho, produção, reprodução, sanidade e financeiro seguem as fichas da cartilha
"Administrando a propriedade leiteira" — inclusive as categorias de despesa, que são exatamente
as linhas da planilha da Embrapa.

**Desempenho:** toda agregação é feita em SQL, nunca em JavaScript. A lista do rebanho resolve
produção média, último CMT, meses com CMT positivo, carência e peito perdido numa consulta só,
com subconsultas correlacionadas e índices em todas as chaves estrangeiras e colunas de filtro.
Percorrer 90 animais em JS para montar a tela é exatamente o que trava o app no curral.

## 1.6 Interface entre o banco e o motor

A ponte é `packages/db/src/fatos.ts`. Antes de a primeira pergunta aparecer, o app monta a
memória de trabalho com o que já está registrado: idade, dias em lactação, número da lactação,
produção média, CMT recente, meses com CMT positivo, peito perdido e CCS recente.

Dois detalhes importam:

- exames **vencidos não viram fato** (CMT com mais de 30 dias, CCS com mais de 45). O motor
  prefere mandar refazer o teste a decidir com dado velho;
- o usuário pode **descartar** qualquer fato pré-carregado na tela, e a sessão é recomputada do
  zero. Quem está olhando a vaca tem a última palavra sobre o que é verdade.

## 1.7 Cadastro de nascimento e entrada

Os dois fluxos de triagem e a edição pela ficha do animal compartilham o componente
`apps/mobile/src/componentes/formularioAnimal.tsx`. Raça, pelagem, filiação, nascimento e peso
ao nascer são dados comuns. A entrada também registra categoria, compra ou transferência,
procedência, GTA, peso na entrada, valor de aquisição, histórico sanitário e informações
reprodutivas. O valor de aquisição é cadastral; não gera um lançamento financeiro automático.

A idade estimada é registrada em meses, com a data de referência, sem inventar uma data de
nascimento nem pré-carregar uma idade exata na anamnese. O último parto e o número de lactações
informados na entrada são usados quando não há lactação registrada; registros de lactação têm
prioridade. A situação reprodutiva da entrada é apresentada como histórico informado, sem
substituir os registros de cobertura.

O esquema v2 acrescenta os campos em bancos já instalados por migração aditiva, preservando os
registros existentes. O repositório valida datas, números, brinco duplicado e categoria/sexo.
Cadastro e eventos de entrada são gravados na mesma transação. As datas dos lembretes são
calculadas a partir do nascimento ou da entrada informados. Editar não duplica eventos e corrige
os lembretes pendentes relacionados às datas alteradas.
