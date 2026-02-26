/**
 * Módulo para upload de arquivos no Nextcloud.
 * Usa WebDAV para upload e OCS API para criar links públicos.
 */

import { createClient } from "webdav";

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL?.replace(/\/$/, "") ?? "";
const NEXTCLOUD_USER = process.env.NEXTCLOUD_USER ?? "";
const NEXTCLOUD_APP_PASSWORD = process.env.NEXTCLOUD_APP_PASSWORD ?? "";

const WEBDAV_BASE = `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}`;
const OCS_BASE = `${NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1`;

function getClient() {
	if (!NEXTCLOUD_URL || !NEXTCLOUD_USER || !NEXTCLOUD_APP_PASSWORD) {
		throw new Error(
			"NEXTCLOUD_URL, NEXTCLOUD_USER e NEXTCLOUD_APP_PASSWORD devem estar definidos no .env",
		);
	}
	return createClient(WEBDAV_BASE, {
		username: NEXTCLOUD_USER,
		password: NEXTCLOUD_APP_PASSWORD,
	});
}

/** Remove caracteres inválidos do nome do arquivo */
function sanitizeFilename(filename: string): string {
	return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "arquivo";
}

function buildRemotePath(filename: string, options?: { despesaId?: string }): string {
	const safeName = sanitizeFilename(filename);
	if (options?.despesaId) {
		return `/recibos/despesa-${options.despesaId}/${safeName}`;
	}
	return `/recibos/${safeName}`;
}

export type UploadResult = { path: string };

/**
 * Faz upload de um recibo para o Nextcloud via WebDAV.
 *
 * @param fileBuffer - Conteúdo do arquivo em Buffer
 * @param filename - Nome do arquivo (ex: recibo-123.pdf)
 * @param options - despesaId para incluir no path (opcional)
 * @returns { path } - Caminho remoto do ficheiro
 */
export async function uploadRecibo(
	fileBuffer: Buffer,
	filename: string,
	options?: { despesaId?: string },
): Promise<UploadResult> {
	const client = getClient();
	const remotePath = buildRemotePath(filename, options);

	const dirPath = remotePath.substring(0, remotePath.lastIndexOf("/"));
	if (dirPath) {
		await client.createDirectory(dirPath, { recursive: true });
	}

	const success = await client.putFileContents(remotePath, fileBuffer, { overwrite: true });
	if (!success) {
		throw new Error("Falha ao fazer upload no Nextcloud");
	}

	return { path: remotePath };
}

interface OcsShareResponse {
	ocs?: {
		meta?: { statuscode?: number };
		data?: { url?: string; id?: string };
	};
}

/**
 * Cria link público via OCS Share API (shareType 3 = public link).
 */
async function createShareLink(remotePath: string): Promise<string> {
	const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_APP_PASSWORD}`).toString("base64");

	const res = await fetch(`${OCS_BASE}/shares?format=json`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${auth}`,
			"OCS-APIRequest": "true",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			path: remotePath,
			shareType: "3", // public link
			permissions: "1", // read only
		}),
	});

	const data = (await res.json()) as OcsShareResponse;

	if (!res.ok) {
		const msg = (data as { message?: string }).message ?? `HTTP ${res.status}`;
		throw new Error(`Falha ao criar link de partilha no Nextcloud: ${msg}`);
	}

	const statusCode = data.ocs?.meta?.statuscode ?? 0;
	if (statusCode !== 200 && statusCode !== 100) {
		throw new Error("Falha ao criar link de partilha no Nextcloud");
	}

	const url = data.ocs?.data?.url;
	if (!url) {
		throw new Error("Resposta do Nextcloud não contém URL do share");
	}

	return url;
}

/**
 * Obtém link público a partir do caminho remoto (para comprovantes já armazenados).
 * Útil quando o comprovante foi guardado como path em vez de URL.
 */
export async function getShareUrlFromPath(remotePath: string): Promise<string> {
	return createShareLink(remotePath);
}

/**
 * Faz upload do recibo, cria link de partilha e retorna a URL pública.
 * Armazena a URL no banco (link permanente).
 */
export async function uploadReciboAndGetUrl(
	fileBuffer: Buffer,
	filename: string,
	options?: { despesaId?: string },
): Promise<string> {
	const { path } = await uploadRecibo(fileBuffer, filename, options);
	return createShareLink(path);
}
