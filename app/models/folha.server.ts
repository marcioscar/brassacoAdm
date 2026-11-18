import { randomBytes } from "node:crypto";
import { db } from "~/db.server";
import {
	ehDecimoTerceiro,
	lancamentoNoPeriodo,
	type MesFechamento,
	type TipoLancamento,
} from "~/lib/folha";

export async function getFuncionarios() {
	return db.folha.findMany({ orderBy: { nome: "asc" } });
}

export async function criarFuncionario(nome: string, conta: string) {
	await db.folha.create({ data: { nome, conta, salarios: [] } });
}

export async function atualizarFuncionario(id: string, nome: string, conta: string) {
	await db.folha.update({ where: { id }, data: { nome, conta } });
}

export async function excluirFuncionario(id: string) {
	const f = await db.folha.findUniqueOrThrow({ where: { id } });
	if ((f.salarios ?? []).length > 0) {
		throw new Error("Funcionário com lançamentos na folha não pode ser excluído.");
	}
	await db.folha.delete({ where: { id } });
}

/**
 * Grava o lançamento de `tipo` do período para cada funcionário: atualiza o que
 * já existe (mês para salário, ano para 13º) ou cria um novo. Se houver mais de
 * um no período, eles viram um só com o valor informado.
 */
export async function salvarLancamentos(
	tipo: TipoLancamento,
	periodo: MesFechamento,
	data: Date,
	pago: boolean,
	itens: { folhaId: string; valor: number; comprovante?: string }[],
) {
	for (const { folhaId, valor, comprovante } of itens) {
		const f = await db.folha.findUniqueOrThrow({ where: { id: folhaId } });
		const salarios = [...(f.salarios ?? [])];
		const indices = salarios
			.map((s, i) => (lancamentoNoPeriodo(s, tipo, periodo) ? i : -1))
			.filter((i) => i >= 0);

		if (indices.length === 0) {
			salarios.push({
				sal_id: randomBytes(12).toString("hex"),
				tipo,
				valor,
				data,
				pago,
				comprovante: comprovante ?? null,
			});
		} else {
			const [primeiro, ...duplicados] = indices;
			salarios[primeiro] = {
				...salarios[primeiro],
				tipo,
				valor,
				data,
				pago,
				// Sem arquivo novo, mantém o comprovante que já estava anexado.
				...(comprovante && { comprovante }),
			};
			for (const i of duplicados.reverse()) salarios.splice(i, 1);
		}
		await db.folha.update({
			where: { id: folhaId },
			data: { salarios: { set: salarios } },
		});
	}
	return itens.length;
}

/** Anexa (ou troca) o comprovante do lançamento do período. */
export async function anexarComprovante(
	folhaId: string,
	tipo: TipoLancamento,
	periodo: MesFechamento,
	comprovante: string,
) {
	const f = await db.folha.findUniqueOrThrow({ where: { id: folhaId } });
	const salarios = (f.salarios ?? []).map((s) =>
		lancamentoNoPeriodo(s, tipo, periodo) ? { ...s, comprovante } : s,
	);
	await db.folha.update({
		where: { id: folhaId },
		data: { salarios: { set: salarios } },
	});
}

/** Remove o lançamento do período, desde que ainda não tenha sido pago. */
export async function removerLancamento(
	folhaId: string,
	tipo: TipoLancamento,
	periodo: MesFechamento,
) {
	const f = await db.folha.findUniqueOrThrow({ where: { id: folhaId } });
	const salarios = f.salarios ?? [];
	const doPeriodo = salarios.filter((s) => lancamentoNoPeriodo(s, tipo, periodo));
	if (doPeriodo.length === 0) return;
	if (doPeriodo.some((s) => s.pago === true)) {
		throw new Error("Lançamento já pago: volte para 'a pagar' antes de remover.");
	}
	await db.folha.update({
		where: { id: folhaId },
		data: {
			salarios: {
				set: salarios.filter((s) => !lancamentoNoPeriodo(s, tipo, periodo)),
			},
		},
	});
}

/* ---------------------------------------------------------------------------
 * Sincronização com Despesas
 *
 * Mantém em despesas um lançamento por mês com o total PAGO na folha, separado
 * em salários e 13º, sem loja. O vínculo é `despesas.origem_folha_mes`:
 * "YYYY-MM" para salários e "13-YYYY-MM" para o 13º. Se o valor da folha muda,
 * a despesa é atualizada em vez de duplicada.
 * ------------------------------------------------------------------------- */

