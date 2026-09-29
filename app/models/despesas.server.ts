import { db } from "~/db.server";
import { z } from "zod";
import { obterHojeDataCivilUTC } from "~/lib/mes-ano";

const formSchema = z.object({
	conta: z.string().min(1),
	valor: z.number().min(0),
	descricao: z.string().min(1),
	fornecedor: z.string().min(1),
	tipo: z.string().min(1),
	data: z.date(),
	comprovante: z.string().optional(),
	boleto: z.string().optional(),
	loja: z.string().optional(),
});



/** Retorna despesa por ID */
export async function getDespesaById(id: string) {
	return db.despesas.findUnique({ where: { id } });
}

/** Retorna despesas de 2025 em diante, pagas */
export async function getDespesas() {
	return db.despesas.findMany({
		where: {
			data: { gte: new Date("2025-01-01") },
			pago: true,
		},
		orderBy: { data: "desc" },
	});
}

const INICIO_2025 = new Date("2025-01-01");

export type FiltroContasAPagar = "hoje" | "todas";
export type StatusContasAPagar = "abertos" | "pagos";

/**
 * Contas a pagar desde 2025. `abertos` = não pagas; `pagos` = pagas que têm
 * boleto anexado, isto é, as que passaram por esta tela — sem o boleto a lista
 * viraria a de todas as despesas pagas, que já é a página Despesas.
 * O filtro `hoje` olha a data de vencimento (`data`).
 */
export async function getContasAPagar(options?: {
	filtro?: FiltroContasAPagar;
	status?: StatusContasAPagar;
}) {
	const filtro = options?.filtro ?? "todas";
	const status = options?.status ?? "abertos";

	let data: { gte: Date; lt?: Date } = { gte: INICIO_2025 };
	if (filtro === "hoje") {
		const hoje = obterHojeDataCivilUTC();
		const amanha = new Date(hoje);
		amanha.setUTCDate(amanha.getUTCDate() + 1);
		data = { gte: hoje, lt: amanha };
	}

	return db.despesas.findMany({
		where:
			status === "pagos"
				? {
						pago: true,
						data,
						boleto: { isSet: true },
						NOT: [{ boleto: null }, { boleto: "" }],
					}
				: { pago: false, data },
		orderBy: { data: "desc" },
	});
}

export async function createDespesa(
	despesa: z.infer<typeof formSchema> & { pago?: boolean },
) {
	return db.despesas.create({
		data: { ...despesa, pago: despesa.pago ?? false },
	});
}

export async function createContaAPagar(
	despesa: z.infer<typeof formSchema> & { pago?: boolean; boleto?: string },
) {
	return db.despesas.create({
		data: { ...despesa, pago: despesa.pago ?? false },
	});
}


export async function updateDespesa(id: string, despesa: z.infer<typeof formSchema>) {
	const validated = formSchema.safeParse(despesa);
	if (!validated.success) {
		return Response.json({ error: "Dados inválidos" }, { status: 400 });
	}
	return db.despesas.update({ where: { id }, data: validated.data });
}

export async function deleteDespesa(id: string) {
	return db.despesas.delete({ where: { id } });
}

/** Atualiza apenas campos específicos (pago, comprovante, boleto, etc.) */
export async function updateDespesaPartial(
	id: string,
	data: Partial<{
		pago: boolean;
		comprovante: string;
		boleto: string;
		conta: string;
		valor: number;
		descricao: string;
		fornecedor: string;
		tipo: string;
		data: Date;
		loja: string;
	}>,
) {
	return db.despesas.update({ where: { id }, data });
}