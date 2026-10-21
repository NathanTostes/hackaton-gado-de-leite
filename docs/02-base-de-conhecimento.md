# 2. Base de conhecimento

> **Documento gerado automaticamente a partir de `packages/knowledge/kb/`.**
> Não edite este arquivo à mão: edite a base e rode `npm run docs`.

**Versão da base:** 1.0.0

**44 regras de produção** · 17 validadas contra fonte primária · 27 a revisar · 48 perguntas · 28 hipóteses

## 2.1 Como a base é escrita

A base vive em JSON, e não em código, por uma razão prática: ela é **dado**, não programa.
Um médico-veterinário consegue abrir `packages/knowledge/kb/grupos/02-mastite.json`, ler a
regra, conferir a página da cartilha citada e dizer se está certa — sem saber TypeScript.

Cada regra carrega:

| Campo | Para que serve |
|---|---|
| `se` | premissa, em `todas` (E), `alguma` (OU) e `nao`, com 10 operadores de comparação |
| `entao` | conclusões, cada uma com seu fator de certeza |
| `prioridade` | resolução de conflito quando várias regras podem disparar |
| `porque` | o texto que o app mostra em "por que essa pergunta?" e no traço |
| `conduta` | o que fazer, como checklist acionável na tela |
| `fonte` | referência bibliográfica, com página |
| `status` | `validada` (conferida com fonte primária) ou `revisar` |

## 2.2 Procedência e honestidade sobre o que não foi validado

O grupo de **mastite** foi extraído integralmente da cartilha da Embrapa Gado de Leite
*"Como identificar a vaca com mastite em sua propriedade"* (2015), com a página citada regra a
regra. São as regras marcadas como `validada`.

Os demais grupos clínicos foram formalizados a partir de consenso veterinário geral e **ainda
não foram conferidos com fonte primária**. Estão marcados como `revisar` e, no aplicativo,
qualquer conclusão que dependa deles aparece com o selo *"requer validação técnica"*.

Declarar isso é mais útil do que escondê-lo: o sistema é uma prova de conceito, e a fronteira
entre o que está verificado e o que está suposto é informação clínica relevante para quem usa.

## 2.3 Metas e fórmulas de rebanho

| Indicador | Meta | Fonte |
|---|---|---|
| % de mastite clínica no mês | ≤ 2% | Mastite, p. 38 (adaptado do National Mastitis Council) |
| % de mastite subclínica | ≤ 20% | Mastite, p. 39 |
| Intervalo entre testes de CMT | 30 dias | Mastite, p. 23 |
| CCS individual indicando subclínica | > 200.000 células/mL | Mastite, p. 34 |
| CMT positivo caracterizando mastite crônica | ≥ 3 meses na mesma lactação | Mastite, p. 35 |
| % de vacas em lactação | ~83% | Administrando, p. 46 |
| % de vacas no rebanho | ~50% | Administrando, p. 46 |

## 2.4 Regras de produção

### Triagem geral

#### `TRI-SEM-ALTERACAO` — Nenhuma alteração detectada na triagem

```
SE NÃO grumos ou pus nos primeiros jatos E NÃO leite com coloração alterada (amarelada ou avermelhada) E NÃO leite com consistência alterada (aguado ou grosso) E NÃO dor à palpação da mama E NÃO inchaço na mama E NÃO febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes E NÃO perda de apetite E NÃO apatia ou prostração E NÃO manqueira (claudicação) E NÃO queda súbita na produção de leite
ENTÃO diagnóstico = sem_alteracao (CF 0,85 — Muito provável)
```

**Por quê:** Nenhum dos sinais pesquisados na triagem foi encontrado: o leite está normal no teste da caneca, a mama não apresenta alteração à palpação, o estado geral do animal está bom e a produção não caiu.

**Conduta:**

- Mantenha o teste da caneca de fundo escuro todos os dias, em todos os quartos, antes de cada ordenha.
- Faça o teste de CMT pelo menos uma vez por mês em todas as vacas em lactação.
- Anote o resultado no controle leiteiro mensal.

**Fonte:** EMBRAPA, Mastite, 2015, p. 40 ("Vamos recordar?").

**Status:** ✅ validada · **Prioridade:** 10

---

#### `TRI-QUEDA-PRODUCAO` — Queda de produção sem causa identificada

```
SE queda súbita na produção de leite E NÃO grumos ou pus nos primeiros jatos E NÃO febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes
ENTÃO diagnóstico = mastite_subclinica (CF 0,35 — Possível)
```

**Por quê:** Vacas com mastite reduzem a produção de leite mesmo sem sinais visíveis. Queda de produção sem outra causa aparente justifica investigar mastite subclínica por CMT ou CCS.

**Conduta:**

- Faça o teste de CMT nos quatro quartos desta vaca.
- Se possível, colete amostra para CCS individual.
- Revise alimentação e disponibilidade de água do lote.

**Fonte:** EMBRAPA, Mastite, 2015, p. 5 e p. 22.

**Status:** ⚠️ a revisar · **Prioridade:** 20

---

### Mastite

#### `MAST-CLIN-G1` — Mastite clínica grau 1

```
SE (grumos ou pus nos primeiros jatos OU leite com coloração alterada (amarelada ou avermelhada) OU leite com consistência alterada (aguado ou grosso))
ENTÃO diagnóstico = mastite_clinica_g1 (CF 0,95 — Muito provável)
```

**Por quê:** É a forma clínica mais branda, em que ocorrem apenas alterações no leite — presença de grumos ou pus, alterações de cor e/ou de consistência — principalmente nos primeiros jatos, observadas no teste da caneca de fundo escuro.

**Conduta:**

