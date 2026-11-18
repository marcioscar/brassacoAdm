/**
 * Folha: tipos de lançamento e montagem da tela de fechamento. Uma linha por
 * funcionário com o lançamento do período (salário do mês ou parcela do 13º do
 * ano) e um valor sugerido. Datas em UTC, como são gravadas no banco.
 */

export const TIPOS_LANCAMENTO = ["salario", "decimo_1", "decimo_2"] as const;
export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];

export const ROTULO_TIPO: Record<TipoLancamento, string> = {
	salario: "Salário",
	decimo_1: "13º - 1ª parcela",
	decimo_2: "13º - 2ª parcela",
};

export function parseTipoLancamento(valor: unknown): TipoLancamento | null {
	return typeof valor === "string" &&
		(TIPOS_LANCAMENTO as readonly string[]).includes(valor)
		? (valor as TipoLancamento)
		: null;
}

export function ehDecimoTerceiro(tipo: TipoLancamento): boolean {
	return tipo !== "salario";
}

export type MesFechamento = { ano: number; mes: number }; // mes 1–12

export type Lancamento = {
	valor?: number | null;
	pago?: boolean | null;
	data?: Date | string | null;
	tipo?: string | null;
};

export type FuncionarioFolha = {
	id: string;
	nome: string;
	conta: string;
	salarios?: Lancamento[] | null;
};

export type LinhaFechamento = {
	folhaId: string;
	nome: string;
	conta: string;
	/** Salário do mês anterior (salário) ou salário base (13º). */
	referencia: number | null;
	sugestao: number | null;
	lancamento: { valor: number; data: string; pago: boolean } | null;
};

export type Fechamento = {
	periodo: MesFechamento;
	tipo: TipoLancamento;
	linhas: LinhaFechamento[];
	totais: {
		pago: number;
		aPagar: number;
		pagos: number;
		aPagarQtd: number;
		semLancamento: number;
	};
	/** Intervalo aceito para a data do lançamento (YYYY-MM-DD). */
	dataMin: string;
	dataMax: string;
};

const arredondar = (v: number) => Math.round(v * 100) / 100;
const isoData = (d: Date) => d.toISOString().slice(0, 10);

function tipoDe(l: Lancamento): TipoLancamento {
	return parseTipoLancamento(l.tipo) ?? "salario";
}

/** Mês corrente no fuso de Brasília, para o fechamento não virar às 21h. */
export function mesAtualFechamento(hoje = new Date()): MesFechamento {
	const [ano, mes] = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Sao_Paulo",
		year: "numeric",
		month: "2-digit",
	})
		.format(hoje)
		.split("-")
		.map(Number);
	return { ano, mes };
}

export function hojeFechamento(hoje = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Sao_Paulo",
	}).format(hoje);
}

export function parseMesFechamento(valor: string | null): MesFechamento | null {
	const match = valor?.match(/^(\d{4})-(\d{2})$/);
	if (!match) return null;
	const ano = Number(match[1]);
	const mes = Number(match[2]);
	if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null;
	return { ano, mes };
}

