# Funcionamento do sistema

Este documento descreve **como o Dr. Moo funciona por dentro**: o caminho que um dado percorre
da tela ao banco, o que cada camada faz, e o passo a passo de cada funcionalidade. É o documento
que um desenvolvedor novo lê antes de abrir o código, e o que um avaliador lê para entender as
decisões sem precisar confiar na palavra de ninguém.

---

## 1. Visão em uma página

```
       TELA (apps/mobile)                     REGRA DE NEGÓCIO                   DADO
┌────────────────────────────┐      ┌────────────────────────────┐    ┌────────────────────┐
│ Expo Router                │      │ @drmoo/engine              │    │ @drmoo/db          │
│  abas + telas empilhadas   │─────▶│  motor de inferência       │    │  SQLite local      │
│  componentes de base       │      │ @drmoo/knowledge           │◀───│  repositórios      │
│  tema claro único          │      │  base de conhecimento JSON │    │  (toda a SQL)      │
└────────────┬───────────────┘      │ @drmoo/domain              │    └─────────┬──────────┘
             │                      │  fórmulas Embrapa          │              │
             │                      └────────────────────────────┘              │
             │                                                                  │
             ▼                                                                  ▼
   @drmoo/relatorio (HTML → PDF)                                  @drmoo/planilha (.xlsx)
   @drmoo/sync (rede local)                                       scripts/servidor-sync.ts
```

Três regras governam a divisão:

1. **O motor não conhece I/O.** Recebe `(base, fatos)` e devolve `(pergunta | parecer, traço)`.
   Por isso ele é testável em milissegundos e o mesmo código roda no navegador e no aparelho.
2. **Toda a SQL vive em `packages/db`.** Nenhuma tela monta consulta; agregação é feita em SQL,
   não em JavaScript, porque o aparelho-alvo tem 2 GB de RAM.
3. **Conhecimento é dado, não código.** As 44 regras e as 28 hipóteses estão em JSON versionado
   (`packages/knowledge/kb/`), com fonte citada regra a regra.

---

## 2. Abertura do app

1. `apps/mobile/app/_layout.tsx` carrega as fontes e chama `abrirBanco()`.
2. `abrirBanco()` abre o SQLite (`expo-sqlite`, nativo no Android, WebAssembly no navegador),
   aplica o DDL, acrescenta colunas que faltarem (migração aditiva) e grava a versão do esquema.
3. Se o banco estiver vazio, `semear()` cria a propriedade de demonstração — o app nunca abre vazio.
4. A interface escolhe o formato pela largura da tela (`useLayout`): no celular, abas embaixo e
   uma coluna; no computador, barra superior fixa com a marca e barra lateral com as seções.
   A barra lateral vive no layout **raiz**, e por isso continua visível nas telas de gestão
   empilhadas por cima das abas.
5. No computador, as seções que já estão na barra lateral (Financeiro, Estatísticas, Base de
   conhecimento, Triagem, Rede local, Configurações) **não** mostram a faixa de cabeçalho com
   seta de voltar: a lateral já diz onde se está, e a faixa só roubaria altura sugerindo uma
   pilha que não existe. O título passa a ser o da própria página (`CabecalhoPagina`). As telas
   de detalhe — ficha do animal, prontuário, anamnese, edição de cadastro — mantêm o cabeçalho,
   porque ali o voltar é o caminho de saída. No celular, todas mantêm o cabeçalho.
6. Botões seguem a mesma lógica (`Acoes`): faixa de largura cheia no celular, onde o dedo
   agradece; linha de botões com largura própria no computador, onde uma faixa de 860 px para
   "Salvar" é só desperdício.

### Banco já aberto em outra aba (web)

No navegador o arquivo fica no OPFS, que aceita **um acesso de escrita por vez**. A segunda aba
cairia num erro de abertura; em vez disso o app abre um banco **em memória** e mostra uma tela
inteira (`AvisoDuasAbas`) no lugar da interface, explicando o que houve e oferecendo duas saídas:
*tentar de novo* — que reabre o banco de verdade depois de a outra aba ser fechada, sem recarregar
a página — ou *continuar sem salvar*, que libera o app com a cópia temporária, avisando que nada
será guardado. Continuando, o aviso se repete em Configurações.

