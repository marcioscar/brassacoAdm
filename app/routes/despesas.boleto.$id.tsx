import type { Route } from "./+types/despesas.boleto.$id";
import { redirect } from "react-router";
import { getDespesaById } from "~/models/despesas.server";

export async function loader({ params }: Route.LoaderArgs) {
	const { id } = params;
	const despesa = await getDespesaById(id);

	if (!despesa?.boleto) {
		return Response.json({ error: "Boleto não encontrado" }, { status: 404 });
	}

	const boleto = despesa.boleto;

	// URL HTTP válida (Nextcloud share link ou link externo)
	if (boleto.startsWith("http://") || boleto.startsWith("https://")) {
		if (!boleto.includes("/session")) {
			throw redirect(boleto);
		}
	}

	// Legado Cloudreve
	if (boleto.startsWith("cloudreve://")) {
		return Response.json(
			{ error: "Boleto em Cloudreve legado. Migre os dados para Nextcloud." },
			{ status: 410 },
		);
	}

	return Response.json({ error: "Boleto inválido" }, { status: 400 });
}

export default function BoletoRedirect() {
	return null;
}
