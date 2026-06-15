import { useState, useMemo, useRef, useEffect } from "react";
import { useLoaderData } from "react-router";
import { getDespesas } from "~/models/despesas.server";
import { getReceitas } from "~/models/receitas.server";
import {
	isMesmoMesAnoDataCivilUTC,
	obterMesAnoAtual,
	obterMesAnoAnterior,
	formatarMesAno,
} from "~/lib/mes-ano";
import { calcularPrecoVenda, verificarPrecoVenda } from "~/utils/financeiro";
import { formatCurrencyBRL } from "~/lib/formatters";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataTable } from "~/components/desp-table";
import { columnsCalculadoraPreco } from "~/components/columns-calculadora-preco";

export async function loader() {
	// Usa o mês anterior como referência: o mês corrente costuma estar incompleto.
	const { mes, ano } = obterMesAnoAnterior(obterMesAnoAtual());

	const [despesas, receitas] = await Promise.all([getDespesas(), getReceitas()]);

	const despesasMes = despesas.filter((d) =>
		isMesmoMesAnoDataCivilUTC(d.data, mes, ano),
	);
	const receitasMes = receitas.filter((r) =>
		isMesmoMesAnoDataCivilUTC(r.data, mes, ano),
	);

	const totalReceitas = receitasMes.reduce((s, r) => s + (r.valor ?? 0), 0);
	const totalVariaveis = despesasMes
		.filter((d) => d.tipo === "variavel" && d.conta !== "Revenda")
		.reduce((s, d) => s + (d.valor ?? 0), 0);
	const totalFixas = despesasMes
		.filter((d) => d.tipo === "fixo")
		.reduce((s, d) => s + (d.valor ?? 0), 0);

	const pctVariaveis =
		totalReceitas > 0
			? parseFloat(((totalVariaveis / totalReceitas) * 100).toFixed(2))
			: 0;
	const pctFixas =
		totalReceitas > 0
			? parseFloat(((totalFixas / totalReceitas) * 100).toFixed(2))
			: 0;

	return {
		pctVariaveis,
		pctFixas,
		mes,
		ano,
		temDados: totalReceitas > 0,
	};
}

type ProdutoImportado = {
	codigo: string;
	produto: string;
	unidade: string;
	custo: number;
	venda: number;
};

/** Chave usada para persistir a última importação no navegador. */
const STORAGE_KEY = "calculadora-preco:importacao";

type ImportacaoSalva = {
	nomeArquivo: string | null;
	produtos: ProdutoImportado[];
};

/**
 * Lê o JSON exportado do catálogo de produtos. Aceita um objeto único ou um
 * array. Os campos numéricos vêm como string (ex.: "55.0000") com ponto decimal.
 */
function parseProdutosJSON(texto: string): ProdutoImportado[] {
	const dados = JSON.parse(texto);
	const lista: any[] = Array.isArray(dados) ? dados : [dados];

	return lista
		.map((item) => ({
			codigo: String(item["Cód. Produto"] ?? "").trim(),
			produto: String(item["Produto"] ?? "").trim(),
			unidade: String(item["Unidade de Medida"] ?? "").trim(),
			custo: parseFloat(String(item["Vr Custo"] ?? "").replace(",", ".")) || 0,
			venda: parseFloat(String(item["Vr. Venda"] ?? "").replace(",", ".")) || 0,
		}))
		.filter((p) => p.produto.length > 0);
}

