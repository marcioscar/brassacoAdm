import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

type Props = { funcionario?: { folhaId: string; nome: string; conta: string } };

/** Cadastro de funcionário (sem `funcionario`) ou edição/exclusão (com). */
export function DialogFuncionario({ funcionario }: Props) {
	const editando = !!funcionario;
	const [open, setOpen] = useState(false);
	const [nome, setNome] = useState(funcionario?.nome ?? "");
	const [conta, setConta] = useState(funcionario?.conta ?? "");
	const fetcher = useFetcher<{ success?: boolean; error?: string }>();
	const ocupado = fetcher.state !== "idle";

	useEffect(() => {
		if (open) {
			setNome(funcionario?.nome ?? "");
			setConta(funcionario?.conta ?? "");
		}
	}, [open, funcionario?.nome, funcionario?.conta]);

	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.success) setOpen(false);
	}, [fetcher.state, fetcher.data]);

	function enviar(e: React.FormEvent) {
		e.preventDefault();
		fetcher.submit(
			{
				intent: editando ? "editarFuncionario" : "novoFuncionario",
				folhaId: funcionario?.folhaId ?? "",
				nome,
				conta,
			},
			{ method: "post" },
		);
	}

	function excluir() {
		if (!funcionario) return;
		fetcher.submit(
			{ intent: "excluirFuncionario", folhaId: funcionario.folhaId },
			{ method: "post" },
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{editando ? (
					<Button
						type='button'
						size='icon-xs'
						variant='ghost'
						aria-label={`Editar ${funcionario.nome}`}>
						<Pencil />
					</Button>
				) : (
					<Button size='sm' variant='outline'>
						<UserPlus className='size-4' />
						Novo funcionário
					</Button>
				)}
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{editando ? "Editar funcionário" : "Cadastrar funcionário"}</DialogTitle>
					<DialogDescription>
						A conta/PIX aparece na folha com botão de copiar.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={enviar} className='space-y-4'>
					<Field>
						<FieldLabel htmlFor='nome-func'>Nome</FieldLabel>
						<Input
							id='nome-func'
							value={nome}
							onChange={(e) => setNome(e.target.value)}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='conta-func'>Conta / PIX</FieldLabel>
						<Input
							id='conta-func'
							value={conta}
							onChange={(e) => setConta(e.target.value)}
							placeholder='CPF, telefone, e-mail ou dados da conta'
							required
						/>
					</Field>
					{fetcher.data?.error && (
						<p className='text-sm text-destructive'>{fetcher.data.error}</p>
					)}
					<DialogFooter className='sm:justify-between'>
						{editando ? (
							<Button type='button' variant='ghost' disabled={ocupado} onClick={excluir}>
								<Trash2 className='size-4' />
								Excluir
							</Button>
						) : (
							<span />
						)}
						<div className='flex gap-2'>
							<Button type='button' variant='outline' onClick={() => setOpen(false)}>
								Cancelar
							</Button>
							<Button type='submit' disabled={ocupado || !nome.trim() || !conta.trim()}>
								{ocupado ? "Salvando..." : "Salvar"}
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
