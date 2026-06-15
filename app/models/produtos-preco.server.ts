import { db } from "~/db.server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export type ProdutoPrecoFiltro = {
	termo?: string | null;
};

const TIPOS_NUMERICOS_MONGO = ["int", "long", "double", "decimal"] as const;

function montarFiltroBusca(termo?: string | null) {
	const texto = termo?.trim();
	if (!texto) {
		return {};
	}

	return {
		OR: [
			{ codigo: { contains: texto, mode: "insensitive" as const } },
			{ descricao: { contains: texto, mode: "insensitive" as const } },
		],
	};
}

function isErroCodigoInconsistente(error: unknown) {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2023" &&
		error.meta?.modelName === "produtos_preco"
	);
}

async function normalizarCodigoNumericoParaString() {
	await Promise.all(
		TIPOS_NUMERICOS_MONGO.map((tipo) =>
			db.$runCommandRaw({
				update: "produtos_preco",
				updates: [
					{
						q: { codigo: { $type: tipo } },
						u: [{ $set: { codigo: { $toString: "$codigo" } } }],
						multi: true,
					},
				],
			}),
		),
	);
}

export async function getProdutosPreco({ termo }: ProdutoPrecoFiltro = {}) {
	try {
		return await db.produtos_preco.findMany({
			where: montarFiltroBusca(termo),
			orderBy: [{ codigo: "asc" }, { descricao: "asc" }],
		});
	} catch (error) {
		if (!isErroCodigoInconsistente(error)) {
			throw error;
		}

		await normalizarCodigoNumericoParaString();

		return db.produtos_preco.findMany({
			where: montarFiltroBusca(termo),
			orderBy: [{ codigo: "asc" }, { descricao: "asc" }],
		});
	}
}

const produtoPrecoSchema = z.object({
	codigo: z.string().trim().min(1, "Código é obrigatório"),
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