const CONTA = "Pessoal";
const TIPO = "fixo";
const MESES_SINCRONIZADOS = 3;
const TOLERANCIA = 0.005;
const DESCRICAO_MANUAL = /sal[aá]rios?|folha/i;

type Categoria = { descricao: string; prefixo: string; adotaManual: boolean };
const SALARIOS: Categoria = { descricao: "Salários (folha)", prefixo: "", adotaManual: true };
const DECIMO: Categoria = { descricao: "13º salário (folha)", prefixo: "13-", adotaManual: false };

type TotalMes = { total: number; ultimoPagamento: Date | null };
const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

function mesesDaJanela(hoje = new Date()) {
	const meses: { ano: number; mes: number }[] = [];
	for (let i = MESES_SINCRONIZADOS - 1; i >= 0; i--) {
		const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
		meses.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 });
	}
	return meses;
}

async function totaisPagosPorMes() {
	const funcionarios = await db.folha.findMany({ select: { salarios: true } });
	const salarios = new Map<string, TotalMes>();
	const decimo = new Map<string, TotalMes>();
	for (const f of funcionarios) {
		for (const s of f.salarios ?? []) {
			if (s.pago !== true) continue;
			const porMes = ehDecimoTerceiro(s.tipo as TipoLancamento) ? decimo : salarios;
			const d = new Date(s.data);
			const chave = chaveMes(d.getUTCFullYear(), d.getUTCMonth() + 1);
			const atual = porMes.get(chave) ?? { total: 0, ultimoPagamento: null };
			atual.total += s.valor;
			if (!atual.ultimoPagamento || d > atual.ultimoPagamento) atual.ultimoPagamento = d;
			porMes.set(chave, atual);
		}
	}
	return { salarios, decimo };
}

async function sincronizarMes(
	cat: Categoria,
	ano: number,
	mes: number,
	totalMes: TotalMes | undefined,
) {
	const chave = `${cat.prefixo}${chaveMes(ano, mes)}`;
	const total = Math.round((totalMes?.total ?? 0) * 100) / 100;
	const inicio = new Date(Date.UTC(ano, mes - 1, 1));
	const fim = new Date(Date.UTC(ano, mes, 0));

	const vinculada = await db.despesas.findFirst({ where: { origem_folha_mes: chave } });

	if (total <= 0) {
		if (vinculada) await db.despesas.delete({ where: { id: vinculada.id } });
		return;
	}
	if (vinculada) {
		if (Math.abs((vinculada.valor ?? 0) - total) >= TOLERANCIA) {
			await db.despesas.update({ where: { id: vinculada.id }, data: { valor: total } });
		}
		return;
	}
	if (cat.adotaManual) {
		// Primeira sincronização do mês: adota uma despesa lançada à mão, se houver,
		// para a folha não ser contada duas vezes.
		const candidatos = await db.despesas.findMany({
			where: { conta: CONTA, data: { gte: inicio, lte: fim } },
		});
		const manual = candidatos.find(
			(d) => !d.origem_folha_mes && DESCRICAO_MANUAL.test(d.descricao ?? ""),
		);
		if (manual) {
			await db.despesas.update({
				where: { id: manual.id },
				data: { origem_folha_mes: chave, valor: total },
			});
			return;
		}
	}
	await db.despesas.create({
		data: {
			conta: CONTA,
			descricao: cat.descricao,
			valor: total,
			data: totalMes?.ultimoPagamento ?? fim,
			tipo: TIPO,
			pago: true,
			origem_folha_mes: chave,
		},
	});
}

let emAndamento: Promise<void> | null = null;

/** Chamada no loader da folha. Só escreve quando o valor diverge. */
export async function sincronizarDespesasFolha(): Promise<void> {
	// Duas chamadas concorrentes criariam duas despesas para o mesmo mês.
	if (emAndamento) return emAndamento;
	emAndamento = (async () => {
		const { salarios, decimo } = await totaisPagosPorMes();
		for (const { ano, mes } of mesesDaJanela()) {
			const chave = chaveMes(ano, mes);
			await sincronizarMes(SALARIOS, ano, mes, salarios.get(chave));
			await sincronizarMes(DECIMO, ano, mes, decimo.get(chave));
		}
	})();
	try {
		await emAndamento;
	} finally {
		emAndamento = null;
	}
}
