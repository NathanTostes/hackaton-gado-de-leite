# 5. Casos de teste

> **Documento gerado automaticamente.** Rode `npm run docs` para atualizar.

*"Defina casos de teste com resultado esperado junto com o conhecimento do domínio e valide
cada versão da base"* — diretriz explícita do regulamento do Hackathon.

**28 de 28 casos passam** contra a base v1.0.0.

Os mesmos casos rodam em três lugares: na suíte automatizada (`npm test`), no CI local antes
de qualquer alteração na base, e **dentro do próprio aplicativo**, na tela "Base de
conhecimento" — onde qualquer pessoa pode apertar um botão e ver o resultado.

## 5.1 Resumo

| Caso | Descrição | Esperado | Obtido | Resultado |
|---|---|---|---|---|
| `CASO-MAST-001` | Grumos nos primeiros jatos, mama sem alteração à palpação | mastite_clinica_g1 | mastite_clinica_g1 (CF 0.95) | ✅ |
| `CASO-MAST-002` | Leite amarelado, sem grumos e sem alteração à palpação | mastite_clinica_g1 | mastite_clinica_g1 (CF 0.95) | ✅ |
| `CASO-MAST-003` | Vaca com grumos no leite, úbere dolorido e inchado, sem febre | mastite_clinica_g2 | mastite_clinica_g2 (CF 0.85) | ✅ |
| `CASO-MAST-004` | Mastite clínica grau 3: grumos, dor e febre — emergência | mastite_clinica_g3 | mastite_clinica_g3 (CF 0.81) | ✅ |
| `CASO-MAST-005` | CMT negativo (N) isolado não deve concluir mastite | _nenhuma conclusão_ | _nenhuma conclusão_ | ✅ |
| `CASO-MAST-006` | CMT com traços (T) — negativo, mas sinaliza acompanhamento | mastite_subclinica | mastite_subclinica (CF 0.30) | ✅ |
| `CASO-MAST-007` | CMT uma cruz (+) — mastite subclínica | mastite_subclinica | mastite_subclinica (CF 0.85) | ✅ |
| `CASO-MAST-008` | CMT duas cruzes (++) — mastite subclínica | mastite_subclinica | mastite_subclinica (CF 0.90) | ✅ |
| `CASO-MAST-009` | CMT três cruzes (+++) — mastite subclínica forte | mastite_subclinica | mastite_subclinica (CF 0.95) | ✅ |
| `CASO-MAST-010` | CCS individual de 350.000 células/mL — acima do limite de 200.000 | mastite_subclinica | mastite_subclinica (CF 0.90) | ✅ |
| `CASO-MAST-011` | CCS individual de 150.000 células/mL — dentro do limite | _nenhuma conclusão_ | _nenhuma conclusão_ | ✅ |
| `CASO-MAST-012` | CMT positivo há 4 meses na mesma lactação — mastite crônica | mastite_cronica | mastite_cronica (CF 0.85) | ✅ |
| `CASO-MAST-013` | Quarto mamário que não produz mais leite — peito perdido | peito_perdido | peito_perdido (CF 0.95) | ✅ |
| `CASO-REB-001` | Exemplo da cartilha: 4,8% de mastite clínica no mês (acima da meta de 2%) | rebanho_mastite_clinica_alta | rebanho_mastite_clinica_alta (CF 0.90) | ✅ |
| `CASO-REB-002` | 25% de mastite subclínica — acima da meta de 20% | rebanho_mastite_subclinica_alta | rebanho_mastite_subclinica_alta (CF 0.90) | ✅ |
| `CASO-REB-003` | 15% de mastite subclínica — dentro da meta | _nenhuma conclusão_ | _nenhuma conclusão_ | ✅ |
| `CASO-MET-001` | Vaca de 3ª cria, 1 dia pós-parto, caída, sem febre, extremidades frias | hipocalcemia | hipocalcemia (CF 1.00) | ✅ |
| `CASO-MET-002` | Vaca com 25 DEL, comendo pouco, emagrecendo, hálito adocicado | cetose | cetose (CF 0.94) | ✅ |
| `CASO-DIG-001` | Lote com fezes líquidas e bolhosas, pouca ruminação, muito concentrado | acidose_ruminal | acidose_ruminal (CF 1.00) | ✅ |
| `CASO-LOC-001` | Vaca mancando, com mau cheiro entre os dedos | pododermatite | pododermatite (CF 0.80) | ✅ |
| `CASO-PAR-001` | Febre, mucosas amareladas, urina escura e muitos carrapatos | tristeza_parasitaria | tristeza_parasitaria (CF 1.00) | ✅ |
| `CASO-NOT-001` | Aftas na boca e nos tetos com salivação intensa — notificação obrigatória | suspeita_aftosa | suspeita_aftosa (CF 0.70) | ✅ |
| `CASO-NOT-002` | Sinais nervosos com dificuldade de engolir — suspeita de raiva (zoonose) | suspeita_raiva | suspeita_raiva (CF 0.70) | ✅ |
| `CASO-BEZ-001` | Bezerra de 10 dias com diarreia e sinais de desidratação | diarreia_neonatal | diarreia_neonatal (CF 1.00) | ✅ |
| `CASO-BEZ-002` | Bezerra de 5 dias que não recebeu colostro nas primeiras 6 horas | falha_transferencia_imunidade | falha_transferencia_imunidade (CF 0.80) | ✅ |
| `CASO-NEG-001` | Vaca sadia: nenhum sinal encontrado na triagem | sem_alteracao | sem_alteracao (CF 0.85) | ✅ |
| `CASO-NEG-002` | Vaca clinicamente normal, mas com CMT ++ — a subclínica só aparece no teste | mastite_subclinica | mastite_subclinica (CF 0.90) | ✅ |
| `CASO-AMB-001` | Caso ambíguo: 20 DEL, come pouco, produção caiu e fezes escassas — abomaso ou cetose? | deslocamento_abomaso | deslocamento_abomaso (CF 0.84) | ✅ |

