import { db } from "~/db.server";
import { z } from "zod";
import { CONTAS, LOJAS } from "./receitas.constants";
import { contaCorrenteSchema } from "~/lib/contas-correntes";
import {
	aplicarExtratoReceita,
	receitaGeraMovimento,
	removerExtratoPorReferencia,
} from "./contas-corrente.server";

const formSchema = z.object({
	descricao: z.string().min(1, "Descrição é obrigatória"),
	valor: z.number().min(0, "Valor deve ser positivo"),
	data: z.date(),
	conta: z.enum(CONTAS, {
		errorMap: () => ({ message: "Conta é obrigatória" }),
	}),
	loja: z.enum(LOJAS, {
		errorMap: () => ({ message: "Loja é obrigatória" }),
	}),
	contaCorrente: contaCorrenteSchema,
}); 

export async function getReceitas() {
	const inicio2025 = new Date("2025-01-01T00:00:00.000Z");
	return db.receitas.findMany({
		where: { data: { gte: inicio2025 } },
		orderBy: { data: "desc" },
	});
}

export async function createReceita(receita: z.infer<typeof formSchema>) {
	const created = await db.receitas.create({ data: receita });
	try {
		if (receitaGeraMovimento(created)) {
			await aplicarExtratoReceita(created);
		}
	} catch (e) {
		await db.receitas.delete({ where: { id: created.id } });
		throw e;
	}
	return created;
}

export async function updateReceita(id: string, receita: z.infer<typeof formSchema>) {
	await removerExtratoPorReferencia(id, "receita");
	const updated = await db.receitas.update({ where: { id }, data: receita });
	if (receitaGeraMovimento(updated)) {
		await aplicarExtratoReceita(updated);
	}
	return updated;
}

export async function deleteReceita(id: string) {
	await removerExtratoPorReferencia(id, "receita");
	return db.receitas.delete({ where: { id } });
}