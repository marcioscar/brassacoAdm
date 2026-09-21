/**
 * O tipo da despesa, nas DUAS grafias que o banco tem.
 *
 * O cadastro gravou "fixa" até fevereiro de 2026 e "fixo" de março em diante, e
 * as duas convivem — 3.434 lançamentos de um lado, 345 do outro. Filtrar por
 * uma só faz a soma ignorar a outra metade SEM AVISAR, e o sintoma é traiçoeiro:
 * a despesa fixa aparece zerada e o lucro do mês parece maior do que foi.
 *
 * Em janeiro de 2026, por exemplo, os 54 lançamentos fixos são todos "fixa" —
 * filtrando por "fixo" a home mostrava despesa fixa zero e lucro inflado em
 * R$ 96.932 naquele mês.
 *
 * O formulário continua oferecendo só "fixo" para lançamento NOVO: a ideia é
 * parar de criar a divergência, não perpetuá-la. Estas funções existem para
 * LER o que já está gravado.
 */
export function ehDespesaFixa(tipo: string | null | undefined) {
	return tipo === "fixo" || tipo === "fixa";
}

export function ehDespesaVariavel(tipo: string | null | undefined) {
	return tipo === "variavel";
}

/**
 * Movimentação de dinheiro ENTRE as lojas — não é despesa.
 *
 * São 376 lançamentos de 2024 com `conta: "transferencia"`, fornecedor igual ao
 * nome da loja (Qi/Sds/Qne/Nrt) e descrição no formato "Qi -> Nrt". Todos estão
 * gravados como `variavel` e `pago`, então a home os somava como despesa: em
 * agosto/24 R$ 172.929 e em setembro/24 R$ 179.019 do que aparecia como
 * "despesa variável" era dinheiro apenas mudando de bolso, e o lucro daqueles
 * meses aparecia menor do que foi.
 *
 * Os registros ficam no banco como histórico de movimentação; quem não pode
 * contá-los é o cálculo.
 */
export function ehTransferenciaEntreLojas(conta: string | null | undefined) {
	return conta === "transferencia";
}

export function calcularPrecoVenda(params: {
	custo: number;
	pctFixos: number;
	pctVariaveis: number;
	pctLucro: number;
}) {
	const { custo, pctFixos, pctVariaveis, pctLucro } = params;
	const totalPct = pctFixos + pctVariaveis + pctLucro;
	if (totalPct >= 100 || custo <= 0) return null;
	const divisor = 1 - totalPct / 100;
	const divisorMinimo = 1 - (pctFixos + pctVariaveis) / 100;
	return {
		precoSugerido: custo / divisor,
		precoMinimo: divisorMinimo > 0 ? custo / divisorMinimo : null,
		markup: 1 / divisor,
	};
}

export function verificarPrecoVenda(params: {
	custo: number;
	preco: number;
	pctFixos: number;
	pctVariaveis: number;
}) {
	const { custo, preco, pctFixos, pctVariaveis } = params;
	if (preco <= 0 || custo < 0) return null;
	const margemBruta = ((preco - custo) / preco) * 100;
	const sobraReal =
		preco - custo - (preco * pctVariaveis) / 100 - (preco * pctFixos) / 100;
	const status =
		sobraReal > 0.005
			? "LUCRATIVO"
			: sobraReal < -0.005
				? "PREJUÍZO"
				: "BREAK-EVEN";
	return { margemBruta, sobraReal, status };
}

/**
 * Custos variáveis alinhados aos cards da home:
 * - `compras` = módulo Compras (NF / mercadoria)
 * - `variaveis` = despesas variáveis já sem duplicar a conta Revenda (vem de `totais.despesasVariaveis`)
 *
 * Antes a margem usava só Revenda nas despesas e ignorava as Compras (NF), distorcendo ponto de equilíbrio e lucro
 * em relação ao que o operador vê em Receitas / Compras.
 */
export function calcularSaudeFinanceira(dados: {
	faturamento: number;
	compras: number;
	variaveis: number;
	fixas: number;
	estoqueAtual: number;
	estoqueAnterior: number;
}) {
	const { faturamento, compras, variaveis, fixas, estoqueAtual, estoqueAnterior } =
		dados;

	// 1. Margem de contribuição (Receitas − Compras NF − outras variáveis)
	const margemRS = faturamento - (compras + variaveis);
	const margemPerc = faturamento > 0 ? margemRS / faturamento : 0;

	// 2. Ponto de equilíbrio (faturamento necessário para cobrir fixas, na mesma base da margem)
	const pontoEquilibrio = margemPerc > 0 ? fixas / margemPerc : 0;

	// 3. Lucro líquido (mesma composição de custos variáveis da margem)
	const lucro = margemRS - fixas;
	const lucratividade = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

	// Métricas com CMV (estoque + compras NF − estoque)
	const cmv = estoqueAnterior + compras - estoqueAtual;
	const margemRSReal = faturamento - (cmv + variaveis);
	const margemPercReal =
		faturamento > 0 ? margemRSReal / faturamento : 0;
	const lucroReal = margemRSReal - fixas;
	const lucratividadeReal =
		faturamento > 0 ? (lucroReal / faturamento) * 100 : 0;

	return {
		margemContribuicao: margemRS,
		margemContribuicaoPerc: margemPerc.toFixed(2),
		pontoEquilibrio,
		lucroLiquido: lucro,
		lucratividade,
		cmv,
		margemRSReal,
		margemPercReal: margemPercReal.toFixed(2),
		lucroLiquidoReal: lucroReal,
		lucratividadeReal,
		status: lucro > 0 ? "LUCRO" : "PREJUÍZO",
	};
}