- Separe a vaca e ordenhe-a por último em todas as próximas ordenhas.
- Identifique o animal, por exemplo com uma corda de nylon no pescoço.
- Descarte o leite do quarto afetado em local apropriado — este leite não deve ser aproveitado.
- Lave as mãos antes de ordenhar a próxima vaca.
- Procure o médico-veterinário para indicar o tratamento adequado.
- Anote o caso na ficha de mastite clínica.

**Fonte:** EMBRAPA. Como identificar a vaca com mastite em sua propriedade, 2015, p. 12 e p. 19-20.

**Status:** ✅ validada · **Prioridade:** 80

---

#### `MAST-CLIN-G2` — Mastite clínica grau 2

```
SE diagnóstico é mastite_clinica_g1 E (dor à palpação da mama OU inchaço na mama OU área endurecida na mama OU parte da mama avermelhada)
ENTÃO diagnóstico = mastite_clinica_g2 (CF 0,90 — Muito provável)
```

**Por quê:** No grau 2, além das alterações no leite vistas no grau 1, ao examinar a mama com as mãos percebe-se dor, inchaço, local endurecido ou parte da mama avermelhada.

**Conduta:**

- Separe a vaca e ordenhe-a por último em todas as próximas ordenhas.
- Identifique o animal, por exemplo com uma corda de nylon no pescoço.
- Descarte o leite do quarto afetado em local apropriado.
- Lave as mãos antes de ordenhar a próxima vaca.
- Acione o médico-veterinário: a presença do profissional é importante para examinar a vaca e indicar o tratamento certo.
- Trate até a recuperação completa da mama doente.

**Fonte:** EMBRAPA, Mastite, 2015, p. 13 e p. 19-20.

**Status:** ✅ validada · **Prioridade:** 85

---

#### `MAST-CLIN-PALP-POS` — Caroços na mama após a ordenha

```
SE caroços ou áreas endurecidas após a ordenha
ENTÃO diagnóstico = mastite_clinica_g1 (CF 0,60 — Provável)
```

**Por quê:** Após a ordenha, cada quarto mamário deve estar macio. A formação de caroços ou de áreas endurecidas indica processo inflamatório na mama.

**Conduta:**

- Refaça o teste da caneca de fundo escuro na próxima ordenha.
- Faça o teste de CMT neste animal.
- Ordenhe a vaca por último até esclarecer o caso.

**Fonte:** EMBRAPA, Mastite, 2015, p. 21.

**Status:** ✅ validada · **Prioridade:** 60

---

#### `MAST-CLIN-UBERE` — Exame visual do úbere alterado

```
SE (aumento de tamanho do úbere OU a vaca não se deixa ordenhar)
ENTÃO diagnóstico = mastite_clinica_g1 (CF 0,65 — Provável)
```

**Por quê:** No exame visual antes da ordenha, aumento de tamanho do úbere ou recusa da vaca em se deixar ordenhar são sinais de que algo está errado na mama.

**Conduta:**

- Examine a mama com as mãos procurando dor, inchaço, área endurecida ou mais quente.
- Faça o teste da caneca de fundo escuro em todos os quartos.

**Fonte:** EMBRAPA, Mastite, 2015, p. 21.

**Status:** ✅ validada · **Prioridade:** 60

---

#### `MAST-SUB-CMT-1` — CMT uma cruz (+)

```
SE pior resultado de CMT entre os quartos é 1
ENTÃO diagnóstico = mastite_subclinica (CF 0,85 — Muito provável)
```

**Por quê:** Formação gelatinosa fraca que não se dissolve é resultado positivo do CMT: há mastite subclínica naquele quarto mamário.

**Conduta:**

- Ordenhe esta vaca depois das vacas sadias.
- Anote o resultado na ficha de mastite subclínica, por quarto.
- Repita o CMT no mês que vem e acompanhe a evolução.
- Lave as mãos durante o teste para não passar germes de uma vaca para outra.

**Fonte:** EMBRAPA, Mastite, 2015, p. 31-33.

**Status:** ✅ validada · **Prioridade:** 70

---

#### `MAST-SUB-CMT-2` — CMT duas cruzes (++)

```
SE pior resultado de CMT entre os quartos é 2
ENTÃO diagnóstico = mastite_subclinica (CF 0,90 — Muito provável)
```

**Por quê:** Formação gelatinosa com mamilo no centro é resultado positivo de CMT. Quanto mais afetado o quarto mamário, mais gelatinosa fica a mistura.

**Conduta:**

- Ordenhe esta vaca depois das vacas sadias.
- Anote o resultado na ficha de mastite subclínica, por quarto.
- Considere a CCS individual para confirmar e acompanhar.
- Repita o CMT no mês que vem.

**Fonte:** EMBRAPA, Mastite, 2015, p. 31-33.

**Status:** ✅ validada · **Prioridade:** 72

---

#### `MAST-SUB-CMT-3` — CMT três cruzes (+++)

```
SE pior resultado de CMT entre os quartos é 3
ENTÃO diagnóstico = mastite_subclinica (CF 0,95 — Muito provável)
```

**Por quê:** Formação de gel muito grosso, que cola no fundo da raquete, indica quarto mamário fortemente afetado.

**Conduta:**

- Ordenhe esta vaca por último.
- Anote o resultado na ficha de mastite subclínica, por quarto.
- Procure o médico-veterinário para definir tratamento ou decisão de descarte.
- Repita o CMT no mês que vem.

**Fonte:** EMBRAPA, Mastite, 2015, p. 31-33.

**Status:** ✅ validada · **Prioridade:** 75

---

#### `MAST-SUB-CMT-TRACOS` — CMT com traços (T)

```
SE pior resultado de CMT entre os quartos é T
ENTÃO diagnóstico = mastite_subclinica (CF 0,30 — Pouco provável)
```

**Por quê:** Ligeira formação de gel que se dissolve com os movimentos da raquete é considerada resultado NEGATIVO, mas merece acompanhamento no mês seguinte.

**Conduta:**

