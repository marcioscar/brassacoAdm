"use client";

import { ArrowUpDown, Save, ReceiptText, Barcode } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

export type Despesa = {
	id: string;
	conta: string | null;
	valor: number | null;
	descricao: string | null;
	fornecedor: string | null;
	tipo: string | null;
	data: Date | null;
	comprovante: string | null;
	boleto: string | null;
	pago: boolean | null;
	loja: string | null;
};

export type DespesaTableOptions = {
	variant: "despesas" | "contas_a_pagar";
	enableSelection?: boolean;
};

export function getColumns(options?: DespesaTableOptions): ColumnDef<Despesa>[] {
	const columns: ColumnDef<Despesa>[] = [];

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
					aria-label="Selecionar todas"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Selecionar linha"
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
			header: () => <div className="text-right">Valor</div>,
			cell: ({ row }) => {
				const valor = row.getValue("valor") as number | null;
				if (valor == null) return <div className="text-right">—</div>;
				return (
					<div className="text-right">
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
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Descrição
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
		},
		{
			accessorKey: "fornecedor",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Fornecedor
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
		},
		{ accessorKey: "tipo", header: "Tipo" },
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
		{
			accessorKey: "comprovante",
			header: () => <ReceiptText className="size-4 shrink-0" />,
			cell: ({ row }) => {
				const comprovante = row.getValue("comprovante") as string | null;
				const id = row.original.id;
				if (comprovante == null || comprovante === "" || !id) return "—";
				const isInvalidUrl =
					comprovante.includes("/session") || comprovante.endsWith("/session");
				const isLegacyCloudreve = comprovante.startsWith("cloudreve://");
				const url =
					isInvalidUrl || isLegacyCloudreve
						? `/despesas/comprovante/${id}`
						: comprovante.startsWith("http://") || comprovante.startsWith("https://")
							? comprovante
							: `/despesas/comprovante/${id}`;
				return (
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 text-primary hover:underline"
						title="Ver comprovante">
						<Save className="size-4 shrink-0" />
					</a>
				);
			},
		},
		{
			accessorKey: "boleto",
			header: () => <Barcode className="size-4 shrink-0 text-orange-400" />,
			cell: ({ row }) => {
				const boleto = row.getValue("boleto") as string | null;
				const id = row.original.id;
				if (boleto == null || boleto === "" || !id) return "—";
				const isInvalidUrl =
					boleto.includes("/session") || boleto.endsWith("/session");
				const isLegacyCloudreve = boleto.startsWith("cloudreve://");
				const url =
					isInvalidUrl || isLegacyCloudreve
						? `/despesas/comprovante/${id}`
						: boleto.startsWith("http://") || boleto.startsWith("https://")
							? boleto
							: `/despesas/boleto/${id}`;
				return (
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 text-primary hover:underline"
						title="Ver boleto">
						<Save className="size-4 shrink-0" />
					</a>
				);
			},
		},
	);

	return columns;
}
