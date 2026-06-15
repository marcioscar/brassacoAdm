"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";

export type ProdutoPreco = {
	id: string;
	codigo: string;
	descricao: string;
	unidade: string;
	preco: number;
	complemento?: string | null;
	quantidade?: string | null;
};

type ProdutosPrecoTableOptions = {
	enableSelection?: boolean;
};

function formatarCodigo(codigo: string) {
	const texto = String(codigo).trim();
	if (/^\d{1,3}([.,]\d{3})+$/.test(texto)) {
		return texto.replace(/[.,]/g, "");
	}
	return texto;
}

function formatarMoeda(valor: number) {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(valor);
}

export function getColumnsProdutosPreco(
	options?: ProdutosPrecoTableOptions,
): ColumnDef<ProdutoPreco>[] {
	const columns: ColumnDef<ProdutoPreco>[] = [];

	if (options?.enableSelection) {
		columns.push({
			id: "select",
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label='Selecionar todas'
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label='Selecionar linha'
				/>
			),
			enableSorting: false,
			enableHiding: false,
		});
	}

	columns.push({
			accessorKey: "codigo",
			cell: ({ row }) => <span>{formatarCodigo(row.original.codigo)}</span>,
			header: ({ column }) => (
				<Button
					variant='ghost'
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Código
					<ArrowUpDown className='ml-2 size-4' />
				</Button>
			),
		});

	columns.push(
		{
			accessorKey: "descricao",
			header: ({ column }) => (
				<Button
					variant='ghost'
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Descrição
					<ArrowUpDown className='ml-2 size-4' />
				</Button>
			),
		},
		{
			accessorKey: "unidade",
			header: "Unidade",
		},
		{
			accessorKey: "complemento",
			header: "Complemento",
			cell: ({ row }) => row.original.complemento ?? "-",
		},
		{
			accessorKey: "quantidade",
			header: "Quantidade",
			cell: ({ row }) => row.original.quantidade ?? "-",
		},
		{
			accessorKey: "preco",
			header: () => <div className='text-right'>Preço</div>,
			cell: ({ row }) => (
				<div className='text-right'>{formatarMoeda(row.original.preco)}</div>
			),
		},
	);

	return columns;
}