A decisão de bloquear em vez de só avisar é deliberada: uma aba que aceita lançar CMT e descarta
tudo ao fechar é pior do que uma aba que diz “não dá”.

---

## 3. Anamnese: o ciclo do motor

```
fatos do banco ──▶ Sessao.proximo() ──▶ pergunta ──▶ Sessao.responder() ──┐
                         │                                               │
                         └──────────────── parecer ◀─────────────────────┘
```

1. **Pré-carga**: `fatosDoAnimal()` monta os fatos que o caderno já responde — idade, DEL,
   número de lactações, produção média, histórico de CMT e CCS. O motor começa sabendo.
2. **Encadeamento progressivo**: toda regra cujas premissas estão satisfeitas dispara, e o fator
   de certeza da conclusão é propagado e combinado (`packages/engine/src/cf.ts`).
3. **Escolha da pergunta**: entre as variáveis que ainda podem mudar o diagnóstico, o motor
   escolhe a de maior ganho dividido pelo custo de obter a resposta — e sabe dizer *por quê*.
4. **Parada**: hipótese líder acima do limiar e distante da segunda, teto de perguntas atingido,
   ou bandeira vermelha (doença de notificação obrigatória ou emergência), que interrompe na hora.
5. **Gravação**: o atendimento guarda fatos iniciais, respostas, conclusões e traço.

**Reprodutibilidade**: abrir o prontuário **re-executa** o motor com os fatos da época. Se o
resultado diverge, a tela diz — e diz também quando a base mudou de versão desde então.

---

## 4. Diagnóstico além da mastite

A base cobre **28 hipóteses em 10 grupos**: triagem, mastite, metabólicas, pós-parto,
digestivas, locomotor, parasitárias, notificação obrigatória, bezerras e indicadores de rebanho.

A tela de Saúde abre com o **panorama por grupo de doença** (`panoramaDiagnosticos()`), que lê as
conclusões gravadas nos atendimentos, descarta hipótese fraca (CF < 0,5) e "sem alteração",
agrupa por doença e separa as bandeiras vermelhas. Sem atendimento no período, a tela lista o que
o sistema sabe diagnosticar em vez de mostrar uma caixa vazia.

A mastite mantém painel próprio porque tem **dado próprio**: CMT por quarto, CCS, casos e a linha
de ordenha sugerida.

---

## 5. Rebanho: busca e filtros

A busca livre é por **palavras**: cada termo precisa aparecer em algum campo do animal, sem
distinguir acento nem caixa.

- A consulta deriva uma coluna `texto_busca` que concatena brinco, nome, tatuagem, raça, pelagem,
  categoria, situação, procedência, GTA, observações, pai, mãe e lote, já normalizada (acentos
  trocados letra a letra em SQL, porque `lower()` do SQLite só conhece ASCII).
- O termo digitado passa pela **mesma** normalização em JavaScript (`normalizarBusca`).
- Os termos entram no `WHERE` com **E**, não **OU**: "holandes malhada" acha a holandesa malhada.

Filtros: categoria, situação, sexo, lote (ou sem lote), CMT ≥ grau, peito perdido, em carência,
prenhes, parto em 60 dias, e faixas de DEL, idade e produção. Ordenação por oito critérios, com
inversão, sempre desempatada pelo brinco para a lista não "piscar" ao filtrar.

---

## 6. Financeiro: o recorte declarado

A análise de lucro do Dr. Moo é **apenas** a relação entre tratamentos médicos e produção de
leite, por vaca:

```
margem da vaca = (litros aproveitados × preço recebido) − custo dos tratamentos
litros aproveitados = litros do período − litros descartados na carência
```

A tela diz isso antes de qualquer número, e repete no PDF. Os indicadores econômicos gerais da
Embrapa (margem bruta e líquida, custo por litro, despesas por categoria) continuam no app, mas
**abaixo e rotulados como contexto**, fora da análise de lucro.

---

## 7. Estatísticas e PDF

