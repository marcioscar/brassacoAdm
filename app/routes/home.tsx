import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { getReceitas } from "~/models/receitas.server";
import type { Route } from "./+types/home";
import {
	calcularSaudeFinanceira,
	ehDespesaFixa,
	ehDespesaVariavel,
	ehTransferenciaEntreLojas,
} from "~/utils/financeiro";
import { getCompras } from "~/models/compras.server";
import { getContasAPagar, getDespesas } from "~/models/despesas.server";
import { useMesAnoContext } from "~/context/mes-ano-context";
import {
	isMesmoMesAnoDataCivilUTC,
	obterMesAnoAtual,
	obterMesAnoAnterior,
	obterMesAnoDaDataCivilUTC,
	obterHojeDataCivilUTC,
	type MesAno,
} from "~/lib/mes-ano";
import { formatCurrencyBRL } from "~/lib/formatters";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "~/components/ui/chart";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";
import { getEstoques } from "~/models/estoque";
import React from "react";
import { Link } from "react-router";

//grafico de area

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Brassaco ADM" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}
type ItemComDataValor = { data: Date | string | null; valor: number | null };
type ItemComPago = { pago?: boolean | null; conta?: string | null };

function toDate(value: Date | string | null) {
	if (!value) return null;
	return value instanceof Date ? value : new Date(value);
}

function filtrarPorMesAno<T extends ItemComDataValor>(
	itens: T[],
	mes: number,
	ano: number,
) {
	return itens.filter((item) =>
		isMesmoMesAnoDataCivilUTC(item.data, mes, ano),
	);
}

function somarValores(itens: ItemComDataValor[]) {
	return itens.reduce((total, item) => total + Number(item.valor || 0), 0);
}

type LancamentoEstoque = {
	data: Date | string | null;
	valor: number | null;
	local?: string | null;
};

/**
 * Estoque de ABERTURA do mês (o lançado no dia 1). Usa o total `todas`; nos
 * meses antigos que também têm uma linha por loja, as lojas ficam de fora para
 * não somar duas vezes. Sem `todas`, soma as lojas. Sem nada, `null`.
 */
function obterEstoqueAbertura(
	estoques: LancamentoEstoque[],
	{ mes, ano }: MesAno,
) {
	const doMes = estoques.filter((e) => isMesmoMesAnoDataCivilUTC(e.data, mes, ano));
	if (doMes.length === 0) return null;
	const total = doMes.filter((e) => e.local === "todas");
	return somarValores(total.length > 0 ? total : doMes);
}

function obterMesAnoSeguinte({ mes, ano }: MesAno): MesAno {
	return mes === 12 ? { mes: 1, ano: ano + 1 } : { mes: mes + 1, ano };
}

function formatarPercentual(valor: number) {
	return `${valor.toFixed(2)}%`;
}

/**
 * Base de TODOS os números de despesa da home: só o que foi pago, e sem as
 * transferências entre lojas, que não são despesa (ver `ehTransferenciaEntreLojas`).
 *
 * A exclusão é feita aqui, na origem, e não em cada soma: assim o card de
 * despesa total, as fixas, as variáveis e o gráfico diário partem todos da
 * mesma base — não dá para uma delas esquecer o filtro.
 */
function filtrarDespesasPagas<T extends ItemComPago>(itens: T[]) {
	return itens.filter(
		(item) => item.pago === true && !ehTransferenciaEntreLojas(item.conta),
	);
}

function calcularVariacaoPercentual(atual: number, anterior: number) {
	if (anterior === 0) {
		if (atual === 0) return 0;
		return 100;
	}
	return ((atual - anterior) / anterior) * 100;
}

function calcularLucroLiquido(
	faturamento: number,
	revendaPaga: number,
	variaveis: number,
	fixas: number,
) {
	const margemRS = faturamento - (revendaPaga + variaveis);
	return margemRS - fixas;
}

type DespesaClassificavel = ItemComDataValor & {
	tipo?: string | null;
	conta?: string | null;
};

