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