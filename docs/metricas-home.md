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

Ver **quanto saiu** pelo módulo de despesas no período — útil para controle de gastos e comparação com outros meses. **Não** é o mesmo conjunto usado no lucro da home (lá a mercadoria entra uma vez só: Revenda paga no lucro líquido, CMV no lucro real — ver § 6).

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
- `tipo === "variavel"` → entra em `despesasVariaveis`; para o lucro, a conta **Revenda** é **excluída** da soma de variáveis porque a mercadoria entra como custo à parte (Revenda paga ou CMV — ver § 6).

---

## 6. Revenda paga vs Compras NF — cada uma no seu lugar

### Conceito

A mesma mercadoria aparece duas vezes nos dados: como **NF de entrada** (módulo Compras) e como **pagamento** (despesa variável na conta **Revenda**). Contar as duas no mesmo resultado infla o custo; por isso cada métrica usa **uma** delas:

| Métrica | Custo da mercadoria | Por quê |
|--|--|--|
| **Lucro líquido** | Revenda **paga** no mês | Visão de caixa: o que de fato saiu para pagar mercadoria. |
| **Lucro real** | **CMV** (estoque + Compras NF − estoque) | O estoque é valorizado pelo custo das notas; só a NF fecha essa conta. |

A data da NF sozinha (compras do mês) não é nem o pagamento nem a venda, então não é usada como custo em nenhum lucro — o card Compras continua só como acompanhamento.

### No sistema

- `despesasRevenda` = despesas pagas com `conta === "Revenda"` → `totais.revenda`.
- `totais.despesasVariaveis` = variáveis **sem** Revenda (impostos, comissões…), usadas nos dois lucros.
- Transferências entre lojas (`conta === "transferencia"`) não entram em nenhuma soma.

---

## 7–8. Totais e variação percentual

`totais` guarda somas do mês e do mês anterior (`receitas`, `compras`, `revenda`, `despesas`, `despesasVariaveis`, `despesasFixas`), sempre com a **mesma regra** nos dois meses.

```
variacao = ((atual - anterior) / anterior) * 100
```

`anterior === 0` e `atual !== 0` → 100; ambos zero → 0. No card de Lucro líquido a badge é a variação mês a mês, não a lucratividade.

---

## 9. Margem de contribuição

```
margemRS = faturamento - (revendaPaga + variaveis)
margemContribuicaoPerc = margemRS / faturamento * 100
```

É a margem da visão de caixa. O rodapé do card Ponto de equilíbrio mostra a margem usada no cálculo dele (ver § 11).

---

## 10. Lucro líquido (card) e lucratividade

**Quanto sobrou no caixa** do mês com a operação:

```
lucroLiquido = faturamento - revendaPaga - variaveis - fixas
lucratividade = lucroLiquido / faturamento * 100
```

Depende de quando os boletos de mercadoria são pagos: um mês que paga muita mercadoria comprada antes aparece com lucro menor, e vice-versa.

---

## 11. Ponto de equilíbrio

Usa a margem do **CMV** (`margemPercReal`), que mede o que a venda deixa de verdade — a margem de caixa oscila conforme o calendário de pagamento da mercadoria. No mês em andamento, sem CMV, cai na margem de caixa; `baseEquilibrio` (`"cmv"` | `"caixa"`) diz qual foi usada e o rodapé do card mostra.

```
margemEquilibrio = margemPercReal ?? margemContribuicaoPerc
pontoEquilibrio = fixas / (margemEquilibrio / 100)   (0 se a margem ≤ 0)
```

O `status` LUCRO/PREJUÍZO segue a mesma regra: lucro real quando existe, senão lucro líquido.

---

## 12. Estoque, CMV e Lucro real

### Estoque

O lançamento de `estoque` com data do **dia 1** do mês (`local: "todas"`) é o estoque de **abertura** daquele mês. Logo, para o mês M:

- estoque inicial = lançamento de 1º/M
- estoque final = lançamento de 1º/(M+1)

