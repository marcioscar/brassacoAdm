import { db } from "~/db.server";
import { z } from "zod";


/** Aceita string ou number - no banco podem existir os dois tipos. Grava como string. */
const nfSchema = z.union([
	z.string(),
	z.coerce.number().min(0),
]).transform((v) => (typeof v === "number" ? String(v) : (v ?? "").toString()));

const formSchema = z.object({
	valor: z.number().min(0, "Valor deve ser positivo"),
	data: z.date(),
	fornecedor: z.string().min(1, "Fornecedor é obrigatório"),
	nf: nfSchema.optional().default(""),
}); 

export async function getCompras() {
	const inicio2025 = new Date("2025-01-01T00:00:00.000Z");
	return db.compras.findMany({
		where: { data: { gte: inicio2025 } },
		orderBy: { data: "desc" },
	});
}

export async function createCompra(compra: z.infer<typeof formSchema>) {
	return db.compras.create({ data: compra });
}

export async function updateCompra(id: string, compra: z.infer<typeof formSchema>) {
	return db.compras.update({ where: { id }, data: compra });
}

export async function deleteCompra(id: string) {
	return db.compras.delete({ where: { id } });
}