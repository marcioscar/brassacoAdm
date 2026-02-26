import { db } from "~/db.server";
import { z } from "zod";
import { CONTAS, LOJAS } from "./receitas.constants";

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
}); 

export async function getReceitas() {
	const inicio2025 = new Date("2025-01-01T00:00:00.000Z");
	return db.receitas.findMany({
		where: { data: { gte: inicio2025 } },
		orderBy: { data: "desc" },
	});
}

export async function createReceita(receita: z.infer<typeof formSchema>) {
	return db.receitas.create({ data: receita });
}

export async function updateReceita(id: string, receita: z.infer<typeof formSchema>) {
	return db.receitas.update({ where: { id }, data: receita });
}

export async function deleteReceita(id: string) {
	return db.receitas.delete({ where: { id } });
}