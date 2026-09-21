# Migrações de dados — coleção `despesas`

Correções feitas **direto no MongoDB**, fora do código. Cada arquivo aqui é o
estado ORIGINAL dos documentos antes da alteração, para auditoria e reversão.

Todas foram aplicadas em 21/09/2026, no banco
`easypanel.quattoracademia.com:27017/brassaco`.

## Por que existiram

O campo `tipo` e o campo `conta` acumularam valores que os filtros do app não
reconheciam. O sintoma nunca é um erro na tela — é uma soma que ignora parte
dos dados em silêncio, e um lucro que parece maior do que foi.

## 01 — `tipo: "undefined"` (4 documentos, R$ 680,12)

Quatro lançamentos de 2022-2024 tinham a **string literal** `"undefined"` no
campo `tipo`. Não caíam em `ehDespesaFixa` nem em `ehDespesaVariavel`: entravam
no total de despesas mas sumiam da quebra fixa/variável, então nesses meses
`fixas + variáveis` não fechava com o total.

Todos eram fixos pelo padrão do fornecedor (CEB 153 fixos × 3 variáveis,
Vivo Telecom 157 × 1, Brassaco 1458 × 114). Gravado `tipo: "fixo"` — a grafia
canônica, e a única que o `<Select>` de edição exibe selecionada.

- `2026-09-21-01-tipo-undefined.json` — os 4 originais

## 02 — Revenda marcada como fixa → variável (127 de 155, R$ 367.073,99)

155 despesas com `conta: "Revenda"` estavam gravadas como `fixa`/`fixo`. Isso
inflava o custo fixo (e com ele o ponto de equilíbrio e o preço sugerido da
calculadora) e, combinado com o bug de cálculo da home, derrubava as variáveis
abaixo de zero.

Convertidos os **127** cujo fornecedor aparece **100% em Revenda** no histórico
(Empac, Macroflex, Granplast, Prafesta, Zanini, Coex e outros 26), mais os de
fornecedor "Diversos" com descrição de mercadoria (caixas, isopor, sacos).

Os outros 28 NÃO foram convertidos aqui — ver 03. Convertê-los seria pior que
deixar como estavam: a home exclui `conta: "Revenda"` das variáveis, então um
serviço marcado como variável some por completo do resultado.

- `2026-09-21-02-revenda-fixa-originais.json` — os 155 originais, separados em
  `convertidos` (127) e `mantidos` (28)
- `2026-09-21-02-ids-convertidos.json` — os 127 ids alterados

## 03 — Os 28 restantes (R$ 31.590,39)

Nesses a `conta` é que estava errada, não o `tipo`.

**3 eram mercadoria disfarçada** — mantiveram `conta: "Revenda"` e viraram
`variavel`. "rio prata" e "sao pedro" parecem serviço pela descrição, mas são
fornecedores do cadastro: WIDA EMBALAGENS RIO PRATA e COMERCIAL DE PLASTICOS
SAO PEDRO EIRELI.

**25 tiveram a `conta` trocada** de Revenda para a conta dominante do
fornecedor, com o `tipo` intacto: Servicos=11, Pessoal=7, Transporte=5,
Impostos=2 (contadora, aluguel, IPTU, folha, energia, água, telefone, diesel).

Duas exceções decididas pela descrição, contra a dominância do fornecedor:
"transporte" (Diversos) → Transporte, e "bolo" (Diversos) → Pessoal.

- `2026-09-21-03-conta-errada-originais.json` — os 28 originais
- `2026-09-21-03-plano-aplicado.json` — o destino de cada um e o motivo
  (`fornecedor` = conta dominante, `descrição` = exceção manual)

## 04 — Contas fora da lista do formulário (782 documentos, R$ 1.321.470,07)

O formulário só oferece `Revenda`, `Servicos`, `Impostos`, `Pessoal`,
`Transporte` e `Moacir`, mas o banco tinha outros cinco valores. Isso deixava o
campo Conta em branco ao editar esses registros e separaria "Serviços" de
"Servicos" em qualquer relatório por categoria.

    "Serviços" (cedilha) -> "Servicos"    374 docs   R$ 362.093,13
    "Imposto"  (singular) -> "Impostos"   326 docs   R$ 802.396,96
    "Diversos"            -> "Servicos"    59 docs   R$  33.483,98
    "Contador"            -> "Servicos"    23 docs   R$ 123.496,00

As duas primeiras são grafia. `Contador` e `Diversos` foram dobradas em
`Servicos` por serem serviço/custeio de fato (contadora; resma de papel,
limpeza, água) e porque os mesmos fornecedores já tinham a maioria dos
lançamentos em `Servicos`. Isso FUNDE a distinção "Contador" — se ela precisar
voltar, o caminho é adicioná-la ao enum do formulário e restaurar pelo backup.

- `2026-09-21-04-contas-fora-do-enum-originais.json` — os 782 originais
- `2026-09-21-04-plano-aplicado.json` — o de/para de cada id

### O que NÃO foi normalizado: `transferencia` (376 docs, R$ 365.752,17)

Não é problema de nomenclatura, então renomear não resolveria. São
movimentações entre as lojas — fornecedor igual ao nome da loja (Qi/Sds/Qne/
Nrt), descrição no formato "Qi -> Nrt" nos 376 — todas de 2024, todas
`variavel` e `pago`. Não são despesa.

A correção foi no CÓDIGO, não nos dados: `ehTransferenciaEntreLojas` em
`app/utils/financeiro.ts`, aplicada na base de despesas da home e no loader da
calculadora de preço. Os registros continuam no banco como histórico.

## Como reverter

Os arquivos guardam o documento inteiro como estava, incluindo `_id`. Para
desfazer, regrave `tipo` e `conta` a partir deles casando pelo `_id`.

## O que ficou de fora, de propósito

Nada de nomenclatura — depois da migração 04 todas as contas do banco estão
dentro do enum do formulário, exceto `transferencia`, que foi mantida de caso
pensado (ver acima: os registros são histórico de movimentação, e quem deixou
de contá-los foi o cálculo).
