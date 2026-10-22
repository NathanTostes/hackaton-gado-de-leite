# Dr. Moo

**Sistema especialista de anamnese e triagem de bovinos leiteiros em lactação.**

Hackathon UFJF 2026 — XXVIII Semana da Computação do DCC/UFJF · RERUM Engenharia de Sistemas
Tema **T1 — Anamnese**: coleta estruturada de sinais e histórico, com triagem explicável.

O Dr. Moo roda **100% offline, em localhost**, sobre uma **base de conhecimento explícita e
versionada** e um **motor de inferência determinístico com fatores de certeza**. Nenhum modelo
de linguagem participa do diagnóstico — a IA foi usada para construir o sistema, não para decidir.

---

## Rodar

Requisitos: **Node.js 22+** e npm. Instale uma única vez, na raiz — são workspaces,
não rode `npm install` dentro de `apps/mobile`:

```bash
npm install
```

### Web (é esta que roda na demonstração)

```bash
npm run web          # abre em http://localhost:8081
```

### Android

Duas opções. A mais simples é o **celular físico**, sem instalar SDK nenhum:

```bash
npm start            # mostra um QR code no terminal
```

Instale o app **Expo Go** no celular, deixe-o na **mesma rede Wi-Fi** do computador e leia o
QR code. Se a rede bloquear a conexão direta, use `npm start -- --tunnel`.

Com emulador do Android Studio aberto (ou celular via USB com depuração ligada):

```bash
npm run android
```

### Em qualquer um dos dois

Na primeira abertura o app cria o banco SQLite local **vazio**. Não há servidor, backend,
chave de API ou acesso à internet em tempo de execução — depois do `npm install`, o app
funciona com a máquina desconectada.

Os dados entram pela planilha: **Mais → Configurações → Planilha da propriedade**. A
planilha exportada já é o modelo (uma aba por cadastro, cabeçalhos em português); preencha
no Excel e importe de volta. O modo **substituição** esvazia o banco antes de importar.

No navegador, o banco fica num arquivo do OPFS, e o navegador só permite **um acesso de
escrita por vez**. Abrir o Dr. Moo numa segunda aba mostra uma tela explicando isso, com duas
saídas: tentar de novo (depois de fechar a outra aba) ou continuar ali num banco temporário, que
funciona mas **não salva** — e diz isso com todas as letras. Para usar dois ambientes de verdade
ao mesmo tempo, use dois aparelhos — ou dois navegadores diferentes — e sincronize pela rede
local.

### Dois aparelhos na mesma rede

Cada aparelho tem o seu próprio banco. Para que conversem, um deles (normalmente o
computador que já serve o app) roda o servidor da propriedade:

```bash
npm run sync         # escuta na porta 8787 e imprime endereço + código de 6 dígitos
```

Nos aparelhos, abra **Mais → Rede local**, informe o endereço (`http://<ip-do-servidor>:8787`),
o código de pareamento e toque em **Sincronizar agora**.

Cada sincronização é uma única ida e volta: o aparelho envia o instantâneo do seu banco, o
servidor mescla com o que já tinha e devolve o resultado, que o aparelho grava. O conflito é
resolvido por *last-write-wins* sobre `updated_at` (com `deleted_at` para exclusão lógica) e a
mesclagem é comutativa e idempotente — os aparelhos convergem independentemente da ordem.
Registro recusado pelo banco local (brinco repetido criado nos dois aparelhos) não derruba a
sincronização: aparece como conflito na tela, para decisão humana.

Continua tudo offline: o servidor escuta apenas na LAN da propriedade, não abre conexão de
saída e guarda a base mesclada em `.drmoo-sync/estado.json`. Variáveis opcionais:
`PORTA_SYNC`, `CODIGO_SYNC`, `NOME_PROPRIEDADE`.

## Planilha, PDF e estatísticas

