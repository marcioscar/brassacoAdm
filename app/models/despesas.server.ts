import { db } from "~/db.server";
import { z } from "zod";

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

export async function getContasAPagar(options?: { filtro?: "hoje" | "todas" }) {
	const filtro = options?.filtro ?? "todas";

	const where: { pago: boolean; data: { gte: Date; lt?: Date } | { gte: Date } } = {
		pago: false,
		data: { gte: INICIO_2025 },
	};

	if (filtro === "hoje") {
		// Datas no BD são UTC midnight. "Hoje" = data atual no fuso Brasil
		const now = new Date();
		const brDate = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
		const [y, m, d] = brDate.split("-").map(Number);
		const hojeStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
		const amanha = new Date(hojeStart);
		amanha.setUTCDate(amanha.getUTCDate() + 1);
		where.data = { gte: hojeStart, lt: amanha };
	}

	return db.despesas.findMany({
		where,
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