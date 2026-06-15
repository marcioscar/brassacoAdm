import { Pencil } from "lucide-react";
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
	FieldError,
	FieldGroup,
	FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useFetcher } from "react-router";
import { useEffect, useState } from "react";
import type { ProdutoPreco } from "~/components/columns-produtos-preco";

type ProdutoPrecoSelectionActionsProps = {
	selectedRows: ProdutoPreco[];
	buscaAtual?: string;
	onClearSelection?: () => void;
};

export function ProdutoPrecoSelectionActions({
	selectedRows,
	buscaAtual = "",
	onClearSelection,
}: ProdutoPrecoSelectionActionsProps) {
	const fetcher = useFetcher<{ errors?: Record<string, string[]> }>();
	const busy = fetcher.state !== "idle";
	const produto = selectedRows[0] ?? null;
	const [editOpen, setEditOpen] = useState(false);
	const [codigo, setCodigo] = useState("");
	const [descricao, setDescricao] = useState("");
	const [unidade, setUnidade] = useState("");
	const [complemento, setComplemento] = useState("");
	const [quantidade, setQuantidade] = useState("");

	useEffect(() => {
		if (!produto) return;
		setCodigo(produto.codigo ?? "");
		setDescricao(produto.descricao ?? "");
		setUnidade(produto.unidade ?? "");
		setComplemento(produto.complemento ?? "");
		setQuantidade(produto.quantidade ?? "");
	}, [produto?.id]);

	function abrirEdicao() {
		if (!produto) return;
		setCodigo(produto.codigo ?? "");
		setDescricao(produto.descricao ?? "");
		setUnidade(produto.unidade ?? "");
		setComplemento(produto.complemento ?? "");
		setQuantidade(produto.quantidade ?? "");
		setEditOpen(true);
	}

	function fecharEdicao() {
		setEditOpen(false);
		onClearSelection?.();
	}

	function handleEditOpenChange(proximoAberto: boolean) {
		setEditOpen(proximoAberto);
		if (!proximoAberto) {
			onClearSelection?.();
		}
	}

	if (selectedRows.length === 0) return null;
	if (selectedRows.length > 1) {
		return (
			<span className='text-muted-foreground text-sm'>
				Selecione apenas 1 produto para editar.
			</span>
		);
	}

	return (
		<>
			<div className='flex flex-wrap items-center gap-2'>
				<Button
					variant='outline'
					size='sm'
					onClick={abrirEdicao}
					disabled={busy}
					className='h-8'>
					<Pencil className='mr-1.5 size-4' />
					Editar
				</Button>
			</div>

			<Dialog open={editOpen} onOpenChange={handleEditOpenChange}>
				<DialogContent className='max-w-lg'>
					<DialogHeader>
						<DialogTitle>Editar produto</DialogTitle>
					</DialogHeader>
					{produto && (
						<fetcher.Form
							method='post'
							action='/pedidos'
							onSubmit={() => setEditOpen(false)}
							className='flex flex-col gap-6'>
							<input type='hidden' name='intent' value='edit' />
							<input type='hidden' name='id' value={produto.id} />
							<input type='hidden' name='buscaAtual' value={buscaAtual} />
							<FieldGroup className='grid grid-cols-2 gap-4'>
								<Field>
									<FieldLabel>Código</FieldLabel>
									<Input
										name='codigo'
										value={codigo}
										onChange={(event) => setCodigo(event.target.value)}
										required
										disabled={busy}
									/>
									<FieldError
										errors={fetcher.data?.errors?.codigo?.map((m) => ({
											message: m,
										}))}
									/>
								</Field>
								<Field>
									<FieldLabel>Unidade</FieldLabel>
									<Input
										name='unidade'
										value={unidade}
										onChange={(event) => setUnidade(event.target.value)}
										required
										disabled={busy}
									/>
									<FieldError
										errors={fetcher.data?.errors?.unidade?.map((m) => ({
											message: m,
										}))}
									/>
								</Field>
								<Field className='col-span-2'>
									<FieldLabel>Descrição</FieldLabel>
									<Input
										name='descricao'
										value={descricao}
										onChange={(event) => setDescricao(event.target.value)}
										required
										disabled={busy}
									/>
									<FieldError
										errors={fetcher.data?.errors?.descricao?.map((m) => ({
											message: m,
										}))}
									/>
								</Field>
								<Field>
									<FieldLabel>Complemento</FieldLabel>
									<Input
										name='complemento'
										value={complemento}
										onChange={(event) => setComplemento(event.target.value)}
										disabled={busy}
									/>
									<FieldError
										errors={fetcher.data?.errors?.complemento?.map((m) => ({
											message: m,
										}))}
									/>
								</Field>
								<Field>
									<FieldLabel>Quantidade</FieldLabel>
									<Input
										name='quantidade'
										value={quantidade}
										onChange={(event) => setQuantidade(event.target.value)}
										disabled={busy}
									/>
									<FieldError
										errors={fetcher.data?.errors?.quantidade?.map((m) => ({
											message: m,
										}))}
									/>
								</Field>
								<Field className='col-span-2'>
									<FieldLabel>Preço</FieldLabel>
									<Input
										name='preco'
										type='number'
										step='0.01'
										min='0'
										defaultValue={produto.preco}
										required
										disabled={busy}
									/>
									<FieldError
										errors={fetcher.data?.errors?.preco?.map((m) => ({
											message: m,
										}))}
									/>
								</Field>
							</FieldGroup>
							<DialogFooter>
								<Button
									type='button'
									variant='outline'
									onClick={fecharEdicao}
									disabled={busy}>
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
