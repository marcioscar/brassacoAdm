import { Trash2, Upload } from "lucide-react";
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
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
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
import { useEffect, useState } from "react";
import type { Despesa } from "~/components/columns-desp";
import { CONTAS_CORRENTES } from "~/lib/contas-correntes";

const CONTAS = [
	"Revenda",
	"Servicos",
	"Impostos",
	"Pessoal",
	"Transporte",
] as const;
const TIPOS = ["fixo", "variavel"] as const;
const LOJAS = ["QI", "QNE", "NRT", "SDS"] as const;

const ACTION_URL = "/contas_a_pagar";
const EDIT_FORM_ID = "conta-apagar-edit-form";

function formatDateForInput(d: Date | null): string {
	if (!d) return "";
	const date = new Date(d);
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

type SelectionUtils = { clearSelection: () => void };

export function ContaAPagarSelectionDialog({
	selectedRows,
	fornecedores,
	clearSelection,
}: {
	selectedRows: Despesa[];
	fornecedores: { id: string; nome: string | null }[];
	clearSelection: SelectionUtils["clearSelection"];
}) {
	const fetcher = useFetcher<{ errors?: Record<string, string[]> }>();
	const busy = fetcher.state !== "idle";
	const despesa = selectedRows[0] ?? null;

	const [conta, setConta] = useState("");
	const [contaCorrente, setContaCorrente] = useState("");
	const [tipo, setTipo] = useState("");
	const [loja, setLoja] = useState("");
	const [fornecedor, setFornecedor] = useState("");
	const [pago, setPago] = useState(false);

	useEffect(() => {
		if (selectedRows.length !== 1 || !despesa) return;
		setConta(despesa.conta ?? "");
		setContaCorrente(despesa.contaCorrente ?? "");
		setTipo(despesa.tipo ?? "");
		setLoja(despesa.loja ?? "");
		setFornecedor(despesa.fornecedor ?? "");
		setPago(despesa.pago === true);
	}, [despesa?.id, selectedRows.length]);

	const open = selectedRows.length === 1 && !!despesa;

	function handleDialogOpenChange(next: boolean) {
		if (!next) {
			clearSelection();
		}
	}

	function handleDelete() {
		if (!despesa || !confirm("Excluir esta conta?")) return;
		fetcher.submit(
			{ intent: "delete", id: despesa.id },
			{ method: "post", action: ACTION_URL },
		);
		clearSelection();
	}

	if (selectedRows.length > 1) {
		return (
			<span className='text-muted-foreground text-sm'>
				Selecione apenas 1 linha para abrir o editor.
			</span>
		);
	}

	if (!despesa) return null;

	return (
		<Dialog open={open} onOpenChange={handleDialogOpenChange}>
			<DialogContent className='max-h-[90vh] max-w-lg overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>Editar conta a pagar</DialogTitle>
				</DialogHeader>

				<fetcher.Form
					id={EDIT_FORM_ID}
					method='post'
					action={ACTION_URL}
					className='flex flex-col gap-6'>
					<input type='hidden' name='intent' value='edit' />
					<input type='hidden' name='id' value={despesa.id} />
					<input
						type='hidden'
						name='pago'
						value={pago ? "true" : "false"}
					/>
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
						<Field className='col-span-2'>
							<FieldLabel>Conta corrente (débito)</FieldLabel>
							<Combobox
								items={[...CONTAS_CORRENTES]}
								value={contaCorrente || null}
								onValueChange={(v) => setContaCorrente(v ?? "")}>
								<ComboboxInput
									placeholder='Selecione a conta a debitar'
									disabled={busy}
									className='w-full'
								/>
								<ComboboxContent>
									<ComboboxEmpty>Nenhuma conta encontrada.</ComboboxEmpty>
									<ComboboxList>
										{(item) => (
											<ComboboxItem key={item} value={item}>
												{item}
											</ComboboxItem>
										)}
									</ComboboxList>
								</ComboboxContent>
							</Combobox>
							<input
								type='hidden'
								name='contaCorrente'
								value={contaCorrente}
							/>
						</Field>
						<div className='col-span-2 flex items-center justify-between gap-4 rounded-lg border px-3 py-3'>
							<Label
								htmlFor='conta-apagar-pago'
								className='cursor-pointer font-normal'>
								Marcar como paga
							</Label>
							<Switch
								id='conta-apagar-pago'
								checked={pago}
								onCheckedChange={setPago}
								disabled={busy}
							/>
						</div>
					</FieldGroup>
				</fetcher.Form>

				<div className='flex flex-col gap-2 border-t pt-4'>
					<p className='text-muted-foreground text-sm font-medium'>
						Comprovante
					</p>
					<fetcher.Form
						method='post'
						action={ACTION_URL}
						encType='multipart/form-data'
						className='flex flex-col gap-3'>
						<input type='hidden' name='intent' value='uploadComprovante' />
						<input type='hidden' name='id' value={despesa.id} />
						{despesa.data && (
							<input
								type='hidden'
								name='data'
								value={formatDateForInput(despesa.data)}
							/>
						)}
						<Field>
							<FieldLabel>Arquivo</FieldLabel>
							<Input
								name='comprovante'
								type='file'
								accept='.pdf,.jpg,.jpeg,.png,.webp'
								required
								disabled={busy}
								className='cursor-pointer'
							/>
							<FieldError
								errors={fetcher.data?.errors?.comprovante?.map((m) => ({
									message: m,
								}))}
							/>
						</Field>
						<Button type='submit' variant='outline' disabled={busy}>
							<Upload className='mr-2 size-4' />
							{busy ? "Enviando..." : "Enviar comprovante"}
						</Button>
					</fetcher.Form>
				</div>

				<DialogFooter className='flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:justify-between'>
					<Button
						type='button'
						variant='destructive'
						onClick={handleDelete}
						disabled={busy}>
						<Trash2 className='mr-2 size-4' />
						Excluir
					</Button>
					<div className='flex flex-wrap gap-2 sm:justify-end'>
						<Button
							type='button'
							variant='outline'
							onClick={() => handleDialogOpenChange(false)}>
							Fechar
						</Button>
						<Button
							type='submit'
							form={EDIT_FORM_ID}
							disabled={busy}>
							{busy ? "Salvando..." : "Salvar"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
