/**
 * Módulo para upload de arquivos no PocketBase.
 * Usa a API do PocketBase para upload e geração de links públicos.
 */

import PocketBase, { ClientResponseError } from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL?.replace(/\/$/, "") ?? "";
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? "";
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD ?? "";
const POCKETBASE_COLLECTION =
	process.env.POCKETBASE_COLLECTION ?? "arquivos_compartilhados";
const POCKETBASE_FIELD = process.env.POCKETBASE_FIELD ?? "documento";

const UPLOAD_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;

function getClient(): PocketBase {
	if (!POCKETBASE_URL || !POCKETBASE_ADMIN_EMAIL || !POCKETBASE_ADMIN_PASSWORD) {
		throw new Error(
			"POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL e POCKETBASE_ADMIN_PASSWORD devem estar definidos no .env",
		);
	}
	return new PocketBase(POCKETBASE_URL);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableUploadError(error: unknown): boolean {
	if (error instanceof ClientResponseError) {
		if (error.isAbort) return false;
		if (error.status === 0) return true;
		if (error.status >= 500 && error.status < 600) return true;
		return false;
	}
	return false;
}

/** Remove caracteres inválidos do nome do arquivo */
function sanitizeFilename(filename: string): string {
	return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "arquivo";
}

const SYSTEM_FIELDS = new Set([
	"id",
	"collectionId",
	"collectionName",
	"created",
	"updated",
	"expand",
]);

/** Obtém o nome do arquivo do record; fallback para safeName se o campo estiver vazio */
function resolveFileName(
	record: Record<string, unknown>,
	fieldName: string,
	fallback: string,
): string {
	const value = record[fieldName];
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	for (const [key, v] of Object.entries(record)) {
		if (SYSTEM_FIELDS.has(key)) continue;
		if (typeof v === "string" && /\.(pdf|jpg|jpeg|png|webp|gif)$/i.test(v)) {
			return v;
		}
	}
	return fallback;
}

async function uploadOnce(
	fileBuffer: Buffer,
	filename: string,
): Promise<string> {
	const pb = getClient();

	await pb.admins.authWithPassword(
		POCKETBASE_ADMIN_EMAIL,
		POCKETBASE_ADMIN_PASSWORD,
	);

	const safeName = sanitizeFilename(filename);
	const file = new File([new Uint8Array(fileBuffer)], safeName, {
		type: "application/octet-stream",
	});

	const formData = new FormData();
	formData.append(POCKETBASE_FIELD, file);

	try {
		const record = await pb.collection(POCKETBASE_COLLECTION).create(formData);
		const fileName = resolveFileName(record, POCKETBASE_FIELD, safeName);
		if (!fileName || fileName === "undefined") {
			throw new Error(
				`Campo "${POCKETBASE_FIELD}" não retornou nome do arquivo. Verifique POCKETBASE_FIELD no .env (deve ser o nome exato do campo File na collection). Record: ${JSON.stringify(record)}`,
			);
		}
		const shareLink = `${pb.baseUrl}/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(fileName)}`;

		pb.authStore.clear();
		return shareLink;
	} catch (error) {
		pb.authStore.clear();
		console.error("Erro no PocketBase:", error);
		throw error;
	}
}

/**
 * Faz upload de um recibo para o PocketBase e retorna a URL pública.
 * Repete automaticamente em falhas transitórias (rede / 5xx).
 */
export async function uploadReciboAndGetUrl(
	fileBuffer: Buffer,
	filename: string,
): Promise<string> {
	for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
		try {
			return await uploadOnce(fileBuffer, filename);
		} catch (error) {
			if (
				attempt < UPLOAD_MAX_ATTEMPTS - 1 &&
				isRetryableUploadError(error)
			) {
				await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
				continue;
			}
			throw error;
		}
	}
	throw new Error("Falha inesperada no upload");
}
