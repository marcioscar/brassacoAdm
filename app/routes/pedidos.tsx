import type { Route } from "./+types/pedidos";
import { Form, redirect } from "react-router";
import { DataTable } from "~/components/desp-table";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { getColumnsProdutosPreco } from "~/components/columns-produtos-preco";
import { ProdutoPrecoSelectionActions } from "~/components/produto-preco-selection-actions";
import {
	getProdutosPreco,
	updateProdutoPreco,
	validarProdutoPreco,
} from "~/models/produtos-preco.server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Pedidos" }, { name: "description", content: "Pedidos" }];
}

function lerTermoBusca(request: Request) {
	const url = new URL(request.url);
	return (url.searchParams.get("busca") ?? "").trim();
}

type ProdutoParaExportacao = {
	id: string;
	codigo: string;
	descricao: string;
	unidade: string;
	complemento?: string | null;
	quantidade?: string | null;
	preco: number;
};

function normalizarCodigo(codigo: string) {
	const texto = String(codigo).trim();
	if (/^\d{1,3}([.,]\d{3})+$/.test(texto)) {
		return texto.replace(/[.,]/g, "");
	}
	return texto;
}

function formatarPreco(preco: number) {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(preco);
}

function escaparCsv(valor: string | number) {
	const texto = String(valor).replaceAll('"', '""');
	return `"${texto}"`;
}

function baixarArquivo(conteudo: BlobPart, nomeArquivo: string, tipo: string) {
	const blob = new Blob([conteudo], { type: tipo });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = nomeArquivo;
	link.click();
	URL.revokeObjectURL(url);
}

function exportarCsv(produtos: ProdutoParaExportacao[]) {
	const cabecalho = [
		"codigo",
		"descricao",
		"unidade",
		"complemento",
		"quantidade",
		"preco",
	];
	const linhas = produtos.map((produto) =>
		[
			escaparCsv(normalizarCodigo(produto.codigo)),
			escaparCsv(produto.descricao),
			escaparCsv(produto.unidade),
			escaparCsv(produto.complemento ?? ""),
			escaparCsv(produto.quantidade ?? ""),
			escaparCsv(produto.preco),
		].join(","),
	);
	const csv = [cabecalho.join(","), ...linhas].join("\n");
	baixarArquivo(csv, "produtos-preco.csv", "text/csv;charset=utf-8;");
}

function exportarPdf(produtos: ProdutoParaExportacao[]) {
	const doc = new jsPDF({ orientation: "landscape" });
	doc.setFontSize(14);
	doc.text("Produtos - Tabela de Precos", 14, 16);

	autoTable(doc, {
		startY: 22,
		head: [["Codigo", "Descricao", "Unidade", "Complemento", "Quantidade", "Preco"]],
		body: produtos.map((produto) => [
			normalizarCodigo(produto.codigo),
			produto.descricao,
			produto.unidade,
			produto.complemento ?? "",
			produto.quantidade ?? "",
			formatarPreco(produto.preco),
		]),
		styles: { fontSize: 9 },
		headStyles: { fillColor: [31, 41, 55] },
	});

	doc.save("produtos-preco.pdf");
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent !== "edit") {
		return Response.json({ error: "Intent inválido" }, { status: 400 });
	}

	const id = String(formData.get("id") ?? "");
	if (!id) {
		return Response.json({ error: "ID inválido" }, { status: 400 });
	}

	const payload = {
		codigo: String(formData.get("codigo") ?? ""),
		descricao: String(formData.get("descricao") ?? ""),
		unidade: String(formData.get("unidade") ?? ""),
		complemento: String(formData.get("complemento") ?? ""),
		quantidade: String(formData.get("quantidade") ?? ""),
		preco: formData.get("preco"),
	};

	const validated = validarProdutoPreco(payload);
	if (!validated.success) {
		return Response.json(
			{ errors: validated.error.flatten().fieldErrors },
			{ status: 400 },
		);
	}

	await updateProdutoPreco(id, validated.data);
	const buscaAtual = String(formData.get("buscaAtual") ?? "").trim();
	const destino = buscaAtual
		? `/pedidos?busca=${encodeURIComponent(buscaAtual)}`
		: "/pedidos";
	throw redirect(destino);
}

export async function loader({ request }: Route.LoaderArgs) {
	const busca = lerTermoBusca(request);
	const produtos = await getProdutosPreco({ termo: busca });
	return { produtos, busca };
}

export default function Pedidos({ loaderData }: Route.ComponentProps) {
	const { produtos, busca } = loaderData;

	return (
		<div className='container mx-auto'>
			<div className='mb-4 space-y-4'>
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<h1 className='text-2xl font-bold'>Pedidos</h1>
					<div className='flex items-center gap-2'>
						<Button
							type='button'
							variant='outline'
							onClick={() => exportarCsv(produtos)}
							disabled={produtos.length === 0}>
							<Download className='mr-1.5 size-4' />
							Exportar CSV
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={() => exportarPdf(produtos)}
							disabled={produtos.length === 0}>
							<Download className='mr-1.5 size-4' />
							Exportar PDF
						</Button>
					</div>
				</div>
				<Form method='get' className='flex max-w-xl flex-wrap items-center gap-2'>
					<Input
						type='text'
						name='busca'
						defaultValue={busca}
						placeholder='Pesquisar por código ou descrição...'
					/>
				</Form>
			</div>

			<DataTable
				columns={getColumnsProdutosPreco({ enableSelection: true })}
				data={produtos}
				enableRowSelection
				getRowId={(row) => row.id}
				selectionActions={(selected, { clearSelection }) => (
					<ProdutoPrecoSelectionActions
						selectedRows={selected}
						buscaAtual={busca}
						onClearSelection={clearSelection}
					/>
				)}
				filterColumn=''
			/>
		</div>
	);
}