## 5.2 Detalhe de cada caso

### `CASO-MAST-001` — Grumos nos primeiros jatos, mama sem alteração à palpação

**Fatos de entrada:**

```json
{
  "caneca_grumos": true,
  "caneca_cor_alterada": false,
  "caneca_consistencia_alterada": false,
  "palpacao_dor": false,
  "palpacao_inchaco": false,
  "palpacao_endurecido": false,
  "palpacao_vermelhidao": false
}
```

**Regras disparadas:** `MAST-CLIN-G1`

**Hipóteses resultantes:** mastite_clinica_g1 (0.95)

**Resultado:** ✅ passou

---

### `CASO-MAST-002` — Leite amarelado, sem grumos e sem alteração à palpação

**Fatos de entrada:**

```json
{
  "caneca_grumos": false,
  "caneca_cor_alterada": true,
  "caneca_consistencia_alterada": false,
  "palpacao_dor": false,
  "palpacao_inchaco": false,
  "palpacao_endurecido": false,
  "palpacao_vermelhidao": false
}
```

**Regras disparadas:** `MAST-CLIN-G1`

**Hipóteses resultantes:** mastite_clinica_g1 (0.95)

**Resultado:** ✅ passou

---

### `CASO-MAST-003` — Vaca com grumos no leite, úbere dolorido e inchado, sem febre

**Fatos de entrada:**

```json
{
  "caneca_grumos": true,
  "palpacao_dor": true,
  "palpacao_inchaco": true,
  "febre": false,
  "apetite_reduzido": false
}
```

**Regras disparadas:** `MAST-CLIN-G1`, `MAST-CLIN-G2`

**Hipóteses resultantes:** mastite_clinica_g2 (0.85)

**Resultado:** ✅ passou

---

### `CASO-MAST-004` — Mastite clínica grau 3: grumos, dor e febre — emergência

**Fatos de entrada:**

```json
{
  "caneca_grumos": true,
  "palpacao_dor": true,
  "febre": true
}
```

**Regras disparadas:** `MAST-CLIN-G1`, `MAST-CLIN-G2`, `MAST-CLIN-G3`

**Hipóteses resultantes:** mastite_clinica_g3 (0.81)

**Resultado:** ✅ passou

---

### `CASO-MAST-005` — CMT negativo (N) isolado não deve concluir mastite

