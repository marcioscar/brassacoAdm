export type MesAno = { mes: number; ano: number };

const TZ_BR = "America/Sao_Paulo";

/**
 * Mês/ano do campo `data` como dia civil gravado em UTC meia-noite (ex.: input type="date" → `2026-04-01T00:00:00.000Z`).
 * Usa getUTC* — não converter o instante para São Paulo, senão 01/04 UTC vira 31/03 no Brasil e some do mês certo.
 */
export function obterMesAnoDaDataCivilUTC(
	data: Date | string | null,
): MesAno | null {
	if (data == null) return null;
	const d = data instanceof Date ? data : new Date(data);
	if (Number.isNaN(d.getTime())) return null;
	return { mes: d.getUTCMonth() + 1, ano: d.getUTCFullYear() };
}

export function isMesmoMesAnoDataCivilUTC(
	data: Date | string | null,
	mes: number,
	ano: number,
): boolean {
	const m = obterMesAnoDaDataCivilUTC(data);
	return m != null && m.mes === mes && m.ano === ano;
}

export function obterMesAnoAtual(): MesAno {
	const agora = new Date();
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: TZ_BR,
		year: "numeric",
		month: "2-digit",
	});
	const parts = formatter.formatToParts(agora);
	const ano = Number(parts.find((part) => part.type === "year")?.value);
	const mes = Number(parts.find((part) => part.type === "month")?.value);
	return { mes, ano };
}

export function obterMesAnoAnterior({ mes, ano }: MesAno): MesAno {
	if (mes === 1) {
		return { mes: 12, ano: ano - 1 };
	}
	return { mes: mes - 1, ano };
}

/** Rótulo para “saldo no 1º dia do mês” (ex.: 1º fev. de 2026). */
export function formatarDia1Mes(mes: number, ano: number) {
	const mesFmt = new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString(
		"pt-BR",
		{ month: "short", timeZone: "UTC" },
	);
	return `1º ${mesFmt} de ${ano}`;
}

export function formatarMesAno(mes: number, ano: number) {
	const mesComZero = String(mes).padStart(2, "0");
	return `${mesComZero}/${ano}`;
}

export function parseMesAnoValue(value: string) {
	const match = value.match(/^(0?[1-9]|1[0-2])[\/-](\d{4})$/);
	if (!match) {
		return null;
	}
	return { mes: Number(match[1]), ano: Number(match[2]) };
}
