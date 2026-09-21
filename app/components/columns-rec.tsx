"use client";

import { ArrowUpDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

export type Receita = {
	id: string;
	conta: string | null;
	valor: number | null;
	descricao: string | null;
	loja: string | null;
	data: Date | null;
};

export type ReceitaTableOptions = {
	variant: "receitas";
	enableSelection?: boolean;
};

export function getColumns(
	options?: ReceitaTableOptions,
): ColumnDef<Receita>[] {
	const columns: ColumnDef<Receita>[] = [];

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
		{ accessorKey: "conta", header: "Conta" },
		{ accessorKey: "loja", header: "Loja" },
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
