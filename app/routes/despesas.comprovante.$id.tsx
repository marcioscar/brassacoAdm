import type { Route } from "./+types/despesas.comprovante.$id";
import { redirect } from "react-router";
import { getDespesaById } from "~/models/despesas.server";

export async function loader({ params }: Route.LoaderArgs) {
	const { id } = params;
	const despesa = await getDespesaById(id);

	if (!despesa?.comprovante) {
		return Response.json({ error: "Comprovante não encontrado" }, { status: 404 });
	}

	const comprovante = despesa.comprovante;

	// URL HTTP válida (Nextcloud share link ou link externo)
	if (
		comprovante.startsWith("http://") ||
		comprovante.startsWith("https://")
	) {
		if (!comprovante.includes("/session")) {
			throw redirect(comprovante);
		}
	}

	// Legado Cloudreve - registos antigos precisam de migração
	if (comprovante.startsWith("cloudreve://")) {
		return Response.json(
			{ error: "Comprovante em Cloudreve legado. Migre os dados para Nextcloud." },
			{ status: 410 },
		);
	}

	return Response.json({ error: "Comprovante inválido" }, { status: 400 });
}

export default function ComprovanteRedirect() {
	return null;
}
