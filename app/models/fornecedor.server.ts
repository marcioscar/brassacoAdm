import { db } from "~/db.server";
import { z } from "zod";




export async function getFornecedores() {
	return db.fornecedores.findMany({
		orderBy: { nome: "asc" },
		select: {
			id: true,
			nome: true,
		},
	});
}

const formSchema = z.object({
	nome: z.string().min(1, "Nome é obrigatório"),
});

export async function createFornecedor(fornecedor: z.infer<typeof formSchema>) {
	return db.fornecedores.create({ data: fornecedor });
}

export async function updateFornecedor(id: string, fornecedor: z.infer<typeof formSchema>) {
	return db.fornecedores.update({ where: { id }, data: fornecedor });
}

export async function deleteFornecedor(id: string) {
	return db.fornecedores.delete({ where: { id } });
}   