- **Planilha da propriedade** (Configurações → Planilha): exporta um `.xlsx` com **uma aba por
  cadastro** e os dados atuais dentro — o arquivo exportado **é** o template. Preencha no Excel
  e importe de volta. Animais são referenciados pelo **brinco**; lote, medicamento e vacina pelo
  **nome**. A importação atualiza o que já existe (sem duplicar), relata linha a linha o que não
  entrou e tem um modo "substituir" que troca a base inteira.
- **Prontuário em PDF** (tela do prontuário): no computador abre a janela de impressão para
  salvar em PDF; no celular gera o PDF e abre o compartilhamento do sistema — WhatsApp inclusive.
- **Estatísticas** (Mais → Estatísticas): todos os gráficos da propriedade numa tela, com
  exportação do relatório completo em PDF pelo mesmo caminho.

Tudo é gerado dentro do app, offline: nenhum arquivo passa por servidor.

## Builds e deploy

```bash
npm run build:web      # exporta o app estático em dist-web/
npm run servir:web     # serve dist-web em http://localhost:8080 para conferir
npm run build:android  # prebuild + gradlew assembleRelease (APK)
```

| Alvo | Como gerar | Deploy mais simples |
|---|---|---|
| **Web** | `npm run build:web` → `dist-web/` (HTML, JS e wasm estáticos) | arrastar `dist-web/` no Netlify/Vercel, ou o workflow `publicar-web.yml` (GitHub Pages) |
| **Android** | `npx eas build -p android --profile preview` (APK na nuvem, sem SDK local) ou `npm run build:android` com Android SDK instalado | enviar o APK direto (link/QR). Loja só se quiser distribuição pública |

### O que vai ao ar

| Endereço | Conteúdo |
|---|---|
| `/` | página de apresentação (`site/index.html`) — o que é a solução, com links para o app |
| `/app/` | o aplicativo web |

### Publicar a web (do mais simples ao mais automático)

