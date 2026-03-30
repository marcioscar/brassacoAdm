import { db } from "~/db.server";
import { z } from "zod";

const formSchema = z.object({
	valor: z.number().min(0, "Valor deve ser positivo"),
	data: z.date(),
});

export async function getEstoqueMesAtual() {
	return db.estoque.findMany({
		where: { data: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) } },
		orderBy: { data: "desc" },
	});
}

export async function getEstoqueMesAnterior() {
	return db.estoque.findMany({
		where: { data: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
		orderBy: { data: "desc" },
	});
}