- Resultado considerado negativo — não é preciso separar a vaca.
- Repita o CMT no mês que vem e observe se evolui para positivo.

**Fonte:** EMBRAPA, Mastite, 2015, p. 32.

**Status:** ✅ validada · **Prioridade:** 40

---

#### `MAST-SUB-CCS` — CCS individual acima de 200.000

```
SE CCS individual (células/mL) > 200000
ENTÃO diagnóstico = mastite_subclinica (CF 0,90 — Muito provável)
```

**Por quê:** Vacas com CCS acima de 200.000 células por mL são consideradas com mastite subclínica. As células somáticas são as células de defesa que passam do sangue para a mama quando há inflamação.

**Conduta:**

- Ordenhe esta vaca depois das vacas sadias.
- Separe o leite desta vaca do leite das vacas sadias para reduzir a CCS do tanque.
- Repita o CMT ou a CCS pelo menos uma vez por mês e anote os resultados.

**Fonte:** EMBRAPA, Mastite, 2015, p. 34.

**Status:** ✅ validada · **Prioridade:** 78

---

#### `MAST-CRONICA` — Mastite crônica (persistente)

```
SE meses seguidos com CMT positivo nesta lactação >= 3
ENTÃO diagnóstico = mastite_cronica (CF 0,85 — Muito provável)
```

**Por quê:** Uma vaca com CMT positivo por três meses ou mais durante uma lactação é considerada com mastite crônica.

**Conduta:**

- Anote os casos de mastite clínica que repetiram várias vezes nesta vaca durante uma ou mais lactações.
- Avalie o DESCARTE da vaca com mastite persistente — é a recomendação da cartilha.
- Até o descarte, ordenhe este animal sempre por último.
- Faça um programa de tratamento e controle da doença para o rebanho.

**Fonte:** EMBRAPA, Mastite, 2015, p. 35.

**Status:** ✅ validada · **Prioridade:** 88

---

#### `MAST-PP` — Peito perdido

```
SE (algum quarto não produz mais leite OU pior resultado de CMT entre os quartos é PP)
ENTÃO diagnóstico = peito_perdido (CF 0,95 — Muito provável)
```

**Por quê:** Quando se constata que um quarto mamário não produz mais leite, na prática ele é chamado de "peito perdido" e deve ser representado pela sigla PP.

**Conduta:**

- Registre o quarto como PP na ficha do animal.
- Não inclua este quarto nos testes de CMT.
- Avalie com o veterinário se a perda decorreu de mastite mal tratada — isso indica falha no controle da doença.

**Fonte:** EMBRAPA, Mastite, 2015, p. 37.

**Status:** ✅ validada · **Prioridade:** 65

---

### Emergências

#### `MAST-CLIN-G3` — Mastite clínica grau 3 — emergência

```
SE diagnóstico é mastite_clinica_g2 E (febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes OU perda de apetite OU sinais de desidratação (olhos fundos, prega de pele lenta) OU apatia ou prostração)
ENTÃO diagnóstico = mastite_clinica_g3 (CF 0,95 — Muito provável)
```

**Por quê:** No grau 3, além dos sinais dos graus 1 e 2, há comprometimento do organismo do animal: a vaca pode apresentar febre, perda de apetite e desidratação. Vacas com mastite clínica grau 3 correm risco de morrer.

**Conduta:**

- CHAME O MÉDICO-VETERINÁRIO IMEDIATAMENTE. O tratamento tem que ser iniciado o mais rápido possível.
- Sem atendimento rápido, a vaca pode perder a mama ou até morrer.
- Separe o animal agora e ordenhe-o sempre por último.
- Descarte todo o leite deste animal em local apropriado.
- Ofereça água e sombra; não transporte o animal sem orientação.

**Fonte:** EMBRAPA, Mastite, 2015, p. 14.

**Status:** ✅ validada · **Prioridade:** 98

---

#### `DIG-TIMPANISMO` — Timpanismo

```
SE flanco esquerdo estufado
ENTÃO diagnóstico = timpanismo (CF 0,75 — Provável)
```

**Por quê:** O flanco esquerdo estufado indica acúmulo de gases no rúmen. O quadro pode evoluir rápido e levar o animal à morte por asfixia.

**Conduta:**

- CHAME O MÉDICO-VETERINÁRIO COM URGÊNCIA.
- Mantenha o animal em pé e caminhando devagar, nunca deitado.
- Não aplique nada pela boca sem orientação — há risco de aspiração.
- Verifique se o lote teve acesso recente a pasto novo de leguminosa ou a muito concentrado.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 93

---

#### `BEZ-DIARREIA-GRAVE` — Diarreia neonatal com desidratação

```
SE diagnóstico é diarreia_neonatal E sinais de desidratação (olhos fundos, prega de pele lenta)
ENTÃO diagnóstico = diarreia_neonatal (CF 0,80 — Provável)
```

**Por quê:** Bezerra com diarreia e sinais de desidratação (olhos fundos, prega de pele que demora a voltar) está em risco de vida.

**Conduta:**

- CHAME O MÉDICO-VETERINÁRIO HOJE: pode ser necessário soro na veia.
- Inicie a reidratação oral imediatamente enquanto aguarda.
- Mantenha a bezerra aquecida e em local seco.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 95

---

### Metabólicas

#### `MET-HIPOCALCEMIA` — Hipocalcemia (febre do leite)

```
SE dias em lactação (DEL) <= 3 E número da lactação >= 2 E vaca caída, sem conseguir levantar E NÃO febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes
ENTÃO diagnóstico = hipocalcemia (CF 0,85 — Muito provável)
```

**Por quê:** A hipocalcemia ocorre tipicamente nos primeiros dias após o parto em vacas multíparas e de alta produção. Apesar do nome popular "febre do leite", o animal NÃO apresenta febre — ao contrário, fica com as extremidades frias.