1. **Arrastar a pasta** — `npm run build:web` e solte `dist-web/` em
   [app.netlify.com/drop](https://app.netlify.com/drop). Sai no ar em segundos, sem conta nem
   configuração, servido na raiz do domínio.
2. **EAS Hosting** — `npx eas-cli deploy --prod` publica o mesmo `dist-web/` com a conta Expo
   que você já vai criar para a Play Store.
3. **GitHub Pages** — `publicar-web.yml` faz tudo a cada merge na `main`; basta ligar
   *Settings → Pages → Source: GitHub Actions* (repositório público, ou GitHub Pro se privado).
   O workflow já ajusta o caminho base (num Pages de projeto o site fica em `/<repositorio>/`) e
   já copia `index.html` para `404.html`, para abrir `/configuracoes` direto ou apertar F5 não
   cair na página de erro do GitHub.

**Atenção à sincronização em rede local**: hospedado em HTTPS (Pages, Netlify, EAS), o navegador
**bloqueia** as chamadas ao servidor da propriedade, que fala `http://` num IP da LAN — é a
regra de conteúdo misto, não um defeito do app. Para demonstrar a sincronização, use o app
servido localmente (`npm run web`, em `http://`) ou o APK no celular.
O resto do sistema funciona igual na versão hospedada.

### Publicar na Play Store

```bash
npm run build:aab     # AAB assinado na nuvem (formato que a loja aceita)
npm run enviar:play   # envia para o Google Play Console
```

Os perfis estão em `eas.json`: `preview` gera APK para instalar direto no celular, `producao`
gera o AAB da loja com `versionCode` incrementado automaticamente. Antes do primeiro envio é
preciso ter a conta de desenvolvedor do Google Play (taxa única de US$ 25) e uma chave de conta
de serviço — `eas submit` explica o passo a passo na primeira execução.

### CI/CD já configurado

`.github/workflows/verificar.yml` roda typecheck e testes em todo push e pull request;
`publicar-web.yml` verifica e publica a web a cada merge na `main`. Build de Android no CI exige
uma conta Expo e o segredo `EXPO_TOKEN` — fora isso, nada a configurar.

### Testar web e celular juntos

```bash
npm run sync           # terminal 1: servidor da propriedade (porta 8787)
npm run web            # terminal 2: app web (porta 8081)
npm start              # terminal 3: QR code para o Expo Go no celular
```

Com os três abertos na mesma rede Wi-Fi: cadastre um animal no celular, sincronize, sincronize
no navegador e confira que ele apareceu.

## Verificar

```bash
npm run verify          # typecheck + 283 testes
npm run test:cobertura  # o mesmo, com relatório de cobertura em coverage/
```

Cobertura atual: **74% das linhas** no total, concentrada onde importa — `domain` 99%,
`relatorio` 98%, `planilha` 95%, `engine` 95%, `db` 92%, `sync` 87%. O que puxa a média para
baixo são os componentes de interface (`apps/mobile/src/componentes`), testados por
renderização nas telas críticas e não linha a linha.

## Entregáveis

```bash
npm run entrega      # regera documentação, diagramas e apresentação
```

| Arquivo | O que é |
|---|---|
| `docs/DrMoo-Documentacao.docx` | documentação técnica completa num só arquivo — capa, sumário, arquitetura, as 44 regras de produção, motor de inferência, processo com IA, casos de teste, funcionamento do sistema e diagrama de classes |
| `docs/DrMoo-DiagramaDeClasses.docx` | só os diagramas de classes, em paisagem: domínio persistido, motor de inferência e serviços de aplicação |
| `docs/DrMoo-Apresentacao.pptx` | 18 slides com animações e notas do apresentador |

Os diagramas saem de `npm run diagrama`, que desenha as figuras a partir do modelo descrito em
`scripts/gerar_diagrama_classes.py` — elas acompanham o código, não um desenho esquecido.

Os arquivos `docs/02-*` e `docs/05-*` são **gerados a partir da própria base de conhecimento**
(`npm run docs`): documentação escrita à mão sobre uma base que muda vira documentação errada.

A pasta `docs/` **não é versionada** — ela é saída de build, como `dist-web/`. Rode
`npm run entrega` para gerar tudo localmente: os capítulos em Markdown, os diagramas, o
documento Word e a apresentação.

A suíte cobre:

| Pacote | O que é verificado |
|---|---|
| `engine` | álgebra de fatores de certeza, encadeamento progressivo e regressivo, refração, retração, resolução de conflito, subsunção, bandeira vermelha, reprodutibilidade |
| `knowledge` | integridade da base e os **28 casos de teste com resultado esperado** |
| `domain` | fórmulas da Embrapa — inclusive a reprodução exata dos números publicados no exemplo da propriedade do Sr. João |
| `db` | esquema, seed e repositórios contra um SQLite real (`node:sqlite`), e a sincronização entre dois aparelhos ponta a ponta |
| `sync` | mesclagem dos instantâneos: last-write-wins, comutatividade, idempotência e validação do que chega pela rede |
| `relatorio` | HTML dos relatórios e os gráficos SVG do PDF, inclusive casos sem dado nenhum |
| `planilha` | normalização de data, número e sim/não; tradução aba ↔ tabela; leitura e escrita do `.xlsx` |
| `db` (planilha) | exportar, reimportar sem duplicar, relatar linha inválida e o modo substituir |

---

## Arquitetura

```
apps/mobile      Interface (Expo / React Native + Web, um código para Android e navegador)
packages/engine  Motor de inferência — TypeScript puro, zero dependências
packages/knowledge  Base de conhecimento (JSON) + casos de teste
packages/domain  Cálculos zootécnicos e econômico-financeiros (funções puras)
packages/db      SQLite local: esquema, repositórios e pré-carga de fatos
packages/sync    Sincronização na rede local: instantâneo, mesclagem e cliente HTTP
packages/planilha  Mapa planilha ↔ banco, leitura e escrita do .xlsx
packages/relatorio Relatórios em HTML + gráficos SVG, que viram PDF no app
packages/ui      Design system (tokens extraídos da logo)
scripts/         Geração de documentação e servidor de sincronização da propriedade
docs/            Documentação da entrega (gerada, fora do versionamento)
```

O motor não importa React, nem SQLite, nem nada de I/O: recebe
`(base de conhecimento, fatos)` e devolve `(próxima pergunta | parecer, traço)`.
É isso que o torna testável em milissegundos e auditável.

Detalhes em `docs/01-arquitetura.md`, com o passo a passo de cada funcionalidade em
`docs/06-funcionamento.md` e o modelo de classes em `docs/07-diagrama-de-classes.md` — todos
gerados por `npm run entrega`.

---

## O que o sistema faz

- **Anamnese guiada**: uma pergunta por vez, escolhida pelo motor em função do que ainda pode
  mudar o diagnóstico, dividida pelo custo de obter a resposta. Responde sempre
  *"por que essa pergunta?"* e *"como cheguei nisso?"*.
- **Pré-carga de fatos**: o motor começa já sabendo idade, dias em lactação, número de lactações,
  produção média, histórico de CMT e CCS. Não pergunta o que o caderno já responde.
- **Bandeira vermelha**: suspeita de doença de notificação obrigatória ou quadro de emergência
  interrompe o questionário e orienta a conduta imediata.
- **Prontuário reproduzível**: reabrir um atendimento re-executa o motor com os fatos gravados;
  se a base mudou de versão desde então, o app avisa.
- **Rebanho** com busca e filtros combináveis, ficha do animal, curva de lactação.
- **Saúde**: lançamento de CMT em lote por quarto mamário, percentuais de mastite clínica e
  subclínica contra as metas da Embrapa, lista de crônicas, linha de ordenha sugerida,
  controle de carência de medicamento.
- **Calendário** sanitário e de tarefas, com eventos gerados automaticamente por tratamentos
  e pela triagem de entrada.
- **Financeiro** nas categorias e indicadores da planilha da Embrapa, mais a **margem por vaca**
  (produção × gastos com remédios × leite descartado por carência).
- **Diagnóstico muito além da mastite**: 28 condições em 10 grupos — metabólicas, pós-parto,
  digestivas, locomotor, parasitárias, de bezerras, indicadores de rebanho e as de notificação
  obrigatória —, com painel por grupo de doença na tela de Saúde.
- **Análise de lucro por vaca** no recorte explícito tratamentos médicos × produção de leite;
  os indicadores gerais da Embrapa ficam à parte, rotulados como contexto.
- **Busca detalhada do rebanho**: texto livre por palavras (sem acento e sem caixa) sobre brinco,
  nome, tatuagem, raça, pelagem, lote, procedência, GTA, pais e observações, mais filtros de
  situação, sexo, lote, CMT, prenhez, DEL, idade e produção, com ordenação em oito critérios.
- **Planilha Excel** de ida e volta e **PDF** do prontuário e das estatísticas.
- **Sincronização entre aparelhos** na rede local da propriedade, sem nuvem.
- **Base de conhecimento** inspecionável na própria interface, com os casos de teste rodando ao vivo.

---

## Fontes do conhecimento de domínio

- OLIVEIRA, V. M. et al. **Como identificar a vaca com mastite em sua propriedade.**
  Brasília: Embrapa, 2015. ISBN 978-85-7035-461-7. — origem integral do grupo de regras de
  mastite, com página citada regra a regra.
- EMBRAPA GADO DE LEITE. **Administrando a propriedade leiteira.** 2016. — fichas de controle,
  categorias de despesa e indicadores técnicos e econômico-financeiros.

Regras formalizadas a partir de consenso veterinário geral, sem conferência com fonte primária,
estão marcadas com `status: "revisar"` e aparecem na interface com selo *"requer validação
técnica"*. Veja `docs/02-base-de-conhecimento.md`, gerado por `npm run docs`.

**O Dr. Moo orienta e faz triagem. Não substitui o exame do médico-veterinário.**

---

## Licença

MIT. Todas as dependências são open source com licença permissiva.
