"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import { formatCurrencyBRL } from "~/lib/formatters";

export type LinhaAnalisePreco = {
	id: string;
	codigo: string;
	produto: string;
	unidade: string;
	custo: number;
	venda: number;
	resultado: {
		margemBruta: number;
		sobraReal: number;
		status: string;
	} | null;
	precoSugerido: number | null;
};

function cabecalhoOrdenavel(label: string, alinharDireita = false) {
	return ({ column }: { column: any }) => (
		<div className={alinharDireita ? "text-right" : undefined}>
			<Button
				variant='ghost'
				className='px-2'
				onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
				{label}
				<ArrowUpDown className='ml-2 size-4' />
			</Button>
		</div>
	);
}

function corStatus(status: string) {
	if (status === "LUCRATIVO") return "bg-green-100 text-green-800 border-green-300";
	if (status === "PREJUÍZO") return "bg-red-100 text-red-800 border-red-300";
	return "bg-yellow-100 text-yellow-800 border-yellow-300";
}

export const columnsCalculadoraPreco: ColumnDef<LinhaAnalisePreco>[] = [
	{
		accessorKey: "codigo",
		header: cabecalhoOrdenavel("Código"),
		cell: ({ row }) => (
			<span className='text-muted-foreground text-xs'>
				{row.original.codigo || "—"}
			</span>
		),
	},
	{
		accessorKey: "produto",
		header: cabecalhoOrdenavel("Produto"),
		cell: ({ row }) => (
			<span className='font-medium block max-w-[220px] truncate'>
				{row.original.produto}
				{row.original.unidade && (
					<span className='text-muted-foreground text-xs'>
						{" "}
						({row.original.unidade})
					</span>
				)}
			</span>
		),
	},
	{
		accessorKey: "custo",
		header: cabecalhoOrdenavel("Custo", true),
		cell: ({ row }) => (
			<div className='text-right'>{formatCurrencyBRL(row.original.custo)}</div>
		),
	},
	{
		accessorKey: "venda",
		header: cabecalhoOrdenavel("Venda", true),
		cell: ({ row }) => (
			<div className='text-right'>{formatCurrencyBRL(row.original.venda)}</div>
		),
	},
	{
		id: "margem",
		accessorFn: (row) => row.resultado?.margemBruta ?? null,
		header: cabecalhoOrdenavel("Margem", true),
		cell: ({ row }) => (
			<div className='text-right'>
				{row.original.resultado
					? `${row.original.resultado.margemBruta.toFixed(1)}%`
					: "—"}
			</div>
		),
	},
	{
		id: "sugerido",
		accessorFn: (row) => row.precoSugerido ?? null,
		header: cabecalhoOrdenavel("Sugerido", true),
		cell: ({ row }) => (
			<div className='text-right text-muted-foreground'>
				{row.original.precoSugerido !== null
					? formatCurrencyBRL(row.original.precoSugerido)
					: "—"}
			</div>
		),
	},
	{
		id: "status",
		accessorFn: (row) => row.resultado?.status ?? "",
		header: cabecalhoOrdenavel("Status"),
		cell: ({ row }) =>
			row.original.resultado ? (
				<div className='text-center'>
					<Badge
						className={`text-xs ${corStatus(row.original.resultado.status)}`}
						variant='outline'>
						{row.original.resultado.status}
					</Badge>
				</div>
			) : (
				<div className='text-center'>—</div>
			),
	},
	{
		id: "sobra",
		accessorFn: (row) => row.resultado?.sobraReal ?? null,
		header: cabecalhoOrdenavel("Sobra/un.", true),
		cell: ({ row }) => {
			const sobra = row.original.resultado?.sobraReal;
			const cor =
				sobra === undefined
					? ""
					: sobra > 0
						? "text-green-600"
						: sobra < 0
							? "text-red-600"
							: "";
			return (
				<div className={`text-right font-medium ${cor}`}>
					{row.original.resultado
						? formatCurrencyBRL(row.original.resultado.sobraReal)
						: "—"}
				</div>
			);
		},
	},
];