**Fatos de entrada:**

```json
{
  "cmt_pior_quarto": "N"
}
```

**Regras disparadas:** —

**Hipóteses resultantes:** —

**Resultado:** ✅ passou

---

### `CASO-MAST-006` — CMT com traços (T) — negativo, mas sinaliza acompanhamento

**Fatos de entrada:**

```json
{
  "cmt_pior_quarto": "T"
}
```

**Regras disparadas:** `MAST-SUB-CMT-TRACOS`

**Hipóteses resultantes:** mastite_subclinica (0.30)

**Resultado:** ✅ passou

---

### `CASO-MAST-007` — CMT uma cruz (+) — mastite subclínica

**Fatos de entrada:**

```json
{
  "cmt_pior_quarto": "1"
}
```

**Regras disparadas:** `MAST-SUB-CMT-1`

**Hipóteses resultantes:** mastite_subclinica (0.85)

**Resultado:** ✅ passou

---

### `CASO-MAST-008` — CMT duas cruzes (++) — mastite subclínica

**Fatos de entrada:**

```json
{
  "cmt_pior_quarto": "2"
}
```

**Regras disparadas:** `MAST-SUB-CMT-2`

**Hipóteses resultantes:** mastite_subclinica (0.90)

**Resultado:** ✅ passou

---

### `CASO-MAST-009` — CMT três cruzes (+++) — mastite subclínica forte

**Fatos de entrada:**

```json
{
  "cmt_pior_quarto": "3"
}
```

**Regras disparadas:** `MAST-SUB-CMT-3`

**Hipóteses resultantes:** mastite_subclinica (0.95)

**Resultado:** ✅ passou

---

### `CASO-MAST-010` — CCS individual de 350.000 células/mL — acima do limite de 200.000

**Fatos de entrada:**

```json
{
  "ccs_individual": 350000
}
```

**Regras disparadas:** `MAST-SUB-CCS`

**Hipóteses resultantes:** mastite_subclinica (0.90)

**Resultado:** ✅ passou

---

### `CASO-MAST-011` — CCS individual de 150.000 células/mL — dentro do limite

**Fatos de entrada:**

```json
{
  "ccs_individual": 150000
}
```

**Regras disparadas:** —

**Hipóteses resultantes:** —

**Resultado:** ✅ passou

---

### `CASO-MAST-012` — CMT positivo há 4 meses na mesma lactação — mastite crônica

**Fatos de entrada:**

```json
{
  "cmt_pior_quarto": "2",
  "cmt_positivo_meses": 4
}
```

**Regras disparadas:** `MAST-CRONICA`, `MAST-SUB-CMT-2`

**Hipóteses resultantes:** mastite_cronica (0.85)

**Resultado:** ✅ passou

---

### `CASO-MAST-013` — Quarto mamário que não produz mais leite — peito perdido

**Fatos de entrada:**

```json
{
  "quarto_sem_leite": true
}
```

**Regras disparadas:** `MAST-PP`

**Hipóteses resultantes:** peito_perdido (0.95)

**Resultado:** ✅ passou

---

### `CASO-REB-001` — Exemplo da cartilha: 4,8% de mastite clínica no mês (acima da meta de 2%)

**Fatos de entrada:**

```json
{
  "perc_mastite_clinica_mes": 4.8
}
```

**Regras disparadas:** `REB-MAST-CLIN-ALTA`

**Hipóteses resultantes:** rebanho_mastite_clinica_alta (0.90)

**Resultado:** ✅ passou

---

### `CASO-REB-002` — 25% de mastite subclínica — acima da meta de 20%

**Fatos de entrada:**

```json
{
  "perc_mastite_subclinica": 25
}
```

**Regras disparadas:** `REB-MAST-SUB-ALTA`

**Hipóteses resultantes:** rebanho_mastite_subclinica_alta (0.90)

**Resultado:** ✅ passou

---

### `CASO-REB-003` — 15% de mastite subclínica — dentro da meta

**Fatos de entrada:**

```json
{
  "perc_mastite_subclinica": 15,
  "perc_mastite_clinica_mes": 1.2
}
```

**Regras disparadas:** —

**Hipóteses resultantes:** —

