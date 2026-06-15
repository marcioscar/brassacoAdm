import { Prisma } from "@prisma/client";
import { db } from "~/db.server";
import {
	obterMesAnoAnterior,
	obterMesAnoAtual,
	type MesAno,
} from "~/lib/mes-ano";

function isUniqueViolation(e: unknown): boolean {
	return (
		e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
	);
}

/** Data do lançamento no mesmo mês civil (America/Sao_Paulo) que `ref`. */
function mesmoMesAnoSp(data: Date, ref: MesAno): boolean {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Sao_Paulo",
		year: "numeric",
		month: "2-digit",
	}).formatToParts(data);
	const y = Number(parts.find((p) => p.type === "year")?.value);
	const m = Number(parts.find((p) => p.type === "month")?.value);
	return y === ref.ano && m === ref.mes;
}

function somaExtratoNoMes(
	extratos: { data: Date; valor: number }[] | null | undefined,
	ref: MesAno,
): number {
	if (!extratos?.length) return 0;
	return extratos.reduce(
		(acc, e) => (mesmoMesAnoSp(e.data, ref) ? acc + e.valor : acc),
		0,
	);
}

async function contasUnicasPorNome(nomesCatalogo: readonly string[]) {
	const contas = await db.contas_corrente.findMany({
		where: { nome: { in: [...nomesCatalogo] } },
	});
	const porNome = new Map<string, (typeof contas)[0]>();
	for (const c of contas) {
		if (!porNome.has(c.nome)) porNome.set(c.nome, c);
	}
	return porNome;
}

/**
 * No primeiro registro de cada mês civil (BR), grava o saldo atual da conta.
 * Usa `findUnique` + create com tolerância a P2002 (requisições paralelas).
 */
export async function ensureSaldoMensalMesCorrente(
	nomesCatalogo: readonly string[],
) {
	const ref = obterMesAnoAtual();
	const porNome = await contasUnicasPorNome(nomesCatalogo);
	for (const conta of porNome.values()) {
		const existing = await db.conta_corrente_saldo_mensal.findUnique({
			where: {
				nomeConta_mes_ano: {
					nomeConta: conta.nome,
					mes: ref.mes,
					ano: ref.ano,
				},
			},
		});
		if (existing) continue;
		try {
			await db.conta_corrente_saldo_mensal.create({
				data: {
					nomeConta: conta.nome,
					mes: ref.mes,
					ano: ref.ano,
					saldo: conta.saldo ?? 0,
				},
			});
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
		}
	}
}

/**
 * Se não existe snapshot do mês anterior, estima: saldo atual − soma dos
 * lançamentos do extrato no mês atual (BR). Útil para quem não tinha histórico
 * antes desta funcionalidade.
 */
export async function backfillSaldoMesAnteriorEstimado(
	nomesCatalogo: readonly string[],
) {
	const ref = obterMesAnoAtual();
	const prev = obterMesAnoAnterior(ref);
	const porNome = await contasUnicasPorNome(nomesCatalogo);
	for (const conta of porNome.values()) {
		const existing = await db.conta_corrente_saldo_mensal.findUnique({
			where: {
				nomeConta_mes_ano: {
					nomeConta: conta.nome,
					mes: prev.mes,
					ano: prev.ano,
				},
			},
		});
		if (existing) continue;
		const movMesAtual = somaExtratoNoMes(conta.extratos, ref);
		const saldoAtual = conta.saldo ?? 0;
		const estimadoFimMesAnterior = saldoAtual - movMesAtual;
		try {
			await db.conta_corrente_saldo_mensal.create({
				data: {
					nomeConta: conta.nome,
					mes: prev.mes,
					ano: prev.ano,
					saldo: estimadoFimMesAnterior,
				},
			});
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
		}
	}
}

/** Mapa nomeConta → saldo gravado no mês anterior ao `ref` (padrão: mês atual BR). */
export async function getSaldosDia1MesAnteriorPorNome(
	nomes: readonly string[],
	ref: MesAno = obterMesAnoAtual(),
): Promise<Map<string, number>> {
	const prev = obterMesAnoAnterior(ref);
	const rows = await db.conta_corrente_saldo_mensal.findMany({
		where: {
			nomeConta: { in: [...nomes] },
			mes: prev.mes,
			ano: prev.ano,
		},
	});
	return new Map(rows.map((r) => [r.nomeConta, r.saldo]));
}
