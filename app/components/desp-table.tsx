import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
	type SortingState,
	getSortedRowModel,
	type ColumnFiltersState,
	getFilteredRowModel,
	type RowSelectionState,
} from "@tanstack/react-table";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";

import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Input } from "~/components/ui/input";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	enableRowSelection?: boolean;
	getRowId?: (row: TData) => string;
	selectionActions?: (selectedRows: TData[]) => React.ReactNode;
	filterColumn?: string;
	filterPlaceholder?: string;
	filterExtra?: React.ReactNode;
}

export function DataTable<TData extends { id?: string }, TValue>({
	columns,
	data,
	enableRowSelection = false,
	getRowId = (row) => (row as { id: string }).id,
	selectionActions,
	filterColumn = "fornecedor",
	filterPlaceholder = "Filtrar por fornecedor...",
	filterExtra,
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	const table = useReactTable({
		data,
		columns,
		getRowId,
		initialState: { pagination: { pageSize: 12 } },
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: setRowSelection,
		enableRowSelection,
		state: {
			sorting,
			columnFilters,
			rowSelection,
		},
	});

	const selectedRows = table.getFilteredSelectedRowModel().rows.map((r) => r.original);
	const hasSelection = selectedRows.length > 0;

	return (
		<>
			{hasSelection && selectionActions && (
				<div className="mb-4 flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-3">
					<span className="text-sm font-medium">
						{selectedRows.length} linha(s) selecionada(s)
					</span>
					{selectionActions(selectedRows)}
				</div>
			)}
			{filterColumn && (
				<div className="flex flex-wrap items-center gap-2 py-4">
					<Input
						placeholder={filterPlaceholder}
						value={
							(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""
						}
						onChange={(event) =>
							table.getColumn(filterColumn)?.setFilterValue(event.target.value)
						}
						className="max-w-sm"
					/>
					{filterExtra}
				</div>
			)}
			<div className="overflow-x-auto rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center">
									Nenhum resultado.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
				<div className="flex items-center justify-end space-x-2 px-4 py-4">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}>
						Anterior
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}>
						Próximo
					</Button>
				</div>
			</div>
		</>
	);
}
