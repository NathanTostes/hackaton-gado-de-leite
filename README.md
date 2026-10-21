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

Na primeira abertura o app cria o banco SQLite local e o popula com a propriedade de
demonstração. Não há servidor, backend, chave de API ou acesso à internet em tempo de
execução — depois do `npm install`, o app funciona com a máquina desconectada.

Para voltar o banco ao estado inicial: **Mais → Configurações → Recriar dados de
demonstração**. O gerador é determinístico, então o resultado é sempre o mesmo.

## Verificar

```bash
npm run verify       # typecheck + 81 testes
```

## Entregáveis

```bash
npm run entrega      # regera a documentação e a apresentação
```

| Arquivo | O que é |
|---|---|
| `docs/DrMoo-Documentacao.docx` | documentação técnica completa num só arquivo — capa, sumário, arquitetura, as 44 regras de produção, motor de inferência, processo com IA e casos de teste |
| `docs/DrMoo-Apresentacao.pptx` | 18 slides com animações e notas do apresentador |

Os arquivos `docs/02-*` e `docs/05-*` são **gerados a partir da própria base de conhecimento**
(`npm run docs`): documentação escrita à mão sobre uma base que muda vira documentação errada.

A suíte cobre:

| Pacote | O que é verificado |
|---|---|
| `engine` | álgebra de fatores de certeza, encadeamento progressivo e regressivo, refração, retração, resolução de conflito, subsunção, bandeira vermelha, reprodutibilidade |
| `knowledge` | integridade da base e os **28 casos de teste com resultado esperado** |
| `domain` | fórmulas da Embrapa — inclusive a reprodução exata dos números publicados no exemplo da propriedade do Sr. João |
| `db` | esquema, seed e repositórios contra um SQLite real (`node:sqlite`) |

---

## Arquitetura

```
apps/mobile      Interface (Expo / React Native + Web, um código para Android e navegador)
packages/engine  Motor de inferência — TypeScript puro, zero dependências
packages/knowledge  Base de conhecimento (JSON) + casos de teste
packages/domain  Cálculos zootécnicos e econômico-financeiros (funções puras)
packages/db      SQLite local: esquema, repositórios e pré-carga de fatos
packages/ui      Design system (tokens extraídos da logo)
docs/            Documentação da entrega
```

O motor não importa React, nem SQLite, nem nada de I/O: recebe
`(base de conhecimento, fatos)` e devolve `(próxima pergunta | parecer, traço)`.
É isso que o torna testável em milissegundos e auditável.

Detalhes em [`docs/01-arquitetura.md`](docs/01-arquitetura.md).

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
técnica"*. Veja [`docs/02-base-de-conhecimento.md`](docs/02-base-de-conhecimento.md).

**O Dr. Moo orienta e faz triagem. Não substitui o exame do médico-veterinário.**

---

## Licença

MIT. Todas as dependências são open source com licença permissiva.
