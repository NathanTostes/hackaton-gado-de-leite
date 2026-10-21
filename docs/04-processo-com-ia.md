# 4. O processo de desenvolvimento com IA

Este documento é exigência do regulamento, mas também é a parte mais honesta da entrega: mostra
onde a IA ajudou de fato, onde ela errou, e o que a equipe precisou entender para corrigir.

---

## 4.1 O agente usado e como foi conduzido

**Agente:** Claude Code (Anthropic), operado em sessão única no repositório.

O trabalho foi dividido em duas etapas com naturezas bem diferentes:

1. **Análise e especificação.** A IA leu as duas cartilhas da Embrapa, o regulamento e a
   apresentação do Hackathon, e transformou um rascunho de ideia de produto
   (`reference/drMoo.md`, 17 linhas) numa especificação executável de 16 seções
   (`reference/specsDrMoo.md`) — com gramática de regras, álgebra de fatores de certeza,
   modelo de dados, roteiro de implementação em 12 etapas e critérios de aceitação.
2. **Implementação.** A especificação virou o prompt mestre. O código foi escrito seguindo a
   ordem E1→E12 definida nela, com a regra de que, se o tempo acabasse, o que existisse já
   fosse avaliável.

## 4.2 A correção que mudou o projeto

O `drMoo.md` original descrevia a anamnese assim:

> *"Registro de prontuário: algoritmos que faz diversas perguntas utilizando de parâmetros reais
> como base (ver um site adequado)"*

Isso descreve um **formulário com ramificações**. O regulamento pede outra coisa: *"base
explícita de conhecimento e motor de inferência"*, e é explícito em *"Não use a LLM como o
sistema especialista"*.

A IA apontou a divergência na leitura do regulamento, e o escopo foi redefinido: o que antes
seria um questionário encadeado virou um motor de inferência com encadeamento progressivo e
regressivo, fatores de certeza e traço auditável. **Essa correção, feita antes da primeira linha
de código, é a razão pela qual o projeto atende o tema.**

## 4.3 Extração do conhecimento das cartilhas

As cartilhas são PDFs em linguagem de produtor, não documentos técnicos estruturados. O
processo foi:

1. extrair o texto completo dos quatro PDFs de `reference/`;
2. identificar, no texto corrido, as afirmações que são **regras** e não explicações
   (ex.: *"A vaca está com mastite clínica se, ao realizar o teste da caneca, o leite apresentar
   alguma destas alterações: coloração amarelada, presença de grumos ou pus"* → `MAST-CLIN-G1`);
3. formalizar cada uma em JSON, **com a página citada**;
4. escrever o caso de teste com resultado esperado **junto com a regra**, não depois.

Dessa leitura saíram também as fórmulas de rebanho (% de mastite clínica e subclínica), as metas
(2%, 20%, 83%), a escala de CMT (`N`, `T`, `+`, `++`, `+++`, `PP`), o limite de CCS (200.000) e
o critério de cronicidade (3 meses de CMT positivo na mesma lactação).

### O que foi encontrado nas cartilhas e vale registrar

A ficha de mortes da cartilha de administração (p. 23) registra três causas reais com as
respectivas orientações: diarreia em bezerra → *"verifique se o leite fornecido está em boa
qualidade higiênica e limpe o bezerreiro"*; febre aftosa → *"verifique se os animais estão sendo
vacinados"*; tristeza parasitária → *"faça controle estratégico de carrapatos"*. Essas três
condutas entraram **literalmente** nas regras correspondentes, com citação. São o tipo de
conhecimento que um modelo de linguagem geraria de forma plausível mas genérica, e que aqui veio
com procedência.

## 4.4 Onde a IA errou — e como foi corrigido

Seis erros reais. Nenhum apareceu em revisão de código — todos foram encontrados por teste
automatizado, por export de produção ou por execução do app num navegador headless.

### Erro 1 — Encadeamento regressivo sem recursão em submetas

A primeira implementação da escolha de perguntas ignorava variáveis que não têm pergunta
associada. O efeito: o motor queria perguntar *"a mama está dolorida?"* (premissa da regra do
grau 2, peso 0,54) antes de *"o leite tem grumos?"* (premissa do grau 1, peso 0,40) — porque a
regra do grau 2 tem prioridade maior, e a submeta `diagnostico=mastite_clinica_g1` era
simplesmente descartada do cálculo.

Clinicamente é a ordem errada: não se investiga o grau 2 antes de estabelecer o grau 1.

**Correção:** quando a variável faltante é produzida por outras regras, o motor recorre nessas
regras com o peso descontado em 20% por nível. Com a recursão, `caneca_grumos` passa a somar
0,40 + 0,43 = 0,83 e vence. É encadeamento regressivo de verdade, não uma heurística plana.

*Um teste cobre isso: `explica por que está perguntando`.*

### Erro 2 — Aspas duplas em literal de SQL

A busca do rebanho usava `COALESCE(a.nome, "")`. Em SQLite, aspas duplas delimitam
**identificadores**, não texto: a consulta procurava uma coluna chamada `""`.

O erro não apareceu em nenhum momento durante o desenvolvimento da tela, porque a busca só
quebra quando há texto digitado. Teria aparecido na demonstração ao vivo, na primeira vez que
alguém digitasse um nome de vaca.

**Correção:** `COALESCE(a.nome, '')`. Encontrado pelo teste que exercita os repositórios contra
um SQLite real (`node:sqlite`) — teste que só existe porque o backend do banco foi feito
injetável.

### Erro 3 — Subsunção ausente: o grau 1 por cima do grau 2

O grau 1 da mastite conclui com CF 0,95; o grau 2, encadeado em cima dele, conclui com
0,90 × 0,95 = 0,855. O ranking por fator de certeza colocava o **grau 1 acima do grau 2** — um
parecer clinicamente confuso, embora aritmeticamente correto.

**Correção:** hipóteses passaram a declarar `substitui`. Uma hipótese confirmada remove do
ranking as que ela subsume — mas o traço preserva a cadeia inteira, porque o grau 1 foi o degrau
que levou ao grau 2.

A tentação aqui era "consertar" os fatores de certeza para que o grau 2 ficasse mais alto. Seria
errado: o CF mede **certeza**, não gravidade. Misturar as duas coisas corromperia o modelo
inteiro. A subsunção resolve o problema de apresentação sem mexer na semântica.

### Erro 4 — WebAssembly do SQLite fora do bundle de produção

O `expo-sqlite` usa o SQLite compilado em WebAssembly no navegador. O servidor de
desenvolvimento resolvia o `.wasm`; o **export de produção não**, porque `wasm` não está em
`assetExts` do Metro por padrão. O app empacotado abriria sem banco.

**Correção:** `config.resolver.assetExts.push('wasm')` em `metro.config.js`. Encontrado porque
o export de produção foi rodado como verificação, em vez de confiar no servidor de
desenvolvimento.

### Erro 5 — Provedor de tema por baixo da tela que o usa

A tela de abertura ("Preparando o Dr. Moo…") era renderizada **antes** de `<ProvedorDeTema>`
montar, e os componentes de base leem o tema por contexto. Resultado: `useTema precisa estar
dentro de <ProvedorDeTema>` logo na primeira renderização — o app simplesmente não abria na web.

**Correção:** o provedor passou a envolver também os estados de carregamento e de erro. Junto
disso apareceu um segundo defeito no mesmo trecho: o indicador de atividade usava a cor primária
(teal) sobre o fundo teal da abertura, ficando invisível. `Carregando` ganhou uma cor opcional.

### Erro 6 — Média diária dividida pelos dias do mês inteiro

A produção diária era `total do mês ÷ dias do mês`. Num mês em andamento o numerador é parcial e
o denominador não: com 21 dias lançados em outubro, o painel mostrava **449 L/dia** e **14,0 L
por vaca** quando o rebanho produzia 664 L/dia e 20,7 L por vaca.

O mesmo descompasso distorcia o custo por litro, porque as despesas do mês já estavam lançadas
por inteiro: R$ 0,78/L contra os R$ 0,51 reais do mês fechado.

**Correção:** a média diária passou a usar os dias que de fato têm lançamento; `resumoMensal`
devolve `fechado` e `diasComProducao`; a tela Financeiro abre no último mês **fechado** e marca o
mês corrente como "(em curso)"; o painel inicial tira os números financeiros do último mês
fechado e diz isso na tela.

Encontrado ao abrir o app num navegador headless e **ler os números da captura de tela**. Não
havia nada no código que uma revisão fosse notar — a inconsistência só aparece comparando o
indicador com o gráfico ao lado.

## 4.5 Divergências encontradas na própria cartilha

Ao reproduzir os números do exemplo da propriedade do Sr. João, dois valores impressos não
fecham com a aritmética da própria publicação:

1. **Produção mensal.** A cartilha manda digitar `= 15416 + 434 + 2120 + 279` e imprime
   **18.251**. A soma dá 18.249. Adotamos o valor impresso, porque é dele que todos os demais
   indicadores publicados derivam.
2. **Margem bruta.** A cartilha imprime `Vendas − despesas = 12.636`, o que exigiria receitas de
   R$ 23.459. Mas as receitas que ela própria detalha somam R$ 22.537 — e é esse valor que
   reproduz **exatamente** a margem líquida publicada (22.537 − 17.463 = 5.074). Ou seja, o
   12.636 impresso é inconsistente com a própria cartilha.

Mantivemos as fórmulas corretas e documentamos a divergência em comentário no teste. Os demais
treze valores publicados são reproduzidos exatamente: custo por litro 0,593, diferença
preço−custo 0,477, custo operacional total 17.463, COT/litro 0,957, margem líquida 5.074,
leite/vaca 18,4 L, %VL 76, %V 46,2, leite/MO/dia 294, leite/área/mês 380, leite/área/ano 4.563,
produção diária 589 L, rebanho 91 animais.

## 4.6 O que a IA fez bem, e o que exigiu decisão humana

**Fez bem:** extração estruturada de texto corrido; escrever a gramática de regras e a álgebra
de CF sem ambiguidade; gerar código repetitivo (esquema, repositórios, telas) rapidamente;
manter consistência de nomenclatura em português em todo o projeto; escrever os testes junto
com o código em vez de depois.

**Exigiu decisão humana:**

- **o escopo.** Cortar o que não cabia no prazo, na ordem certa — rede local virou protótipo
  declarado, estoque de medicamentos ficou de fora. A IA tenderia a implementar tudo pela
  metade.
- **a fronteira do que é verdade.** A decisão de marcar como `revisar` tudo que não veio de
  fonte primária, e de exibir esse selo na interface, é uma escolha de postura: um modelo de
  linguagem produz regras clínicas plausíveis com a mesma fluência com que produz regras
  verificadas, e a diferença entre as duas não aparece no texto gerado.
- **o que o sistema não deve fazer.** Não prescrever medicamento nem dose; não dar diagnóstico
  definitivo; sempre encaminhar ao veterinário. Em triagem veterinária, o limite é parte do
  produto.

## 4.7 O que a equipe precisou entender para conduzir

A diretriz do regulamento — *"Estude e entenda em detalhes o que foi produzido"* — se materializa
em quatro pontos que não dá para delegar:

1. **Por que "não sei" ≠ "não".** É a diferença entre um sistema especialista e um formulário.
   Se a ausência de informação virasse negativa, o motor concluiria "sem alteração" com
   confiança alta a partir de um questionário mal respondido.
2. **Por que o CF não é probabilidade.** As fórmulas de combinação do MYCIN não são o teorema de
   Bayes; são uma heurística que modela acúmulo de evidência. Entender isso é o que impede de
   "ajustar" os números até a tela ficar bonita.
3. **Por que disparar uma regra por ciclo.** Disparar todas as regras aptas de uma vez tornaria
   a resolução de conflito decorativa e deixaria o traço ilegível.
4. **Por que o motor não importa React nem SQLite.** É essa separação que permite rodar os 28
   casos de teste dentro do próprio aplicativo, diante da banca.

## 4.8 Linha do tempo

| Etapa | Entregável |
|---|---|
| E1 | Monorepo + Expo rodando em localhost, tema e fonte da identidade visual |
| E2 | Motor de inferência completo + 20 testes unitários (sem nenhuma regra de domínio) |
| E3 | Grupo de mastite integral, extraído da cartilha com página citada |
| E4 | Tela de anamnese ponta a ponta, com "por quê?" e "como cheguei nisso?" |
| E5-E6 | Banco, rebanho, ficha do animal, prontuário, pré-carga de fatos |
| E7 | Demais grupos clínicos e bandeiras vermelhas — 28 casos de teste |
| E8-E9 | Saúde, calendário, carência, dashboard, triagem, seed de demonstração |
| E10-E11 | Financeiro, panorama por vaca, tela da base de conhecimento |
| E12 | Documentação |

## 4.9 Verificação de ponta a ponta

Além da suíte de 82 testes, o app é aberto num navegador headless (Chromium via Puppeteer) que
percorre todas as rotas, coleta erros de console e captura cada tela. Foi esse passo que revelou
os erros 5 e 6. O export de produção para web também é rodado como verificação — foi ele que
revelou o erro 4.