**Conduta:**

- CHAME O MÉDICO-VETERINÁRIO COM URGÊNCIA: o tratamento é a aplicação de cálcio e precisa ser feito por profissional.
- Mantenha a vaca em posição esternal (deitada sobre o peito), nunca de lado, para evitar timpanismo e aspiração.
- Coloque o animal em piso macio e não escorregadio, à sombra, com água por perto.
- Reveja o manejo nutricional das vacas no pré-parto com o técnico.

**Fonte:** Consenso veterinário geral sobre hipocalcemia puerperal — PENDENTE de validação com fonte primária.

**Status:** ⚠️ a revisar · **Prioridade:** 92

---

#### `MET-HIPOCALCEMIA-REFORCO` — Sinais de reforço de hipocalcemia

```
SE diagnóstico é hipocalcemia E (orelhas e patas frias OU tremores musculares)
ENTÃO diagnóstico = hipocalcemia (CF 0,60 — Provável)
```

**Por quê:** Extremidades frias e tremores musculares reforçam a suspeita de queda de cálcio no sangue.

**Conduta:**

- Reforce a urgência do atendimento veterinário.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 70

---

#### `MET-CETOSE` — Cetose

```
SE dias em lactação (DEL) está entre 7, 60 E perda de apetite E (queda súbita na produção de leite OU emagrecimento visível)
ENTÃO diagnóstico = cetose (CF 0,70 — Provável)
```

**Por quê:** A cetose aparece no início da lactação, quando a vaca não consegue comer o suficiente para a produção de leite que faz. Come menos, emagrece e a produção cai.

**Conduta:**

- Procure o médico-veterinário para confirmar com teste de corpos cetônicos e indicar o tratamento.
- Ofereça alimento de boa qualidade e de fácil consumo a esta vaca.
- Revise a dieta das vacas no início de lactação com o técnico.
- Verifique se há outro problema associado (deslocamento de abomaso, metrite).

**Fonte:** Consenso veterinário geral sobre cetose de início de lactação — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 80

---

#### `MET-CETOSE-HALITO` — Hálito cetônico

```
SE hálito adocicado (cheiro de acetona)
ENTÃO diagnóstico = cetose (CF 0,80 — Provável)
```

**Por quê:** O hálito com cheiro adocicado (acetona) é um sinal bastante específico de cetose.

**Conduta:**

- Procure o médico-veterinário para confirmar e tratar.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 85

---

### Pós-parto e reprodutivas

#### `PP-RETENCAO-PLACENTA` — Retenção de placenta

```
SE dias em lactação (DEL) <= 30 E placenta retida por mais de 12 horas após o parto
ENTÃO diagnóstico = retencao_placenta (CF 0,90 — Muito provável)
```

**Por quê:** A placenta deve ser eliminada em até 12 horas após o parto. Passado esse prazo, considera-se retenção de placenta, que aumenta muito o risco de infecção do útero.

**Conduta:**

- NÃO puxe a placenta: isso machuca o útero e piora o quadro.
- Chame o médico-veterinário para avaliar a necessidade de tratamento.
- Acompanhe temperatura e apetite da vaca nos próximos dias.
- Anote o caso na ficha do animal: vacas com retenção repetida devem ser avaliadas para descarte.

**Fonte:** Consenso veterinário geral sobre puerpério bovino — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 80

---

#### `PP-METRITE` — Metrite / endometrite

```
SE dias em lactação (DEL) <= 45 E corrimento vulvar fétido ou achocolatado
ENTÃO diagnóstico = metrite (CF 0,85 — Muito provável)
```

**Por quê:** Corrimento vulvar fétido ou achocolatado no pós-parto indica infecção do útero.

**Conduta:**

- Chame o médico-veterinário: o tratamento costuma exigir antibiótico com prescrição.
- Atenção à carência do medicamento — o leite não poderá ir para o tanque durante o período indicado na bula.
- Verifique a higiene do local de parto.
- Acompanhe a reprodução desta vaca: metrite atrasa a próxima concepção.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 85

---

#### `PP-METRITE-SISTEMICA` — Metrite com comprometimento do estado geral

```
SE diagnóstico é metrite E (febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes OU apatia ou prostração)
ENTÃO diagnóstico = metrite (CF 0,70 — Provável)
```

**Por quê:** Quando há febre ou apatia junto do corrimento, a infecção já afeta o organismo todo e o atendimento passa a ser urgente.

**Conduta:**

- Atendimento veterinário com urgência — quadro sistêmico.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 90

---

#### `PP-RETENCAO-LEVA-METRITE` — Retenção de placenta aumenta o risco de metrite

```
SE diagnóstico é retencao_placenta
ENTÃO diagnóstico = metrite (CF 0,40 — Possível)
```

**Por quê:** A retenção de placenta é o principal fator de risco para metrite: a membrana retida serve de meio para os germes.

**Conduta:**

- Monitore diariamente temperatura e corrimento vulvar nas próximas duas semanas.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 50

---

### Digestivas

#### `DIG-DESLOC-ABOMASO` — Deslocamento de abomaso

```
SE dias em lactação (DEL) <= 30 E perda de apetite E queda súbita na produção de leite E fezes escassas ou pastosas
ENTÃO diagnóstico = deslocamento_abomaso (CF 0,75 — Provável)
```

**Por quê:** O deslocamento de abomaso é típico do primeiro mês após o parto: a vaca para de comer de repente, a produção despenca e as fezes ficam escassas e pastosas.

**Conduta:**

- CHAME O MÉDICO-VETERINÁRIO: a confirmação é feita pela auscultação (som de "ping") e o tratamento costuma ser cirúrgico.
- Não insista em forçar alimentação.
- Verifique também cetose — os dois problemas costumam andar juntos.
- Revise a dieta de transição (pré e pós-parto) com o técnico.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 88

---

