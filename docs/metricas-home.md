# Métricas da página Home (`app/routes/home.tsx`)

Este documento explica **para que serve** cada ideia financeira na home, **o conceito** usado em gestão e contabilidade (em linguagem de operação), e **como o código** calcula — incluindo referência a `~/utils/financeiro.ts` (`calcularSaudeFinanceira`).

---

## Como ler este documento

- **Conceito**: definição e intenção de negócio.  
- **Para que serve**: decisão ou leitura que a métrica apoia.  
- **No sistema**: filtros, fórmulas e nomes de variáveis no app.

---

## 1. Escopo do período e filtros

### Conceito

Todas as métricas principais olham para um **mês de competência** (receitas, compras e despesas cuja **data** cai naquele mês). Comparar com o **mês anterior** mostra tendência (cresceu ou caiu).

### Para que serve

Garantir que você analise **um período fechado** e veja **evolução** mês a mês, sem misturar meses diferentes.

### No sistema

| Conceito | Regra |
|----------|--------|
| **Mês/ano exibido** | `useMesAnoContext()` ou `mesAno` do loader (mês atual). |
| **Receitas e Compras** | `filtrarPorMesAno` pela data do lançamento. |
| **Despesas** | Só despesas **pagas** (`pago === true`), mesmo mês/ano. |
| **Mês anterior** | `obterMesAnoAnterior` — base das variações % e do lucro anterior. |
| **Gráfico** | Chaves diárias em `America/Sao_Paulo` (`formatarChaveData`). |

**Observação:** usar só despesas **pagas** aproxima uma visão de **caixa** nas despesas; receitas e compras seguem a **data do registro** no módulo (alinhamento com competência depende de como vocês lançam).

---

## 2. Receitas (card)

### Conceito

**Faturamento** do período: quanto a operação **reconheceu** como entrada de vendas/serviços naquele mês (conforme datas dos lançamentos de receita).

### Para que serve

Medir **capacidade de gerar dinheiro** com vendas; base para margens, lucro e ponto de equilíbrio. É o “teto” antes de descontar custos e despesas.

### No sistema

- `totais.receitas` = soma dos `valor` das receitas filtradas no mês.  
- `totais.receitasAnterior` = mesmo para o mês anterior.  
- **Badge %**: `variacaoReceitas` = crescimento ou queda vs mês anterior.

---

## 3. Despesas (card)

### Conceito

**Total de despesas pagas** no mês: soma de tudo que entrou como despesa (fixas + variáveis), **incluindo** lançamentos na conta **Revenda** quando existirem.

### Para que serve

Ver **quanto saiu** pelo módulo de despesas no período — útil para controle de gastos e comparação com outros meses. **Não** é o mesmo conjunto usado no lucro da home (lá entram **Compras NF** e **Revenda** é tratada de outra forma para não duplicar mercadoria).

### No sistema

- `totais.despesas` / `despesasAnterior`.  
- **Badge %**: `variacaoDespesas`.

---

## 4. Compras (card)

### Conceito

Total registrado no módulo **Compras** (ex.: notas fiscais de mercadoria). Representa **aquisição de estoque/mercadoria** naquele mês, como fluxo de compra.

### Para que serve

Acompanhar **volume de compras** e cruzar com receitas e estoque. No app, esse total entra como principal proxy de **custo de mercadoria no mês** no **lucro líquido** (visão “quanto comprei no período”).

### No sistema

- `totais.compras` / `comprasAnterior`.  
- **Badge %**: `variacaoCompras`.

---

## 5. Fixas vs variáveis (conceito de custo)

### Conceito

- **Despesas fixas**: tendem a existir **independente** do volume de vendas (aluguel, salários estáveis, assinaturas).  
- **Despesas variáveis**: **acompanham** a operação (comissões, frete proporcional, insumos que sobem com venda — na prática depende de como vocês classificam cada conta).

### Para que serve

Separar o que é **estrutura** (fixo) do que **muda com a atividade** (variável). O **ponto de equilíbrio** e a **margem de contribuição** usam essa separação.

### No sistema

- `tipo === "fixo"` → `despesasFixas`.  
- `tipo === "variavel"` → entra em `despesasVariaveis`; para o lucro, a conta **Revenda** é **excluída** da soma de variáveis porque o custo de mercadoria entra por **Compras NF** (`totais.despesasVariaveis` = variáveis − Revenda).

---

## 6. Revenda vs Compras NF (por que duas “fontes” de mercadoria)

