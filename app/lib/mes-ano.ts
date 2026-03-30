export type MesAno = { mes: number; ano: number };

export function obterMesAnoAtual(): MesAno {
	const agora = new Date();
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Sao_Paulo",
		year: "numeric",
		month: "2-digit",
	});
	const parts = formatter.formatToParts(agora);
	const ano = Number(parts.find((part) => part.type === "year")?.value);
	const mes = Number(parts.find((part) => part.type === "month")?.value);
	return { mes, ano };
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