`/estatisticas` reúne produção, composição do rebanho, saúde do úbere, diagnósticos por grupo,
a relação tratamentos × leite e o contexto econômico.

A exportação não recalcula nada: os mesmos números viram HTML em `@drmoo/relatorio`, com gráficos
em **SVG escrito à mão** (linha, barras e rosca). Daí para o PDF:

| Onde | Como | Resultado |
|---|---|---|
| Navegador | `window.open` + `print()` | o usuário escolhe "Salvar como PDF" |
| Android / iOS | `expo-print` → `expo-sharing` | folha de compartilhamento do sistema, com WhatsApp |

O prontuário usa o mesmo caminho e leva parecer, condutas, fontes, respostas e o traço da
inferência — quem recebe precisa poder conferir **como** o sistema chegou ali.

---

## 8. Planilha Excel: ida e volta

O arquivo exportado **é** o modelo: uma aba por cadastro (17 abas), cabeçalhos em português,
aba "Leia-me" com as instruções e os dados atuais já preenchidos.

- **Referências por nome**: animal pelo **brinco**, lote/medicamento/vacina pelo **nome**. Id
  interno em planilha é convite a erro silencioso.
- **Importação não destrutiva**: grava o que é novo e atualiza o que já existe, casando pela
  chave natural de cada tabela (brinco; animal + data; data + categoria + valor…). Há um modo
  "substituir" explícito, que esvazia a base antes.
- **Nunca falha calada**: linha com problema vira erro descrito (aba, linha, coluna, motivo) e o
  resto entra. Célula vazia não vira `NULL` — a coluna fica de fora e o banco aplica o padrão.
- Datas aceitam `2026-03-15`, `15/03/2026` e o número de série do Excel; números aceitam
  `1.234,56` e `1234.56`; sim/não aceita várias grafias.
- Tudo numa transação: ou a planilha entra inteira, ou não entra nada.

---

## 9. Sincronização entre aparelhos

Cada aparelho tem o seu banco. Um deles (normalmente o computador que já serve o app) roda
`npm run sync` e vira o **servidor da propriedade** na rede Wi-Fi local.

Uma sincronização é **uma ida e volta**:

1. o aparelho gera o instantâneo do seu banco (as tabelas em JSON);
2. envia ao servidor com o código de pareamento de 6 dígitos;
3. o servidor mescla com o que já tinha e devolve o resultado;
4. o aparelho grava **só o que mudou**.

A mesclagem é *last-write-wins* por `updated_at`, com `deleted_at` para exclusão lógica, e é
**comutativa e idempotente** — mesclar A com B e B com A dá o mesmo resultado, e sincronizar duas
vezes não muda nada. É a mesma função nos dois lados, o que faz os aparelhos convergirem.

Conflito que o algoritmo não resolve sozinho — mesmo brinco cadastrado nos dois aparelhos — é
recusado pelo banco e **relatado na tela** para decisão humana, em vez de derrubar a sincronização.

Nada sai para a internet: o servidor escuta apenas em IPs privados da LAN e não abre conexão de
saída.

---

## 10. O que garante que isto continua verdade

`npm run verify` roda typecheck e a suíte inteira. A suíte não testa só funções bonitas:

| Pacote | O que é verificado |
|---|---|
| `engine` | álgebra de CF, encadeamento, refração, retração, conflito, subsunção, bandeira vermelha |
| `knowledge` | integridade da base e os 28 casos de teste com resultado esperado |
| `domain` | reprodução exata dos números publicados pela Embrapa no exemplo do Sr. João |
| `db` | esquema, seed e repositórios contra SQLite real; busca; diagnósticos; planilha; sincronização entre dois bancos |
| `sync` | convergência, empate, lápide, idempotência e validação do que chega pela rede |
| `relatorio` | conteúdo dos PDFs, escape de HTML e gráficos sem dado nenhum |
| `ui` | telas renderizadas de verdade, sem texto solto fora de `<Text>` |

No GitHub, `.github/workflows/verificar.yml` roda isso em todo push e pull request, e
`publicar-web.yml` só publica a web depois que a verificação passa.
