import { db } from "~/db.server";

/**
 * Todos os lançamentos de estoque — um por mês (e, até fev/25, um por loja além
 * do `todas`). São poucas dezenas de documentos; a home escolhe o mês no cliente,
 * já que o mês selecionado vive no `MesAnoContext`.
 */
export async function getEstoques() {
	return db.estoque.findMany({ orderBy: { data: "asc" } });
}
