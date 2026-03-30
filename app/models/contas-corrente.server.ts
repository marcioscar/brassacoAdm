import { db } from "~/db.server";

export type RefTipoMovimento = "despesa" | "receita";

export class ContaCorrenteNaoEncontradaError extends Error {
	constructor(nomeConta: string) {
		super(
			`Conta corrente "${nomeConta}" não existe em contas_corrente. Cadastre o registro com o mesmo nome usado no formulário.`,
		);
		this.name = "ContaCorrenteNaoEncontradaError";
	}
}

/** Resposta JSON para action quando a conta bancária não está cadastrada. */
export function responseIfContaCorrenteAusente(error: unknown) {
	if (error instanceof ContaCorrenteNaoEncontradaError) {
		return Response.json(
			{ errors: { form: [error.message] } },
			{ status: 400 },
		);
	}
	return null;
}

export function despesaGeraMovimento(d: {
	pago?: boolean | null;
	contaCorrente?: string | null;
	valor?: number | null;
}): boolean {
	return (
		d.pago === true &&
		typeof d.contaCorrente === "string" &&
		d.contaCorrente.length > 0 &&
		typeof d.valor === "number" &&
		!Number.isNaN(d.valor)
	);
}

export function receitaGeraMovimento(r: {
	contaCorrente?: string | null;
	valor?: number | null;
}): boolean {
	return (
		typeof r.contaCorrente === "string" &&
		r.contaCorrente.length > 0 &&
		typeof r.valor === "number" &&
		!Number.isNaN(r.valor)
	);
}

const CAMPOS_MOVIMENTO_DESPESA = new Set([
	"pago",
	"contaCorrente",
	"valor",
	"data",
	"descricao",
	"fornecedor",
	"conta",
]);

export function partialDespesaAfetaExtrato(data: Record<string, unknown>) {
	return Object.keys(data).some((k) => CAMPOS_MOVIMENTO_DESPESA.has(k));
}

function montarDescricaoDespesa(d: {
	descricao: string | null;
	fornecedor?: string | null;
	conta?: string | null;
}) {
	const partes = [
		d.fornecedor?.trim(),
		d.conta?.trim(),
		d.descricao?.trim(),
	].filter(Boolean);
	return partes.length > 0 ? `Despesa: ${partes.join(" · ")}` : "Despesa";
}

function montarDescricaoReceita(d: { descricao: string | null; conta?: string | null }) {
	const partes = [d.conta?.trim(), d.descricao?.trim()].filter(Boolean);
	return partes.length > 0 ? `Receita: ${partes.join(" · ")}` : "Receita";
}

async function pushExtrato(args: {
	nomeConta: string;
	data: Date;
	descricao: string;
	valor: number;
	refId: string;
	refTipo: RefTipoMovimento;
}) {
	const conta = await db.contas_corrente.findFirst({
		where: { nome: args.nomeConta },
	});
	if (!conta) {
		throw new ContaCorrenteNaoEncontradaError(args.nomeConta);
	}
	const linha = {
		data: args.data,
		descricao: args.descricao,
		valor: args.valor,
		refId: args.refId,
		refTipo: args.refTipo,
	};
	const extratos = [...(conta.extratos ?? []), linha];
	const saldo = (conta.saldo ?? 0) + args.valor;
	await db.contas_corrente.update({
		where: { id: conta.id },
		data: { saldo, extratos },
	});
}

export async function aplicarExtratoDespesa(despesa: {
	id: string;
	data: Date | null;
	descricao: string | null;
	valor: number | null;
	contaCorrente: string | null;
	fornecedor?: string | null;
	conta?: string | null;
}) {
	const nomeConta = despesa.contaCorrente!;
	const valor = -Math.abs(Number(despesa.valor));
	const data = despesa.data ?? new Date();
	const descricao = montarDescricaoDespesa(despesa);
	await pushExtrato({
		nomeConta,
		data,
		descricao,
		valor,
		refId: despesa.id,
		refTipo: "despesa",
	});
}

export async function aplicarExtratoReceita(receita: {
	id: string;
	data: Date | null;
	descricao: string | null;
	valor: number | null;
	contaCorrente: string | null;
	conta?: string | null;
}) {
	const nomeConta = receita.contaCorrente!;
	const valor = Math.abs(Number(receita.valor));
	const data = receita.data ?? new Date();
	const descricao = montarDescricaoReceita(receita);
	await pushExtrato({
		nomeConta,
		data,
		descricao,
		valor,
		refId: receita.id,
		refTipo: "receita",
	});
}

/** Remove linha do extrato pelo vínculo e reverte o efeito no saldo. */
export async function removerExtratoPorReferencia(
	refId: string,
	refTipo: RefTipoMovimento,
) {
	const contas = await db.contas_corrente.findMany();
	for (const conta of contas) {
		const extratos = conta.extratos ?? [];
		const idx = extratos.findIndex(
			(e) => e.refId === refId && e.refTipo === refTipo,
		);
		if (idx === -1) continue;
		const removed = extratos[idx]!;
		const novoExtratos = extratos.filter((_, i) => i !== idx);
		const saldo = (conta.saldo ?? 0) - removed.valor;
		await db.contas_corrente.update({
			where: { id: conta.id },
			data: { saldo, extratos: novoExtratos },
		});
		return;
	}
}

export async function getContaCorrentePorNome(nome: string) {
	return db.contas_corrente.findFirst({
		where: { nome },
	});
}

/** Uma entrada por nome, na ordem do catálogo; `conta` null se não existir no BD. */
export async function getContasCorrenteDoCatalogo(nomes: readonly string[]) {
	const lista = await db.contas_corrente.findMany({
		where: { nome: { in: [...nomes] } },
	});
	const map = new Map(lista.map((c) => [c.nome, c]));
	return nomes.map((nome) => ({ nome, conta: map.get(nome) ?? null }));
}