### Conceito

Às vezes a mesma realidade econômica (compra de mercadoria) aparece como **NF no módulo Compras** e/ou como **despesa na conta Revenda**. Contar **os dois** no mesmo resultado **infla** o custo.

### Para que serve

O app **escolhe uma lógica**: no lucro operacional, **Compras NF** representa mercadoria e **Revenda** sai da parcela “variáveis” para evitar **dupla contagem**.

### No sistema

- `despesasCompras` = filtro `conta === "Revenda"`.  
- `totais.despesasVariaveis` = soma variáveis **menos** Revenda.

---

## 7. Agregações em `totais` (referência rápida)

Todas são **somas** (`somarValores`).

| Campo | Significado no código |
|-------|------------------------|
| `receitas` / `receitasAnterior` | Receitas do mês / mês anterior. |
| `compras` / `comprasAnterior` | Compras (NF) do mês / anterior. |
| `despesas` / `despesasAnterior` | Todas as despesas pagas (inclui Revenda). |
| `despesasVariaveis` | Variáveis do mês **sem** Revenda. |
| `despesasFixas` / `*_Anterior` | Fixas atual e anterior. |
| `despesasVariaveisAnterior` | Variáveis do mês anterior **com** Revenda (ver § 12). |
| `despesasCompras` | Só Revenda. |

---

## 8. Variação percentual (badges)

### Conceito

**Taxa de variação** do valor atual em relação ao mês anterior: “cresceu X% ou caiu Y%”.

### Para que serve

Leitura rápida de **momentum** (melhor ou pior que o mês passado). Não diz se o nível absoluto é bom — só **direção relativa**.

### No sistema

```
variacao = ((atual - anterior) / anterior) * 100
```

- `anterior === 0` e `atual !== 0` → **100** (evita divisão por zero).  
- Ambos zero → **0**.

Aplicada a receitas, compras, despesas e **lucro líquido** (`variacaoLucroLiquido`).

**No card de Lucro líquido**, a badge é essa **variação mês a mês**, **não** a lucratividade do mês.

---

## 9. Margem de contribuição

### Conceito

Quanto **sobra** das receitas depois de pagar os **custos variáveis** considerados no modelo (aqui: **Compras NF** + **outras variáveis sem Revenda**), **antes** das despesas fixas. Em custeio variável, é a base que “paga” o fixo e gera lucro.

### Para que serve

Responder: **cada real de venda deixa quanto para cobrir estrutura e lucro?** Margem % alta (sobre receita) indica mais folga para absorver fixos.

### No sistema

```
margemRS = faturamento - (compras + variaveis)
margemContribuicaoPerc = (margemRS / faturamento) * 100  → exibido como "Margem por produto" no rodapé do card Ponto de equilíbrio
```

(`variaveis` = `totais.despesasVariaveis`.)

---

## 10. Lucro líquido (card) e lucratividade

### Conceito

**Resultado operacional simplificado** na base escolhida pelo sistema: receitas menos **compras no período (NF)**, menos **variáveis (sem Revenda)**, menos **fixas**. Não é necessariamente o lucro líquido contábil completo (sem impostos finais, não operacional, etc.), mas um **indicador de gestão** alinhado aos cards Receitas e Compras.

### Para que serve

Ver se o mês **fecha positivo ou negativo** com a mesma lógica que você usa para compras e despesas classificadas no app.

### No sistema

```
margemRS = faturamento - (compras + variaveis)
lucroLiquido = margemRS - fixas
```

- Card: `saudeFinanceira.lucroLiquido` (= `calcularLucroLiquido` com totais do mês).  
- **Lucratividade** (rodapé): `(lucroLiquido / faturamento) * 100` — **margem sobre receita**, não variação vs mês anterior.

---

## 11. Ponto de equilíbrio

### Conceito

**Faturamento mínimo** (na mesma estrutura de custos) em que a **margem de contribuição** igualaria as **despesas fixas** — ponto em que, nesse modelo, **não haveria lucro nem prejuízo** operacional.

### Para que serve

Meta de **volume de vendas** para “pagar a estrutura”. Acima desse valor (se a margem % se mantiver), sobra contribuição para lucro; abaixo, as fixas não são cobertas pela margem.

### No sistema

```
margemPerc = margemRS / faturamento   (se faturamento > 0)
pontoEquilibrio = fixas / margemPerc  somente se margemPerc > 0; senão 0
```