Os dois seguem o **mês selecionado** na home. Se o mês não tiver `todas`, somam-se as linhas por loja.

### CMV e lucro real

```
cmv = estoqueInicial + compras(NF) - estoqueFinal
lucroLiquidoReal = faturamento - cmv - variaveis - fixas
lucratividadeReal = lucroLiquidoReal / faturamento * 100
```

Enquanto o estoque do dia 1 do mês seguinte não for lançado (mês em andamento), CMV e lucro real ficam `null` e o card mostra "Aguardando o estoque do dia 1 do mês seguinte".

---

## 13. Lucro líquido vs Lucro real (resumo)

| | **Lucro líquido** | **Lucro real** |
|--|--|--|
| **Pergunta** | Quanto sobrou no caixa? | Quanto a operação lucrou de fato? |
| **Mercadoria** | Revenda paga no mês | CMV (estoque + NF − estoque) |
| **Disponível** | Sempre, durante o mês | Só com o estoque de fechamento lançado |

---

## 13a. Margem bruta, markup e cobertura de estoque

Dependem do CMV (ver § 12), então só existem em mês fechado. No mês em andamento, os cards mostram o **último mês fechado** e dizem qual é ("último mês fechado: ago/26").

```
margemBruta = (faturamento - cmv) / faturamento * 100
markup = faturamento / cmv
coberturaEstoqueDias = ((estoqueInicial + estoqueFinal) / 2) / cmv * diasNoMes
```

- **Margem bruta / markup**: se o preço cobre o custo da mercadoria, antes de qualquer despesa. Comparável ao markup da Calculadora de Preço.
- **Cobertura**: quantos dias de venda o estoque aguenta no ritmo do mês — quanto dinheiro está parado em mercadoria.

## 13b. Contas a pagar (card)

Posição de **hoje**, independente do mês selecionado: total dos boletos em aberto desde 2025 (`getContasAPagar`), o que já venceu (badge vermelha) e o que vence nos próximos 7 dias. É o que ainda vai sair do lucro de caixa quando for pago. O título leva à página Contas a Pagar, que filtra **Em aberto / Pagos** (pagos = com boleto anexado).

---

## 14. Gráfico (“Receitas, Despesas e Compras”)

### Conceito

Série **no tempo** (dia a dia ou acumulado no mês) para ver **ritmo** de entradas, saídas e evolução do lucro calculado com a **mesma regra do card** (Revenda paga + variáveis sem Revenda + fixas).

### Para que serve

Identificar **concentração** de receita/despesa no mês e se o lucro acumulado **caminha** em linha com o fechamento mensal.

### No sistema

- Modos **Diário** / **Acumulado**.  
- `lucroLiquido` na série usa a Revenda paga no dia e variáveis sem Revenda — alinhado ao card.  
- `lucroReal` na série é **constante** = lucro real **mensal** (vazio enquanto não houver estoque de fechamento).

---

## 14a. Últimos 12 meses

Receitas, lucro líquido e lucro real mês a mês, terminando no mês selecionado. Cada ponto é calculado por `resumirMes` — a mesma função dos cards e do mês anterior, para os números nunca divergirem. O lucro real fica vazio nos meses sem estoque de fechamento.

---

## 15. O que a home **não** mostra (mas o código permite derivar)

### Lucro bruto (conceito)

**Receitas − CMV** (custo só da mercadoria vendida), **antes** de despesas operacionais variáveis e fixas. A home mostra essa ideia em percentual no card **Margem bruta** (§ 13a), não em R$.

### Receitas − Despesas (card único)

Seria “tudo que está em despesas vs receitas”, **sem** ajuste Compras NF / Revenda. **Não** coincide com o lucro da home; pode ser útil como cheque rápido se **toda** a operação estiver só em despesas + receitas (não é o caso atual).

---

*Documento alinhado ao código em `app/routes/home.tsx` e `app/utils/financeiro.ts`.*
