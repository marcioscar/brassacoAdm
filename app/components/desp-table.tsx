import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
	type SortingState,
	getSortedRowModel,
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
import { useCallback, useState } from "react";
import { Input } from "~/components/ui/input";
import { filtrarPorQualquerCampo } from "~/lib/busca-tabela";

export type SelectionTableUtils = { clearSelection: () => void };

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	enableRowSelection?: boolean;
	getRowId?: (row: TData) => string;
	selectionActions?: (
		selectedRows: TData[],
		utils: SelectionTableUtils,
	) => React.ReactNode;
	/** toolbar: barra sempre que houver seleção; toolbar-multi-only: barra só com 2+ linhas (1 linha: ações fora da barra, ex.: diálogo) */
	selectionPlacement?: "toolbar" | "toolbar-multi-only";
	filterExtra?: React.ReactNode;
	/** Busca em todas as colunas (ver `filtrarPorQualquerCampo`). Desligue quando a tela já tem busca própria. */
	enableSearch?: boolean;
	searchPlaceholder?: string;
}

export function DataTable<TData extends { id?: string }, TValue>({
	columns,
	data,
	enableRowSelection = false,
	getRowId = (row) => (row as { id: string }).id,
	selectionActions,
	selectionPlacement = "toolbar",
	filterExtra,
	enableSearch = true,
	searchPlaceholder = "Buscar em qualquer campo...",
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [globalFilter, setGlobalFilter] = useState("");

	const clearSelection = useCallback(() => setRowSelection({}), []);

	const table = useReactTable({
		data,
		columns,
		getRowId,
		initialState: { pagination: { pageSize: 12 } },
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onGlobalFilterChange: setGlobalFilter,
		globalFilterFn: filtrarPorQualquerCampo,
		// O padrão só deixa filtrar colunas de texto/número; a busca é da linha toda.
		getColumnCanGlobalFilter: () => true,
		onRowSelectionChange: setRowSelection,
		enableRowSelection,
		state: {
			sorting,
			rowSelection,
			globalFilter,
		},
	});

	const selectedRows = table.getFilteredSelectedRowModel().rows.map((r) => r.original);
	const hasSelection = selectedRows.length > 0;
	const selectionUtils: SelectionTableUtils = { clearSelection };
	const toolbarContent =
		hasSelection && selectionActions
			? selectionActions(selectedRows, selectionUtils)
			: null;
	const showToolbar =
		hasSelection &&
		(selectionPlacement === "toolbar" ||
			(selectionPlacement === "toolbar-multi-only" && selectedRows.length > 1));
	const showFloatingSelection =
		hasSelection &&
		selectionPlacement === "toolbar-multi-only" &&
		selectedRows.length === 1;

	return (
		<>
			{showToolbar && (
				<div className="mb-4 flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-3">
					<span className="text-sm font-medium">
						{selectedRows.length} linha(s) selecionada(s)
					</span>
					{selectionPlacement === "toolbar" || selectedRows.length > 1
						? toolbarContent
						: null}
				</div>
			)}
			{showFloatingSelection && toolbarContent}
			{enableSearch || filterExtra ? (
				<div className="flex flex-wrap items-center gap-2 py-4">
					{enableSearch ? (
						<Input
							type="search"
							placeholder={searchPlaceholder}
							value={globalFilter}
							onChange={(event) => {
								setGlobalFilter(event.target.value);
								table.setPageIndex(0);
							}}
							className="max-w-sm"
						/>
					) : null}
					{filterExtra}
				</div>
			) : null}
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
