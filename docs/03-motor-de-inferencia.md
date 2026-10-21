# 3. Motor de inferência

Arquivos: `packages/engine/src/{types,cf,match,compilar,engine,explain}.ts`.
Zero dependências. Suíte de 20 testes em `packages/engine/tests/engine.test.ts`.

---

## 3.1 Memória de trabalho

A memória de trabalho é um `Map<string, Fato>`. Cada fato carrega valor, fator de certeza,
origem (`pergunta`, `banco`, `regra`, `calculado`) e, quando foi deduzido, a regra que o
produziu e as variáveis que o sustentaram.

### A convenção que organiza tudo

**O valor é a resposta literal; o fator de certeza é a confiança naquela resposta.**

| Resposta do usuário | Fato gravado |
|---|---|
| Sim | `valor: true, cf: 1.0` |
| Não | `valor: false, cf: 1.0` |
| Acho que sim | `valor: true, cf: 0.6` |
| Acho que não | `valor: false, cf: 0.6` |
| Não sei | **nada é gravado** |

A inversão de sinal acontece na avaliação da premissa: se a comparação bate, a premissa recebe
`+cf`; se não bate, recebe `−cf`. Uma vaca sem grumos (`valor: false, cf: 1`) faz a premissa
`caneca_grumos = true` valer `−1`, derrubando a regra; e faz `NÃO caneca_grumos` valer `+1`.

**"Não sei" não é "não".** O fato simplesmente não entra na memória, e a regra que dependia dele
fica pendente — nem dispara nem é descartada. Essa distinção é o que separa um sistema
especialista de um formulário: tratar ausência de informação como negativa produziria
diagnósticos falsamente confiantes.

## 3.2 Compilação da base

A variável-objetivo (`diagnostico`) assume vários valores ao mesmo tempo: cada hipótese tem seu
próprio fator de certeza. Para caber num `Map`, as referências a ela são reescritas uma única vez
na carga:

```
{ var: "diagnostico", op: "=", val: "mastite_clinica_g1" }
        ↓ compilação
{ var: "diagnostico=mastite_clinica_g1", op: "=", val: true }
```

A compilação também monta o índice `produzidaPor` (chave de memória → regras que a concluem),
que é o que torna o encadeamento regressivo barato.

## 3.3 Encadeamento progressivo

```
repita até o ponto fixo (trava de segurança: 500 ciclos):
    avalie todas as regras contra a memória
    descarte as que não podem disparar (premissa < 0,2 ou indefinida)
    descarte as já disparadas com os mesmos fatos  ← refração
    ordene por resolução de conflito
    dispare APENAS a vencedora
    combine o CF das conclusões na memória
    registre um passo no traço
```

Disparar uma por ciclo, em vez de todas de uma vez, é o que faz a resolução de conflito ter
efeito real e o traço ficar legível na ordem em que o raciocínio aconteceu.

**Refração:** a assinatura de um disparo é o id da regra mais o valor e o CF de cada premissa
avaliada. Com fatos idênticos, a regra não dispara de novo — sem isso, uma regra que conclui
sobre a própria variável entraria em laço e inflaria o CF artificialmente.

## 3.4 Resolução de conflito

Na ordem, até desempatar:

1. **Bandeira vermelha** — regras dos grupos `emergencia` e `notificacao_obrigatoria` passam na
   frente de tudo. Em triagem, errar para o lado da urgência é a escolha certa.
2. **Especificidade** — mais condições na premissa vence. A regra do grau 2 da mastite é mais
   específica que a do grau 1 e deve disparar depois dela, encadeada.
3. **Prioridade** declarada na regra.
4. **Recência** do fato que habilitou a regra.
5. **Ordem de declaração** — desempate final, puramente determinístico, para garantir que o
   mesmo caso produza sempre o mesmo traço.

## 3.5 Fatores de certeza (modelo MYCIN)

**Força da premissa:** `min` sobre `todas`, `max` sobre `alguma`, `−cf` sobre `nao`.
Limiar de corte: `0,2`.

Dois atalhos importam, porque evitam perguntas inúteis:

- numa **conjunção**, um ramo já falso derruba a premissa inteira mesmo que outros ramos sejam
  desconhecidos — não vale a pena perguntar o resto;
- numa **disjunção**, um ramo já verdadeiro basta.

**Conclusão de um disparo:** `CF_regra × CF_premissa`.

**Combinação de duas evidências para a mesma conclusão:**

| Situação | Fórmula |
|---|---|
| ambas positivas | `c₁ + c₂·(1 − c₁)` |
| ambas negativas | `c₁ + c₂·(1 + c₁)` |
| sinais opostos | `(c₁ + c₂) / (1 − min(\|c₁\|, \|c₂\|))` |

### Exemplo numérico resolvido à mão

Vaca com grumos no leite, úbere dolorido e inchado, sem febre (caso `CASO-MAST-003`):

