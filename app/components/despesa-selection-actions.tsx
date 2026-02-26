import { Pencil, Trash2, Upload, CheckCircle } from "lucide-react";
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
	FieldError,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
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
import type { Despesa } from "~/components/columns-desp";

const CONTAS = [
	"Revenda",
	"Servicos",
	"Impostos",
	"Pessoal",
	"Transporte",
] as const;
const TIPOS = ["fixo", "variavel"] as const;
const LOJAS = ["QI", "QNE", "NRT", "SDS"] as const;

function formatDateForInput(d: Date | null): string {
	if (!d) return "";
	const date = new Date(d);
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

interface DespesaSelectionActionsProps {
	selectedRows: Despesa[];
	variant: "despesas" | "contas_a_pagar";
	fornecedores: { id: string; nome: string | null }[];
	onClearSelection?: () => void;
}

export function DespesaSelectionActions({
	selectedRows,
	variant,
	fornecedores,
	onClearSelection,
}: DespesaSelectionActionsProps) {
	const fetcher = useFetcher<{ errors?: Record<string, string[]> }>();
	const [editOpen, setEditOpen] = useState(false);
	const [uploadOpen, setUploadOpen] = useState(false);

	const despesa = selectedRows[0] ?? null;
	const busy = fetcher.state !== "idle";

	const [conta, setConta] = useState(despesa?.conta ?? "");
	const [tipo, setTipo] = useState(despesa?.tipo ?? "");
	const [loja, setLoja] = useState(despesa?.loja ?? "");
	const [fornecedor, setFornecedor] = useState(despesa?.fornecedor ?? "");

	const actionUrl = variant === "despesas" ? "/despesas" : "/contas_a_pagar";
	const uploadFieldName = "comprovante";
	const uploadLabel = "Comprovante";
	const uploadIntent = "uploadComprovante";

	useEffect(() => {
		if (despesa) {
			setConta(despesa.conta ?? "");
			setTipo(despesa.tipo ?? "");
			setLoja(despesa.loja ?? "");
			setFornecedor(despesa.fornecedor ?? "");
		}
	}, [despesa?.id]);

	function handleDelete() {
		if (!despesa || !confirm("Excluir esta conta?")) return;
		fetcher.submit(
			{ intent: "delete", id: despesa.id },
			{ method: "post", action: actionUrl },
		);
		onClearSelection?.();
	}

	function handleMarcarPaga() {
		if (!despesa) return;
		fetcher.submit(
			{ intent: "marcarPaga", id: despesa.id },
			{ method: "post", action: actionUrl },
		);
		onClearSelection?.();
	}

	function openEdit() {
		if (despesa) {
			setConta(despesa.conta ?? "");
			setTipo(despesa.tipo ?? "");
			setLoja(despesa.loja ?? "");
			setFornecedor(despesa.fornecedor ?? "");
			setEditOpen(true);
		}
	}

	// Apenas 1 linha selecionada para editar/upload
	if (selectedRows.length === 0) return null;
	if (selectedRows.length > 1) {
		return (
			<span className='text-muted-foreground text-sm'>
				Selecione apenas 1 linha para editar ou enviar comprovante.
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
				{variant === "contas_a_pagar" && (
					<Button
						variant='outline'
						size='sm'
						onClick={handleMarcarPaga}
						disabled={busy}
						className='h-8'>
						<CheckCircle className='mr-1.5 size-4' />
						Marcar como paga
					</Button>
				)}
				<Button
					variant='outline'
					size='sm'
					onClick={() => setUploadOpen(true)}
					disabled={busy}
					className='h-8'>
					<Upload className='mr-1.5 size-4' />
					Enviar {uploadLabel}
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

			{/* Dialog Editar */}
			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className='max-w-lg'>
					<DialogHeader>
						<DialogTitle>
							Editar {variant === "despesas" ? "Despesa" : "Conta a Pagar"}
						</DialogTitle>
					</DialogHeader>
					{despesa && (
						<fetcher.Form
							method='post'
							action={actionUrl}
							onSubmit={() => setEditOpen(false)}
							className='flex flex-col gap-6'>
							<input type='hidden' name='intent' value='edit' />
							<input type='hidden' name='id' value={despesa.id} />
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
									<FieldLabel>Data</FieldLabel>
									<Input
										name='data'
										type='date'
										defaultValue={formatDateForInput(despesa.data)}
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
										defaultValue={despesa.valor ?? ""}
										required
										disabled={busy}
									/>
								</Field>
								<Field className='col-span-2'>
									<FieldLabel>Descrição</FieldLabel>
									<Input
										name='descricao'
										defaultValue={despesa.descricao ?? ""}
										required
										disabled={busy}
									/>
								</Field>
								<Field>
									<FieldLabel>Tipo</FieldLabel>
									<Select value={tipo} onValueChange={setTipo} disabled={busy}>
										<SelectTrigger className='w-full'>
											<SelectValue placeholder='Tipo' />
										</SelectTrigger>
										<SelectContent>
											{TIPOS.map((t) => (
												<SelectItem key={t} value={t}>
													{t}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<input type='hidden' name='tipo' value={tipo} />
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

			{/* Dialog Upload */}
			<Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
				<DialogContent className='max-w-md'>
					<DialogHeader>
						<DialogTitle>Enviar {uploadLabel}</DialogTitle>
					</DialogHeader>
					{despesa && (
						<fetcher.Form
							method='post'
							action={actionUrl}
							encType='multipart/form-data'
							onSubmit={() => setUploadOpen(false)}>
							<input type='hidden' name='intent' value={uploadIntent} />
							<input type='hidden' name='id' value={despesa.id} />
							{despesa.data && (
								<input
									type='hidden'
									name='data'
									value={formatDateForInput(despesa.data)}
								/>
							)}
							<Field>
								<FieldLabel>{uploadLabel}</FieldLabel>
								<Input
									name={uploadFieldName}
									type='file'
									accept='.pdf,.jpg,.jpeg,.png,.webp'
									required
									disabled={busy}
									className='cursor-pointer'
								/>
							</Field>
							<DialogFooter>
								<Button
									type='button'
									variant='outline'
									onClick={() => setUploadOpen(false)}>
									Cancelar
								</Button>
								<Button type='submit' disabled={busy}>
									{busy ? "Enviando..." : "Enviar"}
								</Button>
							</DialogFooter>
						</fetcher.Form>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
