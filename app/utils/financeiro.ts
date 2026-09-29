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
 * KPIs da home. Duas visões do custo da mercadoria, cada uma com seu papel:
 *
 * - Lucro líquido usa a `revendaPaga` (despesas pagas na conta Revenda): é o
 *   que de fato saiu do caixa para pagar mercadoria no mês. As Compras NF não
 *   entram aqui — a data da nota não é nem o pagamento nem a venda.
 * - Lucro real usa o CMV, que TEM que ser montado com as `compras` (NF): o
 *   estoque é valorizado pelo custo das notas, então só a NF fecha a conta
 *   estoque inicial + compras − estoque final.
 *
 * O estoque lançado no dia 1 de cada mês é o de ABERTURA daquele mês. Então o
 * estoque final de um mês é o do dia 1 do mês seguinte — e enquanto ele não
 * existe (mês em andamento) não há CMV: os campos "real" voltam `null` em vez
 * de um número montado com o estoque errado.
 *
 * Ponto de equilíbrio e status seguem a margem do CMV, que mede o que a venda
 * deixa de verdade; a margem de caixa oscila com o calendário de pagamento da
 * mercadoria. Só no mês em andamento (sem CMV) caem na base de caixa, e
 * `baseEquilibrio` diz qual foi usada.
 *
 * Margem bruta, markup e cobertura de estoque também dependem do CMV e ficam
 * `null` sem ele. Cobertura = estoque médio ÷ CMV × `diasNoPeriodo`: quantos
 * dias de venda o estoque aguenta no ritmo do mês.
 *
 * `variaveis` são as despesas variáveis SEM a conta Revenda (impostos,
 * comissões…), para a mercadoria não entrar duas vezes.
 */
export function calcularSaudeFinanceira(dados: {
	faturamento: number;
	revendaPaga: number;
	compras: number;
	variaveis: number;
	fixas: number;
	estoqueInicial: number | null;
	estoqueFinal: number | null;
	diasNoPeriodo: number;
}) {
	const {
		faturamento,
		revendaPaga,
		compras,
		variaveis,
		fixas,
		estoqueInicial,
		estoqueFinal,
		diasNoPeriodo,
	} = dados;
	const sobreFaturamento = (valor: number) =>
		faturamento > 0 ? (valor / faturamento) * 100 : 0;

	// 1. Margem de contribuição (Receitas − Revenda paga − outras variáveis)
	const margemRS = faturamento - (revendaPaga + variaveis);
	const margemPerc = sobreFaturamento(margemRS);

	// 2. Lucro líquido (mesma composição de custos variáveis da margem)
	const lucro = margemRS - fixas;

	// Métricas com CMV (estoque inicial + compras NF − estoque final)
	const cmv =
		estoqueInicial != null && estoqueFinal != null
			? estoqueInicial + compras - estoqueFinal
			: null;
	const margemRSReal = cmv != null ? faturamento - (cmv + variaveis) : null;
	const lucroReal = margemRSReal != null ? margemRSReal - fixas : null;
	const margemPercReal =
		margemRSReal != null ? sobreFaturamento(margemRSReal) : null;

	// Ponto de equilíbrio (faturamento necessário para cobrir fixas) e status
	const baseEquilibrio = margemPercReal != null ? "cmv" : "caixa";
	const margemEquilibrio = margemPercReal ?? margemPerc;
	const pontoEquilibrio =
		margemEquilibrio > 0 ? fixas / (margemEquilibrio / 100) : 0;
	const lucroStatus = lucroReal ?? lucro;

	const cmvPositivo = cmv != null && cmv > 0 ? cmv : null;
	const margemBruta =
		cmv != null && faturamento > 0 ? sobreFaturamento(faturamento - cmv) : null;
	const markup = cmvPositivo != null ? faturamento / cmvPositivo : null;
	const coberturaEstoqueDias =
		cmvPositivo != null && estoqueInicial != null && estoqueFinal != null
			? ((estoqueInicial + estoqueFinal) / 2 / cmvPositivo) * diasNoPeriodo
			: null;

	return {
		margemContribuicao: margemRS,
		margemContribuicaoPerc: margemPerc,
		pontoEquilibrio,
		baseEquilibrio,
		margemEquilibrio,
		lucroLiquido: lucro,
		lucratividade: sobreFaturamento(lucro),
		cmv,
		margemRSReal,
		margemPercReal,
		lucroLiquidoReal: lucroReal,
		lucratividadeReal: lucroReal != null ? sobreFaturamento(lucroReal) : null,
		margemBruta,
		markup,
		coberturaEstoqueDias,
		status: lucroStatus > 0 ? "LUCRO" : "PREJUÍZO",
	};
}