**Resultado:** ✅ passou

---

### `CASO-MET-001` — Vaca de 3ª cria, 1 dia pós-parto, caída, sem febre, extremidades frias

**Fatos de entrada:**

```json
{
  "del": 1,
  "numero_lactacao": 3,
  "decubito": true,
  "febre": false,
  "extremidades_frias": true
}
```

**Regras disparadas:** `MET-HIPOCALCEMIA`, `MET-HIPOCALCEMIA-REFORCO`, `MET-HIPOCALCEMIA-REFORCO`, `MET-HIPOCALCEMIA-REFORCO`, `MET-HIPOCALCEMIA-REFORCO`, `MET-HIPOCALCEMIA-REFORCO`, `MET-HIPOCALCEMIA-REFORCO`, `MET-HIPOCALCEMIA-REFORCO`, `MET-HIPOCALCEMIA-REFORCO`, `MET-HIPOCALCEMIA-REFORCO`

**Hipóteses resultantes:** hipocalcemia (1.00)

**Resultado:** ✅ passou

---

### `CASO-MET-002` — Vaca com 25 DEL, comendo pouco, emagrecendo, hálito adocicado

**Fatos de entrada:**

```json
{
  "del": 25,
  "apetite_reduzido": true,
  "perda_escore_corporal": true,
  "halito_adocicado": true,
  "fezes_escassas": false,
  "queda_producao_subita": false
}
```

**Regras disparadas:** `MET-CETOSE`, `MET-CETOSE-HALITO`

**Hipóteses resultantes:** cetose (0.94)

**Resultado:** ✅ passou

---

### `CASO-DIG-001` — Lote com fezes líquidas e bolhosas, pouca ruminação, muito concentrado

**Fatos de entrada:**

```json
{
  "fezes_liquidas_bolhosas": true,
  "ruminacao_reduzida": true,
  "dieta_muito_concentrado": true
}
```

