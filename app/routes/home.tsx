import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { getReceitas } from "~/models/receitas.server";
import type { Route } from "./+types/home";
import { calcularSaudeFinanceira } from "~/utils/financeiro";
import { getCompras } from "~/models/compras.server";
import { getDespesas } from "~/models/despesas.server";
import { useMesAnoContext } from "~/context/mes-ano-context";
import { obterMesAnoAtual } from "~/lib/mes-ano";
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
import { getEstoqueMesAnterior, getEstoqueMesAtual } from "~/models/estoque";
import React from "react";

//grafico de area

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Brassaco ADM" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}
type ItemComDataValor = { data: Date | string | null; valor: number | null };
type ItemComPago = { pago?: boolean | null };

type MesAno = { mes: number; ano: number };

function toDate(value: Date | string | null) {
	if (!value) return null;
	return value instanceof Date ? value : new Date(value);
}

function isMesmoMesAno(data: Date | string | null, mes: number, ano: number) {
	const date = toDate(data);
	if (!date) return false;
	return date.getFullYear() === ano && date.getMonth() + 1 === mes;
}

function filtrarPorMesAno<T extends ItemComDataValor>(
	itens: T[],
	mes: number,
	ano: number,
) {
	return itens.filter((item) => isMesmoMesAno(item.data, mes, ano));
}

function somarValores(itens: ItemComDataValor[]) {
	return itens.reduce((total, item) => total + Number(item.valor || 0), 0);
}

function filtrarDespesasPagas<T extends ItemComPago>(itens: T[]) {
	return itens.filter((item) => item.pago === true);
}

function obterMesAnoAnterior({ mes, ano }: MesAno) {
	if (mes === 1) {
		return { mes: 12, ano: ano - 1 };
	}
	return { mes: mes - 1, ano };
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
	compras: number,
	variaveis: number,
	fixas: number,
) {
	const margemRS = faturamento - (compras + variaveis);
	return margemRS - fixas;
}

function formatarChaveData(value: Date | string | null) {
	const date = toDate(value);
	if (!date) return null;
	return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
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
	const ultimoDia = new Date(ano, mes, 0).getDate();
	const dias: string[] = [];
	for (let dia = 1; dia <= ultimoDia; dia += 1) {
		const data = new Date(Date.UTC(ano, mes - 1, dia));
		dias.push(
			data.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
		);
	}
	return dias;
}

type ChartMode = "diario" | "acumulado";