export default function CalculadoraPreco() {
	const { pctVariaveis, pctFixas, mes, ano, temDados } =
		useLoaderData<typeof loader>();

	const [modo, setModo] = useState<"calcular" | "verificar" | "importar">(
		"calcular",
	);
	const [custo, setCusto] = useState("");
	const [pctFixosInput, setPctFixos] = useState(String(pctFixas));
	const [pctVariaveisInput, setPctVariaveis] = useState(String(pctVariaveis));
	const [pctLucro, setPctLucro] = useState("10");
	const [preco, setPreco] = useState("");

	const [produtos, setProdutos] = useState<ProdutoImportado[]>([]);
	const [erroImport, setErroImport] = useState<string | null>(null);
	const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Restaura a última importação salva no navegador (somente no cliente).
	useEffect(() => {
		try {
			const salvo = localStorage.getItem(STORAGE_KEY);
			if (!salvo) return;
			const dados = JSON.parse(salvo) as ImportacaoSalva;
			if (Array.isArray(dados.produtos) && dados.produtos.length > 0) {
				setProdutos(dados.produtos);
				setNomeArquivo(dados.nomeArquivo ?? null);
			}
		} catch {
			localStorage.removeItem(STORAGE_KEY);
		}
	}, []);

	const custoNum = parseFloat(custo) || 0;
	const pctFixosNum = parseFloat(pctFixosInput) || 0;
	const pctVariaveisNum = parseFloat(pctVariaveisInput) || 0;
	const pctLucroNum = parseFloat(pctLucro) || 0;
	const precoNum = parseFloat(preco) || 0;

	const resultadoCalculo = useMemo(
		() =>
			calcularPrecoVenda({
				custo: custoNum,
				pctFixos: pctFixosNum,
				pctVariaveis: pctVariaveisNum,
				pctLucro: pctLucroNum,
			}),
		[custoNum, pctFixosNum, pctVariaveisNum, pctLucroNum],
	);

	const resultadoVerificacao = useMemo(
		() =>
			verificarPrecoVenda({
				custo: custoNum,
				preco: precoNum,
				pctFixos: pctFixosNum,
				pctVariaveis: pctVariaveisNum,
			}),
		[custoNum, precoNum, pctFixosNum, pctVariaveisNum],
	);

	async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
		const arquivo = e.target.files?.[0];
		if (!arquivo) return;
		setErroImport(null);
		try {
			const texto = await arquivo.text();
			const lista = parseProdutosJSON(texto);
			if (lista.length === 0) {
				setProdutos([]);
				setNomeArquivo(arquivo.name);
				setErroImport("Nenhum produto válido encontrado no arquivo.");
				return;
			}
			setProdutos(lista);
			setNomeArquivo(arquivo.name);
			try {
				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify({ nomeArquivo: arquivo.name, produtos: lista }),
				);
			} catch {
				/* localStorage indisponível — segue apenas em memória */
			}
		} catch {
			setProdutos([]);
			setNomeArquivo(arquivo.name);
			setErroImport("Arquivo inválido. Verifique se é um JSON válido.");
		}
	}

	function limparImportacao() {
		setProdutos([]);
		setNomeArquivo(null);
		setErroImport(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			/* localStorage indisponível */
		}
	}

	const analiseProdutos = useMemo(() => {
		const linhas = produtos.map((p, i) => {
			const resultado = verificarPrecoVenda({
				custo: p.custo,
				preco: p.venda,
				pctFixos: pctFixosNum,
				pctVariaveis: pctVariaveisNum,
			});
			const sugerido = calcularPrecoVenda({
				custo: p.custo,
				pctFixos: pctFixosNum,
				pctVariaveis: pctVariaveisNum,
				pctLucro: pctLucroNum,
			});
			return {
				...p,
				id: p.codigo ? `${p.codigo}-${i}` : `linha-${i}`,
				resultado,
				precoSugerido: sugerido?.precoSugerido ?? null,
			};
		});

		const resumo = linhas.reduce(
			(acc, l) => {
				const status = l.resultado?.status;
				if (status === "LUCRATIVO") acc.lucrativo++;
				else if (status === "PREJUÍZO") acc.prejuizo++;
				else if (status === "BREAK-EVEN") acc.breakEven++;
				return acc;
			},
			{ lucrativo: 0, prejuizo: 0, breakEven: 0 },
		);

		return { linhas, resumo };
	}, [produtos, pctFixosNum, pctVariaveisNum, pctLucroNum]);

	const refMes = formatarMesAno(mes, ano);

	return (
		<div className='container mx-auto max-w-6xl p-6 space-y-6'>
			<div>
				<h1 className='text-2xl font-bold'>Calculadora de Preço de Venda</h1>
				<p className='text-muted-foreground text-sm mt-1'>
					Método Mark-up Divisor
				</p>
			</div>

			{!temDados && (
				<div className='rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800'>
					Sem receitas registradas em {refMes}. Os percentuais foram zerados —
					ajuste manualmente.
				</div>
			)}

			{temDados && (
				<div className='rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800'>
					Percentuais calculados com base nas despesas e receitas de {refMes}.
					Você pode editar os valores abaixo.
				</div>
			)}

			{/* Toggle de modo */}
			<div className='flex gap-2'>
				<Button
					variant={modo === "calcular" ? "default" : "outline"}
					onClick={() => setModo("calcular")}
					size='sm'>
					Calcular Preço
				</Button>
				<Button
					variant={modo === "verificar" ? "default" : "outline"}
					onClick={() => setModo("verificar")}
					size='sm'>
					Verificar Preço
				</Button>
				<Button
					variant={modo === "importar" ? "default" : "outline"}
					onClick={() => setModo("importar")}
					size='sm'>
					Importar JSON
				</Button>
			</div>

			{/* Entradas */}
			<Card>
				<CardHeader>
					<CardTitle className='text-base'>Dados de Entrada</CardTitle>
					{modo === "calcular" && (
						<CardDescription>
							Informe o custo e os percentuais para calcular o preço sugerido.
						</CardDescription>
					)}
					{modo === "verificar" && (
						<CardDescription>
							Informe o custo e o preço atual para verificar se é lucrativo.
						</CardDescription>
					)}
					{modo === "importar" && (
						<CardDescription>
							Os percentuais abaixo são aplicados a cada produto do arquivo.
						</CardDescription>
					)}
				</CardHeader>
				<CardContent className='space-y-4'>
					{modo !== "importar" && (
					<div className='grid grid-cols-2 gap-4'>
						<div className='space-y-1'>
							<Label htmlFor='custo'>Custo unitário (R$)</Label>
							<Input
								id='custo'
								type='number'
								min='0'
								step='0.01'
								placeholder='0,00'
								value={custo}
								onChange={(e) => setCusto(e.target.value)}
							/>
						</div>
						{modo === "verificar" && (
							<div className='space-y-1'>
								<Label htmlFor='preco'>Preço de venda atual (R$)</Label>
								<Input
									id='preco'
									type='number'
									min='0'
									step='0.01'
									placeholder='0,00'
									value={preco}
									onChange={(e) => setPreco(e.target.value)}
								/>
							</div>
						)}
					</div>
					)}

					<div className='grid grid-cols-3 gap-4'>
						<div className='space-y-1'>
							<Label htmlFor='pctFixos'>% Custos fixos</Label>
							<Input
								id='pctFixos'
								type='number'
								min='0'
								max='99'
								step='0.01'
								value={pctFixosInput}
								onChange={(e) => setPctFixos(e.target.value)}
							/>
						</div>
						<div className='space-y-1'>
							<Label htmlFor='pctVariaveis'>% Despesas variáveis</Label>
							<Input
								id='pctVariaveis'
								type='number'
								min='0'
								max='99'
								step='0.01'
								value={pctVariaveisInput}
								onChange={(e) => setPctVariaveis(e.target.value)}
							/>
						</div>
						{modo !== "verificar" && (
							<div className='space-y-1'>
								<Label htmlFor='pctLucro'>% Lucro desejado</Label>
								<Input
									id='pctLucro'
									type='number'
									min='0'
									max='99'
									step='0.01'
									value={pctLucro}
									onChange={(e) => setPctLucro(e.target.value)}
								/>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Resultado — Calcular */}
			{modo === "calcular" && (
				<Card>
					<CardHeader>
						<CardTitle className='text-base'>Resultado</CardTitle>
					</CardHeader>
					<CardContent>
						{!resultadoCalculo ? (
							<p className='text-sm text-muted-foreground'>
								{custoNum <= 0
									? "Informe o custo do produto."
									: "A soma dos percentuais deve ser menor que 100%."}
							</p>
						) : (
							<div className='space-y-4'>
								<div className='flex items-center justify-between rounded-lg border p-4 bg-primary/5'>
									<div>
										<p className='text-sm font-medium text-muted-foreground'>
											Preço sugerido
										</p>
										<p className='text-3xl font-bold text-primary'>
											{formatCurrencyBRL(resultadoCalculo.precoSugerido)}
										</p>
										<p className='text-xs text-muted-foreground mt-1'>
											Mark-up: {resultadoCalculo.markup.toFixed(2)}×
										</p>
									</div>
									<Badge variant='secondary' className='text-sm'>
										{pctLucroNum}% lucro
									</Badge>
								</div>

								{resultadoCalculo.precoMinimo !== null && (
									<div className='flex items-center justify-between rounded-lg border p-3'>
										<div>
											<p className='text-sm font-medium text-muted-foreground'>
												Preço mínimo (break-even)
											</p>
											<p className='text-xl font-semibold'>
												{formatCurrencyBRL(resultadoCalculo.precoMinimo)}
											</p>
										</div>
										<Badge variant='outline'>sem lucro</Badge>
									</div>
								)}

								<div className='grid grid-cols-3 gap-3 text-sm'>
									<div className='rounded border p-2 text-center'>
										<p className='text-muted-foreground text-xs'>Custo</p>
										<p className='font-medium'>
											{formatCurrencyBRL(custoNum)}
										</p>
									</div>
									<div className='rounded border p-2 text-center'>
										<p className='text-muted-foreground text-xs'>
											Fixos + Variáveis
										</p>
										<p className='font-medium'>
											{(pctFixosNum + pctVariaveisNum).toFixed(1)}%
										</p>
									</div>
									<div className='rounded border p-2 text-center'>
										<p className='text-muted-foreground text-xs'>
											Lucro desejado
										</p>
										<p className='font-medium'>{pctLucroNum.toFixed(1)}%</p>
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Resultado — Verificar */}
			{modo === "verificar" && (
				<Card>
					<CardHeader>
						<CardTitle className='text-base'>Resultado da Verificação</CardTitle>
					</CardHeader>
					<CardContent>
						{!resultadoVerificacao ? (
							<p className='text-sm text-muted-foreground'>
								{custoNum < 0 || precoNum <= 0
									? "Informe o custo e o preço de venda."
									: "Valores inválidos."}
							</p>
						) : (
							<div className='space-y-4'>
								<div className='flex items-center justify-between rounded-lg border p-4'>
									<div>
										<p className='text-sm font-medium text-muted-foreground'>
											Sobra após todos os custos
										</p>
										<p
											className={`text-3xl font-bold ${
												resultadoVerificacao.sobraReal > 0
													? "text-green-600"
													: resultadoVerificacao.sobraReal < 0
														? "text-red-600"
														: "text-yellow-600"
											}`}>
											{formatCurrencyBRL(resultadoVerificacao.sobraReal)}
										</p>
										<p className='text-xs text-muted-foreground mt-1'>
											por unidade vendida
										</p>
									</div>
									<Badge
										className={`text-sm ${
											resultadoVerificacao.status === "LUCRATIVO"
												? "bg-green-100 text-green-800 border-green-300"
												: resultadoVerificacao.status === "PREJUÍZO"
													? "bg-red-100 text-red-800 border-red-300"
													: "bg-yellow-100 text-yellow-800 border-yellow-300"
										}`}
										variant='outline'>
										{resultadoVerificacao.status}
									</Badge>
								</div>

								<div className='grid grid-cols-2 gap-3 text-sm'>
									<div className='rounded border p-2 text-center'>
										<p className='text-muted-foreground text-xs'>Margem bruta</p>
										<p className='font-medium'>
											{resultadoVerificacao.margemBruta.toFixed(1)}%
										</p>
									</div>
									<div className='rounded border p-2 text-center'>
										<p className='text-muted-foreground text-xs'>
											Custo / Preço
										</p>
										<p className='font-medium'>
											{formatCurrencyBRL(custoNum)} /{" "}
											{formatCurrencyBRL(precoNum)}
										</p>
									</div>
									<div className='rounded border p-2 text-center'>
										<p className='text-muted-foreground text-xs'>
											Fixos ({pctFixosNum.toFixed(1)}%)
										</p>
										<p className='font-medium'>
											−{formatCurrencyBRL((precoNum * pctFixosNum) / 100)}
										</p>
									</div>
									<div className='rounded border p-2 text-center'>
										<p className='text-muted-foreground text-xs'>
											Variáveis ({pctVariaveisNum.toFixed(1)}%)
										</p>
										<p className='font-medium'>
											−{formatCurrencyBRL((precoNum * pctVariaveisNum) / 100)}
										</p>
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Importar JSON */}
			{modo === "importar" && (
				<>
					<Card>
						<CardHeader>
							<CardTitle className='text-base'>Arquivo de produtos</CardTitle>
							<CardDescription>
								Envie um JSON com seus produtos (campos{" "}
								<code>Vr. Venda</code> e <code>Vr Custo</code>). Aceita um
								objeto ou uma lista. A importação fica salva neste navegador —
								só é preciso reimportar se você quiser atualizar.
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-3'>
							<Input
								ref={fileInputRef}
								type='file'
								accept='.json,application/json'
								onChange={handleArquivo}
							/>
							{nomeArquivo && (
								<div className='flex items-center justify-between text-sm'>
									<span className='text-muted-foreground'>
										{nomeArquivo}
										{produtos.length > 0 &&
											` — ${produtos.length} produto(s)`}
									</span>
									<Button
										variant='ghost'
										size='sm'
										onClick={limparImportacao}>
										Limpar
									</Button>
								</div>
							)}
							{erroImport && (
								<div className='rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800'>
									{erroImport}
								</div>
							)}
						</CardContent>
					</Card>

					{produtos.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className='text-base'>
									Análise dos preços
								</CardTitle>
								<CardDescription>
									Fixos {pctFixosNum.toFixed(1)}% · Variáveis{" "}
									{pctVariaveisNum.toFixed(1)}% · Lucro alvo{" "}
									{pctLucroNum.toFixed(1)}%
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-4'>
								<div className='flex flex-wrap gap-3 text-sm'>
									<Badge className='bg-green-100 text-green-800 border-green-300' variant='outline'>
										{analiseProdutos.resumo.lucrativo} lucrativo(s)
									</Badge>
									<Badge className='bg-yellow-100 text-yellow-800 border-yellow-300' variant='outline'>
										{analiseProdutos.resumo.breakEven} no limite
									</Badge>
									<Badge className='bg-red-100 text-red-800 border-red-300' variant='outline'>
										{analiseProdutos.resumo.prejuizo} em prejuízo
									</Badge>
								</div>

								<DataTable
									columns={columnsCalculadoraPreco}
									data={analiseProdutos.linhas}
									enableGlobalFilter
									globalFilterPlaceholder='Buscar por código, produto, status...'
								/>
							</CardContent>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
