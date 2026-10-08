import type { Row } from "@tanstack/react-table";

/** Minúsculas e sem acento: "Serviços" e "servicos" são a mesma busca. */
export function normalizarBusca(texto: string) {
	return texto
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase();
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}T/;
const formatoMoeda = new Intl.NumberFormat("pt-BR", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
const formatoData = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	timeZone: "UTC",
});

/**
 * O texto pesquisável de um valor, no formato em que ele APARECE na tabela —
 * buscar "1.234,50" ou "04/2026" tem que achar o que está na tela, não o
 * número cru ou a data ISO guardada.
 *
 * Números entram também crus ("1234.5", "1234,50"), para quem digita sem ponto
 * de milhar. Links (comprovante, boleto) ficam de fora: na tela são um ícone,
 * e a URL faria "pdf" ou "http" casar com tudo.
 */
function textoDoValor(valor: unknown): string {
	if (valor == null || typeof valor === "boolean") return "";
	if (valor instanceof Date) return formatoData.format(valor);
	if (typeof valor === "number") {
		if (!Number.isFinite(valor)) return "";
		return `${formatoMoeda.format(valor)} ${String(valor)} ${String(valor).replace(".", ",")}`;
	}
	if (typeof valor === "string") {
		if (/^https?:\/\//i.test(valor)) return "";
		if (DATA_ISO.test(valor)) return formatoData.format(new Date(valor));
		return valor;
	}
	if (Array.isArray(valor)) return valor.map(textoDoValor).join(" ");
	if (typeof valor === "object") return Object.values(valor).map(textoDoValor).join(" ");
	return String(valor);
}

const textoPorLinha = new WeakMap<object, string>();

function textoDaLinha<T>(row: Row<T>) {
	const chave = row.original as object;
	let texto = textoPorLinha.get(chave);
	if (texto === undefined) {
		texto = normalizarBusca(
			row
				.getAllCells()
				.map((cell) => textoDoValor(cell.getValue()))
				.join(" | "),
		);
		textoPorLinha.set(chave, texto);
	}
	return texto;
}

/**
 * Busca em TODAS as colunas da linha. Cada palavra digitada tem que aparecer
 * em algum campo: "qi revenda" acha as linhas da loja QI na conta Revenda.
 *
 * O TanStack chama o filtro global uma vez por coluna e aceita a linha se
 * alguma coluna passar; como aqui a resposta é da linha inteira (e fica em
 * cache), o resultado é o mesmo em qualquer coluna.
 */
export function filtrarPorQualquerCampo<T>(
	row: Row<T>,
	_columnId: string,
	busca: unknown,
) {
	const termos = normalizarBusca(String(busca ?? ""))
		.split(/\s+/)
		.filter(Boolean);
	if (termos.length === 0) return true;
	const texto = textoDaLinha(row);
	return termos.every((termo) => texto.includes(termo));
}