#### `DIG-DA-COM-CETOSE` — Cetose concomitante reforça deslocamento de abomaso

```
SE diagnóstico é cetose E dias em lactação (DEL) <= 30 E fezes escassas ou pastosas
ENTÃO diagnóstico = deslocamento_abomaso (CF 0,50 — Possível)
```

**Por quê:** Cetose que não melhora, acompanhada de fezes escassas no primeiro mês de lactação, levanta forte suspeita de deslocamento de abomaso associado.

**Conduta:**

- Peça ao veterinário que ausculte o flanco em busca do som de "ping".

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 60

---

#### `DIG-SARA` — Acidose ruminal subaguda (SARA)

```
SE fezes líquidas e com bolhas E a vaca rumina menos que o normal
ENTÃO diagnóstico = acidose_ruminal (CF 0,70 — Provável)
```

**Por quê:** Fezes líquidas e com bolhas junto de pouca ruminação são sinais clássicos de acidez excessiva no rúmen, causada por excesso de concentrado e falta de fibra longa.

**Conduta:**

- Revise a dieta com o técnico: aumentar fibra longa efetiva e reduzir concentrado rapidamente fermentável.
- Verifique se o concentrado está sendo fornecido de uma vez só — parcele ao longo do dia.
- Acompanhe o teor de gordura do leite do tanque.
- Garanta acesso a volumoso de qualidade antes do concentrado.

**Fonte:** Consenso veterinário/zootécnico geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 75

---

#### `DIG-SARA-REFORCO` — Dieta e gordura do leite reforçam SARA

```
SE diagnóstico é acidose_ruminal E (dieta com muito concentrado e pouca fibra OU queda do teor de gordura do leite)
ENTÃO diagnóstico = acidose_ruminal (CF 0,60 — Provável)
```

**Por quê:** Dieta rica em concentrado e queda do teor de gordura do leite são as duas confirmações de rebanho mais usadas para acidose subaguda.

**Conduta:**

- Trate como problema de LOTE, não de animal isolado: avalie todas as vacas do grupo.

**Fonte:** Consenso veterinário/zootécnico geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 65

---

### Locomotor

#### `LOC-LAMINITE` — Laminite

```
SE manqueira (claudicação) E casco quente ou inchado E NÃO mau cheiro ou ferida entre os dedos
ENTÃO diagnóstico = laminite (CF 0,70 — Provável)
```

**Por quê:** Manqueira com casco quente e sem ferida infectada entre os dedos aponta para laminite, inflamação ligada à dieta (acidose) e ao piso em que o animal anda.

**Conduta:**

- Procure o médico-veterinário ou casqueador para avaliar e fazer o casqueamento corretivo.
- Reveja a dieta do lote com o técnico — laminite costuma vir junto de acidose ruminal.
- Avalie o piso: concreto áspero, pedras no caminho e longas distâncias até o pasto pioram o problema.
- Mantenha a vaca em piso macio enquanto se recupera.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 70

---

#### `LOC-PODODERMATITE` — Pododermatite / doença da linha branca

```
SE manqueira (claudicação) E mau cheiro ou ferida entre os dedos
ENTÃO diagnóstico = pododermatite (CF 0,80 — Provável)
```

**Por quê:** Mau cheiro e ferida entre os dedos, com manqueira, caracterizam infecção do casco (pododermatite).

**Conduta:**

- Procure o médico-veterinário: o tratamento envolve limpeza, curativo e muitas vezes antibiótico.
- Atenção à carência do medicamento para o leite.
- Avalie o uso de pedilúvio e a limpeza do curral e do caminho até o pasto.
- Isole o animal em piso seco até a melhora.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 75

---

#### `LOC-CLAUDICACAO-GERAL` — Manqueira sem causa definida

```
SE manqueira (claudicação) E NÃO casco quente ou inchado E NÃO mau cheiro ou ferida entre os dedos
ENTÃO diagnóstico = laminite (CF 0,35 — Possível)
```

**Por quê:** Há manqueira, mas sem os sinais que permitem separar laminite de infecção do casco. É preciso examinar o casco levantado.

**Conduta:**

- Levante o casco e examine a sola, com contenção adequada.
- Chame o casqueador ou o veterinário.
- Registre o escore de locomoção para acompanhar a evolução.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 40

---

### Parasitárias e infecciosas

#### `PAR-TRISTEZA` — Tristeza parasitária bovina

```
SE febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes E (mucosas pálidas (gengiva e olhos esbranquiçados) OU mucosas amareladas OU urina escura (cor de vinho ou café))
ENTÃO diagnóstico = tristeza_parasitaria (CF 0,75 — Provável)
```

**Por quê:** Febre com mucosas pálidas ou amareladas e urina escura é o quadro clássico de babesiose/anaplasmose, transmitidas pelo carrapato. A cartilha da Embrapa registra tristeza parasitária como causa real de morte em rebanho leiteiro.

**Conduta:**

- CHAME O MÉDICO-VETERINÁRIO COM URGÊNCIA: a doença evolui rápido e o tratamento precoce é decisivo.
- Faça controle estratégico de carrapatos no rebanho — é a orientação registrada na cartilha.
- Evite estresse e transporte do animal doente.
- Observe os demais animais do lote nos próximos dias.

**Fonte:** EMBRAPA. Administrando a propriedade leiteira, 2016, p. 23 (ficha de mortes: tristeza parasitária → "faça controle estratégico de carrapatos"). Quadro clínico: consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 90

---

#### `PAR-TRISTEZA-CARRAPATO` — Infestação por carrapatos reforça tristeza parasitária

```
SE diagnóstico é tristeza_parasitaria E muitos carrapatos no animal
ENTÃO diagnóstico = tristeza_parasitaria (CF 0,70 — Provável)
```

**Por quê:** A presença de muitos carrapatos no animal confirma a via de transmissão da tristeza parasitária.