```
1. MAST-CLIN-G1
   premissa: alguma(caneca_grumos=true[+1,0], …)        → max = 1,00
   conclusão: diagnostico=mastite_clinica_g1
              CF = 0,95 × 1,00                           = 0,95

2. MAST-CLIN-G2
   premissa: todas(
       diagnostico=mastite_clinica_g1                     → 0,95
       alguma(palpacao_dor=true, palpacao_inchaco=true)   → 1,00
   )                                                      → min = 0,95
   conclusão: diagnostico=mastite_clinica_g2
              CF = 0,90 × 0,95                            = 0,855  ⇒ "Muito provável"

3. MAST-CLIN-G3 fica PENDENTE
   premissa: todas(
       diagnostico=mastite_clinica_g2                     → 0,855
       alguma(febre=false[−1], apetite_reduzido=false[−1],
              desidratacao=?, apatia=?)                   → desconhecida
   )
   Dois ramos da disjunção são falsos, dois são desconhecidos: a disjunção não
   pode ser resolvida, e o motor PERGUNTA em vez de concluir.

4. Subsunção: o grau 2 substitui o grau 1 no ranking.
   Parecer final: mastite clínica grau 2, CF 0,855, "Muito provável".
```

## 3.6 Encadeamento regressivo: escolha da próxima pergunta

Para cada regra ainda indecidida, calcula-se um peso:

```
peso = Σ |CF_conclusão| × (1 − CF_atual_da_hipótese) × prioridade/100
       × 2,5 se for emergência ou notificação obrigatória
```

Esse peso é distribuído pelas variáveis que faltam, dividido pelo **custo** de obter cada uma
(1 = observação direta, 3 = exige manejo, 5 = exame laboratorial).

**A parte que faz diferença:** quando a variável faltante não é perguntável mas é produzida por
outras regras — uma submeta, como `diagnostico=mastite_clinica_g1` —, o motor **recorre** nas
regras que podem prová-la, com o peso descontado em 20% por nível (até 4 níveis).

É isso que faz o motor descobrir sozinho que, para chegar ao grau 2 da mastite, precisa antes
perguntar o que estabelece o grau 1. Sem a recursão, ele perguntaria "a mama está dolorida?"
antes de "o leite tem grumos?" — tecnicamente possível, mas clinicamente fora de ordem.

Desempate: menor custo, depois ordem de declaração da pergunta.

## 3.7 Critérios de parada

| Motivo | Quando |
|---|---|
| `bandeira_vermelha` | hipótese de emergência ou notificação obrigatória com CF ≥ 0,5 |
| `confianca_suficiente` | líder com CF ≥ 0,85 **e** distância ≥ 0,25 para a segunda |
| `sem_perguntas_uteis` | nenhuma pergunta restante pode alterar o resultado |
| `limite_de_perguntas` | teto de 20 perguntas — encerra com parecer parcial |
| `encerrado_pelo_usuario` | botão "concluir agora" |

## 3.8 Subsunção de hipóteses

Uma hipótese pode declarar `substitui`. Quando o grau 2 da mastite é confirmado (CF ≥ 0,5), o
grau 1 some do ranking do parecer — mas **continua no traço**, porque foi o degrau que levou até
o grau 2. O mesmo vale para a mastite crônica, que subsume a subclínica.

Sem isso, o grau 1 (CF 0,95) apareceria acima do grau 2 (CF 0,855) e o parecer ficaria
clinicamente confuso.

Note que subsunção **não** é hierarquia de gravidade: mastite clínica e subclínica coexistem no
parecer, porque podem de fato ocorrer em quartos diferentes da mesma vaca. O ranking é por fator
de certeza, não por gravidade — a gravidade aparece na bandeira vermelha e na conduta.

## 3.9 Retração e reprodutibilidade

A sessão guarda `(fatos iniciais, lista ordenada de respostas)` e **recomputa tudo do zero** a
cada avanço. Custa poucos milissegundos e dá três propriedades de graça:

- **retração**: o botão "voltar" só remove a última resposta; toda a cadeia é refeita, inclusive
  conclusões que dependiam dela;
- **reprodutibilidade**: `Sessao.restaurar()` com os mesmos dados devolve um parecer
  byte a byte idêntico — há um teste que compara os JSON;
- **sem estado oculto** que possa dessincronizar da memória de trabalho.

O prontuário grava `kb_versao` e `engine_versao` junto com os fatos. Ao reabrir, o app
re-executa o motor: se a base mudou de versão desde o atendimento, isso aparece em tela.

## 3.10 Traço e módulo de explicação

Cada disparo gera um `PassoDoTraco` com as premissas avaliadas (valor esperado, valor obtido,
CF, se foi satisfeita), as conclusões (CF antes e depois da combinação), a fonte e o texto do
`porque`.

Em cima disso, duas respostas que a interface precisa dar a qualquer momento:

- **"Por que essa pergunta?"** — durante o questionário, lista as regras pendentes que dependem
  da variável perguntada e as hipóteses que elas sustentam.
- **"Como cheguei nisso?"** — no parecer, `explicarConclusao()` reconstrói a árvore de trás para
  frente: regra → premissas → fatos → regras que produziram aqueles fatos, recursivamente, com
  a fonte de cada etapa. `tracoEmTexto()` serializa o mesmo conteúdo para exportação.
