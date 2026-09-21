import { db } from "~/db.server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export type ProdutoPrecoFiltro = {
	termo?: string | null;
};

/**
 * `codigo` é numérico no banco (a coleção vem do ERP), então a busca só compara
 * o código quando o termo digitado é um número; caso contrário filtra a descrição.
 */
function montarFiltroBusca(termo?: string | null): Prisma.produtos_precoWhereInput {
	const texto = termo?.trim();
	if (!texto) {
		return {};
	}

	const filtros: Prisma.produtos_precoWhereInput[] = [
		{ descricao: { contains: texto, mode: "insensitive" } },
	];

	const codigo = Number(texto.replace(/[.,]/g, ""));
	if (Number.isInteger(codigo)) {
		filtros.push({ codigo });
	}

	return { OR: filtros };
}

export async function getProdutosPreco({ termo }: ProdutoPrecoFiltro = {}) {
	return db.produtos_preco.findMany({
		where: montarFiltroBusca(termo),
		orderBy: [{ codigo: "asc" }, { descricao: "asc" }],
	});
}

const produtoPrecoSchema = z.object({
	// O formulário envia texto; o banco guarda `codigo` como inteiro.
	codigo: z
		.string()
		.trim()
		.min(1, "Código é obrigatório")
		.regex(/^\d+$/, "Código deve ser um número inteiro")
		.transform(Number),
	descricao: z.string().trim().min(1, "Descrição é obrigatória"),
	unidade: z.string().trim().min(1, "Unidade é obrigatória"),
	complemento: z
		.string()
		.trim()
		.optional()
		.transform((valor) => (valor && valor.length > 0 ? valor : null)),
	quantidade: z
		.string()
		.trim()
		.optional()
		.transform((valor) => (valor && valor.length > 0 ? valor : null)),
	preco: z.coerce.number().min(0, "Preço deve ser positivo"),
});

export type ProdutoPrecoPayload = z.infer<typeof produtoPrecoSchema>;

export function validarProdutoPreco(payload: unknown) {
	return produtoPrecoSchema.safeParse(payload);
}

export async function updateProdutoPreco(id: string, data: ProdutoPrecoPayload) {
	return db.produtos_preco.update({
		where: { id },
		data,
	});
}
