import type { Route } from "./+types/receitas";
import { getReceitas, createReceita, updateReceita, deleteReceita } from "~/models/receitas.server";
import { DataTable } from "~/components/desp-table";
import { getColumns } from "~/components/columns-rec";
import { ReceitaSelectionActions } from "~/components/receita-selection-actions";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { useFetcher, redirect } from "react-router";
import { useState, useEffect, useRef } from "react";
import { CONTAS, LOJAS } from "~/models/receitas.constants";
import { parseLocalDate } from "~/lib/utils";
import { z } from "zod";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Receitas" }, { name: "description", content: "Receitas" }];
}

const formSchema = z.object({
	conta: z.enum(CONTAS, {
		errorMap: () => ({ message: "Conta é obrigatória" }),
	}),
	loja: z.enum(LOJAS, {
		errorMap: () => ({ message: "Loja é obrigatória" }),
	}),
	valor: z.coerce.number().min(0, "Valor deve ser positivo"),
	descricao: z.string().min(1, "Descrição é obrigatória"),
	data: z.coerce.date(),
});

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "delete") {
		const id = formData.get("id");
		if (typeof id === "string") {
			await deleteReceita(id);
		}
		throw redirect("/receitas");
	}

	if (intent === "edit") {
		const id = formData.get("id");
		if (typeof id !== "string") {
			return Response.json({ error: "ID inválido" }, { status: 400 });
		}
		const editData = {
			conta: String(formData.get("conta") ?? ""),
			loja: String(formData.get("loja") ?? ""),
			valor: Number(formData.get("valor")),
			descricao: String(formData.get("descricao") ?? ""),
			data: formData.get("data")
				? parseLocalDate(String(formData.get("data")))
				: new Date(),
		};
		const validated = formSchema.safeParse(editData);
		if (!validated.success) {
			return Response.json(
				{ errors: validated.error.flatten().fieldErrors },
				{ status: 400 },
			);
		}
		await updateReceita(id, validated.data);
		throw redirect("/receitas");
	}

	// Create (sem intent)
	const data = Object.fromEntries(
		[...formData.entries()].filter(
			([k]: [string, FormDataEntryValue]) => k !== "intent" && k !== "id",
		),
	);
	const validated = formSchema.safeParse(data);
	if (!validated.success) {
		return Response.json(
			{ errors: validated.error.flatten().fieldErrors },
			{ status: 400 },
		);
	}
	await createReceita(validated.data);
	throw redirect("/receitas");
}

export async function loader() {
	const receitas = await getReceitas();
	return { receitas };
}

export default function Receitas({ loaderData }: Route.ComponentProps) {
	const { receitas } = loaderData;
	const fetcher = useFetcher<{ errors?: Record<string, string[]> }>();
	const busy = fetcher.state !== "idle";
	const [conta, setConta] = useState("");
	const [loja, setLoja] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const submittedRef = useRef(false);

	useEffect(() => {
		if (fetcher.state === "idle" && submittedRef.current) {
			submittedRef.current = false;
			if (!fetcher.data?.errors) {
				setDialogOpen(false);
				setConta("");
				setLoja("");
			}
		}
		if (fetcher.state === "submitting") {
			submittedRef.current = true;
		}
	}, [fetcher.state, fetcher.data?.errors]);

	return (
		<div className='container mx-auto'>
			<div className='mb-4 flex items-center justify-between'>
				<h1 className='text-2xl font-bold'>Receitas</h1>
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger asChild>
						<Button variant='secondary'>
							<Plus className='size-4' />
							Nova Receita
						</Button>
					</DialogTrigger>
					<DialogContent className='max-w-lg'>
						<div className='flex flex-col gap-6'>
							<DialogHeader>
								<DialogTitle>Nova Receita</DialogTitle>
							</DialogHeader>
							<fetcher.Form method='post' className='flex flex-col gap-6'>
								<FieldGroup className='grid grid-cols-2 gap-4'>
									<Field>
										<FieldLabel htmlFor='conta'>Conta</FieldLabel>
										<Select
											value={conta}
											onValueChange={setConta}
											disabled={busy}>
											<SelectTrigger id='conta' className='w-full'>
												<SelectValue placeholder='Selecione a conta' />
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
										<FieldError
											errors={fetcher.data?.errors?.conta?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='loja'>Loja</FieldLabel>
										<Select value={loja} onValueChange={setLoja} disabled={busy}>
											<SelectTrigger id='loja' className='w-full'>
												<SelectValue placeholder='Selecione a loja' />
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
										<FieldError
											errors={fetcher.data?.errors?.loja?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='data'>Data</FieldLabel>
										<Input
											id='data'
											name='data'
											type='date'
											defaultValue={new Date().toISOString().split("T")[0]}
											required
											disabled={busy}
										/>
										<FieldError
											errors={fetcher.data?.errors?.data?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field>
										<FieldLabel htmlFor='valor'>Valor</FieldLabel>
										<Input
											id='valor'
											name='valor'
											type='number'
											step='0.01'
											min='0'
											placeholder='0,00'
											required
											disabled={busy}
										/>
										<FieldError
											errors={fetcher.data?.errors?.valor?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field className='col-span-2'>
										<FieldLabel htmlFor='descricao'>Descrição</FieldLabel>
										<Input
											id='descricao'
											name='descricao'
											placeholder='Descrição da receita'
											required
											disabled={busy}
										/>
										<FieldError
											errors={fetcher.data?.errors?.descricao?.map((m) => ({
												message: m,
											}))}
										/>
									</Field>
									<Field className='col-span-2'>
										<DialogFooter className='sm:justify-end'>
											<DialogClose asChild>
												<Button type='button' variant='outline' disabled={busy}>
													Cancelar
												</Button>
											</DialogClose>
											<Button type='submit' disabled={busy}>
												{busy ? "Salvando..." : "Salvar"}
											</Button>
										</DialogFooter>
									</Field>
								</FieldGroup>
							</fetcher.Form>
						</div>
					</DialogContent>
				</Dialog>
			</div>
			<DataTable
				columns={getColumns({ variant: "receitas", enableSelection: true })}
				data={receitas}
				enableRowSelection
				getRowId={(row) => row.id}
				selectionActions={(selected) => (
					<ReceitaSelectionActions
						selectedRows={selected}
					/>
				)}
				filterColumn='descricao'
				filterPlaceholder='Filtrar por descrição...'
			/>
		</div>
	);
}