**Conduta:**

- Implante controle estratégico de carrapatos em todo o rebanho, com orientação técnica.

**Fonte:** EMBRAPA, Administrando a propriedade leiteira, 2016, p. 23.

**Status:** ⚠️ a revisar · **Prioridade:** 65

---

#### `PAR-VERMINOSE` — Verminose

```
SE emagrecimento visível E mucosas pálidas (gengiva e olhos esbranquiçados) E NÃO febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes
ENTÃO diagnóstico = verminose (CF 0,60 — Provável)
```

**Por quê:** Emagrecimento com mucosas pálidas e sem febre sugere parasitismo interno, que causa anemia e queda de desempenho.

**Conduta:**

- Converse com o veterinário sobre exame de fezes e vermifugação estratégica.
- Inclua o controle de verminose no calendário sanitário do rebanho.
- Avalie o manejo de pastagem (lotação e rotação).

**Fonte:** EMBRAPA, Administrando a propriedade leiteira, 2016, p. 25 (calendário sanitário inclui verminose). Quadro clínico: consenso geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 55

---

#### `PAR-PNEUMONIA` — Pneumonia / problema respiratório

```
SE (tosse OU secreção nasal) E (respiração acelerada OU febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes)
ENTÃO diagnóstico = pneumonia (CF 0,75 — Provável)
```

**Por quê:** Tosse ou secreção nasal associadas a respiração acelerada ou febre caracterizam quadro respiratório.

**Conduta:**

- Procure o médico-veterinário: pode haver necessidade de antibiótico com prescrição.
- Atenção à carência do medicamento para o leite e para a carne.
- Melhore a ventilação e reduza a poeira no alojamento.
- Separe o animal dos demais enquanto estiver com sinais.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 80

---

### Notificação obrigatória

#### `NOT-AFTOSA` — Suspeita de febre aftosa

```
SE aftas ou bolhas na boca, língua, focinho, tetos ou entre os cascos E (salivação intensa (baba escorrendo) OU manqueira (claudicação) OU febre (temperatura acima de 39,5 °C) ou orelhas e focinho quentes)
ENTÃO diagnóstico = suspeita_aftosa (CF 0,70 — Provável)
```

**Por quê:** Aftas ou vesículas na boca, língua, focinho, tetos ou entre os cascos, acompanhadas de salivação intensa, manqueira ou febre, caracterizam suspeita de febre aftosa — doença de notificação obrigatória. Este sistema NÃO diagnostica a doença: apenas orienta a comunicação ao órgão oficial.

**Conduta:**

- COMUNIQUE IMEDIATAMENTE o serviço veterinário oficial do seu estado ou o MAPA. A notificação é obrigatória por lei.
- NÃO movimente animais para dentro nem para fora da propriedade.
- Isole os animais com sinais e restrinja a entrada de pessoas e veículos.
- Não descarte nem enterre carcaças antes da chegada da fiscalização.
- Verifique se o rebanho está com a vacinação contra aftosa em dia, conforme o calendário sanitário.

**Fonte:** Notificação obrigatória conforme legislação sanitária federal. EMBRAPA, Administrando a propriedade leiteira, 2016, p. 23 e 25 (febre aftosa como causa de morte; calendário de vacinação). Formalização: PENDENTE de validação com o serviço oficial.

**Status:** ⚠️ a revisar · **Prioridade:** 100

---

#### `NOT-RAIVA` — Suspeita de raiva

```
SE sinais nervosos (incoordenação, agressividade, mugido alterado, paralisia do trem posterior) E (salivação intensa (baba escorrendo) OU dificuldade para engolir)
ENTÃO diagnóstico = suspeita_raiva (CF 0,70 — Provável)
```

**Por quê:** Sinais nervosos — incoordenação, agressividade, mugido alterado, paralisia do trem posterior — acompanhados de salivação ou dificuldade de engolir levantam suspeita de raiva, que é ZOONOSE e doença de notificação obrigatória.

**Conduta:**

- RISCO DE ZOONOSE: não manipule o animal sem equipamento de proteção individual.
- Nunca coloque a mão na boca do animal para procurar corpo estranho.
- COMUNIQUE IMEDIATAMENTE o serviço veterinário oficial do seu estado.
- Isole o animal e afaste as pessoas.
- Se houve contato com saliva do animal em ferida ou mucosa, procure atendimento médico humano hoje.
- Verifique se o rebanho está com a vacinação antirrábica em dia.

**Fonte:** Notificação obrigatória conforme legislação sanitária federal. EMBRAPA, Administrando a propriedade leiteira, 2016, p. 25 (raiva no calendário sanitário). Formalização: PENDENTE de validação com o serviço oficial.

**Status:** ⚠️ a revisar · **Prioridade:** 100

---

### Bezerras

#### `BEZ-DIARREIA` — Diarreia neonatal

```
SE idade em dias <= 60 E fezes líquidas (diarreia)
ENTÃO diagnóstico = diarreia_neonatal (CF 0,85 — Muito provável)
```

**Por quê:** A diarreia é a principal causa de morte de bezerras. A cartilha da Embrapa registra diarreia como causa de morte em bezerra, com a orientação de verificar a qualidade higiênica do leite fornecido e limpar o bezerreiro.

**Conduta:**

- Ofereça soro de reidratação oral — o que mata na diarreia é a desidratação, não a diarreia em si.
- Verifique se o leite fornecido às bezerras está em boa qualidade higiênica.
- Limpe o bezerreiro e mantenha a cama seca.
- Não suspenda o leite: continue alimentando e acrescente o soro entre as mamadas.
- Separe a bezerra doente das demais.

**Fonte:** EMBRAPA. Administrando a propriedade leiteira, 2016, p. 23 (ficha de mortes: diarreia → "verifique se o leite fornecido para as bezerras está em boa qualidade higiênica e limpe o bezerreiro"). Conduta de reidratação: consenso geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 85