Se a margem for **negativa ou zero**, o indicador zera no código (situação em que o modelo clássico de break-even não se aplica bem).

---

## 12. CMV (custo da mercadoria vendida) e Lucro real

### Conceito

**CMV** estima o **custo do estoque que “saiu”** (foi vendido/consumido) no período, usando a relação clássica:

**Estoque inicial + Compras − Estoque final**

Assim, não se assume que **toda compra do mês** virou custo imediato — parte pode ter ido para **aumentar estoque**.

**Lucro real** no app usa essa base de custo de mercadoria em vez do total de compras NF no mês; o restante (variáveis sem Revenda, fixas) é o mesmo.

### Para que serve

Aproximar o resultado quando **estoque oscila**: meses com muita compra mas estoque alto podem ter **lucro real melhor** que o “lucro com compras do mês”, porque o CMV reconhece menos custo na DRE simplificada.

### No sistema

```
cmv = estoqueAnterior + compras - estoqueAtual
margemRSReal = faturamento - (cmv + variaveis)
lucroLiquidoReal = margemRSReal - fixas
lucratividadeReal = (lucroLiquidoReal / faturamento) * 100
```

Card **Lucro real** / **Lucratividade Real**.  
**Status** LUCRO/PREJUÍZO usa o lucro da base **Compras NF**, não o real.

---

## 13. Lucro líquido vs Lucro real (resumo)

| | **Lucro líquido (card)** | **Lucro real** |
|--|--------------------------|----------------|
| **Ideia** | Custo de mercadoria = **compras do mês (NF)** | Custo de mercadoria = **CMV** (estoque + compras − estoque) |
| **Uso típico** | Alinhado ao fluxo de **compras** que você vê no card | Alinhado a **competência** com **estoque** |
| **Diferença** | Se estoque sobe, compras > CMV → lucro “NF” mais baixo que o “real”, e o inverso se estoque cai | — |

---

## 14. Gráfico (“Receitas, Despesas e Compras”)

### Conceito

Série **no tempo** (dia a dia ou acumulado no mês) para ver **ritmo** de entradas, saídas e evolução do lucro calculado com a **mesma regra do card** (compras NF + variáveis sem Revenda + fixas).

### Para que serve

Identificar **concentração** de receita/despesa no mês e se o lucro acumulado **caminha** em linha com o fechamento mensal.

### No sistema

- Modos **Diário** / **Acumulado**.  
- `lucroLiquido` na série usa `comprasDia` e variáveis sem Revenda — alinhado ao card.  
- `lucroReal` na série é **constante** = lucro real **mensal** (não há série diária de CMV no gráfico).

---

## 15. Contas corrente (cards)

### Conceito

Saldo e movimentação de **contas bancárias/caixa** cadastradas no catálogo, para leitura de **liquidez** e conciliação com a operação.

### Para que serve

Cruzar **resultado econômico** (receitas/despesas de gestão) com **posição em banco** (quanto há disponível e o que entrou/saiu no extrato).

### No sistema

`getContasCorrenteDoCatalogo` + `ContaCorrenteCardHome`; cálculos de saldo/extrato no modelo de contas corrente, não em `home.tsx`.

---

## 16. O que a home **não** mostra (mas o código permite derivar)

### Lucro bruto (conceito)

**Receitas − CMV** (custo só da mercadoria vendida), **antes** de despesas operacionais variáveis e fixas. O app calcula `cmv` em `saudeFinanceira` mas **não** expõe um card “Lucro bruto”.

### Receitas − Despesas (card único)

Seria “tudo que está em despesas vs receitas”, **sem** ajuste Compras NF / Revenda. **Não** coincide com o lucro da home; pode ser útil como cheque rápido se **toda** a operação estiver só em despesas + receitas (não é o caso atual).

---

## 17. Observação técnica (consistência do mês anterior)

No mês atual, `despesasVariaveis` **exclui** Revenda. Em `despesasVariaveisAnterior`, o código soma **todas** as variáveis **com** Revenda. Com `comprasAnterior` na mesma fórmula, **Revenda + Compras NF** podem **sobrepor** mercadoria no `lucroLiquidoAnterior`, distorcendo a **variação %** do lucro. Para comparar meses com a mesma lógica, o mês anterior deveria usar **variáveis sem Revenda**, espelhando o mês atual.

---

*Documento alinhado ao código em `app/routes/home.tsx` e `app/utils/financeiro.ts`.*