function criarSerieChart(
	dias: string[],
	receitasMap: Map<string, number>,
	despesasMap: Map<string, number>,
	comprasMap: Map<string, number>,
	despesasComprasMap: Map<string, number>,
	variaveisMap: Map<string, number>,
	fixasMap: Map<string, number>,
	lucroRealMensal: number,
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
		const despesasComprasDia = despesasComprasMap.get(dia) ?? 0;
		const variaveisDia = variaveisMap.get(dia) ?? 0;
		const fixasDia = fixasMap.get(dia) ?? 0;
		const lucroLiquidoDia = calcularLucroLiquido(
			receitasDia,
			despesasComprasDia,
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
		const d = toDate(data);
		if (!d) return;
		const mes = d.getMonth() + 1;
		const ano = d.getFullYear();
		chaves.add(`${mes}-${ano}`);
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
	const estoqueAtual = await getEstoqueMesAtual();
	const estoqueAnterior = await getEstoqueMesAnterior();
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
		estoqueAtual,
		estoqueAnterior,
	};
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
		estoqueAtual,
		estoqueAnterior,
	} = loaderData;
	const mesAnoContext = useMesAnoContext();
	const mesAnoSelecionado = mesAnoContext?.mesAno ?? mesAno;
	const [chartMode, setChartMode] = useState<ChartMode>("acumulado");

	const receitasFiltradas = useMemo(
		() =>
			filtrarPorMesAno(receitas, mesAnoSelecionado.mes, mesAnoSelecionado.ano),
		[receitas, mesAnoSelecionado.mes, mesAnoSelecionado.ano],
	);
	const comprasFiltradas = useMemo(
		() =>
			filtrarPorMesAno(compras, mesAnoSelecionado.mes, mesAnoSelecionado.ano),
		[compras, mesAnoSelecionado.mes, mesAnoSelecionado.ano],
	);
	const despesasFiltradas = useMemo(
		() =>
			filtrarPorMesAno(
				despesasPagas,
				mesAnoSelecionado.mes,
				mesAnoSelecionado.ano,
			),
		[despesasPagas, mesAnoSelecionado.mes, mesAnoSelecionado.ano],
	);
	const mesAnoAnterior = useMemo(
		() => obterMesAnoAnterior(mesAnoSelecionado),
		[mesAnoSelecionado.mes, mesAnoSelecionado.ano],
	);
	const receitasAnteriorFiltradas = useMemo(
		() => filtrarPorMesAno(receitas, mesAnoAnterior.mes, mesAnoAnterior.ano),
		[receitas, mesAnoAnterior.mes, mesAnoAnterior.ano],
	);
	const comprasAnteriorFiltradas = useMemo(
		() => filtrarPorMesAno(compras, mesAnoAnterior.mes, mesAnoAnterior.ano),
		[compras, mesAnoAnterior.mes, mesAnoAnterior.ano],
	);
	const despesasAnteriorFiltradas = useMemo(
		() =>
			filtrarPorMesAno(despesasPagas, mesAnoAnterior.mes, mesAnoAnterior.ano),
		[despesasPagas, mesAnoAnterior.mes, mesAnoAnterior.ano],
	);
	const despesasVariaveis = useMemo(
		() => despesasFiltradas.filter((d) => d.tipo === "variavel"),
		[despesasFiltradas],
	);
	const despesasVariaveisSemCompras = useMemo(
		() => despesasVariaveis.filter((d) => d.conta !== "Revenda"),
		[despesasVariaveis],
	);
	const despesasCompras = useMemo(
		() => despesasFiltradas.filter((d) => d.conta === "Revenda"),
		[despesasFiltradas],
	);
	const despesasComprasAnterior = useMemo(
		() => despesasAnteriorFiltradas.filter((d) => d.conta === "Revenda"),
		[despesasAnteriorFiltradas],
	);

	const despesasFixas = useMemo(
		() => despesasFiltradas.filter((d) => d.tipo === "fixo"),
		[despesasFiltradas],
	);
	const despesasVariaveisAnterior = useMemo(
		() => despesasAnteriorFiltradas.filter((d) => d.tipo === "variavel"),
		[despesasAnteriorFiltradas],
	);
	const despesasFixasAnterior = useMemo(
		() => despesasAnteriorFiltradas.filter((d) => d.tipo === "fixo"),
		[despesasAnteriorFiltradas],
	);
	const totais = useMemo(
		() => ({
			receitas: somarValores(receitasFiltradas),
			receitasAnterior: somarValores(receitasAnteriorFiltradas),
			compras: somarValores(comprasFiltradas),
			comprasAnterior: somarValores(comprasAnteriorFiltradas),
			despesas: somarValores(despesasFiltradas),
			despesasAnterior: somarValores(despesasAnteriorFiltradas),
			despesasVariaveis:
				somarValores(despesasVariaveis) - somarValores(despesasCompras),
			despesasFixas: somarValores(despesasFixas),
			despesasVariaveisAnterior: somarValores(despesasVariaveisAnterior),
			despesasFixasAnterior: somarValores(despesasFixasAnterior),
			despesasCompras: somarValores(despesasCompras),
			despesasComprasAnterior: somarValores(despesasComprasAnterior),
		}),
		[
			receitasFiltradas,
			receitasAnteriorFiltradas,
			comprasFiltradas,
			comprasAnteriorFiltradas,
			despesasFiltradas,
			despesasAnteriorFiltradas,
			despesasVariaveis,
			despesasFixas,
			despesasVariaveisAnterior,
			despesasFixasAnterior,
			despesasCompras,
			despesasComprasAnterior,
		],
	);
	const variacaoReceitas = useMemo(
		() => calcularVariacaoPercentual(totais.receitas, totais.receitasAnterior),
		[totais.receitas, totais.receitasAnterior],
	);
	const variacaoReceitasTexto = `${variacaoReceitas >= 0 ? "+" : ""}${variacaoReceitas.toFixed(1)}%`;
	const variacaoCompras = useMemo(
		() => calcularVariacaoPercentual(totais.compras, totais.comprasAnterior),
		[totais.compras, totais.comprasAnterior],
	);
	const variacaoComprasTexto = `${variacaoCompras >= 0 ? "+" : ""}${variacaoCompras.toFixed(1)}%`;
	const variacaoDespesas = useMemo(
		() => calcularVariacaoPercentual(totais.despesas, totais.despesasAnterior),
		[totais.despesas, totais.despesasAnterior],
	);
	const variacaoDespesasTexto = `${variacaoDespesas >= 0 ? "+" : ""}${variacaoDespesas.toFixed(1)}%`;
	const lucroLiquidoAtual = useMemo(
		() =>
			calcularLucroLiquido(
				totais.receitas,
				totais.compras,
				totais.despesasVariaveis,
				totais.despesasFixas,
			),
		[
			totais.receitas,
			totais.compras,
			totais.despesasVariaveis,
			totais.despesasFixas,
		],
	);
	const lucroLiquidoAnterior = useMemo(
		() =>
			calcularLucroLiquido(
				totais.receitasAnterior,
				totais.comprasAnterior,
				totais.despesasVariaveisAnterior,
				totais.despesasFixasAnterior,
			),
		[
			totais.receitasAnterior,
			totais.comprasAnterior,
			totais.despesasVariaveisAnterior,
			totais.despesasFixasAnterior,
		],
	);
	const variacaoLucroLiquido = useMemo(
		() => calcularVariacaoPercentual(lucroLiquidoAtual, lucroLiquidoAnterior),
		[lucroLiquidoAtual, lucroLiquidoAnterior],
	);
	const variacaoLucroLiquidoTexto = `${variacaoLucroLiquido >= 0 ? "+" : ""}${variacaoLucroLiquido.toFixed(1)}%`;

	const estoqueAtualTotal = estoqueAtual[0]?.valor ?? 0;
	const estoqueAnteriorTotal = estoqueAnterior[0]?.valor ?? 0;

	const dadosFinanceiros = {
		faturamento: totais.receitas,
		compras: totais.compras,
		variaveis: totais.despesasVariaveis,
		fixas: totais.despesasFixas,
	};

	const saudeFinanceira = calcularSaudeFinanceira({
		faturamento: dadosFinanceiros.faturamento,
		compras: dadosFinanceiros.compras,
		variaveis: dadosFinanceiros.variaveis,
		fixas: dadosFinanceiros.fixas,
		estoqueAtual: estoqueAtualTotal,
		estoqueAnterior: estoqueAnteriorTotal,
		despesasCompras: totais.despesasCompras,
		despesasComprasAnterior: totais.despesasComprasAnterior,
	});
	const chartData = useMemo(() => {
		const dias = criarDiasMes(mesAnoSelecionado.mes, mesAnoSelecionado.ano);
		const receitasMap = criarMapaDiario(receitasFiltradas);
		const despesasMap = criarMapaDiario(despesasFiltradas);
		const comprasMap = criarMapaDiario(comprasFiltradas);
		const despesasComprasMap = criarMapaDiario(despesasCompras);
		const variaveisMap = criarMapaDiario(despesasVariaveisSemCompras);
		const fixasMap = criarMapaDiario(despesasFixas);
		return criarSerieChart(
			dias,
			receitasMap,
			despesasMap,
			comprasMap,
			despesasComprasMap,
			variaveisMap,
			fixasMap,
			saudeFinanceira.lucroLiquidoReal,
			chartMode,
		);
	}, [
		receitasFiltradas,
		despesasFiltradas,
		comprasFiltradas,
		despesasCompras,
		despesasVariaveisSemCompras,
		despesasFixas,
		mesAnoSelecionado.mes,
		mesAnoSelecionado.ano,
		saudeFinanceira.lucroLiquidoReal,
		chartMode,
	]);

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
							Lucratividade: {saudeFinanceira.lucratividade.toFixed(2)}%
						</CardDescription>
					</CardFooter>
				</Card>
				<Card className='@container/card'>
					<CardHeader>
						<CardDescription className=''>Lucro real</CardDescription>
						<CardTitle className='text-2xl  tabular-nums @[250px]/card:text-xl font-light font-mono'>
							{formatCurrencyBRL(saudeFinanceira.lucroLiquidoReal)}
						</CardTitle>
						<CardAction className='flex max-w-[96px] items-center justify-end overflow-hidden'></CardAction>
					</CardHeader>
					<CardFooter>
						<CardDescription>
							Lucratividade Real: {saudeFinanceira.lucratividadeReal.toFixed(2)}
							%
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
							Margem por produto: {saudeFinanceira.margemContribuicaoPerc}%
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
								tickFormatter={(value) => {
									const date = new Date(value);
									return date.toLocaleDateString("pt-BR", {
										month: "short",
										day: "numeric",
									});
								}}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(value) => {
											return new Date(value).toLocaleDateString("pt-BR", {
												month: "short",
												day: "numeric",
											});
										}}
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
		</div>
	);
}
