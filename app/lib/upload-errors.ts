import { ClientResponseError } from "pocketbase";

/** Mensagem segura para exibir ao usuário quando o upload falha */
export function formatUploadError(error: unknown): string {
	if (error instanceof ClientResponseError) {
		if (error.isAbort) {
			return "Envio cancelado ou interrompido. Tente novamente.";
		}
		if (error.status === 0) {
			return "Não foi possível conectar ao servidor de arquivos. Verifique a rede e tente novamente.";
		}
		if (error.status >= 500 && error.status < 600) {
			return "Servidor de arquivos indisponível no momento. Tente novamente em instantes.";
		}
		const fromApi =
			typeof error.response?.message === "string"
				? error.response.message
				: typeof error.data?.message === "string"
					? error.data.message
					: null;
		if (fromApi?.trim()) {
			return fromApi.trim();
		}
		if (error.message?.trim() && !error.message.startsWith("ClientResponseError")) {
			return error.message.trim();
		}
		return "Falha ao enviar o arquivo. Verifique o tamanho e o formato.";
	}
	if (error instanceof Error) {
		const msg = error.message.trim();
		if (msg.includes("POCKETBASE_URL") || msg.includes("POCKETBASE_ADMIN")) {
			return "Configuração do servidor de arquivos incompleta. Contate o suporte.";
		}
		if (msg) {
			return msg;
		}
	}
	return "Falha ao enviar o arquivo. Tente novamente.";
}

/** Resposta JSON para actions quando o upload falha (evita ErrorBoundary genérico). */
export function jsonFieldUploadError(
	field: "comprovante" | "boleto",
	error: unknown,
) {
	return Response.json(
		{ errors: { [field]: [formatUploadError(error)] } },
		{ status: 502 },
	);
}