**Regras disparadas:** `DIG-SARA`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`, `DIG-SARA-REFORCO`

**Hipóteses resultantes:** acidose_ruminal (1.00)

**Resultado:** ✅ passou

---

### `CASO-LOC-001` — Vaca mancando, com mau cheiro entre os dedos

**Fatos de entrada:**

```json
{
  "claudicacao": true,
  "mau_cheiro_casco": true,
  "casco_quente_inchado": false
}
```

**Regras disparadas:** `LOC-PODODERMATITE`

**Hipóteses resultantes:** pododermatite (0.80)

**Resultado:** ✅ passou

---

### `CASO-PAR-001` — Febre, mucosas amareladas, urina escura e muitos carrapatos

**Fatos de entrada:**

```json
{
  "febre": true,
  "mucosas_amareladas": true,
  "urina_escura": true,
  "infestacao_carrapatos": true
}
```

**Regras disparadas:** `PAR-TRISTEZA`, `PAR-TRISTEZA-CARRAPATO`, `PAR-TRISTEZA-CARRAPATO`, `PAR-TRISTEZA-CARRAPATO`, `PAR-TRISTEZA-CARRAPATO`, `PAR-TRISTEZA-CARRAPATO`, `PAR-TRISTEZA-CARRAPATO`, `PAR-TRISTEZA-CARRAPATO`, `PAR-TRISTEZA-CARRAPATO`, `PAR-TRISTEZA-CARRAPATO`

**Hipóteses resultantes:** tristeza_parasitaria (1.00)

**Resultado:** ✅ passou

---

### `CASO-NOT-001` — Aftas na boca e nos tetos com salivação intensa — notificação obrigatória

**Fatos de entrada:**

```json
{
  "vesiculas_boca_tetos_cascos": true,
  "salivacao_intensa": true
}
```

**Regras disparadas:** `NOT-AFTOSA`

**Hipóteses resultantes:** suspeita_aftosa (0.70)

**Resultado:** ✅ passou

---

### `CASO-NOT-002` — Sinais nervosos com dificuldade de engolir — suspeita de raiva (zoonose)

**Fatos de entrada:**

```json
{
  "sinais_nervosos": true,
  "dificuldade_deglutir": true
}
```

**Regras disparadas:** `NOT-RAIVA`

**Hipóteses resultantes:** suspeita_raiva (0.70)

**Resultado:** ✅ passou

---

### `CASO-BEZ-001` — Bezerra de 10 dias com diarreia e sinais de desidratação

**Fatos de entrada:**

```json
{
  "idade_dias": 10,
  "fezes_liquidas": true,
  "desidratacao": true,
  "colostro_primeiras_6h": true,
  "umbigo_inchado_quente": false
}
```

**Regras disparadas:** `BEZ-DIARREIA`, `BEZ-DIARREIA-GRAVE`, `BEZ-DIARREIA-GRAVE`, `BEZ-DIARREIA-GRAVE`, `BEZ-DIARREIA-GRAVE`, `BEZ-DIARREIA-GRAVE`, `BEZ-DIARREIA-GRAVE`, `BEZ-DIARREIA-GRAVE`

**Hipóteses resultantes:** diarreia_neonatal (1.00)

**Resultado:** ✅ passou

---

### `CASO-BEZ-002` — Bezerra de 5 dias que não recebeu colostro nas primeiras 6 horas

**Fatos de entrada:**

```json
{
  "idade_dias": 5,
  "colostro_primeiras_6h": false,
  "fezes_liquidas": false,
  "umbigo_inchado_quente": false
}
```

**Regras disparadas:** `BEZ-FALHA-COLOSTRO`

**Hipóteses resultantes:** falha_transferencia_imunidade (0.80)

**Resultado:** ✅ passou

---

### `CASO-NEG-001` — Vaca sadia: nenhum sinal encontrado na triagem

**Fatos de entrada:**

```json
{
  "caneca_grumos": false,
  "caneca_cor_alterada": false,
  "caneca_consistencia_alterada": false,
  "palpacao_dor": false,
  "palpacao_inchaco": false,
  "febre": false,
  "apetite_reduzido": false,
  "apatia": false,
  "claudicacao": false,
  "queda_producao_subita": false
}
```

**Regras disparadas:** `TRI-SEM-ALTERACAO`

**Hipóteses resultantes:** sem_alteracao (0.85)

**Resultado:** ✅ passou

---

### `CASO-NEG-002` — Vaca clinicamente normal, mas com CMT ++ — a subclínica só aparece no teste

**Fatos de entrada:**

```json
{
  "caneca_grumos": false,
  "caneca_cor_alterada": false,
  "caneca_consistencia_alterada": false,
  "palpacao_dor": false,
  "palpacao_inchaco": false,
  "febre": false,
  "apetite_reduzido": false,
  "apatia": false,
  "claudicacao": false,
  "queda_producao_subita": false,
  "cmt_pior_quarto": "2"
}
```

**Regras disparadas:** `TRI-SEM-ALTERACAO`, `MAST-SUB-CMT-2`

**Hipóteses resultantes:** mastite_subclinica (0.90), sem_alteracao (0.85)

**Resultado:** ✅ passou

---

### `CASO-AMB-001` — Caso ambíguo: 20 DEL, come pouco, produção caiu e fezes escassas — abomaso ou cetose?

**Fatos de entrada:**

```json
{
  "del": 20,
  "apetite_reduzido": true,
  "queda_producao_subita": true,
  "fezes_escassas": true
}
```

**Regras disparadas:** `DIG-DESLOC-ABOMASO`, `MET-CETOSE`, `DIG-DA-COM-CETOSE`

**Hipóteses resultantes:** deslocamento_abomaso (0.84), cetose (0.70)

**Resultado:** ✅ passou

---

## 5.3 Cobertura

Os casos cobrem, no mínimo: os três graus de mastite clínica; mastite subclínica por CMT em
cada nível da escala (T, +, ++, +++); subclínica por CCS acima e abaixo de 200.000; mastite
crônica; peito perdido; o exemplo impresso de 4,8% de mastite clínica da cartilha; mastite
subclínica acima e abaixo da meta de 20%; um caso de cada grupo clínico; dois casos de
notificação obrigatória; dois casos de bezerra; **dois casos negativos** — o sistema precisa
saber dizer "não encontrei alteração" — e um caso deliberadamente ambíguo, em que duas
hipóteses ficam próximas e o parecer traz as duas.