---

#### `BEZ-ONFALITE` — Onfalite (infecção de umbigo)

```
SE idade em dias <= 60 E umbigo inchado, quente ou dolorido
ENTÃO diagnóstico = onfalite (CF 0,85 — Muito provável)
```

**Por quê:** Umbigo inchado, quente e dolorido indica infecção pela porta de entrada do umbigo, geralmente por falha na cura no momento do nascimento.

**Conduta:**

- Procure o médico-veterinário: costuma exigir antibiótico.
- Revise o protocolo de cura do umbigo ao nascimento (imersão em solução adequada, repetida).
- Limpe e seque o local de parto e o bezerreiro.
- Acompanhe: a infecção pode se espalhar para articulações e fígado.

**Fonte:** Consenso veterinário geral — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 80

---

#### `BEZ-FALHA-COLOSTRO` — Falha na transferência de imunidade passiva

```
SE idade em dias <= 90 E NÃO recebeu colostro nas primeiras 6 horas de vida
ENTÃO diagnóstico = falha_transferencia_imunidade (CF 0,80 — Provável)
```

**Por quê:** A bezerra nasce sem defesas e só adquire anticorpos pelo colostro, que precisa ser fornecido em quantidade adequada nas primeiras horas de vida. Sem isso, ela fica muito mais sujeita a diarreia, onfalite e pneumonia.

**Conduta:**

- Trate esta bezerra como animal de alto risco: observe diariamente.
- Corrija o protocolo de colostragem para os próximos nascimentos: colostro de boa qualidade nas primeiras horas de vida.
- Inclua a conferência de colostro na triagem de recém-nascidas.
- Converse com o veterinário sobre a necessidade de medidas de apoio.

**Fonte:** Consenso veterinário geral sobre colostragem — PENDENTE de validação.

**Status:** ⚠️ a revisar · **Prioridade:** 70

---

### Indicadores de rebanho

#### `REB-MAST-CLIN-ALTA` — Mastite clínica acima de 2% no mês

```
SE % de mastite clínica no mês > 2
ENTÃO diagnóstico = rebanho_mastite_clinica_alta (CF 0,90 — Muito provável)
```

**Por quê:** O resultado esperado de mastite clínica em um rebanho não deve ser maior do que 2% ao mês. Acima disso, recomenda-se adotar um programa de controle de mastite.

**Conduta:**

- Adote um programa de controle de mastite para o rebanho, com apoio do médico-veterinário.
- Faça o teste da caneca de fundo escuro todos os dias, antes de cada ordenha, em todos os quartos.
- Garanta que toda vaca com mastite seja ordenhada por último.
- Reforce a lavagem das mãos do retireiro entre as vacas.
- Anote todos os novos casos, os curados, os que voltaram e os que não foram curados.

**Fonte:** EMBRAPA, Mastite, 2015, p. 38 (fórmula adaptada do National Mastitis Council; meta de 2%).

**Status:** ✅ validada · **Prioridade:** 85

---

#### `REB-MAST-SUB-ALTA` — Mastite subclínica acima de 20%

```
SE % de mastite subclínica > 20
ENTÃO diagnóstico = rebanho_mastite_subclinica_alta (CF 0,90 — Muito provável)
```

**Por quê:** O importante é que no máximo 20% das vacas apresentem mastite subclínica.

**Conduta:**

- Reveja a rotina de ordenha: lavagem e desinfecção dos tetos, secagem com papel-toalha individual.
- Repita o CMT ou faça a CCS pelo menos uma vez ao mês e anote os resultados.
- Separe o leite das vacas positivas do leite das sadias para reduzir a CCS do tanque.
- Identifique e avalie o descarte das vacas com mastite persistente.

**Fonte:** EMBRAPA, Mastite, 2015, p. 39 (meta de 20%).

**Status:** ✅ validada · **Prioridade:** 80

---

#### `REB-CMT-ATRASADO` — CMT do rebanho atrasado

```
SE dias desde o último teste de CMT no rebanho > 30
ENTÃO diagnóstico = rebanho_cmt_atrasado (CF 0,95 — Muito provável)
```

**Por quê:** O teste de CMT deve ser feito pelo menos uma vez ao mês, em todos os tetos das vacas em lactação, antes da ordenha.

**Conduta:**

- Programe o CMT mensal de todo o rebanho no calendário.
- Se a ordenha for com bezerro ao pé, faça o teste em todos os tetos antes de o bezerro apojar as vacas.

**Fonte:** EMBRAPA, Mastite, 2015, p. 23 e p. 25.

**Status:** ✅ validada · **Prioridade:** 60

---

#### `REB-VL-BAIXA` — Percentual de vacas em lactação abaixo do ideal

```
SE % de vacas em lactação < 83
ENTÃO diagnóstico = rebanho_vl_baixa (CF 0,80 — Provável)
```

**Por quê:** A média anual ideal é ter cerca de 83% das vacas em lactação. Este indicador mostra a eficiência reprodutiva da propriedade.

**Conduta:**

- Fique atento à alimentação e à reprodução das vacas.
- Mantenha a ficha de coberturas e inseminações em dia para não deixar vacas vazias por muito tempo.
- Avalie quais vacas têm problemas de reprodução e devem ser descartadas.

**Fonte:** EMBRAPA. Administrando a propriedade leiteira, 2016, p. 46 e p. 49.

**Status:** ✅ validada · **Prioridade:** 50

---

## 2.5 Perguntas

O custo indica o esforço para obter a resposta: 1 = observação direta, 3 = exige manejo ou
contenção, 5 = exame laboratorial. O motor divide o ganho esperado pelo custo, e por isso
pergunta "o leite tem grumos?" antes de pedir uma CCS de laboratório.

