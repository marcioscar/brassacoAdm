"use client";

import { ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

export type Compra = {
	id: string;
	valor: number | null;
	fornecedor: string | null;
	/** Aceita string, number ou JsonValue do Prisma (banco pode ter os dois tipos) */
	nf: string | number | null;
	data: Date | null;
};

export type CompraTableOptions = {
	variant: "compras";
	enableSelection?: boolean;
};

export function getColumns(
	options?: CompraTableOptions,
): ColumnDef<Compra>[] {
	const columns: ColumnDef<Compra>[] = [];

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

	columns.push(
		{
			accessorKey: "fornecedor",
			header: ({ column }) => (
				<Button
					variant='ghost'
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Fornecedor
					<ArrowUpDown className='ml-2 size-4' />
				</Button>
			),
		},
		{
			accessorKey: "valor",
			header: () => <div className='text-right'>Valor</div>,
			cell: ({ row }) => {
				const valor = row.getValue("valor") as number | null;
				if (valor == null) return <div className='text-right'>—</div>;
				return (
					<div className='text-right'>
						{new Intl.NumberFormat("pt-BR", {
							style: "currency",
							currency: "BRL",
						}).format(valor)}
					</div>
				);
			},
		},
		{
			accessorKey: "nf",
			header: "NF",
			cell: ({ row }) => {
				const nf = row.getValue("nf") as string | number | null;
				if (nf == null || nf === "") return "—";
				return String(nf);
			},
		},
		{
			accessorKey: "data",
			header: "Data",
			cell: ({ row }) => {
				const data = row.getValue("data") as Date | null;
				if (data == null) return "—";
				return new Intl.DateTimeFormat("pt-BR", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
					timeZone: "UTC",
				}).format(new Date(data));
			},
		},
	);

	return columns;
}
