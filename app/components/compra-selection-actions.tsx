import { Pencil, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	Field,
	FieldGroup,
	FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "~/components/ui/combobox";
import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Compra } from "~/components/columns-compra";

function formatDateForInput(d: Date | null): string {
	if (!d) return "";
	const date = new Date(d);
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

interface CompraSelectionActionsProps {
	selectedRows: Compra[];
	fornecedores: { id: string; nome: string | null }[];
	onClearSelection?: () => void;
}

export function CompraSelectionActions({
	selectedRows,
	fornecedores,
	onClearSelection,
}: CompraSelectionActionsProps) {
	const fetcher = useFetcher<{ errors?: Record<string, string[]> }>();
	const [editOpen, setEditOpen] = useState(false);

	const compra = selectedRows[0] ?? null;
	const busy = fetcher.state !== "idle";

	const [fornecedor, setFornecedor] = useState(compra?.fornecedor ?? "");

	useEffect(() => {
		if (compra) {
			setFornecedor(compra.fornecedor ?? "");
		}
	}, [compra?.id]);

	function handleDelete() {
		if (!compra || !confirm("Excluir esta compra?")) return;
		fetcher.submit(
			{ intent: "delete", id: compra.id },
			{ method: "post", action: "/compras" },
		);
		onClearSelection?.();
	}

	function openEdit() {
		if (compra) {
			setFornecedor(compra.fornecedor ?? "");
			setEditOpen(true);
		}
	}

	if (selectedRows.length === 0) return null;
	if (selectedRows.length > 1) {
		return (
			<span className='text-muted-foreground text-sm'>
				Selecione apenas 1 linha para editar.
			</span>
		);
	}

	return (
		<>
			<div className='flex flex-wrap items-center gap-2'>
				<Button
					variant='outline'
					size='sm'
					onClick={openEdit}
					disabled={busy}
					className='h-8'>
					<Pencil className='mr-1.5 size-4' />
					Editar
				</Button>
				<Button
					variant='destructive'
					size='sm'
					onClick={handleDelete}
					disabled={busy}
					className='h-8'>
					<Trash2 className='mr-1.5 size-4' />
					Excluir
				</Button>
			</div>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className='max-w-lg'>
					<DialogHeader>
						<DialogTitle>Editar Compra</DialogTitle>
					</DialogHeader>
					{compra && (
						<fetcher.Form
							method='post'
							action='/compras'
							onSubmit={() => setEditOpen(false)}
							className='flex flex-col gap-6'>
							<input type='hidden' name='intent' value='edit' />
							<input type='hidden' name='id' value={compra.id} />
							<FieldGroup className='grid grid-cols-2 gap-4'>
								<Field className='col-span-2'>
									<FieldLabel>Fornecedor</FieldLabel>
									<Combobox
										items={fornecedores.map((f) => f.nome ?? f.id)}
										value={fornecedor || null}
										onValueChange={(v) => setFornecedor(v ?? "")}>
										<ComboboxInput
											placeholder='Selecione o fornecedor'
											disabled={busy}
											className='w-full'
										/>
										<ComboboxContent>
											<ComboboxEmpty>
												Nenhum fornecedor encontrado.
											</ComboboxEmpty>
											<ComboboxList>
												{(item) => (
													<ComboboxItem key={item} value={item}>
														{item}
													</ComboboxItem>
												)}
											</ComboboxList>
										</ComboboxContent>
									</Combobox>
									<input type='hidden' name='fornecedor' value={fornecedor} />
								</Field>
								<Field>
									<FieldLabel>Data</FieldLabel>
									<Input
										name='data'
										type='date'
										defaultValue={formatDateForInput(compra.data)}
										required
										disabled={busy}
									/>
								</Field>
								<Field>
									<FieldLabel>Valor</FieldLabel>
									<Input
										name='valor'
										type='number'
										step='0.01'
										min='0'
										defaultValue={compra.valor ?? ""}
										required
										disabled={busy}
									/>
								</Field>
								<Field>
									<FieldLabel>NF</FieldLabel>
									<Input
										name='nf'
										type='text'
										placeholder='Ex: 123 ou 12345'
										defaultValue={
											compra.nf != null ? String(compra.nf) : ""
										}
										disabled={busy}
									/>
								</Field>
							</FieldGroup>
							<DialogFooter>
								<Button
									type='button'
									variant='outline'
									onClick={() => setEditOpen(false)}>
									Cancelar
								</Button>
								<Button type='submit' disabled={busy}>
									{busy ? "Salvando..." : "Salvar"}
								</Button>
							</DialogFooter>
						</fetcher.Form>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
