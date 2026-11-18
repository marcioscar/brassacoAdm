import {
	Check,
	ChevronLeft,
	Copy,
	ChevronRight,
	ClipboardCheck,
	Search,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { DialogFuncionario } from "~/components/folha/dialog-funcionario";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	deslocarMes,
	ehDecimoTerceiro,
	formatarMesFechamento,
	ROTULO_TIPO,
	TIPOS_LANCAMENTO,
	type Fechamento,
	type LinhaFechamento,
	type MesFechamento,
	type TipoLancamento,
} from "~/lib/folha";
import { cn } from "~/lib/utils";

const MESES = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro",
];

const AJUDA_TIPO: Record<TipoLancamento, string | null> = {
	salario: null,
	decimo_1:
		"Sugestão: metade do último salário. Prazo legal: 30/11. Não calcula o proporcional de quem entrou no ano; ajuste o valor quando precisar.",
	decimo_2:
		"Sugestão: último salário menos a 1ª parcela, sem descontar INSS e IR; ajuste o valor líquido. Prazo legal: 20/12.",
};

type Filtro = "todos" | "pendentes" | "pagos";

const formatoMoeda = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

function moeda(v: number | null | undefined): string {
	return v == null ? "-" : formatoMoeda.format(v);
}

function valorParaInput(v: number | null): string {
	return v == null ? "" : v.toFixed(2).replace(".", ",");
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
function parseValor(texto: string): number | null {
	const limpo = texto.trim().replace(/^R\$\s*/, "");
	if (!limpo) return null;
	const normalizado = limpo.includes(",")
		? limpo.replace(/\./g, "").replace(",", ".")
		: limpo;
	const num = Number(normalizado);
	return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

function dataCurta(iso: string): string {
	const [, m, d] = iso.split("-");
	return `${d}/${m}`;
}

/** "pix: 123..." -> "123...": copia só a chave; dados bancários vão inteiros. */
function textoParaCopiar(conta: string): string {
	const semPrefixo = conta.replace(/^\s*pix\s*[:▸-]?\s*/i, "").trim();
	return semPrefixo || conta.trim();
}

function href(periodo: MesFechamento, tipo: TipoLancamento): string {
	return `?mes=${formatarMesFechamento(periodo)}&tipo=${tipo}`;
}

function rotuloMes({ ano, mes }: MesFechamento): string {
	return `${MESES[mes - 1]}/${ano}`;
}

type Props = {
	fechamento: Fechamento;
	mesAtual: MesFechamento;
	hoje: string;
};

export function FechamentoFolha({ fechamento, mesAtual, hoje }: Props) {
	const { periodo, tipo, linhas, totais, dataMin, dataMax } = fechamento;
	const fetcher = useFetcher<{ success?: boolean; error?: string }>();
	const salvandoIds = useRef<string[]>([]);

	const [edicoes, setEdicoes] = useState<Record<string, string>>({});
	const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
	const [filtro, setFiltro] = useState<Filtro>("todos");
	const [busca, setBusca] = useState("");
	const [dataPagamento, setDataPagamento] = useState(() =>
		hoje < dataMin ? dataMin : hoje > dataMax ? dataMax : hoje,
	);

	// Depois de salvar, as linhas gravadas passam a mostrar o valor do banco.
	useEffect(() => {
		if (fetcher.state !== "idle" || !fetcher.data?.success) return;
		const salvos = salvandoIds.current;
		if (salvos.length === 0) return;
		salvandoIds.current = [];
		setSelecionados(new Set());
		setEdicoes((atual) => {
			const proximo = { ...atual };
			for (const id of salvos) delete proximo[id];
			return proximo;
		});
	}, [fetcher.state, fetcher.data]);

	const textoValor = (linha: LinhaFechamento) =>
		edicoes[linha.folhaId] ?? valorParaInput(linha.sugestao);

	const visiveis = useMemo(() => {
		const termo = busca.trim().toLowerCase();
		return linhas.filter((l) => {
			if (termo && !l.nome.toLowerCase().includes(termo)) return false;
			if (filtro === "pagos") return l.lancamento?.pago === true;
			if (filtro === "pendentes") return l.lancamento?.pago !== true;
			return true;
		});
	}, [linhas, busca, filtro]);

	const selecionadosVisiveis = visiveis.filter((l) =>
		selecionados.has(l.folhaId),
	);
	const todosVisiveisMarcados =
		visiveis.length > 0 && selecionadosVisiveis.length === visiveis.length;

	const linhasSelecionadas = linhas.filter((l) => selecionados.has(l.folhaId));
	const itensSelecionados = linhasSelecionadas.map((l) => ({
		folhaId: l.folhaId,
		nome: l.nome,
		valor: parseValor(textoValor(l)),
	}));
	const invalidos = itensSelecionados.filter((i) => i.valor == null);
	const totalSelecionado = itensSelecionados.reduce(
		(acc, i) => acc + (i.valor ?? 0),
		0,
	);
	const ocupado = fetcher.state !== "idle";

	function alternar(id: string, marcado: boolean) {
		setSelecionados((atual) => {
			const proximo = new Set(atual);
			if (marcado) proximo.add(id);
			else proximo.delete(id);
			return proximo;
		});
	}

	function alternarTodos(marcado: boolean) {
		setSelecionados((atual) => {
			const proximo = new Set(atual);
			for (const l of visiveis) {
				if (marcado) proximo.add(l.folhaId);
				else proximo.delete(l.folhaId);
			}
			return proximo;
		});
	}

	function salvar(pago: boolean) {
		if (itensSelecionados.length === 0 || invalidos.length > 0) return;
		salvandoIds.current = itensSelecionados.map((i) => i.folhaId);
		fetcher.submit(
			{
				intent: "salvarLancamentos",
				tipo,
				mes: formatarMesFechamento(periodo),
				data: dataPagamento,
				pago: pago ? "1" : "0",
				itens: JSON.stringify(
					itensSelecionados.map(({ folhaId, valor }) => ({ folhaId, valor })),
				),
			},
			{ method: "post" },
		);
	}

	function remover(folhaId: string) {
		salvandoIds.current = [folhaId];
		fetcher.submit(
			{
				intent: "removerLancamento",
				tipo,
				mes: formatarMesFechamento(periodo),
				folhaId,
			},
			{ method: "post" },
		);
	}

	const ehMesAtual =
		periodo.ano === mesAtual.ano && periodo.mes === mesAtual.mes;
	const pendentes = totais.semLancamento + totais.aPagarQtd;
	const decimo = ehDecimoTerceiro(tipo);

	return (
		<Card>
			<CardHeader>
				<div className='flex items-center gap-2'>
					<ClipboardCheck className='h-5 w-5 text-orange-500' />
					<CardTitle>Fechamento de {rotuloMes(periodo)}</CardTitle>
				</div>
				<CardDescription>
					Confira o valor, marque as pessoas e salve. O que for pago entra
					sozinho em Despesas (conta Pessoal).
				</CardDescription>
				<CardAction className='flex items-center gap-1'>
					<Button asChild size='icon-sm' variant='outline'>
						<Link
							to={href(deslocarMes(periodo, -1), tipo)}
							preventScrollReset
							aria-label='Mês anterior'>
							<ChevronLeft />
						</Link>
					</Button>
					{!ehMesAtual && (
						<Button asChild size='sm' variant='outline'>
							<Link to={href(mesAtual, tipo)} preventScrollReset>
								Mês atual
							</Link>
						</Button>
					)}
					<Button asChild size='icon-sm' variant='outline'>
						<Link
							to={href(deslocarMes(periodo, 1), tipo)}
							preventScrollReset
							aria-label='Próximo mês'>
							<ChevronRight />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent className='space-y-4'>
				<div className='flex flex-wrap gap-1'>
					{TIPOS_LANCAMENTO.map((t) => (
						<Button
							key={t}
							asChild
							size='sm'
							variant={t === tipo ? "default" : "outline"}>
							<Link to={href(periodo, t)} preventScrollReset>
								{ROTULO_TIPO[t]}
							</Link>
						</Button>
					))}
				</div>

				{AJUDA_TIPO[tipo] && (
					<p className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800'>
						{AJUDA_TIPO[tipo]}
					</p>
				)}

				<div className='grid gap-3 sm:grid-cols-3'>
					<Resumo
						titulo='Pago'
						valor={moeda(totais.pago)}
						detalhe={`${totais.pagos} pessoa(s)`}
						cor='text-green-600'
					/>
					<Resumo
						titulo='Lançado a pagar'
						valor={moeda(totais.aPagar)}
						detalhe={`${totais.aPagarQtd} pessoa(s)`}
						cor='text-orange-600'
					/>
					<Resumo
						titulo='Faltam'
						valor={`${pendentes} de ${linhas.length}`}
						detalhe={`${totais.semLancamento} sem lançamento`}
						cor={pendentes > 0 ? "text-orange-600" : "text-green-600"}
					/>
				</div>

				<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
					<div className='flex flex-wrap items-center gap-2'>
						{(
							[
								["todos", "Todos"],
								["pendentes", "Faltam pagar"],
								["pagos", "Pagos"],
							] as const
						).map(([valor, rotulo]) => (
							<Button
								key={valor}
								type='button'
								size='sm'
								variant={filtro === valor ? "secondary" : "outline"}
								onClick={() => setFiltro(valor)}>
								{rotulo}
							</Button>
						))}
					</div>
					<div className='flex items-center gap-2'>
						<div className='relative w-full sm:w-56'>
							<Search className='absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground' />
							<Input
								value={busca}
								onChange={(e) => setBusca(e.target.value)}
								placeholder='Buscar funcionário'
								className='pl-8'
							/>
						</div>
						<DialogFuncionario />
					</div>
				</div>

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className='w-8'>
								<Checkbox
									aria-label='Selecionar todos'
									checked={todosVisiveisMarcados}
									onCheckedChange={(c) => alternarTodos(c === true)}
								/>
							</TableHead>
							<TableHead>Funcionário</TableHead>
							<TableHead>Conta / PIX</TableHead>
							<TableHead className='text-right'>
								{decimo ? "Salário base" : "Mês passado"}
							</TableHead>
							<TableHead className='w-40'>Valor</TableHead>
							<TableHead>Situação</TableHead>
							<TableHead className='w-8' />
						</TableRow>
					</TableHeader>
					<TableBody>
						{visiveis.map((linha) => {
							const texto = textoValor(linha);
							const valor = parseValor(texto);
							const variacao =
								!decimo && valor != null && linha.referencia
									? ((valor - linha.referencia) / linha.referencia) * 100
									: null;
							const marcado = selecionados.has(linha.folhaId);
							return (
								<TableRow
									key={linha.folhaId}
									data-state={marcado ? "selected" : undefined}>
									<TableCell>
										<Checkbox
											aria-label={`Selecionar ${linha.nome}`}
											checked={marcado}
											onCheckedChange={(c) =>
												alternar(linha.folhaId, c === true)
											}
										/>
									</TableCell>
									<TableCell>
										<div className='flex items-center gap-1'>
											<span className='font-medium'>{linha.nome}</span>
											<DialogFuncionario
												funcionario={{
													folhaId: linha.folhaId,
													nome: linha.nome,
													conta: linha.conta,
												}}
											/>
										</div>
									</TableCell>
									<TableCell>
										<ContaPix conta={linha.conta} />
									</TableCell>
									<TableCell className='text-right text-muted-foreground'>
										{moeda(linha.referencia)}
									</TableCell>
									<TableCell>
										<div className='flex items-center gap-2'>
											<Input
												aria-label={`Valor de ${linha.nome}`}
												inputMode='decimal'
												placeholder='0,00'
												value={texto}
												aria-invalid={texto !== "" && valor == null}
												onChange={(e) => {
													const novo = e.target.value;
													setEdicoes((atual) => ({
														...atual,
														[linha.folhaId]: novo,
													}));
													if (!marcado) alternar(linha.folhaId, true);
												}}
												className='h-8 w-28 text-right'
											/>
											{variacao != null && Math.abs(variacao) >= 0.05 && (
												<span
													className={cn(
														"text-xs whitespace-nowrap",
														variacao > 0 ? "text-orange-600" : "text-green-600",
													)}>
													{variacao > 0 ? "▲" : "▼"}{" "}
													{Math.abs(variacao).toFixed(1).replace(".", ",")}%
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Situacao linha={linha} />
									</TableCell>
									<TableCell>
										{linha.lancamento && !linha.lancamento.pago && (
											<Button
												type='button'
												size='icon-xs'
												variant='ghost'
												disabled={ocupado}
												aria-label={`Remover lançamento de ${linha.nome}`}
												title='Remover lançamento'
												onClick={() => remover(linha.folhaId)}>
												<Trash2 />
											</Button>
										)}
									</TableCell>
								</TableRow>
							);
						})}
						{visiveis.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={7}
									className='py-8 text-center text-muted-foreground'>
									Ninguém nesta lista.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>

				{fetcher.data?.error && fetcher.state === "idle" && (
					<p className='text-sm text-destructive'>{fetcher.data.error}</p>
				)}

				{selecionados.size > 0 && (
					<div className='fixed bottom-4 left-1/2 z-20 flex w-[min(56rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-3 rounded-lg border bg-background p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between'>
						<div className='text-sm'>
							<span className='font-medium'>
								{selecionados.size} selecionado(s)
							</span>{" "}
							· {moeda(totalSelecionado)}
							{invalidos.length > 0 && (
								<span className='block text-xs text-destructive'>
									Sem valor válido: {invalidos.map((i) => i.nome).join(", ")}
								</span>
							)}
						</div>
						<div className='flex flex-wrap items-center gap-2'>
							<label className='flex items-center gap-2 text-sm text-muted-foreground'>
								Data
								<Input
									type='date'
									value={dataPagamento}
									min={dataMin}
									max={dataMax}
									onChange={(e) => setDataPagamento(e.target.value)}
									className='h-8 w-40'
								/>
							</label>
							<Button
								type='button'
								size='sm'
								variant='ghost'
								onClick={() => setSelecionados(new Set())}>
								Limpar
							</Button>
							<Button
								type='button'
								size='sm'
								variant='outline'
								disabled={ocupado || invalidos.length > 0 || !dataPagamento}
								onClick={() => salvar(false)}>
								Salvar a pagar
							</Button>
							<Button
								type='button'
								size='sm'
								disabled={ocupado || invalidos.length > 0 || !dataPagamento}
								onClick={() => salvar(true)}>
								{ocupado ? "Salvando..." : "Marcar como pago"}
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function Resumo({
	titulo,
	valor,
	detalhe,
	cor,
}: {
	titulo: string;
	valor: string;
	detalhe: string;
	cor: string;
}) {
	return (
		<div className='rounded-lg border bg-muted/40 px-4 py-2'>
			<p className='text-xs font-medium text-muted-foreground'>{titulo}</p>
			<p className={cn("text-lg font-semibold", cor)}>{valor}</p>
			<p className='text-[11px] text-muted-foreground'>{detalhe}</p>
		</div>
	);
}

function ContaPix({ conta }: { conta: string }) {
	const [copiado, setCopiado] = useState(false);
	const texto = conta.trim();
	if (!texto) {
		return <span className='text-xs text-muted-foreground'>Sem conta</span>;
	}

	async function copiar() {
		try {
			await navigator.clipboard.writeText(textoParaCopiar(texto));
			setCopiado(true);
			setTimeout(() => setCopiado(false), 1500);
		} catch {
			// Sem permissão de área de transferência: o texto continua visível.
		}
	}

	return (
		<div className='flex max-w-56 items-center gap-1'>
			<span className='truncate text-xs' title={texto}>
				{texto}
			</span>
			<Button
				type='button'
				size='icon-xs'
				variant='ghost'
				aria-label='Copiar conta'
				title={copiado ? "Copiado" : "Copiar"}
				onClick={copiar}>
				{copiado ? <Check className='text-green-600' /> : <Copy />}
			</Button>
		</div>
	);
}

function Situacao({ linha }: { linha: LinhaFechamento }) {
	const { lancamento } = linha;
	if (!lancamento) {
		return (
			<span className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
				Sem lançamento
			</span>
		);
	}
	if (lancamento.pago) {
		return (
			<span className='rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'>
				Pago {dataCurta(lancamento.data)} · {moeda(lancamento.valor)}
			</span>
		);
	}
	return (
		<span className='rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700'>
			A pagar {dataCurta(lancamento.data)} · {moeda(lancamento.valor)}
		</span>
	);
}