/**
 * Separa as despesas pagas nas três parcelas do lucro.
 *
 * - `revenda`: conta Revenda em qualquer tipo — o custo da mercadoria na visão
 *   de caixa (lucro líquido), sem depender de como foi classificada.
 * - `variaveis`: variáveis SEM Revenda, porque a mercadoria já entra como custo
 *   à parte (Revenda paga no lucro líquido, CMV no lucro real). Tem que ser um
 *   filtro DENTRO das variáveis, nunca uma subtração do total de Revenda: já
 *   houve Revenda gravada como fixa, e subtraí-la de uma soma onde nunca entrou
 *   derrubava as variáveis abaixo de zero (jan/26 chegou a −R$ 7.106).
 * - `fixas`: "fixo" e "fixa" (ver `ehDespesaFixa`).
 */
function classificarDespesas<T extends DespesaClassificavel>(despesas: T[]) {
	return {
		revenda: despesas.filter((d) => d.conta === "Revenda"),
		variaveis: despesas.filter(
			(d) => ehDespesaVariavel(d.tipo) && d.conta !== "Revenda",
		),
		fixas: despesas.filter((d) => ehDespesaFixa(d.tipo)),
	};
}

function diasNoMes({ mes, ano }: MesAno) {
	return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Totais e KPIs de UM mês — a mesma conta para o mês selecionado, o anterior
 * e cada ponto da tendência, para os três nunca divergirem.
 */
function resumirMes<D extends DespesaClassificavel>(
	fontes: {
		receitas: ItemComDataValor[];
		compras: ItemComDataValor[];
		despesasPagas: D[];
		estoques: LancamentoEstoque[];
	},
	mesAno: MesAno,
) {
	const { mes, ano } = mesAno;
	const receitas = filtrarPorMesAno(fontes.receitas, mes, ano);
	const compras = filtrarPorMesAno(fontes.compras, mes, ano);
	const despesas = filtrarPorMesAno(fontes.despesasPagas, mes, ano);
	const { revenda, variaveis, fixas } = classificarDespesas(despesas);

	const totais = {
		receitas: somarValores(receitas),
		compras: somarValores(compras),
		despesas: somarValores(despesas),
		revenda: somarValores(revenda),
		variaveis: somarValores(variaveis),
		fixas: somarValores(fixas),
	};
	// Estoque do dia 1 = abertura do mês; o final é a abertura do mês seguinte.
	const estoqueInicial = obterEstoqueAbertura(fontes.estoques, mesAno);
	const estoqueFinal = obterEstoqueAbertura(
		fontes.estoques,
		obterMesAnoSeguinte(mesAno),
	);
	const saude = calcularSaudeFinanceira({
		faturamento: totais.receitas,
		revendaPaga: totais.revenda,
		compras: totais.compras,
		variaveis: totais.variaveis,
		fixas: totais.fixas,
		estoqueInicial,
		estoqueFinal,
		diasNoPeriodo: diasNoMes(mesAno),
	});

	return {
		mesAno,
		listas: { receitas, compras, despesas, revenda, variaveis, fixas },
		totais,
		estoqueInicial,
		saude,
	};
}

/** Os 12 meses terminando em `fim` (inclusive), do mais antigo ao mais novo. */
function ultimos12Meses(fim: MesAno) {
	const meses: MesAno[] = [fim];
	while (meses.length < 12) meses.unshift(obterMesAnoAnterior(meses[0]));
	return meses;
}

/** De que mês vem o número que depende de CMV, quando não é o selecionado. */
function descreverMesCmv(mesCmv: MesAno, selecionado: MesAno) {
	return mesCmv.mes === selecionado.mes && mesCmv.ano === selecionado.ano
		? "mês fechado"
		: `último mês fechado: ${formatarMesCurto(mesCmv)}`;
}

function formatarMesCurto({ mes, ano }: MesAno) {
	const nome = new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString("pt-BR", {
		month: "short",
		timeZone: "UTC",
	});
	return `${nome.replace(".", "")}/${String(ano).slice(2)}`;
}

function formatarChaveData(value: Date | string | null) {
	const date = toDate(value);
	if (!date) return null;
	return date.toISOString().slice(0, 10);
}

/** Rótulo pt-BR para chave `YYYY-MM-DD` sem deslocar o dia (calendário = UTC civil). */
function formatarLabelDiaISO(chave: string) {
	const [y, m, d] = chave.split("-").map(Number);
	if (!y || !m || !d) return chave;
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pt-BR", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

function criarMapaDiario(itens: ItemComDataValor[]) {
	const mapa = new Map<string, number>();
	itens.forEach((item) => {
		const chave = formatarChaveData(item.data);
		if (!chave) return;
		const atual = mapa.get(chave) ?? 0;
		mapa.set(chave, atual + Number(item.valor || 0));
	});
	return mapa;
}

function criarDiasMes(mes: number, ano: number) {
	const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
	const dias: string[] = [];
	const mesStr = String(mes).padStart(2, "0");
	for (let dia = 1; dia <= ultimoDia; dia += 1) {
		dias.push(`${ano}-${mesStr}-${String(dia).padStart(2, "0")}`);
	}
	return dias;
}

type ChartMode = "diario" | "acumulado";

function criarSerieChart(
	dias: string[],
	receitasMap: Map<string, number>,
	despesasMap: Map<string, number>,
	comprasMap: Map<string, number>,
	revendaMap: Map<string, number>,
	variaveisMap: Map<string, number>,
	fixasMap: Map<string, number>,
	lucroRealMensal: number | null,
	modo: ChartMode,
) {
	let receitasAcumuladas = 0;
	let despesasAcumuladas = 0;
	let comprasAcumuladas = 0;
	let lucroLiquidoAcumulado = 0;

	return dias.map((dia) => {
		const receitasDia = receitasMap.get(dia) ?? 0;
		const despesasDia = despesasMap.get(dia) ?? 0;
		const comprasDia = comprasMap.get(dia) ?? 0;
		const variaveisDia = variaveisMap.get(dia) ?? 0;
		const fixasDia = fixasMap.get(dia) ?? 0;
		// Mesma base do card: Revenda paga + variáveis sem Revenda + fixas
		const lucroLiquidoDia = calcularLucroLiquido(
			receitasDia,
			revendaMap.get(dia) ?? 0,
			variaveisDia,
			fixasDia,
		);

		if (modo === "acumulado") {
			receitasAcumuladas += receitasDia;
			despesasAcumuladas += despesasDia;
			comprasAcumuladas += comprasDia;
			lucroLiquidoAcumulado += lucroLiquidoDia;

			return {
				date: dia,
				receitas: receitasAcumuladas,
				despesas: despesasAcumuladas,
				compras: comprasAcumuladas,
				lucroLiquido: lucroLiquidoAcumulado,
				lucroReal: lucroRealMensal,
			};
		}

		return {
			date: dia,
			receitas: receitasDia,
			despesas: despesasDia,
			compras: comprasDia,
			lucroLiquido: lucroLiquidoDia,
			lucroReal: lucroRealMensal,
		};
	});
}

function criarOpcoesMesAno(
	receitas: ItemComDataValor[],
	compras: ItemComDataValor[],
	despesas: ItemComDataValor[],
	selecionado: MesAno,
) {
	const chaves = new Set<string>();
	const incluirData = (data: Date | string | null) => {
		const m = obterMesAnoDaDataCivilUTC(data);
		if (!m) return;
		chaves.add(`${m.mes}-${m.ano}`);
	};

	receitas.forEach((r) => incluirData(r.data));
	compras.forEach((c) => incluirData(c.data));
	despesas.forEach((d) => incluirData(d.data));
	chaves.add(`${selecionado.mes}-${selecionado.ano}`);

	return [...chaves]
		.map((chave) => {
			const [mesStr, anoStr] = chave.split("-");
			const mes = Number(mesStr);
			const ano = Number(anoStr);
			return { mes, ano };
		})
		.sort((a, b) => {
			if (a.ano !== b.ano) return b.ano - a.ano;
			return b.mes - a.mes;
		});
}

export async function loader() {
	const receitas = await getReceitas();
	const compras = await getCompras();
	const despesas = await getDespesas();
	const despesasPagas = filtrarDespesasPagas(despesas);
	const mesAno = obterMesAnoAtual();
	const estoques = await getEstoques();
	const opcoesMesAno = criarOpcoesMesAno(
		receitas,
		compras,
		despesasPagas,
		mesAno,
	);

	return {
		receitas,
		compras,
		despesasPagas,
		mesAno,
		opcoesMesAno,
		estoques,
		contasAPagar: resumirContasAPagar(await getContasAPagar()),
	};
}

/**
 * Posição de HOJE dos boletos em aberto (não depende do mês selecionado):
 * o que já venceu e o que vence nos próximos 7 dias. É o que ainda vai sair
 * do lucro de caixa quando for pago.
 */
function resumirContasAPagar(abertas: ItemComDataValor[]) {
	const hoje = obterHojeDataCivilUTC().getTime();
	const daquiA7Dias = hoje + 7 * 24 * 60 * 60 * 1000;
	const resumo = { total: 0, quantidade: 0, vencido: 0, quantidadeVencida: 0, proximos7Dias: 0 };
	for (const conta of abertas) {
		const valor = Number(conta.valor || 0);
		const data = toDate(conta.data)?.getTime();
		resumo.total += valor;
		resumo.quantidade += 1;
		if (data == null) continue;
		if (data < hoje) {
			resumo.vencido += valor;
			resumo.quantidadeVencida += 1;
		} else if (data < daquiA7Dias) {
			resumo.proximos7Dias += valor;
		}
	}
	return resumo;
}
export default function Home({ loaderData }: Route.ComponentProps) {
	const chartConfig = {
		receitas: {
			label: "Receitas",
			color: "#0511F2",
		},
		despesas: {
			label: "Despesas",
			color: "#E3836D",
		},
		compras: {
			label: "Compras",
			color: "#0D0D0D",
		},
		lucroLiquido: {
			label: "Lucro Líquido",
			color: "#6DE3B8",
		},
		lucroReal: {
			label: "Lucro Real",
			color: "var(--chart-5)",
		},
	} satisfies ChartConfig;
	const {
		receitas,
		compras,
		despesasPagas,
		mesAno,
		estoques,
		contasAPagar,
	} = loaderData;
	const mesAnoContext = useMesAnoContext();
	const mesAnoSelecionado = mesAnoContext?.mesAno ?? mesAno;
	const [chartMode, setChartMode] = useState<ChartMode>("acumulado");

	/** Os 12 meses até o selecionado; o último é o próprio mês selecionado. */
	const tendencia = useMemo(
		() =>
			ultimos12Meses(mesAnoSelecionado).map((m) =>
				resumirMes({ receitas, compras, despesasPagas, estoques }, m),
			),
		[receitas, compras, despesasPagas, estoques, mesAnoSelecionado.mes, mesAnoSelecionado.ano],
	);
	const atual = tendencia[tendencia.length - 1];
	const anterior = tendencia[tendencia.length - 2];
	const { totais, saude: saudeFinanceira, estoqueInicial } = atual;
	/**
	 * Margem bruta e cobertura precisam de CMV. No mês em andamento ele ainda não
	 * existe, então os cards mostram o último mês fechado — e dizem qual é.
	 */
	const ultimoMesComCmv = useMemo(
		() => [...tendencia].reverse().find((r) => r.saude.cmv != null) ?? null,
		[tendencia],
	);

	const variacaoTexto = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
	const variacaoReceitas = calcularVariacaoPercentual(
		totais.receitas,
		anterior.totais.receitas,
	);
	const variacaoReceitasTexto = variacaoTexto(variacaoReceitas);
	const variacaoCompras = calcularVariacaoPercentual(
		totais.compras,
		anterior.totais.compras,
	);
	const variacaoComprasTexto = variacaoTexto(variacaoCompras);
	const variacaoDespesas = calcularVariacaoPercentual(
		totais.despesas,
		anterior.totais.despesas,
	);
	const variacaoDespesasTexto = variacaoTexto(variacaoDespesas);
	const variacaoLucroLiquido = calcularVariacaoPercentual(
		saudeFinanceira.lucroLiquido,
		anterior.saude.lucroLiquido,
	);
	const variacaoLucroLiquidoTexto = variacaoTexto(variacaoLucroLiquido);

	const chartData = useMemo(() => {
		const { listas } = atual;
		return criarSerieChart(
			criarDiasMes(mesAnoSelecionado.mes, mesAnoSelecionado.ano),
			criarMapaDiario(listas.receitas),
			criarMapaDiario(listas.despesas),
			criarMapaDiario(listas.compras),
			criarMapaDiario(listas.revenda),
			criarMapaDiario(listas.variaveis),
			criarMapaDiario(listas.fixas),
			atual.saude.lucroLiquidoReal,
			chartMode,
		);
	}, [atual, chartMode]);

	const tendenciaData = useMemo(
		() =>
			tendencia.map((r) => ({
				mes: formatarMesCurto(r.mesAno),
				receitas: r.totais.receitas,
				lucroLiquido: r.saude.lucroLiquido,
				lucroReal: r.saude.lucroLiquidoReal,
			})),
		[tendencia],
	);

	return (
		<div className='container mt-4 mx-auto flex flex-col gap-4'>
			<div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs *:data-[slot=card]:overflow-hidden md:grid-cols-2 lg:grid-cols-3 lg:px-6'>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription className='text-blue-600'>
							Receitas
						</CardDescription>
						<CardTitle className='text-lg  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{formatCurrencyBRL(totais.receitas)}
						</CardTitle>
						<CardAction className='flex max-w-[96px] items-center justify-end overflow-hidden'>
							<Badge
								variant='outline'
								className='flex w-full items-center justify-center gap-1 whitespace-nowrap text-xs'>
								{variacaoReceitas >= 0 ? (
									<TrendingUp className='size-3 text-green-500' />
								) : (
									<TrendingDown className='size-3 text-red-400' />
								)}
								{variacaoReceitasTexto}
							</Badge>
						</CardAction>
					</CardHeader>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription className='text-red-600'>Despesas</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{formatCurrencyBRL(totais.despesas)}
						</CardTitle>
						<CardAction className='flex max-w-[96px] items-center justify-end overflow-hidden'>
							<Badge
								variant='outline'
								className='flex w-full items-center justify-center gap-1 whitespace-nowrap text-xs'>
								{variacaoDespesas >= 0 ? (
									<TrendingUp className='size-3 text-red-400' />
								) : (
									<TrendingDown className='size-3 text-green-400' />
								)}
								{variacaoDespesasTexto}
							</Badge>
						</CardAction>
					</CardHeader>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription className='text-green-600'>
							Compras
						</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{formatCurrencyBRL(totais.compras)}
						</CardTitle>
						<CardAction className='flex max-w-[96px] items-center justify-end overflow-hidden'>
							<Badge
								variant='outline'
								className='flex w-full items-center justify-center gap-1 whitespace-nowrap text-xs'>
								{variacaoCompras >= 0 ? (
									<TrendingUp className='size-3 text-green-500' />
								) : (
									<TrendingDown className='size-3 text-red-500' />
								)}
								{variacaoComprasTexto}
							</Badge>
						</CardAction>
					</CardHeader>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription className=''>Lucro Líquido</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{formatCurrencyBRL(saudeFinanceira.lucroLiquido)}
						</CardTitle>
						<CardAction className='flex max-w-[96px] items-center justify-end overflow-hidden'>
							<Badge
								variant='outline'
								className='flex w-full items-center justify-center gap-1 whitespace-nowrap text-xs'>
								{variacaoLucroLiquido >= 0 ? (
									<TrendingUp className='size-3 text-green-500' />
								) : (
									<TrendingDown className='size-3 text-red-500' />
								)}
								{variacaoLucroLiquidoTexto}
							</Badge>
						</CardAction>
					</CardHeader>
					<CardFooter>
						<CardDescription>
							Lucratividade:{" "}
							{formatarPercentual(saudeFinanceira.lucratividade)} · mercadoria
							pela Revenda paga
						</CardDescription>
					</CardFooter>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription className=''>Lucro real</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{saudeFinanceira.lucroLiquidoReal != null
								? formatCurrencyBRL(saudeFinanceira.lucroLiquidoReal)
								: "—"}
						</CardTitle>
						<CardAction className='flex max-w-[96px] items-center justify-end overflow-hidden'></CardAction>
					</CardHeader>
					<CardFooter>
						<CardDescription>
							{saudeFinanceira.lucratividadeReal != null
								? `Lucratividade real: ${formatarPercentual(saudeFinanceira.lucratividadeReal)} · CMV ${formatCurrencyBRL(saudeFinanceira.cmv ?? 0)}`
								: estoqueInicial == null
									? "Sem estoque de abertura do mês"
									: "Aguardando o estoque do dia 1 do mês seguinte"}
						</CardDescription>
					</CardFooter>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription>Ponto de Equilíbrio</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{formatCurrencyBRL(saudeFinanceira.pontoEquilibrio)}
						</CardTitle>
					</CardHeader>
					<CardFooter>
						<CardDescription>
							Margem de contribuição:{" "}
							{formatarPercentual(saudeFinanceira.margemEquilibrio)} ·{" "}
							{saudeFinanceira.baseEquilibrio === "cmv"
								? "base CMV"
								: "base caixa (sem CMV no mês)"}
						</CardDescription>
					</CardFooter>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription>Margem bruta</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{ultimoMesComCmv?.saude.margemBruta != null
								? formatarPercentual(ultimoMesComCmv.saude.margemBruta)
								: "—"}
						</CardTitle>
					</CardHeader>
					<CardFooter>
						<CardDescription>
							{ultimoMesComCmv
								? `Markup ${ultimoMesComCmv.saude.markup != null ? `${ultimoMesComCmv.saude.markup.toFixed(2)}×` : "—"} · ${descreverMesCmv(ultimoMesComCmv.mesAno, mesAnoSelecionado)}`
								: "Sem estoque para calcular o CMV"}
						</CardDescription>
					</CardFooter>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription>Cobertura de estoque</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{ultimoMesComCmv?.saude.coberturaEstoqueDias != null
								? `${Math.round(ultimoMesComCmv.saude.coberturaEstoqueDias)} dias`
								: "—"}
						</CardTitle>
					</CardHeader>
					<CardFooter>
						<CardDescription>
							{ultimoMesComCmv
								? `Estoque parado no ritmo de venda · ${descreverMesCmv(ultimoMesComCmv.mesAno, mesAnoSelecionado)}`
								: "Sem estoque para calcular o CMV"}
						</CardDescription>
					</CardFooter>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription>
							<Link to='/contas_a_pagar' className='hover:underline'>
								Contas a pagar
							</Link>
						</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{formatCurrencyBRL(contasAPagar.total)}
						</CardTitle>
						{contasAPagar.vencido > 0 ? (
							<CardAction>
								<Badge variant='destructive' className='whitespace-nowrap text-xs'>
									{formatCurrencyBRL(contasAPagar.vencido)} vencido
								</Badge>
							</CardAction>
						) : null}
					</CardHeader>
					<CardFooter>
						<CardDescription>
							{contasAPagar.quantidade}{" "}
							{contasAPagar.quantidade === 1 ? "boleto" : "boletos"} em aberto ·{" "}
							{formatCurrencyBRL(contasAPagar.proximos7Dias)} nos próximos 7 dias
						</CardDescription>
					</CardFooter>
				</Card>
			</div>
			<Card className='pt-0'>
				<CardHeader className='flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row'>
					<div className='grid flex-1 gap-1'>
						<CardTitle>Receitas, Despesas e Compras</CardTitle>
						<CardDescription>
							{chartMode === "acumulado"
								? "Valores acumulados do mês atual"
								: "Valores diários do mês atual"}
						</CardDescription>
					</div>
					<div className='flex items-center gap-2'>
						<Button
							type='button'
							variant={chartMode === "diario" ? "default" : "outline"}
							onClick={() => setChartMode("diario")}>
							Diário
						</Button>
						<Button
							type='button'
							variant={chartMode === "acumulado" ? "default" : "outline"}
							onClick={() => setChartMode("acumulado")}>
							Acumulado
						</Button>
					</div>
				</CardHeader>
				<CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
					<ChartContainer
						config={chartConfig}
						className='aspect-auto h-[250px] w-full'>
						<LineChart
							accessibilityLayer
							data={chartData}
							margin={{ left: 12, right: 12 }}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey='date'
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={32}
								tickFormatter={(value) =>
									formatarLabelDiaISO(String(value))
								}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(value) =>
											formatarLabelDiaISO(String(value))
										}
										indicator='dot'
									/>
								}
							/>
							<Line
								dataKey='receitas'
								type='monotone'
								stroke='var(--color-receitas)'
								strokeWidth={2}
								dot={false}
							/>
							<Line
								dataKey='despesas'
								type='monotone'
								stroke='var(--color-despesas)'
								strokeWidth={2}
								dot={false}
							/>
							<Line
								dataKey='compras'
								type='monotone'
								stroke='var(--color-compras)'
								strokeWidth={2}
								dot={false}
							/>
							<Line
								dataKey='lucroLiquido'
								type='monotone'
								stroke='var(--color-lucroLiquido)'
								strokeWidth={2}
								dot={false}
							/>
							<Line
								dataKey='lucroReal'
								type='monotone'
								stroke='var(--color-lucroReal)'
								strokeWidth={2}
								dot={false}
							/>
							<ChartLegend content={<ChartLegendContent />} />
						</LineChart>
					</ChartContainer>
				</CardContent>
			</Card>
			<Card className='pt-0'>
				<CardHeader className='border-b py-5'>
					<CardTitle>Últimos 12 meses</CardTitle>
					<CardDescription>
						Receitas, lucro líquido (caixa) e lucro real (CMV) — o lucro real só
						aparece nos meses com estoque de fechamento
					</CardDescription>
				</CardHeader>
				<CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
					<ChartContainer
						config={chartConfig}
						className='aspect-auto h-[250px] w-full'>
						<LineChart
							accessibilityLayer
							data={tendenciaData}
							margin={{ left: 12, right: 12 }}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey='mes'
								tickLine={false}
								axisLine={false}
								tickMargin={8}
							/>
							<ChartTooltip
								cursor={false}
								content={<ChartTooltipContent indicator='dot' />}
							/>
							<Line
								dataKey='receitas'
								type='monotone'
								stroke='var(--color-receitas)'
								strokeWidth={2}
								dot
							/>
							<Line
								dataKey='lucroLiquido'
								type='monotone'
								stroke='var(--color-lucroLiquido)'
								strokeWidth={2}
								dot
							/>
							<Line
								dataKey='lucroReal'
								type='monotone'
								stroke='var(--color-lucroReal)'
								strokeWidth={2}
								dot
							/>
							<ChartLegend content={<ChartLegendContent />} />
						</LineChart>
					</ChartContainer>
				</CardContent>
			</Card>
		</div>
	);
}