export function formatarMesFechamento({ ano, mes }: MesFechamento): string {
	return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function deslocarMes({ ano, mes }: MesFechamento, delta: number): MesFechamento {
	const d = new Date(Date.UTC(ano, mes - 1 + delta, 1));
	return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
}

/** O salário vale para o mês; o 13º, para o ano inteiro. */
export function limitesDoPeriodo(
	tipo: TipoLancamento,
	{ ano, mes }: MesFechamento,
): { dataMin: string; dataMax: string } {
	if (ehDecimoTerceiro(tipo)) {
		return { dataMin: `${ano}-01-01`, dataMax: `${ano}-12-31` };
	}
	return {
		dataMin: isoData(new Date(Date.UTC(ano, mes - 1, 1))),
		dataMax: isoData(new Date(Date.UTC(ano, mes, 0))),
	};
}

/** Lançamento de `tipo` cuja data cai no período (mês ou ano, conforme o tipo). */
export function lancamentoNoPeriodo(
	l: Lancamento,
	tipo: TipoLancamento,
	{ ano, mes }: MesFechamento,
): boolean {
	if (!l.data || l.valor == null || tipoDe(l) !== tipo) return false;
	const d = new Date(l.data);
	if (d.getUTCFullYear() !== ano) return false;
	return ehDecimoTerceiro(tipo) || d.getUTCMonth() + 1 === mes;
}

function somaPaga(lancs: Lancamento[], tipo: TipoLancamento, periodo: MesFechamento) {
	return lancs.reduce(
		(acc, l) =>
			l.pago === true && lancamentoNoPeriodo(l, tipo, periodo)
				? acc + (l.valor ?? 0)
				: acc,
		0,
	);
}

/** Salário mais recente até o fim do mês do fechamento (pago ou a pagar). */
function salarioBase(lancs: Lancamento[], { ano, mes }: MesFechamento): number | null {
	const limite = Date.UTC(ano, mes, 0, 23, 59, 59);
	const candidato = lancs
		.filter(
			(l) =>
				l.data &&
				(l.valor ?? 0) > 0 &&
				tipoDe(l) === "salario" &&
				new Date(l.data).getTime() <= limite,
		)
		.sort((a, b) => new Date(b.data!).getTime() - new Date(a.data!).getTime())[0];
	return candidato?.valor ?? null;
}

function montarLinha(
	f: FuncionarioFolha,
	tipo: TipoLancamento,
	periodo: MesFechamento,
): LinhaFechamento {
	const lancs = f.salarios ?? [];
	const doPeriodo = lancs.filter((l) => lancamentoNoPeriodo(l, tipo, periodo));
	const lancamento =
		doPeriodo.length > 0
			? {
					valor: arredondar(doPeriodo.reduce((acc, l) => acc + (l.valor ?? 0), 0)),
					data: isoData(new Date(doPeriodo[0].data!)),
					pago: doPeriodo.every((l) => l.pago === true),
				}
			: null;

	let referencia: number | null;
	let sugestao: number | null;
	if (tipo === "salario") {
		const anterior = somaPaga(lancs, "salario", deslocarMes(periodo, -1));
		referencia = anterior > 0 ? arredondar(anterior) : null;
		sugestao = referencia;
	} else {
		referencia = salarioBase(lancs, periodo);
		if (referencia == null) sugestao = null;
		else if (tipo === "decimo_1") sugestao = arredondar(referencia / 2);
		else {
			const primeira = somaPaga(lancs, "decimo_1", periodo);
			sugestao = arredondar(primeira > 0 ? referencia - primeira : referencia);
		}
	}

	return {
		folhaId: f.id,
		nome: f.nome,
		conta: f.conta,
		referencia,
		sugestao: lancamento?.valor ?? sugestao,
		lancamento,
	};
}

export function montarFechamento(
	funcionarios: FuncionarioFolha[],
	tipo: TipoLancamento,
	periodo: MesFechamento,
): Fechamento {
	const linhas = funcionarios
		.map((f) => montarLinha(f, tipo, periodo))
		.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

	const totais = { pago: 0, aPagar: 0, pagos: 0, aPagarQtd: 0, semLancamento: 0 };
	for (const l of linhas) {
		if (!l.lancamento) totais.semLancamento++;
		else if (l.lancamento.pago) {
			totais.pagos++;
			totais.pago += l.lancamento.valor;
		} else {
			totais.aPagarQtd++;
			totais.aPagar += l.lancamento.valor;
		}
	}
	totais.pago = arredondar(totais.pago);
	totais.aPagar = arredondar(totais.aPagar);

	return { periodo, tipo, linhas, totais, ...limitesDoPeriodo(tipo, periodo) };
}