| Variável | Pergunta | Tipo | Custo |
|---|---|---|---|
| `caneca_grumos` | Nos primeiros jatos, o leite apresenta grumos ou pus? | boolean | 1 |
| `caneca_cor_alterada` | O leite está com a cor alterada (amarelada ou avermelhada)? | boolean | 1 |
| `caneca_consistencia_alterada` | O leite está com a consistência alterada (mais aguado ou mais grosso que o normal)? | boolean | 1 |
| `palpacao_dor` | A vaca sente dor quando você toca alguma parte da mama? | boolean | 1 |
| `palpacao_inchaco` | Há inchaço em alguma parte da mama? | boolean | 1 |
| `palpacao_endurecido` | Há alguma área endurecida na mama? | boolean | 1 |
| `palpacao_vermelhidao` | Alguma parte da mama está avermelhada? | boolean | 1 |
| `ubere_aumento_tamanho` | O úbere está visivelmente aumentado de tamanho? | boolean | 1 |
| `nao_deixa_ordenhar` | A vaca não se deixa ordenhar? | boolean | 1 |
| `caroco_apos_ordenha` | Depois da ordenha, você sente caroços ou áreas endurecidas dentro de algum quarto? | boolean | 1 |
| `quarto_sem_leite` | Algum quarto mamário não produz mais leite? | boolean | 1 |
| `cmt_pior_quarto` | Qual o resultado do teste de CMT? | por_quarto | 3 |
| `ccs_individual` | Qual a Contagem de Células Somáticas (CCS) individual desta vaca? | numero | 5 |
| `febre` | A vaca está com febre (acima de 39,5 °C) ou com orelhas e focinho quentes? | boolean | 3 |
| `apetite_reduzido` | A vaca está comendo menos que o normal? | boolean | 1 |
| `apatia` | A vaca está apática, parada, cabeça baixa, diferente do normal? | boolean | 1 |
| `desidratacao` | A vaca apresenta sinais de desidratação (olhos fundos, prega de pele que demora a voltar)? | boolean | 1 |
| `queda_producao_subita` | Houve queda súbita na produção de leite desta vaca? | boolean | 1 |
| `decubito` | A vaca está caída e não consegue levantar? | boolean | 1 |
| `extremidades_frias` | As orelhas e as patas estão frias? | boolean | 1 |
| `tremores_musculares` | A vaca apresenta tremores musculares? | boolean | 1 |
| `halito_adocicado` | O hálito da vaca está adocicado (cheiro de acetona ou de maçã passada)? | boolean | 1 |
| `perda_escore_corporal` | A vaca está emagrecendo de forma visível? | boolean | 1 |
| `placenta_retida_12h` | A placenta ficou retida por mais de 12 horas após o parto? | boolean | 1 |
| `corrimento_vulvar_fetido` | Há corrimento pela vulva com cheiro ruim ou cor achocolatada? | boolean | 1 |
| `fezes_escassas` | As fezes estão escassas ou mais pastosas que o normal? | boolean | 1 |
| `fezes_liquidas_bolhosas` | As fezes estão líquidas e com bolhas? | boolean | 1 |
| `ruminacao_reduzida` | A vaca está ruminando menos que o normal? | boolean | 1 |
| `flanco_esquerdo_distendido` | O flanco esquerdo está estufado? | boolean | 1 |
| `dieta_muito_concentrado` | A dieta do lote tem muito concentrado e pouca fibra longa? | boolean | 1 |
| `queda_gordura_leite` | Houve queda no teor de gordura do leite do rebanho? | boolean | 3 |
| `claudicacao` | A vaca está mancando? | boolean | 1 |
| `casco_quente_inchado` | Algum casco está quente ou inchado? | boolean | 3 |
| `mau_cheiro_casco` | Há mau cheiro ou ferida entre os dedos? | boolean | 3 |
| `mucosas_palidas` | As mucosas (gengiva e ao redor dos olhos) estão pálidas? | boolean | 1 |
| `mucosas_amareladas` | As mucosas estão amareladas? | boolean | 1 |
| `urina_escura` | A urina está escura, cor de vinho ou de café? | boolean | 1 |
| `infestacao_carrapatos` | O animal está com muitos carrapatos? | boolean | 1 |
| `tosse` | O animal está tossindo? | boolean | 1 |
| `secrecao_nasal` | Há secreção saindo pelo nariz? | boolean | 1 |
| `respiracao_acelerada` | A respiração está acelerada? | boolean | 1 |
| `vesiculas_boca_tetos_cascos` | Há aftas ou bolhas na boca, na língua, no focinho, nos tetos ou entre os cascos? | boolean | 3 |
| `salivacao_intensa` | A vaca está babando muito, com saliva escorrendo? | boolean | 1 |
| `sinais_nervosos` | O animal apresenta sinais nervosos (incoordenação, agressividade, mugido alterado, paralisia do trem traseiro)? | boolean | 1 |
| `dificuldade_deglutir` | O animal tem dificuldade para engolir? | boolean | 1 |
| `fezes_liquidas` | A bezerra está com fezes líquidas (diarreia)? | boolean | 1 |
| `umbigo_inchado_quente` | O umbigo da bezerra está inchado, quente ou dolorido? | boolean | 1 |
| `colostro_primeiras_6h` | A bezerra recebeu colostro nas primeiras 6 horas de vida? | boolean | 1 |

## 2.6 Changelog

### v1.0.0 — 2026-10-21

Base inicial. Grupo 02 (mastite) extraído integralmente de EMBRAPA, 'Como identificar a vaca com mastite em sua propriedade' (2015), com página citada por regra — status 'validada'. Grupos 03 a 09 formalizados a partir de consenso veterinário geral, marcados como 'revisar' até conferência com fonte primária. Grupo 10 (indicadores de rebanho) usa as fórmulas e metas das duas cartilhas Embrapa.
