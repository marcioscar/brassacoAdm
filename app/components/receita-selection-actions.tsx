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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import type { Receita } from "~/components/columns-rec";
import { CONTAS, LOJAS } from "~/models/receitas.constants";

function formatDateForInput(d: Date | null): string {
	if (!d) return "";
	const date = new Date(d);
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

interface ReceitaSelectionActionsProps {
	selectedRows: Receita[];
	onClearSelection?: () => void;
}

export function ReceitaSelectionActions({
	selectedRows,
	onClearSelection,
}: ReceitaSelectionActionsProps) {
	const fetcher = useFetcher<{ errors?: Record<string, string[]> }>();
	const [editOpen, setEditOpen] = useState(false);

	const receita = selectedRows[0] ?? null;
	const busy = fetcher.state !== "idle";

	const [conta, setConta] = useState(receita?.conta ?? "");
	const [loja, setLoja] = useState(receita?.loja ?? "");

	useEffect(() => {
		if (receita) {
			setConta(receita.conta ?? "");
			setLoja(receita.loja ?? "");
		}
	}, [receita?.id]);

	function handleDelete() {
		if (!receita || !confirm("Excluir esta receita?")) return;
		fetcher.submit(
			{ intent: "delete", id: receita.id },
			{ method: "post", action: "/receitas" },
		);
		onClearSelection?.();
	}

	function openEdit() {
		if (receita) {
			setConta(receita.conta ?? "");
			setLoja(receita.loja ?? "");
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
						<DialogTitle>Editar Receita</DialogTitle>
					</DialogHeader>
					{receita && (
						<fetcher.Form
							method='post'
							action='/receitas'
							onSubmit={() => setEditOpen(false)}
							className='flex flex-col gap-6'>
							<input type='hidden' name='intent' value='edit' />
							<input type='hidden' name='id' value={receita.id} />
							<FieldGroup className='grid grid-cols-2 gap-4'>
								<Field>
									<FieldLabel>Conta</FieldLabel>
									<Select
										value={conta}
										onValueChange={setConta}
										disabled={busy}>
										<SelectTrigger className='w-full'>
											<SelectValue placeholder='Conta' />
										</SelectTrigger>
										<SelectContent>
											{CONTAS.map((c) => (
												<SelectItem key={c} value={c}>
													{c}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<input type='hidden' name='conta' value={conta} />
								</Field>
								<Field>
									<FieldLabel>Loja</FieldLabel>
									<Select value={loja} onValueChange={setLoja} disabled={busy}>
										<SelectTrigger className='w-full'>
											<SelectValue placeholder='Loja' />
										</SelectTrigger>
										<SelectContent>
											{LOJAS.map((l) => (
												<SelectItem key={l} value={l}>
													{l}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<input type='hidden' name='loja' value={loja} />
								</Field>
								<Field>
									<FieldLabel>Data</FieldLabel>
									<Input
										name='data'
										type='date'
										defaultValue={formatDateForInput(receita.data)}
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
										defaultValue={receita.valor ?? ""}
										required
										disabled={busy}
									/>
								</Field>
								<Field className='col-span-2'>
									<FieldLabel>Descrição</FieldLabel>
									<Input
										name='descricao'
										defaultValue={receita.descricao ?? ""}
										required
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
