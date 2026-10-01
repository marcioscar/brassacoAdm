/**
 * CPF/CNPJ — cópia das regras do ERP (`pdv/app/lib/documento.ts`).
 *
 * O cadastro de fornecedor grava na mesma coleção que o ERP, então tem que
 * aceitar e recusar exatamente o mesmo: documento é opcional, mas quando vem
 * tem que ser válido, e é guardado só com os caracteres (sem máscara).
 */

/** Tira máscara e normaliza: o CNPJ alfanumérico usa letras maiúsculas. */
export function limparDocumento(valor: string) {
	return valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Dígito verificador de CPF/CNPJ. Cada caractere entra como `código ASCII − 48`,
 * o que dá 0–9 para dígitos e 17–42 para letras — a regra do CNPJ alfanumérico.
 */
function digito(base: string, pesos: number[]) {
	const soma = base
		.split("")
		.reduce((acc, char, i) => acc + (char.charCodeAt(0) - 48) * pesos[i], 0);
	const resto = soma % 11;
	return resto < 2 ? 0 : 11 - resto;
}

function repetido(valor: string) {
	return new Set(valor).size === 1;
}

function validarCpf(cpf: string) {
	if (!/^\d{11}$/.test(cpf) || repetido(cpf)) return false;
	const d1 = digito(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
	const d2 = digito(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
	return cpf === cpf.slice(0, 9) + d1 + d2;
}

function validarCnpj(cnpj: string) {
	// 12 posições alfanuméricas + 2 dígitos verificadores, sempre numéricos.
	if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || repetido(cnpj)) return false;
	const d1 = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
	const d2 = digito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
	return cnpj === cnpj.slice(0, 12) + d1 + d2;
}

export function validarCpfCnpj(bruto: string) {
	const doc = limparDocumento(bruto);
	if (doc.length === 11) return validarCpf(doc);
	if (doc.length === 14) return validarCnpj(doc);
	return false;
}

export function tipoPessoaDe(bruto: string): "FISICA" | "JURIDICA" | null {
	const doc = limparDocumento(bruto);
	if (doc.length === 11) return "FISICA";
	if (doc.length === 14) return "JURIDICA";
	return null;
}
